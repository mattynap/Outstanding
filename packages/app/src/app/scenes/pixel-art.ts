import type Phaser from 'phaser';

/**
 * Pixel art disegnata dal codice: ogni sprite è una griglia di pixel con contorno scuro calcolato,
 * così le maglie cambiano colore senza ridisegnare nulla e non servono asset esterni.
 */

export { EMPTY, OUTLINE, Pix, css, glyphs, shade } from './pix';
import { OUTLINE, Pix, css, glyphs, shade } from './pix';

export const SKINS = [0xf0c39d, 0xd59c6d, 0xa86d47, 0x6f4430] as const;
export const HAIRS = [0x2a1c15, 0x5b3a1f, 0xc99a4b, 0x111114, 0x7a2f1d] as const;

export function canvas(scene: Phaser.Scene, key: string, w: number, h: number) {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Texture ${key} non creata`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return { tex, ctx };
}

/* ------------------------------------------------------------------ giocatori */

export interface Look {
  shirt: number;
  shorts: number;
  skin: number;
  hair: number;
  gloves?: number;
}

type P = readonly [number, number];
interface Pose {
  dy: number;
  /** [gamba dietro, gamba davanti] */
  feet: readonly [P, P];
  /** [braccio dietro, braccio davanti] */
  hands: readonly [P, P];
}

export const CELL_W = 16;
export const CELL_H = 22;
export const FEET_Y = 20;
/** Indici dei fotogrammi nella striscia di ogni giocatore. */
export const FRAME = { idle: 0, run: 2, kick0: 6, kick1: 7, stretch: 8, cheer: 9 } as const;

const BODY = [
  '..hhhh..',
  '.hhhhhh.',
  '.hhsses.',
  '.hsssss.',
  '..sSss..',
  '...SS...',
  '.jjccjj.',
  'jjjjjjjj',
  'jjjjjjjJ',
  '.JjjjjJ.',
  '.nnnnnn.',
  '.nNnnNn.',
];

// Coordinate su terreno a y=18; lo sprite aggiunge 2 righe di margine sopra per braccia alzate.
const POSES: readonly Pose[] = [
  {
    dy: 0,
    feet: [
      [6, 18],
      [9, 18],
    ],
    hands: [
      [4, 12],
      [11, 12],
    ],
  },
  {
    dy: 1,
    feet: [
      [6, 18],
      [9, 18],
    ],
    hands: [
      [3, 12],
      [12, 12],
    ],
  },
  {
    dy: 0,
    feet: [
      [3, 17],
      [12, 18],
    ],
    hands: [
      [13, 10],
      [3, 11],
    ],
  },
  {
    dy: 1,
    feet: [
      [6, 18],
      [9, 15],
    ],
    hands: [
      [6, 12],
      [10, 12],
    ],
  },
  {
    dy: 0,
    feet: [
      [12, 18],
      [3, 17],
    ],
    hands: [
      [3, 11],
      [13, 10],
    ],
  },
  {
    dy: 1,
    feet: [
      [9, 18],
      [6, 15],
    ],
    hands: [
      [10, 12],
      [6, 12],
    ],
  },
  {
    dy: 0,
    feet: [
      [2, 14],
      [9, 18],
    ],
    hands: [
      [13, 10],
      [2, 9],
    ],
  },
  {
    dy: 0,
    feet: [
      [7, 18],
      [13, 12],
    ],
    hands: [
      [1, 8],
      [12, 11],
    ],
  },
  {
    dy: 0,
    feet: [
      [6, 18],
      [9, 18],
    ],
    hands: [
      [11, 0],
      [14, 1],
    ],
  },
  {
    dy: 0,
    feet: [
      [5, 18],
      [10, 18],
    ],
    hands: [
      [2, 0],
      [13, 0],
    ],
  },
];

function drawPlayer(look: Look, pose: Pose): Pix {
  const OY = 2;
  const p = new Pix(CELL_W, CELL_H);
  const dy = pose.dy + OY;
  const colors: Record<string, number> = {
    h: look.hair,
    s: look.skin,
    S: shade(look.skin, 0.82),
    e: OUTLINE,
    j: look.shirt,
    J: shade(look.shirt, 0.74),
    c: shade(look.shirt, 1.35),
    n: look.shorts,
    N: shade(look.shorts, 0.8),
  };
  const hips: readonly [P, P] = [
    [6, 13 + dy],
    [9, 13 + dy],
  ];
  const shoulders: readonly [P, P] = [
    [4, 8 + dy],
    [11, 8 + dy],
  ];
  const leg = (i: 0 | 1) => {
    const dark = i === 0 ? 0.8 : 1;
    const [hx, hy] = hips[i];
    const [fx, fy] = pose.feet[i];
    p.line(hx, hy, fx, fy + OY, (t) => shade(t < 0.3 ? look.skin : 0xf1eee4, dark), 2);
    for (let k = 0; k < 3; k++) p.set(fx + k, fy + OY, shade(0x22222b, dark));
  };
  const arm = (i: 0 | 1) => {
    const dark = i === 0 ? 0.78 : 1;
    const [sx, sy] = shoulders[i];
    const [hx, hy] = pose.hands[i];
    p.line(sx, sy, hx, hy + OY, (t) => shade(t < 0.35 ? look.shirt : look.skin, dark), 2);
    if (look.gloves !== undefined) {
      p.set(hx, hy + OY, look.gloves);
      p.set(hx + 1, hy + OY, look.gloves);
    }
  };
  arm(0);
  leg(0);
  BODY.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]!;
      if (ch !== '.') p.set(4 + c, 1 + r + dy, colors[ch]!);
    }
  });
  leg(1);
  arm(1);
  return p.outlined();
}

/** Crea (una volta sola) la striscia di fotogrammi e le animazioni per un aspetto di giocatore. */
export function ensurePlayer(scene: Phaser.Scene, look: Look): string {
  const key = `pl-${[look.shirt, look.shorts, look.skin, look.hair, look.gloves ?? 0].join('-')}`;
  if (scene.textures.exists(key)) return key;
  const { tex, ctx } = canvas(scene, key, CELL_W * POSES.length, CELL_H);
  POSES.forEach((pose, i) => {
    drawPlayer(look, pose).blit(ctx, i * CELL_W, 0);
    tex.add(i, 0, i * CELL_W, 0, CELL_W, CELL_H);
  });
  tex.refresh();
  const frames = (list: number[]) => list.map((frame) => ({ key, frame }));
  scene.anims.create({ key: `${key}-idle`, frames: frames([0, 1]), frameRate: 3, repeat: -1 });
  scene.anims.create({
    key: `${key}-run`,
    frames: frames([2, 3, 4, 5]),
    frameRate: 12,
    repeat: -1,
  });
  scene.anims.create({ key: `${key}-jog`, frames: frames([2, 3, 4, 5]), frameRate: 7, repeat: -1 });
  return key;
}

/** Scritta in pixel con contorno e ombra, da mostrare ingrandita a passi interi. */
export function textTexture(scene: Phaser.Scene, text: string, color: number): string {
  const key = `tx-${text}-${color}`;
  if (scene.textures.exists(key)) return key;
  const body = glyphs(text, color, shade(color, 0.78)).outlined(0x0b0f14);
  const { tex, ctx } = canvas(scene, key, body.w + 1, body.h + 1);
  body.blit(ctx, 1, 1, 0x0b0f14);
  body.blit(ctx, 0, 0);
  tex.refresh();
  return key;
}

/* ------------------------------------------------------------------ stadio */

export const PITCH_TOP = 36;
export const MID_Y = 90;
export const GOAL_X = 226;
export const POST_FAR = 80;
export const POST_NEAR = 100;

/** Valori pseudo casuali fissi: lo stadio è sempre uguale, niente sfarfallio fra una scena e l'altra. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function circle(
  p: Pix,
  cx: number,
  cy: number,
  r: number,
  color: number,
  keep: (x: number) => boolean,
) {
  for (let a = 0; a < 360; a += 1) {
    const x = Math.round(cx + r * Math.cos((a * Math.PI) / 180));
    const y = Math.round(cy + r * Math.sin((a * Math.PI) / 180));
    if (keep(x)) p.set(x, y, color);
  }
}

function paintGrass(scene: Phaser.Scene): void {
  if (scene.textures.exists('pitch-grass')) return;
  const w = 240;
  const h = 108;
  const p = new Pix(w, h);
  const rnd = seeded(7);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const stripe = Math.floor(x / 20) % 2 ? 0x2c8a4b : 0x328f51;
      const noise = rnd();
      p.set(x, y, noise < 0.06 ? shade(stripe, 1.12) : noise > 0.95 ? shade(stripe, 0.88) : stripe);
    }
  // Zona dietro la porta e fondo campo più scuri per dare profondità.
  for (let y = 0; y < h; y++)
    for (let x = GOAL_X + 1; x < w; x++) p.set(x, y, shade(p.get(x, y), 0.82));
  for (let x = 0; x < w; x++) for (let y = 0; y < 3; y++) p.set(x, y, shade(p.get(x, y), 0.8));
  const line = 0xe8f1dc;
  const T = (wy: number) => wy - PITCH_TOP;
  for (let x = 0; x <= GOAL_X; x++) {
    p.set(x, 3, line);
    p.set(x, h - 4, line);
  }
  for (let y = 3; y <= h - 4; y++) {
    p.set(GOAL_X, y, line);
    p.set(20, y, line);
  }
  circle(p, 20, T(MID_Y), 22, line, () => true);
  p.set(20, T(MID_Y), line);
  const box = (x0: number, y0: number, y1: number) => {
    for (let x = x0; x <= GOAL_X; x++) {
      p.set(x, T(y0), line);
      p.set(x, T(y1), line);
    }
    for (let y = T(y0); y <= T(y1); y++) p.set(x0, y, line);
  };
  box(186, 56, 124);
  box(212, 72, 108);
  p.set(200, T(MID_Y), line);
  p.set(201, T(MID_Y), line);
  circle(p, 200, T(MID_Y), 24, line, (x) => x < 186);
  const { tex, ctx } = canvas(scene, 'pitch-grass', w, h);
  p.blit(ctx, 0, 0);
  tex.refresh();
}

function paintGoal(scene: Phaser.Scene): void {
  if (scene.textures.exists('pitch-goal')) return;
  // Origine della texture nel mondo: (GOAL_X - 1, POST_FAR - 11).
  const p = new Pix(14, 34);
  const white = 0xf6f6ee;
  const net = 0xc9d3cf;
  const top = (x: number) => 2 + Math.round((x - 1) * 0.25);
  const bottom = (x: number) => 31 - Math.round((x - 1) * 0.1);
  for (let x = 2; x <= 10; x++)
    for (let y = top(x); y <= bottom(x); y++) if ((x + y) % 2 === 0) p.set(x, y, net);
  p.line(1, 2, 10, top(10), () => white);
  p.line(1, 22, 10, top(10) + 20, () => shade(white, 0.85));
  p.line(10, top(10), 10, bottom(10), () => shade(white, 0.8));
  p.line(1, 2, 1, 22, () => white);
  p.line(1, 2, 1, 11, () => white, 2);
  p.line(1, 22, 1, 31, () => white, 2);
  const { tex, ctx } = canvas(scene, 'pitch-goal', p.w, p.h);
  p.outlined(0x23312b).blit(ctx, 0, 0);
  tex.refresh();
}

function paintBall(scene: Phaser.Scene): void {
  if (scene.textures.exists('pitch-ball')) return;
  const shapes = [
    ['.ww.', 'wkww', 'wwwg', '.wg.'],
    ['.ww.', 'wwkw', 'wwgg', '.kg.'],
    ['.kw.', 'wwww', 'wgwk', '.gg.'],
    ['.wk.', 'wwww', 'kgww', '.gw.'],
  ];
  const map: Record<string, number> = { w: 0xfbfaf2, k: 0x2a2a33, g: 0xb9bdb6 };
  const { tex, ctx } = canvas(scene, 'pitch-ball', 6 * shapes.length, 6);
  shapes.forEach((rows, i) => {
    const p = new Pix(6, 6);
    rows.forEach((row, y) => {
      for (let x = 0; x < 4; x++) if (row[x] !== '.') p.set(x + 1, y + 1, map[row[x]!]!);
    });
    p.outlined().blit(ctx, i * 6, 0);
    tex.add(i, 0, i * 6, 0, 6, 6);
  });
  tex.refresh();
  scene.anims.create({
    key: 'ball-spin',
    frames: [0, 1, 2, 3].map((frame) => ({ key: 'pitch-ball', frame })),
    frameRate: 16,
    repeat: -1,
  });
}

function paintSmall(scene: Phaser.Scene): void {
  if (scene.textures.exists('pitch-shadow')) return;
  const sh = canvas(scene, 'pitch-shadow', 10, 3);
  sh.ctx.fillStyle = 'rgba(8,24,14,0.42)';
  sh.ctx.fillRect(2, 0, 6, 3);
  sh.ctx.fillRect(0, 1, 10, 1);
  sh.tex.refresh();
  const dot = canvas(scene, 'pitch-dot', 2, 2);
  dot.ctx.fillStyle = '#ffffff';
  dot.ctx.fillRect(0, 0, 2, 2);
  dot.tex.refresh();
  const bit = canvas(scene, 'pitch-bit', 2, 1);
  bit.ctx.fillStyle = '#ffffff';
  bit.ctx.fillRect(0, 0, 2, 1);
  bit.tex.refresh();
}

const BOARD_WORDS = ['OUTSTANDING', 'FORZA', 'CALCIO', 'PALLONE', 'GOL'];
const BOARD_COLORS: readonly (readonly [number, number])[] = [
  [0x13304d, 0xf2c555],
  [0xf2c555, 0x13304d],
  [0xb8322b, 0xf6f1e3],
  [0x16502d, 0xf6f1e3],
  [0xf6f1e3, 0xb8322b],
];

function paintBoards(scene: Phaser.Scene): void {
  if (scene.textures.exists('pitch-boards')) return;
  const { tex, ctx } = canvas(scene, 'pitch-boards', 480, 7);
  for (let copy = 0; copy < 2; copy++)
    BOARD_WORDS.forEach((word, i) => {
      const [bg, fg] = BOARD_COLORS[i]!;
      const x0 = copy * 240 + i * 48;
      ctx.fillStyle = css(bg);
      ctx.fillRect(x0, 0, 48, 7);
      ctx.fillStyle = css(shade(bg, 0.7));
      ctx.fillRect(x0 + 47, 0, 1, 7);
      const g = glyphs(word, fg);
      g.blit(ctx, x0 + Math.floor((48 - g.w) / 2), 0);
    });
  tex.refresh();
}

/** Tribuna con tifosi: 4 fotogrammi (fermi, metà su, altra metà su, esultanza con bandiere). */
function paintCrowd(scene: Phaser.Scene, ours: number, theirs: number): string {
  const key = `crowd-${ours}-${theirs}`;
  if (scene.textures.exists(key)) return key;
  const w = 240;
  const h = 30;
  const { tex, ctx } = canvas(scene, key, w, h * 4);
  const neutral = [0xd8d2c4, 0x3b4a5c, 0x8c3b3b, 0x2f5d8a, 0x6b6b6b, 0x1f1f26];
  for (let frame = 0; frame < 4; frame++) {
    const p = new Pix(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const tier = Math.floor(y / 5);
        p.set(x, y, y % 5 === 4 ? 0x33414d : tier % 2 ? 0x1c2731 : 0x212d38);
      }
    const rnd = seeded(42);
    for (let tier = 0; tier < 6; tier++) {
      const base = tier * 5 + 4;
      let n = 0;
      for (let x = 1; x < w - 2; x += 3, n++) {
        const jitter = rnd() < 0.5 ? 0 : 1;
        const empty = rnd() < 0.12;
        const pick = rnd();
        const shirt =
          pick < 0.55 ? ours : pick < 0.68 ? theirs : neutral[Math.floor(rnd() * neutral.length)]!;
        const skin = SKINS[Math.floor(rnd() * SKINS.length)]!;
        const flag = rnd() < 0.08;
        if (empty) continue;
        const up =
          frame === 3 || (frame === 1 && n % 2 === 0) || (frame === 2 && n % 2 === 1) ? 1 : 0;
        const fx = x + jitter;
        const fy = base - up;
        p.set(fx, fy - 1, shirt);
        p.set(fx + 1, fy - 1, shade(shirt, 0.8));
        p.set(fx, fy - 2, shirt);
        p.set(fx + 1, fy - 2, shirt);
        p.set(fx, fy - 3, skin);
        p.set(fx + 1, fy - 3, shade(skin, 0.85));
        if (frame === 3) {
          p.set(fx - 1, fy - 4, skin);
          p.set(fx + 2, fy - 4, skin);
        }
        if (flag && (frame === 3 || tier % 2 === 0)) {
          p.set(fx + 2, fy - 2, 0x9a8f7a);
          p.set(fx + 2, fy - 3, 0x9a8f7a);
          for (let fy2 = 0; fy2 < 2; fy2++)
            for (let fx2 = 0; fx2 < 3; fx2++)
              p.set(
                fx + 3 + fx2,
                fy - 5 + fy2 + (frame === 3 ? -1 : 0),
                fy2 ? shade(ours, 0.8) : ours,
              );
        }
      }
    }
    p.blit(ctx, 0, frame * h);
    tex.add(frame, 0, 0, frame * h, w, h);
  }
  tex.refresh();
  const frames = (list: number[]) => list.map((frame) => ({ key, frame }));
  scene.anims.create({
    key: `${key}-idle`,
    frames: frames([0, 1, 0, 2]),
    frameRate: 3,
    repeat: -1,
  });
  scene.anims.create({
    key: `${key}-cheer`,
    frames: frames([3, 1, 3, 2]),
    frameRate: 9,
    repeat: -1,
  });
  return key;
}

/** Prepara tutte le texture dello stadio e restituisce la chiave della tribuna. */
export function ensureStadium(scene: Phaser.Scene, ours: number, theirs: number): string {
  paintGrass(scene);
  paintGoal(scene);
  paintBall(scene);
  paintSmall(scene);
  paintBoards(scene);
  return paintCrowd(scene, ours, theirs);
}
