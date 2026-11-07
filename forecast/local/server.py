"""기상청 중기예보 · Python 3.10+ / 외부 패키지 불필요.

KEY.env는 데이터로만 읽습니다. 이 서버는 단일 중앙 API 게이트웨이입니다.
"""
from __future__ import annotations
import argparse
import datetime as dt
import http.server
import json
import math
import os
from pathlib import Path
import re
import socket
import sqlite3
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import sys
# chat.py에서도 같은 설정·캐시 함수를 사용합니다. __main__ 중복 모듈 생성을 방지합니다.
if __name__=='__main__': sys.modules['server']=sys.modules[__name__]

ROOT = Path(__file__).resolve().parent
KST = dt.timezone(dt.timedelta(hours=9))
BASE_URL = 'https://apis.data.go.kr/1360000/MidFcstInfoService/'
FUNCTIONS = {'outlook':'getMidFcst', 'land':'getMidLandFcst',
             'temperature':'getMidTa', 'sea':'getMidSeaFcst'}
REGIONS = json.loads((ROOT/'regions.json').read_text(encoding='utf-8'))
KEY_FILE = ROOT/'KEY.env'
INTERVAL = 30
LIMIT = 9000
WARNING = 8000

class AppError(Exception):
    def __init__(self, kind, message, retry=60):
        self.kind, self.message, self.retry = kind, message, retry
        super().__init__(message)
    def public(self):
        return dict(kind=self.kind, message=self.message, retryAfter=self.retry)

def read_env(path):
    """셸 실행 없이 UTF-8/BOM 파일의 NAME=value만 읽습니다."""
    result = {}
    try:
        text = path.read_text(encoding='utf-8-sig')
    except FileNotFoundError:
        return result
    except (UnicodeError, OSError):
        raise AppError('CONFIG_FILE', 'KEY.env를 UTF-8로 저장하고 읽기 권한을 확인하세요.')
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, value = line.split('=', 1)
        value = value.strip()
        if value[:1] in ('"', "'") and value[-1:] == value[:1]:
            value = value[1:-1]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].rstrip()
        result[name.strip()] = value
    return result

def key_configuration(root=ROOT, environ=None):
    env = os.environ if environ is None else environ
    path = root/'KEY.env'
    note = None
    # 이전 .env는 실행 환경으로 로딩하지 않습니다. 실제 키가 있으면 한 번만 안전하게 이전합니다.
    try:
        legacy = read_env(root/'.env').get('KMA_SERVICE_KEY')
        if legacy and not is_placeholder(legacy):
            if not path.exists():
                with path.open('x', encoding='utf-8', newline='\n') as f:
                    f.write('KMA_SERVICE_KEY='+legacy+'\n')
                note = '기존 .env의 설정을 KEY.env로 이전했습니다. .env는 로딩하지 않습니다.'
            elif read_env(path).get('KMA_SERVICE_KEY') != legacy:
                note = '기존 .env와 KEY.env의 설정이 다릅니다. KEY.env를 유지하며 .env는 로딩하지 않습니다.'
    except FileExistsError:
        note = 'KEY.env가 이미 있어 덮어쓰지 않았습니다.'
    except AppError:
        note = '기존 .env를 읽지 못했습니다. 자동 로딩하지 않습니다.'
    except OSError:
        note = '기존 설정 이전에 실패했습니다. KEY.env를 직접 설정하세요.'
    source = '운영체제 환경변수' if 'KMA_SERVICE_KEY' in env else 'KEY.env'
    try:
        value = env['KMA_SERVICE_KEY'] if 'KMA_SERVICE_KEY' in env else read_env(path).get('KMA_SERVICE_KEY')
    except AppError as e:
        return '', dict(state='file_error', source=source, message=e.message, note=note)
    state = 'missing' if value is None else 'empty' if not value.strip() else 'placeholder' if is_placeholder(value) else 'configured'
    return (value or '').strip(), dict(state=state, source=source, note=note)

def is_placeholder(value):
    v = value.strip().upper()
    return v in {'YOUR_API_KEY','YOUR_API_KEY_HERE','API_KEY','발급받은_실제_인증키','인증키','발급받은_인증키'} or v.startswith('YOUR_')

