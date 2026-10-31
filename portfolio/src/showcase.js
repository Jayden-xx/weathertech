import { el } from './lib/dom.js';
import { Button, SectionHeading, SiteHeader, Hero, ProjectCard, Gallery, Notice, AboutEditor, ContactLinks, SiteFooter } from './components/index.js';

const landscape = { src: './assets/image-placeholder.svg', width: 1600, height: 1000, alt: '실제 사진으로 교체할 가로 예시 영역' };
const portrait = { src: './assets/image-placeholder-portrait.svg', width: 800, height: 1000, alt: '실제 사진으로 교체할 세로 예시 영역' };
const app = document.querySelector('#app');
app.append(SiteHeader({ home: '#', links: [{ label: 'Components', href: '#components' }, { label: 'Gallery', href: '#gallery' }, { label: 'Editor', href: '#editor' }] }));
const main = el('main', { className: 'container', id: 'main' });
main.append(el('div', { className: 'collection-bar' }, [el('p', { className: 'eyebrow', text: 'NUVV / COMPONENT COLLECTION' }), el('p', { className: 'eyebrow', text: 'Quiet Editorial · 01' })]));
main.append(Hero({ image: landscape, workHref: '#work' }));
main.append(el('p', { className: 'demo-caption', text: '컴포넌트 미리보기입니다. 사진 영역과 프로젝트 제목은 예시이며 실제 콘텐츠로 교체합니다.' }));

let sectionNumber = 0;
function specimen(id, title, description, content) {
  sectionNumber++;
  return el('section', { className: 'specimen', id }, [
    el('div', { className: 'specimen__heading' }, [el('span', { className: 'specimen__index', text: String(sectionNumber).padStart(2, '0') }), el('h2', { text: title })]),
    el('p', { className: 'specimen__intro', text: description }), content,
  ]);
}

const colors = [['Charcoal', '#111111'], ['Ivory', '#F2F0EB'], ['Sage', '#B8C4AC'], ['Surface', '#1B1B1A'], ['Muted', '#B5B2AC'], ['Error', '#F0A39D']];
main.append(specimen('components', 'Color & typography', '차콜과 아이보리를 중심으로 세이지를 핵심 행동에만 사용합니다.', el('div', {}, [
  el('div', { className: 'palette' }, colors.map(([name, hex]) => {
    const color = el('div', { className: 'swatch__color' });
    color.style.background = hex;
    return el('div', { className: 'swatch' }, [color, el('p', { text: name }), el('p', { className: 'muted', text: hex })]);
  })),
  el('div', { className: 'type-samples', style: 'margin-top:48px', lang: 'en' }, [SectionHeading({ eyebrow: 'Travel & Wellness', title: 'A quieter way of seeing.', description: 'Light, texture, and a sense of space. Photography that invites a slower, closer way of seeing.' })]),
])));

const actionNotice = Notice();
const copyExample = Button({ label: '미리보기 동작', variant: 'secondary', onClick: () => actionNotice.setMessage('버튼 클릭 이벤트가 연결되었습니다.', 'success') });
const loading = Button({ label: '저장' });
loading.setLoading(true, '저장 중…');
main.append(specimen('buttons', 'Buttons & actions', '48px 기본 버튼, 44px 작은 버튼, 키보드 초점과 비활성·처리 중 상태입니다.', el('div', {}, [
  el('div', { className: 'button-examples' }, [
    Button({ label: 'View Work', href: '#work', icon: 'arrow' }),
    copyExample, Button({ label: 'Back to Work', href: '#work', variant: 'text' }),
    Button({ label: '로그아웃', variant: 'secondary', size: 'small' }),
    Button({ label: '선택 불가', disabled: true }), loading,
    Button({ label: '다음 항목', iconOnly: true, icon: 'next', variant: 'secondary', onClick: () => actionNotice.setMessage('아이콘 버튼도 이름으로 구분할 수 있습니다.') }),
  ]), el('div', { style: 'margin-top:24px' }, actionNotice),
])));

main.append(specimen('work', 'Project cards', '사진 비율과 제목은 분리되어 있습니다. 768px부터 2열, 모바일에서는 1열로 바뀝니다.', el('div', { className: 'work-grid', lang: 'en' },
  [['Quiet Coast', 'Travel', portrait], ['Slow Mornings', 'Wellness', landscape], ['Open Ground', 'Travel', portrait], ['A Moment Within', 'Wellness', landscape]].map(([title, category, image]) => ProjectCard({ title, category, image, href: '#gallery' })))));
main.append(specimen('gallery', 'Gallery & image viewer', '사진을 누르면 확대 화면이 열립니다. 방향키, Escape, 닫기 버튼으로 조작하고 원래 위치로 돌아옵니다.', Gallery({ images: [landscape, portrait] })));
main.append(specimen('feedback', 'Feedback & states', '성공·실패는 색상뿐 아니라 문구와 아이콘으로 전달합니다.', el('div', { className: 'notice-examples' }, [
  Notice({ message: 'Email copied', tone: 'success' }),
  Notice({ message: '저장하지 못했습니다. 입력 내용은 유지됩니다.', tone: 'error' }),
  Notice({ message: '이 컴포넌트는 실제 인증·저장 서버에 연결하여 사용합니다.' }),
])));
main.append(specimen('editor', 'About editor', '영문 소개를 입력하면 미리보기에 반영됩니다. 이 예제는 서버를 연결하지 않아 저장이 비활성화되어 있습니다.', AboutEditor({
  value: { title: 'A quieter way of seeing.', body: 'I’m Nuvv, a photographer drawn to travel and wellness. My work explores people, places, and moments of pause.', specialty: 'Travel & Wellness Photography' },
})));
main.append(specimen('contact', 'Contact links', '연락처가 없는 상태를 표시합니다. 실제 이메일과 인스타그램 주소를 전달하면 링크와 복사 버튼이 생성됩니다.', ContactLinks()));
main.append(el('p', { className: 'demo-caption' }, el('a', { href: './home-preview-v1.png', text: '앞서 생성한 디자인 시안 이미지 보기' })));
app.append(main, SiteFooter({ links: [{ label: 'Back to top', href: '#' }] }));
