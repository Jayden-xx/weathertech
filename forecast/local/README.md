# 2026-11-07 Gemini 연결 수정

기본 모델을 실제 응답 확인한 gemini-3.5-flash-lite로 변경했습니다. thinkingLevel=low를 사용하고 모델503 혼잡은 GEMINI_UNAVAILABLE로 구분합니다. 모델 출력은 동작별 단일 칸으로 받아 상충하는 발표본 선택을 막습니다. 실제 키는 보존했고 Sites 비밀 환경변수로도 적용했습니다. 아래 이전 키 미설정 설명은 최초 구현 당시 기록이며 현재 로컬·공개 모두 설정됨 상태입니다.

# Gemini 날씨 도우미 추가 (2026-11-07)

기존 Python 3.10+ 서버와 네 예보 페이지를 유지했습니다. 추가 패키지 설치는 없습니다.

## 설정과 실행
기존 KEY.env의 기상청 키를 보존하고 없는 Gemini 설정만 추가했습니다. 파일 위치:
C:/Users/user/Documents/Codex/2026-11-07/api-api-url-json-json-json/outputs/kma-mid-forecast/KEY.env

```ini
KMA_SERVICE_KEY=발급받은_기상청_키
GEMINI_API_KEY=발급받은_Gemini_키
GEMINI_MODEL=gemini-3.5-flash-lite
```
실제 키는 채팅에 보내지 말고 파일에 직접 저장하세요. 메모장에서 모든 파일 형식으로 저장하고 탐색기에서 파일 확장명을 켜 KEY.env.txt가 아닌지 확인하세요. OS 환경변수가 파일보다 우선하며 빈 OS 값도 우선합니다. UTF-8/BOM, 주석·빈 줄을 처리합니다. 설정은 시작할 때 읽으므로 변경 후 재시작해야 합니다. 서버실행.cmd 더블클릭 또는 PowerShell에서 .\서버실행.cmd 실행. Python이 설치되어 있으면 python -X utf8 server.py도 가능합니다. 터미널을 유지하고 Ctrl+C로 종료하세요. 주소: http://127.0.0.1:8080/outlook

## 연결 설계와 쉬운 설명
chat.py는 Google REST generateContent를 서버에서 호출합니다. x-goog-api-key 헤더에 Gemini 키를 넣으며 기상청 serviceKey와 별개입니다. 구조화 응답(JSON: 정해진 칸을 가진 답안지)만 사용하고 함수 호출 도구와 혼용하지 않습니다. 기본 모델은 공식 문서에서 stable·structured outputs 지원을 확인한 gemini-3.5-flash-lite입니다. 빠른 Flash 계열의 현행 안정 모델을 선택했으며 무료·무제한을 보장하지 않습니다. 계정의 실제 모델 권한과 요금은 확인하지 못했습니다.

공식 자료: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
https://ai.google.dev/api/generate-content
https://ai.google.dev/gemini-api/docs/structured-output
https://ai.google.dev/gemini-api/docs/rate-limits
https://ai.google.dev/gemini-api/docs/pricing
https://aistudio.google.com/apikey

## 사용법과 동작 검증
오른쪽 날씨 도우미를 열어 서울의 중기기온을 보여줘 / 서해중부 예상파고를 확인해 줘 / 오늘 06시 발표 자료로 바꿔줘 / 현재 표에서 최고기온이 가장 높은 날은? 등을 요청하세요.
navigate_page, select_region, select_publication, refresh_forecast, explain_current_data만 서버와 브라우저에서 검증합니다. 임의 URL·파일·명령·설정 변경은 허용하지 않습니다. AI 제안과 앱 실행 결과를 구분하며 페이지 이동 후 임시 상태를 복원해 서버 캐시와 대조합니다. 여러 선택을 한 번의 최종 조회로 묶습니다.