def normalize_key(value):
    # unquote_plus는 +를 공백으로 바꾸므로 사용하지 않습니다.
    return urllib.parse.unquote(value) if re.search(r'%[0-9a-fA-F]{2}', value) else value

def scrub(value, secret):
    """제공기관이 키를 반사하더라도 응답·캐시에 남기지 않습니다."""
    if isinstance(value, dict):
        return {k:scrub(v,secret) for k,v in value.items() if str(k).lower() not in {'servicekey','authkey','kma_service_key'}}
    if isinstance(value, list): return [scrub(v,secret) for v in value]
    if isinstance(value, str) and secret:
        for token in {secret, normalize_key(secret), urllib.parse.quote(normalize_key(secret),safe=''), urllib.parse.quote_plus(normalize_key(secret))}:
            if token: value=value.replace(token,'[비공개]')
        value=re.sub(r'(?i)(serviceKey|authKey)\s*[=:]\s*[^\s&<>"\']+',r'\1=[비공개]',value)
    return value

def stamp(ts=None):
    return dt.datetime.fromtimestamp(time.time() if ts is None else ts, KST).isoformat(timespec='seconds')

def publications(now=None):
    now = now or dt.datetime.now(KST)
    choices=[]
    for back in range(2):
        day=now.date()-dt.timedelta(days=back)
        for hour in (6,18):
            at=dt.datetime.combine(day,dt.time(hour),KST)
            if 0 <= (now-at).total_seconds() < 86400:
                choices.append(at.strftime('%Y%m%d%H%M'))
    return sorted(choices,reverse=True)

def number(value):
    if value is None or isinstance(value,bool) or isinstance(value,str) and not value.strip(): return None
    try:
        n=float(value)
        return n if math.isfinite(n) else None
    except (TypeError,ValueError): return None

def text(value):
    return value.strip() if isinstance(value,str) and value.strip() else None

def transform(page, item, issue):
    base=dt.datetime.strptime(issue,'%Y%m%d%H%M').date()
    if page=='outlook': return []
    rows=[]
    for day in range(4,11):
        periods=('',) if page=='temperature' or day>=8 else ('Am','Pm')
        for part in periods:
            # 18시 발표의 4일 후는 명세상 제공되지 않음. 실제 값이 오면 별도 경고와 원문 유지.
            if issue[8:10]=='18' and day==4: continue
            when=(base+dt.timedelta(days=day)).isoformat()
            row=dict(date=when, day=day, period={'Am':'오전','Pm':'오후','':'하루'}[part])
            if page=='temperature':
                row.update(min=number(item.get(f'taMin{day}')),max=number(item.get(f'taMax{day}')))
            elif page=='land':
                rain=number(item.get(f'rnSt{day}{part}'))
                row.update(weather=text(item.get(f'wf{day}{part}')),rain=rain if rain is None or 0<=rain<=100 else None)
            else:
                row.update(weather=text(item.get(f'wf{day}{part}')),
                           min=number(item.get(f'wh{day}A{part}')),max=number(item.get(f'wh{day}B{part}')))
            rows.append(row)
    return rows

def parse_payload(raw):
    """HTTP가 200이어도 resultCode가 오류일 수 있습니다. 원문 오류는 출력하지 않습니다."""
    try:
        obj=json.loads(raw)
    except (ValueError,UnicodeError):
        try:
            xml=ET.fromstring(raw)
            tags={el.tag.split('}')[-1]:(el.text or '').strip() for el in xml.iter()}
            code=tags.get('returnReasonCode') or tags.get('resultCode')
            if code: raise code_error(code)
        except ET.ParseError: pass
        raise AppError('FORMAT','제공기관 응답이 정상 JSON 형식이 아닙니다.',120)
    if not isinstance(obj,dict): raise AppError('FORMAT','제공기관 응답 구조를 확인할 수 없습니다.',120)
    service_error=obj.get('OpenAPI_ServiceResponse',{}).get('cmmMsgHeader',{}) if isinstance(obj.get('OpenAPI_ServiceResponse'),dict) else {}
    if isinstance(service_error,dict) and service_error.get('returnReasonCode') is not None:
        raise code_error(service_error['returnReasonCode'])
    response=obj.get('response',{})
    if not isinstance(response,dict): raise AppError('FORMAT','제공기관 응답 구조를 확인할 수 없습니다.',120)
    header=response.get('header',{})
    if not isinstance(header,dict): raise AppError('FORMAT','응답 상태 항목이 없습니다.',120)
    if str(header.get('resultCode')) not in ('00','0'): raise code_error(str(header.get('resultCode')))
    body=response.get('body',{})
    if not isinstance(body,dict): raise AppError('FORMAT','응답 본문 구조가 다릅니다.',120)
    container=body.get('items') or {}
    items=container.get('item') if isinstance(container,dict) else None
    if isinstance(items,dict): items=[items]
    if not isinstance(items,list) or not items: raise AppError('NO_DATA','해당 발표본의 데이터가 없습니다.',120)
    if not all(isinstance(x,dict) for x in items): raise AppError('FORMAT','예보 항목 구조가 다릅니다.',120)
    return obj,body,items

