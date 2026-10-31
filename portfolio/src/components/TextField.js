import { el, uid } from '../lib/dom.js';
export function TextField({ label, name, value = '', multiline = false, limit, required = false, onInput } = {}) {
  const id = uid('field');
  const hintId = id + '-hint';
  const errorId = id + '-error';
  const input = el(multiline ? 'textarea' : 'input', { id, name, className: 'field-control', ...(multiline ? { rows: 8 } : { type: 'text' }), required, 'aria-describedby': hintId });
  input.value = value;
  const hint = el('div', { id: hintId, className: 'field-hint' });
  const error = el('p', { id: errorId, className: 'field-error', hidden: true });
  const root = el('div', { className: 'field' }, [el('label', { for: id, text: label }), input, hint, error]);
  const count = () => { hint.textContent = limit ? Array.from(input.value).length + ' / ' + limit.toLocaleString('en-US') : ''; };
  const setError = (message = '') => {
    error.textContent = message;
    error.hidden = !message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    input.setAttribute('aria-describedby', hintId + (message ? ' ' + errorId : ''));
  };
  input.addEventListener('input', () => { count(); onInput?.(input.value); });
  count();
  return { element: root, input, setError, get value() { return input.value; } };
}
