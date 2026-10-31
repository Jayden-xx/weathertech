import { el, safeUrl } from '../lib/dom.js';
export function ProjectCard({ title, category, year, href, image, position = '50% 50%' } = {}) {
  const picture = el('img', { src: safeUrl(image.src, { image: true }), alt: '', width: image.width, height: image.height, loading: 'lazy', decoding: 'async' });
  picture.style.objectPosition = position;
  const frame = el('div', { className: 'project-card__frame' }, picture);
  picture.addEventListener('error', () => { picture.hidden = true; frame.append(el('span', { className: 'image-fallback', text: 'Image unavailable.' })); }, { once: true });
  const link = el('a', { className: 'project-card', href: safeUrl(href) }, [
    frame,
    el('h3', { className: 'project-card__title', text: title }),
    el('p', { className: 'eyebrow', text: [category, year].filter(Boolean).join(' / ') }),
  ]);
  return el('article', { className: 'project-card-wrapper' }, link);
}