def code_error(code):
    code=str(code).zfill(2)
    if code=='03': return AppError('NO_DATA','해당 발표본에 데이터가 없습니다.',120)
    if code=='22': return AppError('PROVIDER_LIMIT','제공기관 호출 제한입니다. 외부 호출을 24시간 중지합니다.',86400)
    if code in {'20','21','30','31','32','33'}:
        return AppError('AUTH','API 인증 또는 접근 권한 오류입니다. 키와 중기예보 활용신청 상태를 포털에서 확인하세요.',900)
    if code in {'10','11','12'}: return AppError('REQUEST','제공기관이 요청 조건 또는 서비스 오류를 반환했습니다.',300)
    return AppError('PROVIDER','제공기관 내부 오류 또는 알 수 없는 응답 상태입니다.',120)

def external_request(page, code, issue, key):
    params=dict(serviceKey=normalize_key(key),dataType='JSON',numOfRows=10,pageNo=1,tmFc=issue)
    params['stnId' if page=='outlook' else 'regId']=code
    url=BASE_URL+FUNCTIONS[page]+'?'+urllib.parse.urlencode(params)
    # 리디렉션으로 HTTPS가 HTTP로 내려가거나 키가 다른 호스트로 전달되지 않게 금지합니다.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs): return None
    opener=urllib.request.build_opener(NoRedirect,urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    try:
        with opener.open(urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'KMA-Mid-Learning/1.0'}),timeout=15) as r:
            raw=r.read(2_000_001)
            if len(raw)>2_000_000: raise AppError('FORMAT','제공기관 응답 크기가 예상보다 큽니다.',300)
    except urllib.error.HTTPError as e:
        try:
            raw=e.read(65536)
            parse_payload(raw)
        except AppError as known:
            if known.kind not in {'FORMAT','NO_DATA'}: raise known from None
        if e.code in (401,403): raise AppError('AUTH','API 인증 또는 접근 권한을 확인하세요. HTTP 인증 오류입니다.',900) from None
        if e.code==429: raise code_error('22') from None
        raise AppError('HTTP','제공기관 HTTP 오류입니다. 잠시 후 다시 확인합니다.',120) from None
    except (urllib.error.URLError,TimeoutError,OSError):
        raise AppError('NETWORK','제공기관 연결에 실패했습니다. 인터넷·방화벽·제공기관 상태를 확인하세요.',120) from None
    return scrub(parse_payload(raw)[0],key)

