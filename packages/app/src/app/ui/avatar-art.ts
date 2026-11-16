/**
 * Disegno dell'avatar in stile "figurina": mezzo busto vettoriale con ombre morbide, braccia per i
 * tatuaggi. Funzioni pure che producono una lista di forme SVG (viewBox 200×240, testa in 100,84);
 * il componente le disegna in ordine.
 */
import type { AvatarParts, TattooZone } from '@outstanding/content';
import type { Appearance, Kit } from '@outstanding/engine';

export type Shape =
  | {
      t: 'path';
      d: string;
      fill?: string;
      stroke?: string;
      sw?: number;
      op?: number;
      dash?: string;
    }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; op?: number }
  | {
      t: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      rx?: number;
      fill: string;
      op?: number;
    }
  | {
      t: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      font: string;
      fill: string;
      rot: number;
      op?: number;
      ls?: number;
    };

export const VIEW_W = 200;
export const VIEW_H = 240;

const INK = '#22344A';
const TAT_OP = 0.82;
const SHADE = 'rgba(60,25,10,0.16)';
const GOLD = '#E9C46A';
const GREY = '#B9B9B4';
/** Metà larghezza delle spalle per corporatura (snella, atletica, robusta). */
const SHOULDERS: Readonly<Record<string, number>> = { snella: 58, atletica: 66, robusta: 74 };
const NEUTRAL_KIT: Kit = { primary: '#3A4A40', secondary: '#A9BBAE', pattern: 'solid' };

/** Mescola due colori esadecimali (t = 0 il primo, 1 il secondo). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Grigio dei capelli con l'età: 0 fino a `greyFromAge`, 1 da `fullGreyAge`. */
export function greyness(age: number | null, a: Appearance, parts: AvatarParts): number {
  if (!a.ageing || age === null) return 0;
  const { greyFromAge, fullGreyAge } = parts.ageing;
  return Math.min(1, Math.max(0, (age - greyFromAge) / (fullGreyAge - greyFromAge)));
}

