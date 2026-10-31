import { el, validateAbout } from '../lib/dom.js';
import { TextField } from './TextField.js';
import { Button } from './Button.js';
import { Notice } from './Notice.js';
export function AboutEditor({ value = { title: '', body: '', specialty: '' }, onSave, publicHref } = {}) {
  let initial = { ...value };
  let busy = false;
  const notice = Notice();
  const previewTitle = el('h3', { className: 'about-preview__title' });
  const previewBody = el('p', { className: 'about-preview__body' });
  const previewSpecialty = el('p', { className: 'eyebrow' });
  const reason = el('p', { className: 'field-hint', id: undefined });
  const fields = {};
  const getValue = () => Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
  const isDirty = () => JSON.stringify(getValue()) !== JSON.stringify(initial);
  function update(showErrors = false) {
    const current = getValue();
    const errors = validateAbout(current);
    previewTitle.textContent = current.title;
    previewBody.textContent = current.body;
    previewSpecialty.textContent = current.specialty;
    for (const [key, field] of Object.entries(fields)) {
      field.setError(showErrors || field.input.dataset.touched ? errors[key] : '');
    }
    save.disabled = busy || Boolean(Object.keys(errors).length) || !isDirty() || !onSave;
    reason.textContent = !onSave ? '저장 기능은 서버 연결 후 사용할 수 있습니다.' : busy ? '저장 중입니다.' : Object.keys(errors).length ? '필수 항목과 글자 수를 확인해 주세요.' : !isDirty() ? '변경 사항이 없습니다.' : '미리보기를 확인한 뒤 저장해 주세요.';
  }
  for (const [name, label, limit] of [['title', '소개 제목', 80], ['body', '소개 본문', 1200], ['specialty', '전문 분야', 120]]) {
    fields[name] = TextField({ name, label, limit, value: value[name], multiline: name === 'body', required: true, onInput: () => update() });
    fields[name].input.addEventListener('blur', () => { fields[name].input.dataset.touched = 'true'; update(); });
  }
  const save = Button({ label: '저장', onClick: () => form.requestSubmit() });
  const form = el('form', { className: 'about-editor__form', novalidate: true }, [
    el('p', { className: 'muted', text: '모든 항목은 필수입니다. 일반 텍스트로 입력해 주세요.' }),
    notice, ...Object.values(fields).map(field => field.element), el('div', { className: 'editor-actions' }, [save, publicHref && Button({ label: '공개 화면 보기', href: publicHref, variant: 'text' })]), reason,
  ]);
  const root = el('div', { className: 'about-editor', lang: 'ko' }, [form,
    el('aside', { className: 'about-preview', 'aria-label': '자기소개 미리보기' }, [el('p', { className: 'eyebrow', text: '미리보기 — 아직 공개되지 않았습니다' }), el('div', { lang: 'en' }, [previewTitle, previewBody, previewSpecialty])]),
  ]);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    update(true);
    if (save.disabled) return;
    const snapshot = getValue();
    busy = true;
    save.setLoading(true, '저장 중…');
    for (const field of Object.values(fields)) field.input.readOnly = true;
    update();
    try {
      await onSave(snapshot);
      initial = { ...snapshot };
      notice.setMessage('저장했습니다. 공개 페이지에 반영됩니다.', 'success');
    } catch {
      notice.setMessage('저장하지 못했습니다. 로그인 상태와 연결을 확인한 뒤 다시 시도해 주세요.', 'error');
    } finally {
      busy = false;
      save.setLoading(false);
      for (const field of Object.values(fields)) field.input.readOnly = false;
      update();
    }
  });
  root.hasUnsavedChanges = isDirty;
  const beforeUnload = event => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  root.destroy = () => window.removeEventListener('beforeunload', beforeUnload);
  update();
  return root;
}
