const paths = {
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['m6 6 12 12M18 6 6 18'],
  next: ['m9 5 7 7-7 7'],
  previous: ['m15 5-7 7 7 7'],
  arrow: ['M5 12h14m-6-6 6 6-6 6'],
  external: ['M14 4h6v6M20 4 10 14', 'M10 4H4v16h16v-6'],
  copy: ['M9 9h11v11H9z', 'M15 9V4H4v11h5'],
  check: ['m5 12 4 4L19 6'],
  error: ['M12 8v5M12 17h.01', 'M12 3 2 21h20z'],
};
export function Icon(name = 'arrow') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(key, value);
  for (const d of paths[name] || paths.arrow) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