class Store:
    def __init__(self,path):
        self.db=sqlite3.connect(path,check_same_thread=False)
        self.db.row_factory=sqlite3.Row
        self.lock=threading.RLock()
        self.db.executescript('''PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS calls(at REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS calls_at ON calls(at);
        CREATE TABLE IF NOT EXISTS cache(k TEXT PRIMARY KEY,page TEXT,code TEXT,issue TEXT,payload TEXT,success REAL);
        CREATE TABLE IF NOT EXISTS errors(k TEXT PRIMARY KEY,kind TEXT,message TEXT,until_at REAL,attempt INTEGER);
        CREATE TABLE IF NOT EXISTS state(k TEXT PRIMARY KEY,v REAL);
        ''')
    def state(self,key):
        row=self.db.execute('SELECT v FROM state WHERE k=?',(key,)).fetchone()
        return row[0] if row else 0
    def set_state(self,key,value):
        self.db.execute('INSERT OR REPLACE INTO state VALUES (?,?)',(key,value))
    def stats(self,now=None):
        now=time.time() if now is None else now
        with self.lock:
            count=self.db.execute('SELECT count(*) FROM calls WHERE at>?',(now-86400,)).fetchone()[0]
            return dict(calls24h=count,warning=count>=WARNING,limit=LIMIT,warningAt=WARNING,
                        nextExternalIn=max(0,math.ceil(self.state('last_call')+INTERVAL-now)),
                        stoppedUntil=stamp(self.state('blocked')) if self.state('blocked')>now else None,
                        basis='최근 24시간 · 네 기능 합산 · 단일 중앙 서버')
    def reserve(self,now):
        with self.lock:
            if self.state('blocked')>now: raise AppError('PROVIDER_LIMIT','제공기관 호출 제한으로 외부 호출이 중지되어 있습니다.',math.ceil(self.state('blocked')-now))
            if self.stats(now)['calls24h']>=LIMIT: raise AppError('APP_LIMIT','앱의 최근 24시간 호출 상한 9,000회에 도달했습니다.',300)
            remaining=self.state('last_call')+INTERVAL-now
            if remaining>0: raise AppError('THROTTLED','전체 기능의 외부 호출 간격을 지키며 대기 중입니다.',math.ceil(remaining))
            self.db.execute('INSERT INTO calls VALUES (?)',(now,))
            self.set_state('last_call',now)
            self.db.commit()
    def close(self): self.db.close()

