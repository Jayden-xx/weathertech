# 기후의 흐름 · 기상청 중기예보

지역별 중기전망, 육상 날씨·강수확률, 예상 최저·최고기온, 해상 날씨·예상파고를 조회하는 웹사이트입니다. 크림색 모눈 배경과 하늘색 그래픽 UI, 그래프·수치표·원문 보기, 30초 자동 확인을 제공합니다.

**공개 사이트:** https://weather-note-kma.workspace-482617.chatgpt.site

## 폴더 구성

```text
weather/forecast/
├── local/                  Python 로컬 실행본
│   ├── server.py
│   ├── 서버실행.cmd
│   ├── KEY.env.example
│   └── static/             HTML · CSS · 브라우저 JS
├── sites/                  Sites 공개 배포용 Worker
│   ├── .openai/hosting.json
│   ├── core.mjs            파싱 · 캐시 · 전역 호출 관리
│   ├── worker.mjs          페이지와 API 라우팅
│   ├── assets.mjs          키가 없는 화면·지역 데이터
│   ├── build.mjs
│   └── drizzle/            D1 DB 스키마
└── scripts/
    └── sync_sites_assets.py
```

## 로컬 실행

Python 3.10 이상이 필요하며 pip 패키지 설치는 없습니다. `local/서버실행.cmd`를 더블클릭하고 ‘서버 준비 완료’를 확인한 뒤 http://127.0.0.1:8080/outlook 에 접속합니다. 프로젝트 밖에서 실행해도 CMD 파일 위치를 기준으로 작동합니다. 실행 중 터미널을 열어 두고 Ctrl+C로 종료합니다.

실제 기상청 데이터는 `local/KEY.env.example`을 복사해 **local/KEY.env**로 저장한 후 본인의 키를 입력해야 합니다.

```dotenv
KMA_SERVICE_KEY=발급받은_실제_인증키
```

KEY.env는 파일 이름, KMA_SERVICE_KEY는 설정 이름입니다. server.py와 같은 폴더에 UTF-8로 저장하고 KEY.env.txt가 아닌지 확인합니다. 운영체제 환경변수가 파일보다 우선하며 키 변경 후 서버를 재시작합니다. 키가 없어도 설정 안내와 명시적인 모의 응답 모드는 실행됩니다. 실제 키는 GitHub나 채팅에 올리지 마세요.

| 페이지 | 경로 | 기능 |
|---|---|---|
| 중기전망 | /outlook | getMidFcst, stnId별 전망문 |
| 육상예보 | /land | getMidLandFcst, 권역별 날씨·강수확률 |
| 기온예보 | /temperature | getMidTa, 지역별 예상 최저·최고기온 |
| 해상예보 | /sea | getMidSeaFcst, 해역별 날씨·예상파고 |

## Sites에서 재사용·수정

현재 공개 사이트는 `sites/.openai/hosting.json`의 프로젝트 ID와 연결됩니다. 같은 사이트를 수정할 때는 이 ID를 유지하세요. **GitHub에 커밋하는 것만으로 현재 Sites가 자동 배포되지는 않습니다.** Codex에서 이 폴더를 열고 기존 Sites에 변경을 반영해 배포하도록 요청하세요.

새로운 별도 Sites를 만들 때는 기존 ID를 임의로 재사용하지 말고 새 프로젝트를 생성해 반환된 ID를 사용합니다. D1 바인딩 이름은 DB이며 최초 배포 때 drizzle의 마이그레이션이 적용됩니다. 인증키는 Sites 서버의 **KMA_SERVICE_KEY 비밀 환경변수**에 설정하고 배포해야 적용됩니다. 로컬 KEY.env를 업로드하지 않습니다.

`sites/` 폴더에서 검증한 Node 24 환경으로 실행합니다. 별도 npm 패키지 설치는 없습니다.

```sh
node --test test.mjs
node build.mjs
```

산출물은 dist/server/index.js입니다. Sites의 소스 저장·버전 저장·배포 절차로 게시하며 dist나 인증키를 소스로 커밋하지 않습니다. D1 스키마 변경은 기존 적용 파일을 수정하지 않고 새 마이그레이션을 추가하세요.

## 화면 수정 흐름

화면의 원본은 `local/static/`입니다. 이 파일을 수정한 후 forecast 폴더에서 다음을 실행하면 Sites의 assets.mjs를 다시 생성합니다. 이 스크립트는 Python 표준 라이브러리와 local/fixtures.py만 사용하며 별도 패키지가 필요하지 않습니다.

```sh
python scripts/sync_sites_assets.py
cd sites
node --test test.mjs
node build.mjs
```

서버 로직은 실행 환경이 달라 local/server.py와 sites/core.mjs에 각각 있습니다. 한쪽 로직을 수정하면 다른 쪽과 테스트도 함께 확인하세요.

## 데이터 해석과 호출 관리

- 출처: 기상청 MidFcstInfoService, 사용자 제공 중기예보 활용가이드와 2025.12 예보구역 Excel. 원본 문서·Excel은 이 저장소에 포함하지 않았습니다. 지역 목록·해시 정보는 local/SOURCE_NOTES.json에 있습니다.
- 전망 stnId, 육상 regId, 기온 regId, 해상 regId는 별도 관리합니다. 격자 nx/ny를 사용하는 단기예보 구조를 혼용하지 않습니다.
- KST 06시 발표는 발표일 +4~+10일, 18시 발표는 +5~+10일입니다. 최근 24시간 자료만 조회합니다. 내일·모레 예보용 API가 아닙니다.
- 강수확률은 %, 기온은 ℃, 예상파고는 m입니다. 예보값과 관측값을 구분하고 없는 값을 0으로 바꾸지 않습니다.
- 기온 Low/High의 산술 의미는 확정하지 않아 범위 그래프를 만들지 않습니다. 요청 발표시각은 API 반환값으로 표현하지 않습니다.
- 방문자 수와 기상청 호출 수는 다릅니다. 동일 조건은 성공 캐시를 공유하고 네 기능의 외부 호출 시작 간격을 전체 최소 30초로 제한합니다.
- 최근 24시간 8,000회 경고·9,000회 상한, 제공기관 제한 시 외부 호출 중지와 이전 자료 표시를 구현했습니다. 공식 자정 초기화 시각을 확인하지 못해 최근 24시간으로 보수적으로 계산합니다.
- Sites는 공용 D1 DB를, 로컬은 SQLite 파일을 사용합니다. 로컬 앱·다른 프로젝트에서 같은 키를 사용한 호출까지 자동 합산하지는 않습니다.

## 검증 기록

2026-11-07에 로컬 Python 자동 검사 24개, Sites Node/SQLite 자동 검사 16개를 통과했습니다. Sites 배포 환경의 06시 실제 응답으로 전망 1건·육상 11구간·기온 7일·해상 11구간과 PC/모바일 화면을 확인했습니다. 모든 지역과 18시 실제 응답을 전수 검사한 것은 아닙니다. local/VERIFICATION.md의 초기 검사와 후속 검사 구분을 참고하세요.

## 비밀 정보 제외

실제 KEY.env, .env, Sites 비밀 값, .git 이력, DB·캐시·호출 기록, node_modules와 dist를 제외했습니다. 설정 예제만 포함합니다. GitHub에 소스를 보관해도 Sites의 비밀 환경변수는 따라오지 않습니다.
