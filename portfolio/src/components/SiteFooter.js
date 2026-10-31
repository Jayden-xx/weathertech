import { el } from '../lib/dom.js';
import { Button } from './Button.js';
export function SiteFooter({ brand = 'Nuvv', year = new Date().getFullYear(), links = [] } = {}) {
  return el('footer', { className: 'site-footer container' }, [
    el('p', { className: 'muted', text: '© ' + year + ' ' + brand }),
    el('nav', { 'aria-label': 'Footer navigation', className: 'footer-links' }, links.map(link => Button({ ...link, variant: 'text' }))),
  ]);
}
