# Nuvv 재사용 UI 컴포넌트

이 폴더는 `design.md`를 구현한 프레임워크 독립형 HTML·CSS·JavaScript 컴포넌트 모음입니다. 사이트 제작 전 컴포넌트를 확인하는 로컬 작업이며 배포하지 않았습니다.

## 실행

Node.js가 설치된 환경에서 이 폴더를 터미널로 열어 실행합니다. 외부 패키지 설치는 필요 없습니다.

```powershell
node server.mjs
```

브라우저에서 http://127.0.0.1:4173 을 엽니다. 파일을 더블클릭하는 방식은 ES 모듈 보안 정책 때문에 지원하지 않습니다. 종료는 터미널에서 Ctrl+C입니다.

검사는 다음 명령으로 실행합니다.

```powershell
node --test tests/*.test.js
```

## 파일 구성

- `src/styles/tokens.css`: 색상·서체·여백·크기 기준.
- `src/styles/base.css`: 초기화, 타이포그래피, 초점·모션 감소.
- `src/styles/components.css`: 공통 컴포넌트 스타일.
- `src/styles/showcase.css`: 미리보기 페이지 전용 스타일.
- `src/components/`: 컴포넌트마다 독립된 JavaScript 파일.
- `src/lib/`: 안전한 DOM 생성, 주소·입력 검사, 대화상자 관리.
- `src/showcase.js`: 컴포넌트 사용 예시.
- `assets/`: 실제 사진으로 교체할 로컬 SVG 예시 영역.

## 사용 방법

실제 페이지에서 tokens, base, components 순서로 CSS를 불러옵니다. 미리보기 전용 showcase.css는 실제 페이지에 필요하지 않습니다. 컴포넌트는 DOM 요소를 반환하므로 원하는 위치에 append 합니다. 인라인 HTML 문자열 대신 textContent 기반으로 문구를 넣습니다.

```js
import { Button, ProjectCard } from './src/components/index.js';

const action = Button({ label: 'View Work', href: '/work', icon: 'arrow' });
document.querySelector('main').append(action);

const card = ProjectCard({
  title: '프로젝트 제목',
  category: 'Travel',
  href: '/work/project-slug',
  image: { src: '/images/cover.jpg', width: 1600, height: 1000 },
});
document.querySelector('.work-grid').append(card);
```

## 컴포넌트 API

| 컴포넌트 | 주요 입력 | 반환·동작 |
| --- | --- | --- |
| Button | label, href, variant(primary/secondary/text/ghost), size, icon, iconOnly, disabled, onClick, newTab | 요소, 실행 버튼은 setLoading(boolean, 문구) 지원 |
| Icon | 아이콘 이름 | 장식용 SVG, 클릭 대상은 Button으로 감싸기 |
| SectionHeading | eyebrow, title, description, level, id | 제목 블록, H1 중복 방지는 페이지에서 관리 |
| Notice | message, tone(info/success/error) | 요소, setMessage(문구, 상태)로 갱신 |
| TextField | label, name, value, multiline, limit, required, onInput | element, input, value, setError |
| ProjectCard | title, category, year, href, image, position | 단일 링크가 있는 article |
| SiteHeader | brand, home, links, current | 헤더·모바일 메뉴, destroy()로 관찰 해제 |
| Hero | name, specialty, description, image, workHref | 소개 섹션, H1 포함 |
| ImageViewer | images: [{src, alt}] | element, open(index), close() |
| Gallery | images: [{src, alt, width, height}] | 사진 목록과 확대 화면 포함 |
| ContactLinks | email, instagram | 링크·복사·알림, destroy()로 타이머 해제 |
| AboutEditor | value: {title, body, specialty}, onSave, publicHref | 실시간 미리보기·검사, hasUnsavedChanges(), destroy() |
| SiteFooter | brand, year, links | 푸터 |

이미지 대체 텍스트는 실제 사진 확인 후 작성합니다. 카드 표지는 링크 안에 제목이 있어 빈 대체 텍스트를 사용하고, Gallery·Hero에서는 사진을 설명하는 alt를 전달합니다. 모든 코드 주석은 한글입니다.

## 자기소개 저장 연결

AboutEditor는 저장 UI이며 인증 서버가 아닙니다. 기본 예제에는 onSave를 전달하지 않아 저장할 수 없습니다. 실제 작업에서는 onSave에 인증된 서버 요청 함수를 전달하고, 실패 시 예외를 발생시킵니다. Promise가 성공해야만 저장 성공으로 표시됩니다. 서버는 매 요청에서 본인 권한을 검사하고 영속 저장·공개 캐시 갱신을 수행해야 합니다. 브라우저 저장 공간이나 가짜 성공으로 대체하지 않습니다.

```js
import { AboutEditor } from './src/components/index.js';
const editor = AboutEditor({
  value: { title: '제목', body: '본문', specialty: 'Travel & Wellness' },
  onSave: async (value) => {
    const response = await fetch('/api/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error('저장 실패');
  },
});
```

이 예시는 호출 형태 설명입니다. /api/about 서버는 아직 구현하지 않았습니다. 인증 방식이 정해지면 세션·요청 위조 방지 등 서버 계약을 함께 설계합니다.

편집 화면이 존재하는 상태에서 내부 페이지를 전환하려면 editor.hasUnsavedChanges()를 검사하고 ‘계속 편집 / 저장하지 않고 나가기’ 확인창을 연결합니다. 브라우저 종료·새로고침 경고는 컴포넌트에 포함되어 있습니다. 컴포넌트를 제거할 때 destroy()를 호출합니다.

## 범위와 확인할 사항

- 현재 결과는 컴포넌트와 미리보기이며 전체 포트폴리오 라우팅·로그인·서버 저장·프로젝트 파일 자동 수집은 다음 단계입니다.
- 사진·연락처는 제공되지 않아 예시 영역과 빈 상태를 사용합니다.
- 원본 사진 수령 후 반응형 이미지 크기와 실제 사진 크롭을 설정합니다.
- 네이티브 dialog를 지원하는 현대 브라우저를 대상으로 합니다.
- 실제 기기·브라우저 검수 결과는 작업 완료 보고의 검증 범위를 확인합니다.

## 이번 작업에서 확인한 결과

- JavaScript 18개 파일 문법 검사 통과.
- 주소 안전성, 필수값·길이 제한, 유니코드 글자 수 관련 테스트 3개 통과.
- 로컬 HTTP 응답 200 및 브라우저 경고·오류 로그 없음 확인.
- 320·375px 1열, 768·1,440px 2열 및 가로 넘침 없음 확인.
- 버튼 이벤트, 사진 확대·다음 이동·마지막 버튼 비활성, Escape 닫기와 초점 복귀 확인.
- 모바일 메뉴 열기·Escape 닫기, 소개 입력에 따른 미리보기 변경 확인.
- 실제 사진·인증·서버 저장, 여러 실제 기기에서의 검수는 연결 이후 확인할 항목입니다.

`components-preview.png`는 실제 브라우저에서 캡처한 컬러·서체 컴포넌트 화면입니다.
