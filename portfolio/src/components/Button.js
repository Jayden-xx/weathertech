import { el, safeUrl } from '../lib/dom.js';
import { Icon } from './Icon.js';

export function Button({ label, href, variant = 'primary', size = 'default', icon, iconOnly = false, disabled = false, onClick, newTab = false } = {}) {
  const isLink = href !== undefined;
  const node = el(isLink ? 'a' : 'button', {
    className: 'button button--' + variant + (size === 'small' ? ' button--small' : '') + (iconOnly ? ' button--icon' : ''),
    ...(isLink ? { href: disabled ? undefined : safeUrl(href), ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } : { type: 'button', disabled }),
    'aria-label': iconOnly ? label : (newTab ? label + ' (opens in a new tab)' : undefined),
    'aria-disabled': disabled ? 'true' : undefined,
    onClick: (event) => { if (disabled) event.preventDefault(); else onClick?.(event); },
  });
  const text = el('span', { className: iconOnly ? 'sr-only' : '', text: label });
  node.append(text);
  if (icon) node.append(Icon(icon));
  node.setLoading = (loading, loadingLabel = '처리 중…') => {
    if (isLink) throw new TypeError('처리 중 상태는 실행 버튼에만 사용할 수 있습니다.');
    node.disabled = disabled || loading;
    node.setAttribute('aria-busy', String(loading));
    text.textContent = loading ? loadingLabel : label;
    node.classList.toggle('is-loading', loading);
  };
  return node;
}
