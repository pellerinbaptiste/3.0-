// Dessin SVG d'une chaussette (motif + emoji). La droite est le miroir de la gauche.
let uid = 0;

const SOCK_PATH = 'M28 6 H68 V78 Q68 92 80 97 L88 101 Q100 107 96 122 Q92 135 76 134 L38 132 Q18 130 22 108 L28 84 Z';

function pattern(id, kind, base, accent) {
  switch (kind) {
    case 'stripes':
      return `<pattern id="${id}" width="20" height="16" patternUnits="userSpaceOnUse">
        <rect width="20" height="16" fill="${base}"/><rect y="10" width="20" height="6" fill="${accent}"/></pattern>`;
    case 'dots':
      return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="${base}"/><circle cx="7" cy="7" r="2.6" fill="${accent}"/></pattern>`;
    case 'diamonds':
      return `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse">
        <rect width="18" height="18" fill="${base}"/><path d="M9 1 L17 9 L9 17 L1 9 Z" fill="${accent}" opacity=".85"/></pattern>`;
    case 'stars':
      return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill="${base}"/>
        <path d="M11 4 L12.6 9 L18 9 L13.7 12 L15.3 17 L11 14 L6.7 17 L8.3 12 L4 9 L9.4 9 Z" fill="${accent}"/></pattern>`;
    case 'flames':
      return `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="${accent}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="#5d1000"/></linearGradient>`;
    case 'spiral':
      return `<radialGradient id="${id}" cx=".5" cy=".55" r=".6">
        <stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="${base}"/><stop offset=".8" stop-color="${accent}"/><stop offset="1" stop-color="${base}"/></radialGradient>`;
    case 'rainbow':
      return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        ${['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa']
          .map((c, i) => `<stop offset="${i / 5}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    case 'tricolor':
      return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0d47a1"/><stop offset=".33" stop-color="#0d47a1"/>
        <stop offset=".33" stop-color="#ffffff"/><stop offset=".66" stop-color="#ffffff"/>
        <stop offset=".66" stop-color="#e53935"/><stop offset="1" stop-color="#e53935"/></linearGradient>`;
    default:
      return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${base}"/></pattern>`;
  }
}

export function sockSVG(sock, side = 'R', { size = 64 } = {}) {
  const id = `sp${++uid}`;
  const [base, accent] = sock.colors;
  const flip = side === 'L' ? 'transform="translate(118 0) scale(-1 1)"' : '';
  const emoji = sock.emoji
    ? `<text x="${side === 'L' ? 70 : 48}" y="62" font-size="26" text-anchor="middle" dominant-baseline="middle">${sock.emoji}</text>`
    : '';
  return `<svg class="sock-svg" viewBox="0 0 118 140" width="${size}" height="${Math.round(size * 140 / 118)}" role="img" aria-label="${sock.name} (${side === 'L' ? 'gauche' : 'droite'})">
    <defs>${pattern(id, sock.pattern, base, accent)}</defs>
    <g ${flip}>
      <path d="${SOCK_PATH}" fill="url(#${id})" stroke="rgba(0,0,0,.45)" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="28" y="6" width="40" height="14" fill="${accent}" stroke="rgba(0,0,0,.45)" stroke-width="2.5"/>
      <path d="M30 18 V8 M36 18 V8 M42 18 V8 M48 18 V8 M54 18 V8 M60 18 V8 M66 18 V8" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>
    </g>
    ${emoji}
  </svg>`;
}

export function emptySockSVG(side = 'R', { size = 64 } = {}) {
  const flip = side === 'L' ? 'transform="translate(118 0) scale(-1 1)"' : '';
  return `<svg class="sock-svg empty" viewBox="0 0 118 140" width="${size}" height="${Math.round(size * 140 / 118)}" aria-hidden="true">
    <g ${flip}><path d="${SOCK_PATH}" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="7 6" stroke-linejoin="round"/></g>
    <text x="${side === 'L' ? 70 : 48}" y="70" font-size="30" text-anchor="middle" dominant-baseline="middle" fill="currentColor">?</text>
  </svg>`;
}
