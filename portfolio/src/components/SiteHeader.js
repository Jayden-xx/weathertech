import { el, uid } from '../lib/dom.js';
import { attachDialog } from '../lib/dialog.js';
import { Button } from './Button.js';
export function SiteHeader({ brand = 'Nuvv', home = '/', links = [{ label: 'Work', href: '/work' }, { label: 'About', href: '/#about' }, { label: 'Contact', href: '/#contact' }], current } = {}) {
  const id = uid('menu');
  const navigation = (mobile = false) => el('nav', { className: mobile ? 'mobile-nav' : 'desktop-nav', 'aria-label': mobile ? 'Mobile navigation' : 'Main navigation' }, links.map(link => {
    const item = Button({ label: link.label, href: link.href, variant: 'text', onClick: () => { if (mobile) controller.close(); } });
    if (link.href === current) item.setAttribute('aria-current', 'page');
    return item;
  }));
  const dialog = el('dialog', { id, className: 'menu-dialog', 'aria-label': 'Navigation' });
  const controller = attachDialog(dialog, { onClose: () => openButton.setAttribute('aria-expanded', 'false') });
  const openButton = Button({ label: 'Open menu', icon: 'menu', iconOnly: true, variant: 'ghost', onClick: () => { controller.open(); openButton.setAttribute('aria-expanded', 'true'); } });
  openButton.classList.add('mobile-menu-toggle');
  openButton.setAttribute('aria-expanded', 'false');
  openButton.setAttribute('aria-controls', id);
  dialog.append(el('div', { className: 'menu-dialog__bar' }, [el('span', { className: 'brand', text: brand }), Button({ label: 'Close menu', icon: 'close', iconOnly: true, variant: 'ghost', onClick: controller.close })]), navigation(true));
  dialog.addEventListener('click', event => { if (event.target === dialog) controller.close(); });
  const header = el('header', { className: 'site-header' }, [el('div', { className: 'container site-header__inner' }, [el('a', { className: 'brand', href: home, text: brand }), navigation(), openButton]), dialog]);
  const observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
    const inner = header.firstElementChild;
    header.classList.remove('is-compact');
    if (inner.scrollWidth > inner.clientWidth) header.classList.add('is-compact');
    if (window.innerWidth >= 768 && !header.classList.contains('is-compact') && dialog.open) controller.close();
  });
  observer.observe(header);
  header.destroy = () => { observer.disconnect(); if (dialog.open) controller.close(); };
  return header;
}