function armBox(sw: number, zone: 'armLeft' | 'armRight') {
  return { x: zone === 'armLeft' ? 100 - sw - 20 : 100 + sw - 4, w: 24 };
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.44 : r;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + Math.cos(ang) * rr).toFixed(1)} ${(cy + Math.sin(ang) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}

/** Simbolo di un tatuaggio centrato in (cx, cy), in scala `s` (1 = braccio). */
function symbol(id: string, cx: number, cy: number, s: number): Shape[] {
  const k = (v: number) => v * s;
  const line = { stroke: INK, sw: 1.8 * s, op: TAT_OP };
  switch (id) {
    case 'stella':
      return [{ t: 'path', d: star(cx, cy, k(8)), fill: INK, op: TAT_OP }];
    case 'rosa':
      return [
        { t: 'circle', cx, cy, r: k(6.5), fill: '#C8202F', stroke: INK, sw: 1.4 * s },
        {
          t: 'path',
          d: `M${cx - k(3)} ${cy} Q${cx} ${cy - k(5)} ${cx + k(3)} ${cy} Q${cx} ${cy + k(4)} ${cx - k(2)} ${cy + k(1)}`,
          ...line,
        },
        { t: 'path', d: `M${cx} ${cy + k(7)} V${cy + k(22)}`, ...line },
        {
          t: 'path',
          d: `M${cx} ${cy + k(13)} Q${cx - k(8)} ${cy + k(9)} ${cx - k(9)} ${cy + k(17)} Q${cx - k(3)} ${cy + k(18)} ${cx} ${cy + k(13)}Z`,
          fill: '#1E7A46',
          stroke: INK,
          sw: 1.2 * s,
        },
      ];
    case 'pallone':
      return [
        { t: 'circle', cx, cy, r: k(8), fill: '#F1EBDD', stroke: INK, sw: 1.6 * s },
        { t: 'path', d: star(cx, cy, k(3.4)), fill: INK, op: TAT_OP },
      ];
    case 'corona':
      return [
        {
          t: 'path',
          d: `M${cx - k(9)} ${cy + k(6)} L${cx - k(9)} ${cy - k(6)} L${cx - k(4)} ${cy} L${cx} ${cy - k(9)} L${cx + k(4)} ${cy} L${cx + k(9)} ${cy - k(6)} L${cx + k(9)} ${cy + k(6)}Z`,
          fill: INK,
          op: TAT_OP,
        },
      ];
    case 'coppa':
      return [
        {
          t: 'path',
          d: `M${cx - k(8)} ${cy - k(9)} H${cx + k(8)} Q${cx + k(8)} ${cy + k(3)} ${cx} ${cy + k(5)} Q${cx - k(8)} ${cy + k(3)} ${cx - k(8)} ${cy - k(9)}Z M${cx - k(1.5)} ${cy + k(5)} H${cx + k(1.5)} V${cy + k(11)} H${cx - k(1.5)}Z M${cx - k(6)} ${cy + k(11)} H${cx + k(6)} V${cy + k(14)} H${cx - k(6)}Z`,
          fill: INK,
          op: TAT_OP,
        },
      ];
    case 'ali':
      return [
        {
          t: 'path',
          d: `M${cx} ${cy + k(8)} Q${cx - k(12)} ${cy} ${cx - k(11)} ${cy - k(12)} Q${cx - k(6)} ${cy - k(4)} ${cx} ${cy - k(2)} Q${cx + k(6)} ${cy - k(4)} ${cx + k(11)} ${cy - k(12)} Q${cx + k(12)} ${cy} ${cx} ${cy + k(8)}Z`,
          fill: INK,
          op: TAT_OP,
        },
      ];
    default:
      return [];
  }
}

/** Tatuaggio su un braccio: la parte visibile va da sotto la manica (y 182) al bordo (y 240). */
function armTattoo(id: string, x: number, w: number): Shape[] {
  const cx = x + w / 2;
  switch (id) {
    case 'tribale':
      return [
        {
          t: 'path',
          d: `M${x + 2} 186 Q${cx} 194 ${x + w - 2} 184 L${x + w - 6} 196 Q${cx} 192 ${x + 6} 198Z M${x + 3} 206 Q${cx} 216 ${x + w - 2} 204 L${x + w - 4} 218 Q${cx} 214 ${x + 4} 222Z M${x + 2} 228 Q${cx} 232 ${x + w - 2} 224 L${x + w - 4} 234 Q${cx} 234 ${x + 3} 238Z`,
          fill: INK,
          op: TAT_OP,
        },
      ];
    case 'scritta':
      return [
        {
          t: 'text',
          x: cx + 5,
          y: 230,
          text: 'MAMMA',
          size: 14,
          font: 'var(--o-font-display)',
          fill: INK,
          rot: -90,
          op: TAT_OP,
          ls: 1,
        },
      ];
    case 'numeri_romani':
      return [
        {
          t: 'text',
          x: cx + 5,
          y: 228,
          text: 'XXIV',
          size: 15,
          font: 'var(--o-font-display)',
          fill: INK,
          rot: -90,
          op: TAT_OP,
          ls: 2,
        },
      ];
    case 'manica': {
      const line = { stroke: INK, sw: 1.8, op: TAT_OP };
      return [
        { t: 'path', d: `M${x + 1} 186 Q${cx} 192 ${x + w - 1} 184`, ...line },
        {
          t: 'path',
          d: `M${x + 2} 194 Q${x + 8} 202 ${x + 4} 210 Q${x + 12} 206 ${x + 14} 214 Q${x + 18} 204 ${x + w - 2} 206`,
          ...line,
        },
        { t: 'circle', cx, cy: 222, r: 5, stroke: INK, sw: 1.8 },
        { t: 'path', d: `M${x + 2} 232 Q${cx} 226 ${x + w - 2} 234`, ...line },
        {
          t: 'path',
          d: `M${x + 3} 214 L${x + 6} 218 M${x + w - 4} 214 L${x + w - 7} 220`,
          ...line,
        },
      ];
    }
    default:
      return symbol(id, cx, id === 'rosa' ? 200 : 208, 1);
  }
}

function hairShapes(style: string, color: string, skin: string): { back: Shape[]; front: Shape[] } {
  const fill = (d: string, op?: number): Shape => ({ t: 'path', d, fill: color, op });
  switch (style) {
    case 'corti':
      return {
        back: [],
        front: [
          fill(
            'M70 82 C68 52 84 42 101 42 C119 42 133 54 130 82 C126 68 118 61 107 59 C97 67 84 71 70 82Z',
          ),
        ],
      };
    case 'rasati':
      return {
        back: [],
        front: [
          fill(
            'M71 78 C71 54 85 46 100 46 C115 46 129 54 129 78 C122 66 112 61 100 61 C88 61 78 66 71 78Z',
            0.75,
          ),
        ],
      };
    case 'lunghi':
      return {
        back: [
          fill(
            'M68 88 C63 50 82 39 100 39 C120 39 137 50 132 88 C134 106 137 120 142 130 C131 128 126 118 126 106 L126 78 C116 70 108 66 100 66 C92 66 84 70 74 78 L74 106 C74 118 69 128 58 130 C63 120 66 106 68 88Z',
          ),
        ],
        front: [
          fill(
            'M68 86 C63 50 82 39 100 39 C120 39 137 50 132 86 C126 72 114 64 100 64 C86 64 74 72 68 86Z',
          ),
        ],
      };
    case 'ricci': {
      const front: Shape[] = [
        fill(
          'M68 84 C66 56 82 44 100 44 C118 44 134 56 132 84 C124 70 112 64 100 64 C88 64 76 70 68 84Z',
        ),
      ];
      for (let a = 170; a <= 370; a += 18) {
        const r = (a * Math.PI) / 180;
        front.push({
          t: 'circle',
          cx: +(100 + Math.cos(r) * 31).toFixed(1),
          cy: +(70 + Math.sin(r) * 27).toFixed(1),
          r: 10,
          fill: color,
        });
      }
      for (let a = 200; a <= 340; a += 28) {
        const r = (a * Math.PI) / 180;
        front.push({
          t: 'circle',
          cx: +(100 + Math.cos(r) * 18).toFixed(1),
          cy: +(66 + Math.sin(r) * 16).toFixed(1),
          r: 10,
          fill: color,
        });
      }
      return { back: [], front };
    }
    case 'cresta':
      return {
        back: [],
        front: [
          fill(
            'M71 78 C71 54 85 46 100 46 C115 46 129 54 129 78 C122 66 112 61 100 61 C88 61 78 66 71 78Z',
            0.3,
          ),
          fill('M90 56 C91 40 95 30 100 22 C105 30 109 40 110 56 C104 52 96 52 90 56Z'),
        ],
      };
    case 'codino':
      return {
        back: [{ t: 'circle', cx: 100, cy: 38, r: 9, fill: color }],
        front: [
          fill(
            'M70 82 C68 52 84 42 101 42 C119 42 133 54 130 82 C126 68 118 61 107 59 C97 67 84 71 70 82Z',
          ),
        ],
      };
    case 'raccolti':
      return {
        back: [{ t: 'circle', cx: 100, cy: 36, r: 12, fill: color }],
        front: [
          fill(
            'M70 80 C68 54 84 44 100 44 C116 44 132 54 130 80 C124 66 112 60 100 60 C88 60 76 66 70 80Z',
          ),
        ],
      };
    case 'riga':
      return {
        back: [],
        front: [
          fill(
            'M70 84 C66 52 84 41 102 41 C120 41 134 54 130 84 C128 70 122 62 112 58 C100 58 84 64 78 74 C76 76 72 80 70 84Z',
          ),
          { t: 'path', d: 'M86 45 Q92 51 93 58', stroke: skin, sw: 1.6, op: 0.7 },
        ],
      };
    case 'treccine': {
      const front: Shape[] = [
        fill(
          'M70 80 C68 54 84 44 100 44 C116 44 132 54 130 80 C124 66 112 60 100 60 C88 60 76 66 70 80Z',
        ),
      ];
      for (const x of [80, 88, 96, 104, 112, 120]) {
        front.push({
          t: 'path',
          d: `M${x} 49 Q${x + (x - 100) * 0.15} 56 ${x + (x - 100) * 0.3} 64`,
          stroke: skin,
          sw: 1.4,
          op: 0.45,
        });
      }
      return { back: [], front };
    }
    default:
      return { back: [], front: [] };
  }
}

function faceShape(face: string, skin: string): Shape {
  if (face === 'squadrato') {
    return {
      t: 'path',
      d: 'M70 70 C70 54 84 47 100 47 C116 47 130 54 130 70 V92 C130 112 116 121 100 121 C84 121 70 112 70 92Z',
      fill: skin,
    };
  }
  if (face === 'tondo') return { t: 'ellipse', cx: 100, cy: 85, rx: 32, ry: 35, fill: skin };
  return { t: 'ellipse', cx: 100, cy: 84, rx: 30, ry: 37, fill: skin };
}

function eyesShapes(shape: string, color: string): Shape[] {
  const [rx, ry, ir] =
    shape === 'tondi' ? [5, 5, 3.2] : shape === 'sottili' ? [6, 2.6, 2.4] : [5.5, 4, 3];
  return [88, 112].flatMap<Shape>((x) => [
    { t: 'ellipse', cx: x, cy: 87, rx, ry, fill: '#FFFFFF' },
    { t: 'circle', cx: x + 1, cy: 87, r: ir, fill: color },
    { t: 'circle', cx: x + 1.6, cy: 86, r: 0.9, fill: '#FFFFFF' },
  ]);
}

const BROWS: Readonly<Record<string, { d: string; sw: number }>> = {
  dritte: { d: 'M81 78 L95 77 M105 77 L119 78', sw: 2.6 },
  arcuate: { d: 'M81 79 Q88 74 95 77 M105 77 Q112 74 119 79', sw: 2.6 },
  folte: { d: 'M81 79 Q88 74 95 77 M105 77 Q112 74 119 79', sw: 4.2 },
};
const NOSES: Readonly<Record<string, string>> = {
  piccolo: 'M100 90 Q98 96 100 98 Q102 98 103 97',
  dritto: 'M100 86 Q97 97 99 99 Q102 100 104 98',
  largo: 'M98 88 Q94 98 97 100 Q100 102 104 100 Q107 98 104 96',
};
const BEARDS: Readonly<Record<string, string>> = {
  accenno:
    'M71 90 C73 112 86 123 100 123 C114 123 127 112 129 90 C122 104 112 111 100 111 C88 111 78 104 71 90Z',
  barba:
    'M69 84 C69 112 83 127 100 127 C117 127 131 112 131 84 C127 98 120 103 114 101 C108 98 104 97 100 97 C96 97 92 98 86 101 C80 103 73 98 69 84Z',
  pizzetto: 'M93 108 C95 117 105 117 107 108 C107 119 104 124 100 124 C96 124 93 119 93 108Z',
};
const MOUSTACHE = 'M88 104 Q100 97 112 104 Q100 102 88 104Z';

function kitShapes(kit: Kit, sw: number): Shape[] {
  const torso = `M${100 - sw} 166 Q${100 - sw} 142 ${100 - sw + 20} 140 L84 134 Q100 146 116 134 L${100 + sw - 20} 140 Q${100 + sw} 142 ${100 + sw} 166 L${100 + sw - 4} 240 L${100 - sw + 4} 240Z`;
  const out: Shape[] = [{ t: 'path', d: torso, fill: kit.primary }];
  if (kit.pattern === 'vstripes') {
    for (const dx of [-36, -12, 12, 36])
      out.push({ t: 'path', d: `M${100 + dx} 140 V240`, stroke: kit.secondary, sw: 7 });
  } else if (kit.pattern === 'hstripes') {
    for (const y of [178, 204, 230])
      out.push({ t: 'path', d: `M${100 - sw} ${y} H${100 + sw}`, stroke: kit.secondary, sw: 9 });
  } else if (kit.pattern === 'sash') {
    out.push({
      t: 'path',
      d: `M${100 - sw + 14} 142 L${100 + sw - 4} 236`,
      stroke: kit.secondary,
      sw: 14,
    });
  } else {
    out.push({ t: 'path', d: 'M84 134 Q100 146 116 134', stroke: kit.secondary, sw: 5 });
  }
  // Ombra sul fianco sinistro e colletto.
  out.push({
    t: 'path',
    d: `M${100 - sw} 166 Q${100 - sw} 142 ${100 - sw + 20} 140 L${100 - sw + 22} 240 L${100 - sw + 4} 240Z`,
    fill: 'rgba(0,0,0,0.14)',
  });
  return out;
}

/** Tutte le forme dell'avatar, dal fondo al primo piano. */
export function avatarShapes(
  a: Appearance,
  parts: AvatarParts,
  kit: Kit | null,
  age: number | null,
): Shape[] {
  const pick = <T>(list: readonly T[], i: number, fallback: T): T => list[i] ?? fallback;
  const skin = pick(parts.skinTones, a.skin, '#E2AE86');
  const baseHair = pick(parts.hairColors, a.hairColor, '#3B2A1E');
  const grey = greyness(age, a, parts);
  const hairColor = grey > 0 ? mix(baseHair, GREY, grey) : baseHair;
  const style = pick(parts.hairStyles, a.hairStyle, 'corti');
  const sw = SHOULDERS[pick(parts.bodies, a.body, 'atletica')] ?? SHOULDERS['atletica']!;
  const shirt = kit ?? NEUTRAL_KIT;
  const hair = hairShapes(style, hairColor, skin);
  const out: Shape[] = [];

  out.push({ t: 'rect', x: 0, y: 0, w: VIEW_W, h: VIEW_H, fill: 'var(--o-surface)' });
  out.push({ t: 'circle', cx: 100, cy: 96, r: 78, fill: 'rgba(255,255,255,0.04)' });

  // Braccia con ombra, tatuaggi, collo.
  for (const zone of ['armLeft', 'armRight'] as const) {
    const b = armBox(sw, zone);
    out.push({ t: 'rect', x: b.x, y: 146, w: b.w, h: 110, rx: 12, fill: skin });
    out.push({
      t: 'rect',
      x: b.x + (zone === 'armLeft' ? 0 : 14),
      y: 146,
      w: 10,
      h: 110,
      fill: SHADE,
    });
    const id = a.tattoos[zone];
    if (id) out.push(...armTattoo(id, b.x, b.w));
  }
  out.push({ t: 'path', d: 'M86 102 h28 v36 q-14 9 -28 0z', fill: skin });
  out.push({ t: 'path', d: 'M86 112 q14 10 28 0 v6 q-14 8 -28 0z', fill: SHADE });
  const neck = a.tattoos.neck;
  if (neck) out.push(...symbol(neck, 109, 125, 0.62));

  out.push(...kitShapes(shirt, sw));
  for (const zone of ['armLeft', 'armRight'] as const) {
    const b = armBox(sw, zone);
    out.push({ t: 'rect', x: b.x - 2, y: 144, w: b.w + 4, h: 34, rx: 10, fill: shirt.primary });
    out.push({ t: 'rect', x: b.x - 2, y: 172, w: b.w + 4, h: 6, fill: shirt.secondary });
  }
  if (pick(parts.necklaces, a.necklace, 'nessuna') === 'catenina') {
    out.push({ t: 'path', d: 'M86 136 Q100 150 114 136', stroke: GOLD, sw: 2, dash: '2 1.5' });
  }

  // Testa: capelli dietro, orecchie, viso, ombra.
  out.push(...hair.back);
  out.push({ t: 'ellipse', cx: 70, cy: 88, rx: 6, ry: 9, fill: skin });
  out.push({ t: 'ellipse', cx: 130, cy: 88, rx: 6, ry: 9, fill: skin });
  out.push(faceShape(pick(parts.faceShapes, a.face, 'ovale'), skin));
  out.push({
    t: 'path',
    d: 'M100 47 C118 47 130 62 130 84 C130 106 117 121 100 121 C112 112 118 98 118 84 C118 66 112 54 100 47Z',
    fill: SHADE,
  });

  const earring = pick(parts.earrings, a.earring, 'nessuno');
  if (earring === 'punto') {
    for (const x of [70, 130])
      out.push({ t: 'circle', cx: x, cy: 96, r: 2.4, fill: '#F2D27A', stroke: '#B88A2A', sw: 0.8 });
  } else if (earring === 'cerchio') {
    for (const x of [70, 130])
      out.push({ t: 'circle', cx: x, cy: 99, r: 3.6, stroke: GOLD, sw: 1.5 });
  }

  // Barba e baffi.
  const beard = pick(parts.beards, a.beard, 'nessuna');
  const beardPath = BEARDS[beard];
  if (beardPath)
    out.push({ t: 'path', d: beardPath, fill: hairColor, op: beard === 'accenno' ? 0.35 : 1 });
  if (beard === 'barba' || beard === 'baffi') {
    out.push({
      t: 'path',
      d: MOUSTACHE,
      fill: hairColor,
      stroke: beard === 'baffi' ? hairColor : undefined,
      sw: 2.4,
    });
  }

  // Occhi, sopracciglia, naso, bocca.
  out.push(
    ...eyesShapes(
      pick(parts.eyeShapes, a.eyes, 'mandorla'),
      pick(parts.eyeColors, a.eyeColor, '#4A2E1A'),
    ),
  );
  const brows = BROWS[pick(parts.brows, a.brows, 'arcuate')] ?? BROWS['arcuate']!;
  out.push({ t: 'path', d: brows.d, stroke: hairColor, sw: brows.sw });
  out.push({
    t: 'path',
    d: NOSES[pick(parts.noses, a.nose, 'dritto')] ?? NOSES['dritto']!,
    stroke: 'rgba(90,40,20,0.45)',
    sw: 1.6,
  });
  out.push({ t: 'path', d: 'M92 107 Q100 112 108 107', stroke: '#7A3B26', sw: 2.2 });

  // Capelli davanti, stempiatura con l'età, fascia.
  out.push(...hair.front);
  const bald = style === 'calvo' || style === 'rasati' || style === 'cresta';
  if (
    a.ageing &&
    age !== null &&
    age >= parts.ageing.recedeFromAge &&
    !bald &&
    hair.front.length > 0
  ) {
    out.push({ t: 'ellipse', cx: 81, cy: 63, rx: 8, ry: 6.5, fill: skin });
    out.push({ t: 'ellipse', cx: 119, cy: 63, rx: 8, ry: 6.5, fill: skin });
  }
  if (pick(parts.headbands, a.headband, 'nessuna') === 'fascia') {
    out.push({
      t: 'path',
      d: 'M70 70 Q100 56 130 70 L130 78 Q100 64 70 78Z',
      fill: shirt.secondary === '#FFFFFF' ? shirt.primary : shirt.secondary,
    });
  }
  return out;
}

/** Zone in cui un tatuaggio si può fare, per l'interfaccia. */
export const ZONES: readonly TattooZone[] = ['armLeft', 'armRight', 'neck'];
