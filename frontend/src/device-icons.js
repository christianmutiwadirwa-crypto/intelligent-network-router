// SVG definitions for Router and PC, styled to match Lucide React icons
const routerSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
  <path d="M6.01 18H6"/>
  <path d="M10.01 18H10"/>
  <path d="M15 10v4"/>
  <path d="M17.84 7.17a4 4 0 0 0-5.66 0"/>
  <path d="M20.66 4.34a8 8 0 0 0-11.31 0"/>
</svg>
`;

const pcSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
  <line x1="8" y1="21" x2="16" y2="21"/>
  <line x1="12" y1="17" x2="12" y2="21"/>
</svg>
`;

export const routerImg = new Image();
routerImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(routerSvgString);

export const pcImg = new Image();
pcImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pcSvgString);
