# Gemini 실제 연결 최종 검증 · 2026-11-07 KST

이 기록이 아래 최초 구현·키 미설정 기록보다 우선합니다.

- 실패 재현: gemini-3.8-flash generateContent 요청 시간 초과 및 Google HTTP503 UNAVAILABLE/high demand. 키로 모델 목록 HTTP200 확인. gemini-3.1-flash-lite도 생성에 실패했고, gemini-2.5-flash는 신규 사용자404를 반환해 사용하지 않았습니다. 실제로 응답한 gemini-3.5-flash-lite로 기본 모델과 KEY.env의 모델 설정을 변경했습니다. 실제 키·기상청 키는 보존했습니다.
- thinkingLevel=low를 사용합니다. 모델 혼잡503은 GEMINI_UNAVAILABLE로 구분하고 무한 자동 재시도는 하지 않습니다. 앱 호출 상한을 초기화하거나 우회하지 않았습니다.
- 실제 모델이 배열에서 여러 발표본을 선택한 사례를 관찰했습니다. 응답 schema를 동작별 nullable 단일 칸 객체로 변경하고 앱이 검증된 배열로 변환합니다. 추가 필드·잘못된 지역·충돌 동작 차단은 유지합니다.
- 로컬: 실제 Gemini HTTP200, 한국어 응답 및 서울 기온 선택 동작 검증. 모의 응답이 아닙니다.
- 공개 Sites: 비밀 환경변수 GEMINI_API_KEY/GEMINI_MODEL 반영, 버전7 배포 성공. 소스 a36bcd4226ef6476bdd18877f8b5d4e8b0c7003c. 배포 appgdep_6aeedb549d3c81918f8a01cd0afd01b6.
- 실제 공개 브라우저: 중기전망에서 자연어로 서울 기온 페이지 이동, 코드11B10101, 발표202611070600 및 앱 실행 결과 확인. 현재 표의 최고기온 질문에 Gemini가 2026-11-12,13,14의16℃를 답해 실제 서버 캐시·표와 일치했습니다. API 원문·그래프·표는 기존 기상청 자료를 유지했습니다.
- Python 자동 검사47개, Sites Node 검사31개 통과. 동작 슬롯 변환, 추가필드 거부, 동일 동작 중복 정리/충돌 차단 및 기존 예보 회귀 포함. 자동 검사는 모의 모델 응답이며 위 브라우저 검사는 실제 Gemini입니다.
- 공개 화면 캡처: Sites_Gemini_실제연결_성공.jpg. 일반 설명·다른 지역/질문의 모든 답변 정확성을 보증하는 검사는 아닙니다. 계정별 요금과 호출 한도는 Google AI Studio에서 별도 확인하세요.
- 실제 키는 소스·GitHub·ZIP에서 제외합니다. 진단 생성 요청도 별도로 기록했으며 한도검사를 위해 대량 호출하지 않았습니다. 계정 모델 목록 GET은 생성 요청과 구분합니다.

공식 확인: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite · https://ai.google.dev/gemini-api/docs/thinking · https://ai.google.dev/api/generate-content

# 챗봇 추가 검증 2026-11-07

- Python: 기존 24개 + 챗봇 21개 = 45개 통과. Sites Node 검사 30개 통과. 모델과 외부 오류는 모의 전송을 사용했으며 대량 호출하지 않음.
- 실제 기상청: 네 기능의 기존 인증 캐시를 재조회하고 원문/표 변환 일치 확인. 추가 실제 외부 요청 1회로 서울 202611061800 발표 6일치 정상 수신(총 호출 8→9). Gemini 성공과 별개.
- 실제 Gemini: 키가 없어 미검증. KEY.env는 placeholder 상태. 설정 로딩·REST 형식·오류·행동·비용 경계는 모의 검사이며 실제 AI 해석 품질 검증 아님.
- 기존 기상청 키는 추가 전후 값 비교로 보존 확인. Gemini 설정 두 줄만 추가. OS 우선·BOM·빈 값·자리표시자·누락·구조 필드·역할 제한·허용 동작·지역·발표본·공동 극값·0·결측·캐시 ID·비용 기록 재연결·동시 전송·429·시간 초과·인증·모델·안전 정책·원문 비노출 자동 검사 통과.
- 브라우저 모의 전용 8082: 전망→서울 기온→서해중부 해상 실제 UI 이동, 대화 복원, 실행 결과 확인, 공동 최고 16℃ 날짜 3개, 부산 바다 질문, 06시 발표 선택, 대화 삭제 확인.
- PC 1440×1050 화면 확인. 모바일 390×844: 문서 폭375, 입력창 x25~299, 전송 x307~350/y701~762로 화면 안에 있음. 실제 휴대전화는 미검증.
- Enter 전송은 실제 확인. Shift+Enter·IME 조합 이벤트·숨긴 탭·모든 브라우저 타이밍은 코드 검토만 했음.
- 서버실행.cmd로 Python3.12.14 실행과 준비 메시지 확인. 로컬8080 실행 유지. Ctrl+C는 기존 PTY의 신호 전달 제한으로 실제 일반 터미널 검증 미완료.
- 키/모델 변경 후 재시작 필요. 실제 Gemini 키 입력 후 자연어 해석·계정 모델 접근·비용을 최소 호출로 추가 검증해야 함.
- 기존 검사 상세 이력은 VERIFICATION_PRE_CHAT.md. ZIP은 KEY.env·DB·Git을 제외한 소스만 포함.