chat.py의 data()는 브라우저 숫자를 받지 않고 기능·코드·발표본·성공시각으로 서버 캐시를 찾습니다. statistics()가 공동 최댓값·최솟값을 모두 계산하며 null은 제외하고 0은 보존합니다. 예보 날짜와 발표시각은 구분합니다. 원문은 기존 예보 화면에서, AI 생성 설명과 서버 계산 근거는 채팅에서 구분합니다. 모델 설명은 오류가 있을 수 있어 표시된 원문·표·근거와 함께 확인해야 합니다.

대화 원문은 서버 DB/로그에 저장하지 않습니다. 탭의 sessionStorage에는 최근 메시지 12개, 서버에는 30분 만료 동작·조회 조건만 저장합니다. 대화 지우기는 양쪽 대화 상태를 지우지만 비용 집계는 유지합니다. HTML을 실행하지 않고 textContent로 표시합니다. Enter 전송, Shift+Enter 줄바꿈과 한글 IME 조합 중 Enter 보호를 구현했습니다.

## 별도 호출량·비용 관리
Gemini 앱 기본 상한은 전체 분당 5회, 최근 24시간 100회, 대화당 분당 2회입니다. GEMINI_RPM_LIMIT / GEMINI_RPD_LIMIT / GEMINI_SESSION_RPM_LIMIT를 KEY.env 또는 서버 환경변수로 조절합니다. 이는 Google 공식 한도가 아닙니다. 공식 한도는 프로젝트·모델·등급에 따라 다르며 Google의 일일 한도는 태평양시 자정 기준입니다. 앱은 보수적으로 최근 24시간을 집계합니다.

질문 1개당 모델 호출 최대 1회, 입력 1,000자, 이력 최대 10개/6,000자(브라우저 전송은 최근 6개), 출력 2,048토큰, 요청 25초입니다. 실패 시도도 DB에 기록하며 실제 제공된 토큰만 합산합니다. 429는 60초부터 지수 증가, 최대 1시간 대기합니다. 인증·모델 오류는 자동 재시도하지 않습니다. 예보의 30초 확인은 Gemini 호출을 만들지 않습니다. 기상청의 공통 30초 간격·8,000회 경고·9,000회 상한은 그대로입니다.

## 오류와 배포
키 미설정/빈 값/자리표시자는 설정 안내, 인증은 GEMINI_AUTH, 모델·요청 지원은 GEMINI_MODEL, Google 제한은 GEMINI_LIMIT, 앱 제한은 GEMINI_APP_LIMIT, 네트워크/시간 초과/안전 정책/구조 오류는 각각 별도로 표시합니다. 실패해도 기존 예보는 유지합니다.

.env는 암호화가 아닙니다. 키를 서버에서만 사용하고 다운로드 허용 목록·로그 원문 차단·Git/ZIP 제외로 보호합니다. 로컬은 Host+Origin과 JSON/32KB 검사를 적용합니다. 공개 Sites는 동일 출처 검사와 D1 공유 호출 집계를 사용합니다. 로컬 KEY.env가 Sites로 자동 복사되지는 않습니다. 공개 챗봇은 관리자가 Sites 비밀 환경변수 GEMINI_API_KEY를 따로 설정해야 합니다. 현재 로그인·강한 사용자별 제한은 구현하지 않았습니다. 공개 운영 시 로그인과 계정별 제한·비용 모니터링을 추가하고 앱 전체 상한을 낮게 유지하세요. 임시 대화별 제한은 새 세션으로 우회할 수 있지만 전체 상한은 유지됩니다.

검사: python -m unittest -v test_server test_chat. 상세 결과는 VERIFICATION.md, 기존 예보 문서는 WEATHER_GUIDE.md를 참고하세요.

추가 수정: 공개 버전5에서 챗봇 DB 적용과 503을 해결했습니다. 공개 상태·세션 생성·삭제 API와 네 페이지를 실제 검증했습니다. 남은 설정은 Sites 비밀 환경변수 GEMINI_API_KEY 등록이며 실제 Gemini 인증·답변은 아직 미검증입니다.
