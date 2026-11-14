# 2026-11-14 작업 인계

## 최신 상태

- 공개 사이트: https://weather-note-kma.workspace-482617.chatgpt.site/sea
- Sites 프로젝트: `appgprj_6aeec9782f0481919b052a589a7ac5a8`
- 게시 버전: 10
- 게시한 Sites 소스 커밋: `3191722aa301902c2f1c6a7d683a139f2264a392`
- 작성자 역할: 기획·검수. Codex로 구현했습니다.

## 오늘 반영한 기능

파고에 따른 상대적인 파도 높이와 움직임, 해·구름·흐림·비·눈 애니메이션, 날짜 간 파고의 부드러운 전환을 추가했습니다. 파도 영역은 제목 바로 아래에 배치했습니다. 날짜 진행이 끝나도 파도 움직임은 계속되며, 일시 정지와 재생을 지원합니다.

상단 파도 영역 또는 조회 조건의 **파도 데이터** 메뉴에서 다음 모드를 선택합니다.

1. 실제 예보
2. 기본 모의 데이터
3. 급변 파고 체험 · 더미

급변 모드는 4일 후 0.2~0.5m, 5일 후 4~6m, 6일 후 0.5~1m, 7일 후 3~5m, 8일 후 0.2~0.5m, 9일 후 2~4m, 10일 후 0.2~0.5m입니다. 발표본에 따라 처음 제공되는 날짜는 달라집니다. 모든 체험 자료에는 실제 예보가 아니라는 안내가 표시됩니다.

서버 경로 예: `/api/demo?page=sea&code=12A20000&issue=auto&scenario=surge`. 일반 모의 자료는 scenario 생략 또는 basic입니다. 외부 기상청 API를 호출하지 않는 합성 자료입니다.

## 파일과 재사용

- [portfolio-PRD-draft.md](portfolio-PRD-draft.md): 이 대화에서 작성한 포트폴리오 PRD 초안입니다. 현재 `portfolio/prd.md`의 상세 기획을 대체하지 않습니다.
- [weather-note-90sec.pptx](weather-note-90sec.pptx): 참고 디자인을 반영한 최종 발표 자료입니다. 4장, 15·20·40·15초 구성, 발표자 노트에 한국어 대본이 있습니다.
- [surge-demo.jpg](surge-demo.jpg): 공개 사이트에서 급변 모드를 선택한 검증 화면입니다.
- [발표 디자인 참고](https://pptbizcam.co.kr/?p=226826): PPT BIZCAM 템플릿 2084의 짙은 배경, 흰 곡선, 주황 강조를 적용했습니다. 원본 템플릿 파일은 이 저장소에 재배포하지 않습니다.

## 다음 작업 시작

Node.js 24 이상에서 저장소 루트 기준으로 실행합니다.

```sh
cd forecast/sites
node --test test.mjs
node build.mjs
node --check dist/server/index.js
```

현재 테스트 32개를 통과했습니다. 마지막 추가 테스트는 급변 모드의 명시적 더미 라벨, 0.5m·6m 범위, 기본 모의 자료의 불변성을 검사합니다. 공개 화면에서도 모드 선택과 4~6m 그림을 확인했습니다.

Sites는 Cloudflare Worker와 D1을 사용하므로 일반 정적 서버만으로 전체 API를 실행할 수 없습니다. 마이그레이션과 호스팅 manifest를 유지하고 Sites의 기존 프로젝트를 선택해 빌드·소스 동기화·저장 버전 배포를 진행합니다. 인증키는 기존 서버 비밀 환경변수에서 관리합니다.

**주의:** `forecast/local/`은 별도 Python 실행본입니다. `forecast/scripts/sync_sites_assets.py`를 실행하면 오늘의 Sites UI를 이전 로컬 UI로 덮어쓸 수 있습니다. 먼저 기능을 양쪽에 맞추거나 필요한 부분만 수동 반영하세요.

GitHub 보관은 Sites 배포를 자동 실행하지 않습니다. Sites 소스 저장소와 GitHub 저장소의 커밋 SHA는 별개입니다.

