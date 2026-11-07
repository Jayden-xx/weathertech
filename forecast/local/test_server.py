"""외부 API를 호출하지 않는 자동 검사. Python -m unittest -v test_server"""
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.parse
import server as s
from fixtures import fixture,payload

class ConfigTests(unittest.TestCase):
    def test_bom_comments_quotes_and_plus(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'KEY.env').write_text('\ufeff# comment\n\nKMA_SERVICE_KEY="fixture+ABC/="\n',encoding='utf-8')
            value,c=s.key_configuration(p,{})
            self.assertEqual(value,'fixture+ABC/=');self.assertEqual(c['state'],'configured')
            self.assertEqual(s.read_env(p/'KEY.env')['KMA_SERVICE_KEY'],'fixture+ABC/=')
    def test_missing_empty_placeholder(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)
            self.assertEqual(s.key_configuration(p,{})[1]['state'],'missing')
            for value,state in [('', 'empty'),('YOUR_API_KEY','placeholder'),('발급받은_실제_인증키','placeholder')]:
                (p/'KEY.env').write_text('KMA_SERVICE_KEY='+value,encoding='utf-8')
                self.assertEqual(s.key_configuration(p,{})[1]['state'],state)
    def test_environment_wins_even_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'KEY.env').write_text('KMA_SERVICE_KEY=file-fixture',encoding='utf-8')
            self.assertEqual(s.key_configuration(p,{'KMA_SERVICE_KEY':'os-fixture'})[0],'os-fixture')
            self.assertEqual(s.key_configuration(p,{'KMA_SERVICE_KEY':''})[1]['state'],'empty')
    def test_legacy_migration_and_conflict(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'.env').write_text('KMA_SERVICE_KEY=legacy-fixture',encoding='utf-8')
            self.assertEqual(s.key_configuration(p,{})[0],'legacy-fixture')
            (p/'.env').write_text('KMA_SERVICE_KEY=other-fixture',encoding='utf-8')
            self.assertEqual(s.key_configuration(p,{})[0],'legacy-fixture')
            self.assertIn('다릅니다',s.key_configuration(p,{})[1]['note'])
    def test_file_is_never_executed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'KEY.env').write_text('print("executed")\nKMA_SERVICE_KEY=YOUR_API_KEY\n',encoding='utf-8')
            self.assertEqual(s.key_configuration(p,{})[1]['state'],'placeholder')
    def test_key_encoding_once(self):
        for v in ['fixture+ABC/=', 'fixture%2BABC%2F%3D']:
            q=urllib.parse.urlencode({'serviceKey':s.normalize_key(v)})
            self.assertEqual(q,'serviceKey=fixture%2BABC%2F%3D')
    def test_secret_redaction(self):
        clean=s.scrub({'serviceKey':'fixture+ABC/=', 'message':'fixture%2BABC%2F%3D fixture+ABC/='},'fixture+ABC/=')
        self.assertNotIn('fixture',json.dumps(clean))
        self.assertNotIn('serviceKey',clean)