class Gateway:
    def __init__(self,store,key,config,transport=external_request,clock=time.time):
        self.store,self.key,self.config,self.transport,self.clock=store,key,config,transport,clock
        self.lock=threading.RLock()
        self.inflight={}
        self.external_busy=False
    @staticmethod
    def cache_key(page,code,issue):
        return f'{FUNCTIONS[page]}|{code}|{issue}|1|10|JSON'
    def fetch_one(self,page,code,issue):
        k=self.cache_key(page,code,issue)
        with self.lock,self.store.lock:
            cached=self.store.db.execute('SELECT * FROM cache WHERE k=?',(k,)).fetchone()
            if cached: return json.loads(cached['payload']),cached['success'],True
            error=self.store.db.execute('SELECT * FROM errors WHERE k=?',(k,)).fetchone()
            now=self.clock()
            if error and error['until_at']>now:
                raise AppError(error['kind'],error['message'],math.ceil(error['until_at']-now))
            existing=self.inflight.get(k)
            if not existing:
                if self.external_busy: raise AppError('THROTTLED','다른 외부 API 요청이 진행 중입니다.',30)
                self.store.reserve(now)
                existing=threading.Event()
                self.inflight[k]=existing
                self.external_busy=True
                owner=True
            else: owner=False
        if not owner:
            if not existing.wait(20): raise AppError('THROTTLED','동일 조건의 요청 처리 중입니다.',30)
            return self.fetch_one(page,code,issue)
        try:
            payload=self.transport(page,code,issue,self.key)
            payload=scrub(payload,self.key)
            parse_payload(json.dumps(payload,ensure_ascii=False))
            success=self.clock()
            with self.store.lock:
                self.store.db.execute('INSERT OR REPLACE INTO cache VALUES (?,?,?,?,?,?)',(k,page,code,issue,json.dumps(payload,ensure_ascii=False),success))
                self.store.db.execute('DELETE FROM errors WHERE k=?',(k,))
                self.store.db.commit()
            return payload,success,False
        except AppError as e:
            with self.store.lock:
                old=self.store.db.execute('SELECT attempt FROM errors WHERE k=?',(k,)).fetchone()
                attempt=(old[0] if old else 0)+1
                delay=min(1800,max(e.retry,60)*2**min(attempt-1,5))
                if e.kind=='PROVIDER_LIMIT':
                    delay=86400
                    self.store.set_state('blocked',self.clock()+86400)
                if e.kind in {'NETWORK','HTTP','PROVIDER','AUTH','FORMAT','REQUEST'}:
                    self.store.set_state('last_call',max(self.store.state('last_call'),self.clock()+delay-INTERVAL))
                self.store.db.execute('INSERT OR REPLACE INTO errors VALUES (?,?,?,?,?)',(k,e.kind,e.message,self.clock()+delay,attempt))
                self.store.db.commit()
                e.retry=delay
            raise
        finally:
            with self.lock:
                self.external_busy=False
                self.inflight.pop(k,None)
                existing.set()
    def forecast(self,page,code,requested='auto'):
        now=self.clock()
        choices=publications(dt.datetime.fromtimestamp(now,KST))
        if page not in FUNCTIONS or code not in {r['code'] for r in REGIONS.get(page,[])}:
            raise AppError('INPUT','해당 기능의 공식 지역코드를 선택하세요.',30)
        if requested!='auto' and requested not in choices:
            raise AppError('INPUT','최근 24시간 이내의 06시·18시 발표본을 선택하세요.',30)
        choices=choices if requested=='auto' else [requested]
        if self.config['state']!='configured':
            return self.fallback(page,code,requested,choices,AppError('KEY_'+self.config['state'].upper(),'KEY.env에 KMA_SERVICE_KEY를 설정한 뒤 서버를 재시작하세요.',30))
        failure=None
        for issue in choices:
            try:
                payload,success,cached=self.fetch_one(page,code,issue)
                return self.result(page,code,requested,issue,payload,success,cached,failure or (AppError('PREVIOUS_ISSUE','최신 후보에 자료가 없어 이전 유효 발표본을 표시합니다.',120) if issue!=choices[0] else None))
            except AppError as e:
                failure=e
                if e.kind!='NO_DATA': break
        return self.fallback(page,code,requested,choices,failure)
    def fallback(self,page,code,requested,choices,error):
        with self.store.lock:
            if requested=='auto':
                old=self.store.db.execute('SELECT * FROM cache WHERE page=? AND code=? ORDER BY issue DESC LIMIT 1',(page,code)).fetchone()
            else:
                old=self.store.db.execute('SELECT * FROM cache WHERE k=?',(self.cache_key(page,code,requested),)).fetchone()
        if old:
            return self.result(page,code,requested,old['issue'],json.loads(old['payload']),old['success'],True,error)
        return dict(ok=False,error=error.public(),checkedAt=stamp(self.clock()),quota=self.store.stats(self.clock()))
    def result(self,page,code,requested,issue,payload,success,cached,error=None):
        _,body,items=parse_payload(json.dumps(payload,ensure_ascii=False))
        # 요청한 한 구역만 표시합니다. 응답이 여러 개이거나 코드가 다르면 경고합니다.
        field='stnId' if page=='outlook' else 'regId'
        matched=[i for i in items if str(i.get(field,i.get('regid','')))==code]
        item=matched[0] if matched else items[0]
        actual=item.get(field,item.get('regid'))
        comparison='비교 불가 · 응답에 코드 없음' if actual is None else '일치' if str(actual)==code else '불일치'
        warnings=[]
        if actual is not None and str(actual)!=code: warnings.append('요청 코드와 응답 코드가 다릅니다. 지역을 확인하세요.')
        if len(items)>1: warnings.append('여러 항목이 반환되어 요청 코드와 일치하는 항목을 우선 표시했습니다. 원문을 확인하세요.')
        if issue[8:10]=='18' and any(re.match(r'(taMin|taMax|wf|rnSt|wh)4',k) for k in item):
            warnings.append('18시 발표에 명세상 제공되지 않는 4일 후 필드가 있습니다. 원문을 확인하세요.')
        if any(re.match(r'ta(?:Min|Max)\d+Min$',k) for k in item): warnings.append('가이드 명세와 다른 Min 범위 필드가 있습니다. Low로 자동 변경하지 않습니다.')
        rows=transform(page,item,issue)
        if page=='outlook' and not text(item.get('wfSv')): warnings.append('기상전망 본문이 미제공입니다.')
        missing=sum(1 for row in rows for k,v in row.items() if k not in {'date','day','period'} and v is None)
        return dict(ok=True,page=page,code=code,requestedTmFc=requested,usedTmFc=issue,
                    publicationSource='요청에 사용한 발표시각 · 응답이 반환한 발표시각 아님',
                    source='서버 캐시' if cached else '실제 API 응답',stale=bool(error),
                    error=error.public() if error else None,checkedAt=stamp(self.clock()),lastSuccessAt=stamp(success),
                    responseCode=actual,codeComparison=comparison,rows=rows,outlook=text(item.get('wfSv')),
                    totalCount=body.get('totalCount'),itemCount=len(items),missingCount=missing,
                    warnings=warnings,raw=payload,quota=self.store.stats(self.clock()))

