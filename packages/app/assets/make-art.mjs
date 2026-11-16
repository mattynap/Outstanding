/**
 * Genera le immagini sorgente di icona e schermata d'avvio (SVG disegnati dal codice, poi PNG con
 * sharp). Da qui `@capacitor/assets` ricava tutte le misure per Android.
 *
 *   node assets/make-art.mjs && npx capacitor-assets generate --android
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));

// Colori del tema (packages/app/src/theme/tokens.css).
const BG = '#0b1f15';
const STRIPE = '#0e2619';
const GOLD = '#f2b830';
const BALL = '#f1ebdd';
const INK = '#14140f';

/** Righe verticali del campo falciato. */
function stripes(size, count = 8) {
  const w = size / count;
  let out = `<rect width="${size}" height="${size}" fill="${BG}"/>`;
  for (let i = 1; i < count; i += 2) {
    out += `<rect x="${i * w}" y="0" width="${w}" height="${size}" fill="${STRIPE}"/>`;
  }
  return out;
}

const pt = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Il marchio: la "O" d'oro con dentro un pallone. `r` è il raggio esterno dell'anello. */
function mark(cx, cy, r) {
  const ring = r * 0.13;
  const R = r - ring * 1.6; // raggio del pallone
  const p = R * 0.36; // raggio del pentagono centrale
  const center = [0, 72, 144, 216, 288].map((d) => pt(cx, cy, p, d));
  let ball = '';
  // Pentagoni esterni (tagliati dal bordo del pallone) e cuciture.
  for (let k = 0; k < 5; k++) {
    const dir = k * 72 + 36;
    const [ox, oy] = pt(cx, cy, R * 0.92, dir);
    const outer = [0, 72, 144, 216, 288].map((d) => pt(ox, oy, p * 0.95, d + dir + 180));
    ball += `<polygon points="${poly(outer)}" fill="${INK}"/>`;
    const [sx, sy] = center[(k + 1) % 5];
    const [ex, ey] = pt(cx, cy, R * 0.66, k * 72 + 72);
    ball += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${INK}" stroke-width="${(R * 0.035).toFixed(1)}" stroke-linecap="round"/>`;
  }
  ball += `<polygon points="${poly(center)}" fill="${INK}"/>`;
  return `
    <defs><clipPath id="ball"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="${BALL}"/>
    <g clip-path="url(#ball)">${ball}</g>
    <circle cx="${cx}" cy="${cy}" r="${r - ring / 2}" fill="none" stroke="${GOLD}" stroke-width="${ring}"/>`;
}

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const files = {
  // Icona classica: campo e marchio grande.
  'icon-only': svg(1024, stripes(1024) + mark(512, 512, 380)),
  // Icona adattiva: il marchio resta nella zona sicura (66% del lato).
  'icon-foreground': svg(1024, mark(512, 512, 300)),
  'icon-background': svg(1024, stripes(1024)),
  // Schermata d'avvio: campo e marchio al centro, piccolo rispetto allo schermo.
  splash: svg(2732, stripes(2732, 12) + mark(1366, 1366, 330)),
  'splash-dark': svg(2732, stripes(2732, 12) + mark(1366, 1366, 330)),
};

for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(here, `${name}.svg`), content);
  await sharp(Buffer.from(content))
    .png()
    .toFile(join(here, `${name}.png`));
}
console.log('ok:', Object.keys(files).join(', '));
