import pathlib,json,sys
root=pathlib.Path(__file__).resolve().parents[1];local=root/'local';site=root/'sites'
sys.path.insert(0,str(local));from fixtures import fixture
html=(local/'static'/'index.html').read_text(encoding='utf-8')
html=html.replace('<h2>인증키를 설정하면 실제 예보를 볼 수 있어요</h2>','<h2>날씨 자료 연결을 준비하고 있어요</h2>')
html=html.replace('프로젝트 폴더의 <b>KEY.env</b> 파일에 아래 설정을 저장한 뒤 서버를 재시작하세요.','서비스 관리자가 서버의 기상청 연결 설정을 확인 중입니다. 방문자는 인증키를 입력할 필요가 없습니다.')
html=html.replace('<code>KMA_SERVICE_KEY=발급받은_실제_인증키</code>','')
js=(local/'static'/'app.js').read_text(encoding='utf-8')
js=js.replace("missing:'인증키 설정이 없습니다.'","missing:'서비스 연결 설정을 준비 중입니다.'")
regions=json.loads((local/'regions.json').read_text(encoding='utf-8'))
values={'HTML':html,'CSS':(local/'static'/'style.css').read_text(encoding='utf-8'),'JS':js,'REGIONS':regions,'DEMO':{p:fixture(p,regions[p][0]['code'],'202611070600') for p in regions}}
(site/'assets.mjs').write_text('\n'.join('export const '+k+'='+json.dumps(v,ensure_ascii=False)+';' for k,v in values.items())+'\n',encoding='utf-8')
print('UI, regions and explicitly labeled demo responses embedded. KEY.env not copied.')