class RuntimeLock:
    """다른 포트로 중복 실행해 호출량을 우회하지 못하도록 프로젝트당 서버 하나만 허용."""
    def __init__(self,path): self.file=path.open('a+b')
    def acquire(self):
        self.file.seek(0)
        if os.name=='nt':
            import msvcrt
            if self.file.read(1)==b'': self.file.write(b'0'); self.file.flush()
            self.file.seek(0)
            msvcrt.locking(self.file.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(self.file,fcntl.LOCK_EX|fcntl.LOCK_NB)
    def close(self): self.file.close()

class Handler(http.server.BaseHTTPRequestHandler):
    server_version='KMA-Mid/1.0'
    def log_message(self,fmt,*args):
        # 쿼리 문자열과 외부 URL·오류 원문을 로그에 남기지 않습니다.
        print(f'[{stamp()}] {self.command} {urllib.parse.urlsplit(self.path).path}',flush=True)
    def send_data(self,status,data,content_type='application/json; charset=utf-8'):
        if not isinstance(data,bytes): data=json.dumps(data,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        try:self.wfile.write(data)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
    def do_GET(self):
        # 로컬용: 외부 Host 헤더를 거절해 DNS rebinding을 방어합니다.
        host=self.headers.get('Host','').split(':')[0]
        if host not in {'127.0.0.1','localhost'}:
            return self.send_data(403,dict(error='로컬 접속만 허용합니다.'))
        parsed=urllib.parse.urlsplit(self.path)
        path=parsed.path
        try:
            if path=='/api/status':
                return self.send_data(200,dict(ready=True,config=self.server.config,keyPath=str(KEY_FILE),regions=REGIONS,
                    publications=publications(),quota=self.server.gateway.store.stats(),url=f'http://127.0.0.1:{self.server.server_port}/outlook',
                    notice='하루 두 번 발표 · 최근 24시간 자료 · 30초는 새 자료 확인 주기'))
            if path=='/api/chat/status': return self.send_data(200,self.server.chat.status())
            if path=='/api/forecast':
                args=urllib.parse.parse_qs(parsed.query)
                value=lambda k,d='':args.get(k,[d])[0]
                return self.send_data(200,self.server.gateway.forecast(value('page'),value('code'),value('issue','auto')))
            if path=='/api/demo':
                from fixtures import fixture
                args=urllib.parse.parse_qs(parsed.query)
                value=lambda k,d='':args.get(k,[d])[0]
                page,code,issue=value('page'),value('code'),value('issue','auto')
                choices=publications()
                if page not in FUNCTIONS or code not in {r['code'] for r in REGIONS.get(page,[])} or issue!='auto' and issue not in choices:
                    raise AppError('INPUT','공식 지역과 최근 발표본을 선택하세요.')
                actual=choices[0] if issue=='auto' else issue
                result=self.server.gateway.result(page,code,issue,actual,fixture(page,code,actual),time.time(),False)
                result.update(demo=True,source='모의 응답 · 실제 예보 아님')
                return self.send_data(200,result)
            routes={'/':'index.html','/outlook':'index.html','/land':'index.html','/temperature':'index.html','/sea':'index.html',
                    '/static/app.js':'app.js','/static/chat.js':'chat.js','/static/style.css':'style.css'}
            if path in routes:
                suffix=Path(routes[path]).suffix
                typ={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[suffix]
                return self.send_data(200,(ROOT/'static'/routes[path]).read_bytes(),typ)
            self.send_data(404,dict(error='페이지를 찾을 수 없습니다.'))
        except AppError as e:self.send_data(400,dict(ok=False,error=e.public()))
        except Exception:
            # 예외 문자열은 키/외부 URL을 포함할 수 있으므로 노출하지 않습니다.
            self.send_data(500,dict(ok=False,error=dict(kind='SERVER',message='서버 처리 오류입니다. 프로젝트 파일과 실행 환경을 확인하세요.',retryAfter=120)))

    def do_POST(self):
        # 같은 로컬 출처의 JSON 요청만 허용. CORS 허용 헤더는 제공하지 않습니다.
        host=self.headers.get('Host','')
        expected={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        if host not in expected or self.headers.get('Origin')!='http://'+host or self.headers.get('Sec-Fetch-Site') in {'cross-site','none'}:
            return self.send_data(403,dict(ok=False,error=dict(kind='CHAT_ORIGIN',message='같은 로컬 사이트에서만 챗봇을 사용할 수 있습니다.')))
        if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json' or self.headers.get('Transfer-Encoding'):
            return self.send_data(415,dict(ok=False,error=dict(kind='CHAT_INPUT',message='JSON 요청만 허용합니다.')))
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=32768: raise AppError('CHAT_INPUT','요청 크기는 32KB 이하여야 합니다.',0)
            self.connection.settimeout(10)
            body=json.loads(self.rfile.read(size));path=urllib.parse.urlsplit(self.path).path
            from chat import check_fields
            if path=='/api/chat/session':
                check_fields(body,set());result=self.server.chat.session()
            elif path=='/api/chat/clear':
                check_fields(body,{'sessionId'});result=self.server.chat.clear(body['sessionId'])
            elif path=='/api/chat':result=self.server.chat.ask(body)
            elif path=='/api/chat/ack':result=self.server.chat.acknowledge(body)
            else:return self.send_data(404,dict(ok=False,error=dict(kind='NOT_FOUND',message='허용되지 않은 요청입니다.')))
            self.send_data(200,result)
        except AppError as e:self.send_data(400,dict(ok=False,error=e.public()))
        except (ValueError,UnicodeError):self.send_data(400,dict(ok=False,error=dict(kind='CHAT_INPUT',message='JSON 형식을 확인하세요.')))
        except Exception:self.send_data(500,dict(ok=False,error=dict(kind='CHAT_SERVER',message='챗봇 처리 오류입니다. 예보 화면은 계속 이용할 수 있습니다.')))

def main():
    parser=argparse.ArgumentParser(description='기상청 중기예보 로컬 서버')
    parser.add_argument('--port',type=int,default=8080)
    args=parser.parse_args()
    runtime=ROOT/'.runtime';runtime.mkdir(exist_ok=True)
    # 포트 검사와 실제 bind 모두 확인. 기존 프로세스는 종료하지 않음.
    probe=socket.socket()
    try:probe.bind(('127.0.0.1',args.port))
    except OSError:
        print(f'실행 실패: 127.0.0.1:{args.port} 포트가 사용 중이거나 바인딩할 수 없습니다. 다른 프로세스를 종료하지 않았습니다.',flush=True)
        return 1
    finally:probe.close()
    lock=RuntimeLock(runtime/'server.lock')
    try:lock.acquire()
    except OSError:
        print('실행 실패: 이 프로젝트의 중앙 API 서버가 이미 실행 중입니다. 기존 터미널을 확인하세요.',flush=True)
        lock.close();return 1
    key,config=key_configuration()
    store=Store(runtime/'gateway.sqlite3')
    try:
        server=http.server.ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
        server.daemon_threads=True
        server.config=config
        server.gateway=Gateway(store,key,config)
        from chat import ChatService,configuration
        server.chat=ChatService(server.gateway,configuration())
        print(f'서버 준비 완료: http://127.0.0.1:{args.port}/outlook',flush=True)
        print(f'키 설정 상태: {config["state"]} / 설정 파일: {KEY_FILE}',flush=True)
        print(f'Gemini 설정 상태: {server.chat.config["state"]} · 모델: {server.chat.config["model"]}',flush=True)
        if config.get('note'):print(config['note'],flush=True)
        print('터미널을 열어 두세요. Ctrl+C로 종료합니다. KEY.env 변경 후 재시작하세요.',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:print('\nCtrl+C: 서버를 종료합니다.',flush=True)
        finally:server.server_close()
    except OSError:
        print('서버 시작 실패: 포트 사용 상태와 프로젝트 파일 접근 권한을 확인하세요.',flush=True)
        return 1
    finally:
        # 실행 중인 daemon 요청이 있을 수 있으므로 프로세스 종료 시 DB를 닫도록 맡김.
        lock.close()
    return 0

if __name__=='__main__': raise SystemExit(main())