class DataTests(unittest.TestCase):
    def test_array_single_empty(self):
        p=fixture('temperature','11B10101','202611070600')
        self.assertEqual(len(s.parse_payload(json.dumps(p))[2]),1)
        p['response']['body']['items']['item']=p['response']['body']['items']['item'][0]
        self.assertEqual(len(s.parse_payload(json.dumps(p))[2]),1)
        for container in [None,{}, {'item':[]}, {'item':''}]:
            p['response']['body']['items']=container
            with self.assertRaises(s.AppError) as e:s.parse_payload(json.dumps(p))
            self.assertEqual(e.exception.kind,'NO_DATA')
    def test_json_xml_provider_errors(self):
        for raw in [b'<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>',json.dumps({'OpenAPI_ServiceResponse':{'cmmMsgHeader':{'returnReasonCode':'22'}}})]:
            with self.assertRaises(s.AppError) as e:s.parse_payload(raw)
            self.assertEqual(e.exception.kind,'PROVIDER_LIMIT')
        with self.assertRaises(s.AppError):s.parse_payload('<html>bad gateway</html>')
    def test_missing_is_not_zero(self):
        for v in [None,'','  ','-','NaN',True]:self.assertIsNone(s.number(v))
        for v in [0,'0']:self.assertEqual(s.number(v),0)
        rows=s.transform('temperature',{'taMin4':0,'taMax4':''},'202611070600')
        self.assertEqual(rows[0]['min'],0);self.assertIsNone(rows[0]['max'])
    def test_dates_06_18_and_year_rollover(self):
        for page,count6,count18 in [('land',11,9),('temperature',7,6),('sea',11,9)]:
            for issue,count in [('202612290600',count6),('202612291800',count18)]:
                obj=fixture(page,s.REGIONS[page][0]['code'],issue)
                rows=s.transform(page,obj['response']['body']['items']['item'][0],issue)
                self.assertEqual(len(rows),count)
                self.assertEqual(rows[0]['date'],'2027-01-02' if issue.endswith('0600') else '2027-01-03')
                if page!='temperature':self.assertEqual(sum(r['period']=='하루' for r in rows),3)
    def test_land_pair_and_sea_mapping(self):
        land=s.transform('land',{'wf5Am':'맑음','rnSt5Am':0},'202611070600')
        row=next(r for r in land if r['day']==5 and r['period']=='오전')
        self.assertEqual((row['weather'],row['rain']),('맑음',0))
        sea=s.transform('sea',{'wh4AAm':0,'wh4BAm':2,'wh4APm':1,'wh4BPm':3,'wh8A':2,'wh8B':4},'202611070600')
        self.assertEqual((sea[0]['min'],sea[0]['max']),(0,2));self.assertEqual((sea[1]['min'],sea[1]['max']),(1,3))
        self.assertEqual((sea[-3]['min'],sea[-3]['max']),(2,4))
    def test_publications_only_recent24h(self):
        now=dt.datetime(2026,11,7,6,0,tzinfo=s.KST)
        self.assertEqual(s.publications(now),['202611070600','202611061800'])
        self.assertEqual(s.publications(now-dt.timedelta(seconds=1)),['202611061800','202611060600'])
    def test_regions_separated_from_excel(self):
        self.assertEqual(len(s.REGIONS['temperature']),203)
        self.assertIn('11B10101',{r['code'] for r in s.REGIONS['temperature']})
        self.assertNotIn('11B00000',{r['code'] for r in s.REGIONS['temperature']})

