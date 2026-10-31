import { el, safeUrl } from '../lib/dom.js';
import { Button } from './Button.js';
export function Hero({ name = 'Nuvv', specialty = 'Travel & Wellness Photography', description = 'Travel, wellness, and the quiet in between.', image, workHref = '/work' } = {}) {
  return el('section', { className: 'hero', 'aria-label': 'Introduction', lang: 'en' }, [
    el('div', { className: 'hero__intro' }, [
      el('div', {}, [el('p', { className: 'eyebrow', text: specialty }), el('h1', { className: 'hero-title', text: name })]),
      el('div', { className: 'hero__copy' }, [el('p', { text: description }), Button({ label: 'View Work', href: workHref, icon: 'arrow' })]),
    ]),
    image && el('img', { className: 'hero__image', src: safeUrl(image.src, { image: true }), alt: image.alt, width: image.width, height: image.height, fetchpriority: 'high', decoding: 'async' }),
  ]);
}
