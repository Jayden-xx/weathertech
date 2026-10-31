import { el, safeUrl } from '../lib/dom.js';
import { Button } from './Button.js';
import { Notice } from './Notice.js';
export function ContactLinks({ email, instagram } = {}) {
  const notice = Notice();
  let timer;
  const root = el('div', { className: 'contact-links', lang: 'en' });
  if (email) {
    const copy = Button({ label: 'Copy email', icon: 'copy', variant: 'secondary', onClick: async () => {
      clearTimeout(timer);
      copy.setLoading(true, 'Copying…');
      try {
        await navigator.clipboard.writeText(email);
        notice.setMessage('Email copied', 'success');
        timer = setTimeout(() => notice.setMessage(''), 4000);
      } catch { notice.setMessage('Copy didn’t work. Select the email address to copy it.', 'error'); }
      finally { copy.setLoading(false); }
    } });
    root.append(el('div', { className: 'contact-links__email' }, [el('a', { href: 'mailto:' + encodeURIComponent(email), className: 'email-link', text: email }), copy]));
  } else root.append(el('p', { className: 'muted', text: 'Contact details coming soon.' }));
  if (instagram) root.append(Button({ label: 'Instagram', href: safeUrl(instagram), variant: 'text', icon: 'external', newTab: true }));
  root.append(notice);
  root.destroy = () => clearTimeout(timer);
  return root;
}
