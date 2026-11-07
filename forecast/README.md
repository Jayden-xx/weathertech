# 기후의 흐름 · 중기예보 + Gemini 도우미

공개 사이트: https://weather-note-kma.workspace-482617.chatgpt.site

`local/`은 Python3.10+ 로컬 실행본, `sites/`는 공개 Sites Worker입니다. `local/서버실행.cmd`를 실행하고 http://127.0.0.1:8080/outlook 에 접속하세요. 외부 pip 패키지는 필요 없습니다. Node 테스트에는 Node24 이상이 필요합니다.

`local/KEY.env.example`을 `local/KEY.env`로 복사해 KMA_SERVICE_KEY, GEMINI_API_KEY를 직접 설정하세요. GEMINI_MODEL 기본값은 gemini-3.5-flash-lite입니다. OS 환경변수가 파일보다 우선하며 변경 후 재시작하세요. 실제 키는 저장소·브라우저·로그에 넣지 않습니다. Sites는 별도의 비밀 환경변수 설정과 재배포가 필요합니다.

네 예보 페이지와 지역·발표본 선택, 그래프·표·원문을 유지했습니다. 챗봇은 검증된 다섯 동작만 실행하고 서버 캐시를 근거로 설명합니다. 대화는 이 탭에서만 임시 보관하며 삭제할 수 있습니다. 기상청 공통30초 간격·9,000회 상한, Gemini 분당5회·최근24시간100회·세션분당2회 기본 상한을 별도로 관리합니다.

## 개발과 검사

```sh
cd local
python -m unittest -v test_server test_chat
cd ../
python scripts/sync_sites_assets.py
cd sites
node --test test.mjs
node build.mjs
```

Gemini 혼잡503은 키 오류와 구분합니다. 자동 모델 변경이나 무한 재시도는 하지 않습니다. 모델은 환경변수로 변경할 수 있습니다. 기본모델은 실제 API 연결을 검증한 Flash-Lite 계열입니다. 요금과 계정별 공식 한도는 별도 확인하세요. 코드·오류 검사는 모의 응답과 실제 응답을 구분해 VERIFICATION에 기록했습니다.

Sites DB migration은 drizzle 원본과 dist/_appgen_meta/drizzle 호환 경로를 함께 패키징합니다. .openai/drizzle만 넣었을 때 호스팅 정규화에서 SQL이 제외되어503이 발생했던 문제를 수정했습니다. 기존 SQL/journal은 변경하지 말고 새 migration을 추가하세요.

공식 문서: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite · https://ai.google.dev/gemini-api/docs/thinking · https://ai.google.dev/api/generate-content

로컬 설정법과 상세 구조는 local/README.md, 검증 이력은 local/VERIFICATION.md를 참고하세요. 실제 KEY.env, 실행DB, .git, 빌드 결과는 포함하지 않습니다.
