import { el, safeUrl } from '../lib/dom.js';
import { ImageViewer } from './ImageViewer.js';
export function Gallery({ images = [] } = {}) {
  const viewer = ImageViewer({ images });
  const root = el('div', { className: 'gallery', lang: 'en' }, [
    el('p', { className: 'muted', text: images.length ? 'Select an image to view larger.' : 'New work is on the way.' }),
    ...images.map((image, index) => {
      const button = el('button', { type: 'button', className: 'gallery__item' + (image.height > image.width ? ' gallery__item--portrait' : ''), 'aria-label': 'View image ' + (index + 1) + ': ' + image.alt, onClick: () => viewer.open(index) },
        el('img', { src: safeUrl(image.src, { image: true }), alt: image.alt, width: image.width, height: image.height, loading: 'lazy', decoding: 'async' }));
      button.querySelector('img').addEventListener('error', () => { button.replaceChildren(el('span', { className: 'image-fallback', text: 'Image unavailable.' })); });
      return button;
    }), viewer.element,
  ]);
  return root;
}
