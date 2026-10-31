import { el, uid, safeUrl } from '../lib/dom.js';
import { attachDialog } from '../lib/dialog.js';
import { Button } from './Button.js';
export function ImageViewer({ images = [] } = {}) {
  const headingId = uid('viewer-title');
  const count = el('p', { className: 'eyebrow', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const stage = el('div', { className: 'image-viewer__stage' });
  const status = el('p', { className: 'viewer-status', role: 'status' });
  let current = 0;
  let request = 0;
  const previous = Button({ label: 'Previous image', icon: 'previous', iconOnly: true, variant: 'secondary', onClick: () => show(current - 1) });
  const next = Button({ label: 'Next image', icon: 'next', iconOnly: true, variant: 'secondary', onClick: () => show(current + 1) });
  const dialog = el('dialog', { className: 'image-viewer', 'aria-labelledby': headingId });
  const controller = attachDialog(dialog, { onClose: () => { request++; } });
  dialog.append(el('h2', { id: headingId, className: 'sr-only', text: 'Image viewer' }),
    el('div', { className: 'image-viewer__bar' }, [count, Button({ label: 'Close image viewer', icon: 'close', iconOnly: true, variant: 'ghost', onClick: controller.close })]),
    stage, el('div', { className: 'image-viewer__footer' }, [previous, status, next]));
  function show(index) {
    if (index < 0 || index >= images.length) return;
    current = index;
    const token = ++request;
    count.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(images.length).padStart(2, '0');
    previous.disabled = index === 0;
    next.disabled = index === images.length - 1;
    previous.hidden = next.hidden = images.length === 1;
    status.textContent = 'Loading image…';
    const source = images[index];
    const image = new Image();
    image.alt = source.alt || '';
    image.onload = () => { if (token !== request) return; stage.replaceChildren(image); status.textContent = ''; };
    image.onerror = () => { if (token !== request) return; status.textContent = 'Image unavailable. Try another image.'; };
    image.src = safeUrl(source.src, { image: true });
  }
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
  });
  return { element: dialog, open(index = 0) {
    if (!images.length) return;
    stage.replaceChildren();
    controller.open();
    show(Math.max(0, Math.min(index, images.length - 1)));
  }, close: controller.close };
}
