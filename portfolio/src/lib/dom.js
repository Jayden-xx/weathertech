let sequence = 0;
export const uid = (prefix = 'nuvv') => prefix + '-' + (++sequence);

export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [children].flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function safeUrl(value, { image = false } = {}) {
  const url = new URL(String(value), 'https://nuvv.invalid/');
  const protocols = image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:'];
  if (!protocols.includes(url.protocol)) throw new TypeError('허용하지 않는 주소 형식입니다.');
  return String(value);
}

export function validateAbout(value) {
  const errors = {};
  for (const [key, limit] of Object.entries({ title: 80, body: 1200, specialty: 120 })) {
    const text = value[key] || '';
    if (!text.trim()) errors[key] = '필수 항목을 입력해 주세요.';
    else if (Array.from(text).length > limit) errors[key] = limit + '자 이내로 입력해 주세요.';
  }
  return errors;
}