## 公開 Sites 추가 확인
Sites 버전4 배포 자체는 성공했으나 /api/chat/status HTTP503을 확인했습니다. DB 개요에는 기존 네 테이블만 있어 새 챗봇 마이그레이션 적용이 확인되지 않습니다. 공개 챗봇은 미완료입니다. 배포용 소스와 SQL은 ZIP에 포함했습니다. 런타임 요청에서 임의 CREATE TABLE로 우회하지 않았습니다. 로컬8080 챗봇 설정 안내와 45개 검사는 정상입니다.


## 공개 Sites 복구 완료 · 이전 미완료 기록을 대체
# 공개 Sites 챗봇 DB·503 복구 결과

2026-11-07 KST · 공개 버전 5
주소: https://weather-note-kma.workspace-482617.chatgpt.site/outlook

## 원인과 수정
원본 배포 tar에는 dist/.openai/drizzle SQL이 있었지만 호스팅에 저장된 정규화 아카이브는 파일 2개만 포함했고, 공개 DB에는 챗봇 테이블이 없었습니다. build.mjs에서 SQL과 journal을 지원되는 호환 경로 dist/_appgen_meta/drizzle에도 포함했습니다. 재저장한 호스팅 아카이브는 파일8개로 늘었고 재배포 후 chat_sessions, gemini_calls, gemini_control이 생성됨을 DB 개요에서 확인했습니다. 기존 예보 테이블4개는 유지했습니다. 런타임 CREATE/ALTER TABLE이나 공개 관리 엔드포인트를 추가하지 않았습니다.

소스 commit: dab460a84ef005305a9eff5d25d25f4177624615
공개 배포: appgdep_6aeed816c4208191a4a537c07a2c79a0 / succeeded

## 실제 공개 환경 검사
- GET /api/chat/status: HTTP200 (이전503 해결)
- POST /api/chat/session: HTTP200
- POST /api/chat: 키 미설정 전용 오류 GEMINI_KEY_MISSING, HTTP400
- POST /api/chat/clear: HTTP200
- 다른 Origin의 POST: HTTP403
- 네 예보 페이지: 모두 HTTP200, 챗봇 스크립트 포함
- 실제 브라우저: 기존 전망 원문과 챗봇 설정 안내 함께 확인
- Node 자동 검사30개 통과 (모델 응답은 모의)
- Gemini 실제 외부 호출0회. 비용 발생 모델 테스트 없음

## 키 설정과 남은 검증
공개 Sites에는 현재 KMA_SERVICE_KEY만 등록되어 있습니다. GEMINI_API_KEY는 미설정이며 로컬 KEY.env도 Gemini 자리표시자입니다. 실제 Gemini 인증·답변 생성은 검증하지 못했습니다. 키는 대화창에 붙여넣지 말고 Sites 비밀 환경변수 GEMINI_API_KEY에 직접 등록해야 합니다. GEMINI_MODEL 기본값은 gemini-3.8-flash입니다. 로컬 KEY.env와 공개 Sites 설정은 별개입니다. 키 등록 후 런타임 설정 적용/재배포가 필요하며, 최소1회 실제 질문으로 모델 권한과 답변을 추가 검증하세요. 앱의 호출 상한은 그대로 유지됩니다.

대화 원문·키·서버 환경변수 전체를 로그나 검증파일에 기록하지 않았습니다. 세션 검증용 상태는 clear로 삭제했습니다.
