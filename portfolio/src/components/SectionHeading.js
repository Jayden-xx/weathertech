import { el } from '../lib/dom.js';
export function SectionHeading({ eyebrow, title, description, level = 2, id } = {}) {
  const heading = Math.min(6, Math.max(1, level));
  return el('div', { className: 'section-heading' }, [
    eyebrow && el('p', { className: 'eyebrow', text: eyebrow }),
    el('h' + heading, { className: heading === 1 ? 'page-title' : 'section-title', id, text: title }),
    description && el('p', { className: 'section-description', text: description }),
  ]);
}