class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'state.db'
        self.store=s.Store(self.path);self.now=dt.datetime(2026,11,7,15,tzinfo=s.KST).timestamp()
        self.count=0
        def transport(page,code,issue,key):
            self.count+=1;return fixture(page,code,issue)
        self.gateway=s.Gateway(self.store,'fixture-secret',{'state':'configured'},transport,lambda:self.now)
    def tearDown(self):self.store.close();self.tmp.cleanup()
    def test_cache_shared_and_persistent(self):
        a=self.gateway.forecast('temperature','11B10101')
        b=self.gateway.forecast('temperature','11B10101')
        self.assertEqual(self.count,1);self.assertTrue(b['ok']);self.assertEqual(b['source'],'서버 캐시')
        self.store.close();self.store=s.Store(self.path)
        gateway=s.Gateway(self.store,'fixture-secret',{'state':'configured'},self.gateway.transport,lambda:self.now)
        self.assertTrue(gateway.forecast('temperature','11B10101')['ok'])
        self.assertEqual(self.count,1);self.assertEqual(self.store.stats(self.now)['calls24h'],1)
    def test_global_interval_between_different_functions(self):
        self.gateway.forecast('temperature','11B10101')
        b=self.gateway.forecast('land','11B00000');self.assertEqual(b['error']['kind'],'THROTTLED')
        self.now+=30;self.assertTrue(self.gateway.forecast('land','11B00000')['ok'])
        self.assertEqual(self.store.stats(self.now)['calls24h'],2)
    def test_concurrent_identical_request_is_one(self):
        original=self.gateway.transport
        def slow(*args):time.sleep(.12);return original(*args)
        self.gateway.transport=slow
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results=list(pool.map(lambda _:self.gateway.forecast('land','11B00000'),range(5)))
        self.assertTrue(all(r['ok'] for r in results));self.assertEqual(self.count,1)
    def test_quota_warning_limit_and_rolling_expiry(self):
        self.store.db.executemany('INSERT INTO calls VALUES (?)',[(self.now-10,)]*8000);self.store.db.commit()
        self.assertTrue(self.store.stats(self.now)['warning'])
        self.store.db.executemany('INSERT INTO calls VALUES (?)',[(self.now-10,)]*1000);self.store.db.commit()
        b=self.gateway.forecast('land','11B00000');self.assertEqual(b['error']['kind'],'APP_LIMIT');self.assertEqual(self.count,0)
        self.now+=86400;self.assertEqual(self.store.stats(self.now)['calls24h'],0)
    def test_provider_limit_stops_all_functions_and_survives_restart(self):
        def limited(*a):raise s.code_error('22')
        self.gateway.transport=limited
        self.assertEqual(self.gateway.forecast('land','11B00000')['error']['kind'],'PROVIDER_LIMIT')
        self.now+=31
        self.assertEqual(self.gateway.forecast('sea','12A20000')['error']['kind'],'PROVIDER_LIMIT')
        self.assertEqual(self.store.stats(self.now)['calls24h'],1)
        self.store.close();self.store=s.Store(self.path)
        self.assertIsNotNone(self.store.stats(self.now)['stoppedUntil'])
    def test_negative_cache_backoff_and_no_data_fallback(self):
        def empty(*args):self.count+=1;raise s.code_error('03')
        self.gateway.transport=empty
        self.gateway.forecast('land','11B00000');self.gateway.forecast('land','11B00000')
        self.assertEqual(self.count,1)
        self.now+=30
        self.gateway.transport=lambda p,c,i,k:fixture(p,c,i)
        b=self.gateway.forecast('land','11B00000')
        self.assertTrue(b['ok']);self.assertEqual(b['usedTmFc'],'202611061800');self.assertTrue(b['stale'])
    def test_failure_counted_and_old_success_retained(self):
        a=self.gateway.forecast('land','11B00000')
        self.now+=4*3600
        def fail(*args):raise s.AppError('NETWORK','모의 네트워크 오류',120)
        self.gateway.transport=fail
        b=self.gateway.forecast('land','11B00000')
        self.assertTrue(b['ok']);self.assertTrue(b['stale']);self.assertEqual(b['usedTmFc'],a['usedTmFc'])
        self.assertEqual(self.store.stats(self.now)['calls24h'],2)
    def test_code_mismatch_missing_code_and_alias(self):
        p=payload({'regId':'wrong','taMin4':3})
        result=self.gateway.result('temperature','11B10101','auto','202611070600',p,self.now,False)
        self.assertEqual(result['codeComparison'],'불일치');self.assertTrue(result['warnings'])
        p=payload({'wfSv':'example'})
        result=self.gateway.result('outlook','108','auto','202611070600',p,self.now,False)
        self.assertIn('비교 불가',result['codeComparison'])
        p=payload({'regid':'11B00000'})
        result=self.gateway.result('land','11B00000','auto','202611070600',p,self.now,False)
        self.assertEqual(result['codeComparison'],'일치')
    def test_key_not_configured_never_calls_provider(self):
        self.gateway.config={'state':'missing'}
        self.assertFalse(self.gateway.forecast('land','11B00000')['ok']);self.assertEqual(self.count,0)
    def test_invalid_issue_and_region(self):
        for page,code,issue in [('land','11B10101','auto'),('land','11B00000','202001010600')]:
            with self.assertRaises(s.AppError):self.gateway.forecast(page,code,issue)

if __name__=='__main__':unittest.main(verbosity=2)
