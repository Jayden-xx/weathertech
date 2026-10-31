import { el } from '../lib/dom.js';
import { Icon } from './Icon.js';
export function Notice({ message = '', tone = 'info' } = {}) {
  const node = el('div', { className: 'notice', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  node.setMessage = (text, nextTone = 'info') => {
    node.className = 'notice notice--' + nextTone;
    node.hidden = !text;
    node.replaceChildren();
    if (text) node.append(Icon(nextTone === 'error' ? 'error' : nextTone === 'success' ? 'check' : 'arrow'), el('span', { text }));
  };
  node.setMessage(message, tone);
  return node;
}
