import type Phaser from 'phaser';
import { OUTLINE, Pix, canvas, shade } from './pixel-art';

/** Mezzobusti frontali per le scene fuori dal campo: stessi colori e contorno dei giocatori. */

export const BUST_W = 36;
export const BUST_H = 44;

export interface BustLook {
  skin: number;
  hair: number;
  /** Giacca, tuta o maglia. */
  top: number;
  outfit: 'suit' | 'tracksuit' | 'shirt';
  tie?: number;
  hairStyle: 'short' | 'side' | 'bald' | 'curly';
  glasses?: boolean;
}

type Eyes = 'normal' | 'wide' | 'down' | 'closed';
type Mouth = 'closed' | 'talk' | 'open' | 'side' | 'smile';
type Brows = 'normal' | 'angry' | 'raised';
type Arms = 'down' | 'raiseR' | 'phone' | 'chin' | 'up' | 'slam';

interface Face {
  eyes: Eyes;
  mouth: Mouth;
  brows: Brows;
  arms: Arms;
}

/** Espressioni disponibili, nell'ordine dei fotogrammi della striscia. */
export const BUST = {
  idle: { eyes: 'normal', mouth: 'closed', brows: 'normal', arms: 'down' },
  talk: { eyes: 'normal', mouth: 'talk', brows: 'normal', arms: 'down' },
  ring: { eyes: 'normal', mouth: 'open', brows: 'angry', arms: 'raiseR' },
  hold: { eyes: 'normal', mouth: 'talk', brows: 'raised', arms: 'raiseR' },
  wide: { eyes: 'wide', mouth: 'open', brows: 'raised', arms: 'down' },
  phone: { eyes: 'down', mouth: 'smile', brows: 'normal', arms: 'phone' },
  yawn: { eyes: 'closed', mouth: 'open', brows: 'normal', arms: 'down' },
  doubt: { eyes: 'normal', mouth: 'side', brows: 'raised', arms: 'chin' },
  shout: { eyes: 'wide', mouth: 'open', brows: 'angry', arms: 'up' },
  slam: { eyes: 'normal', mouth: 'open', brows: 'angry', arms: 'slam' },
  smile: { eyes: 'normal', mouth: 'smile', brows: 'normal', arms: 'down' },
} as const satisfies Record<string, Face>;
export type BustFrame = keyof typeof BUST;
const NAMES = Object.keys(BUST) as BustFrame[];
export const bustFrame = (name: BustFrame) => NAMES.indexOf(name);

/** Punto della mano destra alzata, relativo all'angolo in alto a sinistra della cella. */
export const RAISED_HAND = { x: 33, y: 6 } as const;

function ellipse(
  p: Pix,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: (x: number, y: number) => number,
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) p.set(x, y, color(x, y));
    }
}

function drawBust(look: BustLook, face: Face): Pix {
  const p = new Pix(BUST_W, BUST_H);
  const skinD = shade(look.skin, 0.82);
  const topD = shade(look.top, 0.72);
  const topL = shade(look.top, 1.2);
  const dark = 0x241a1f;

  // Busto: spalle che si allargano, lato destro in ombra.
  for (let y = 24; y < BUST_H; y++) {
    const half = Math.min(15, 9 + (y - 24) * 2);
    for (let x = 18 - half; x < 18 + half; x++) p.set(x, y, x >= 28 || x <= 6 ? topD : look.top);
  }
  // Collo.
  for (let y = 19; y < 25; y++)
    for (let x = 15; x <= 20; x++) p.set(x, y, y < 21 ? skinD : look.skin);
  if (look.outfit === 'suit') {
    for (let y = 24; y < 36; y++) {
      const w = Math.max(0, 4 - Math.floor((y - 24) / 3));
      for (let x = 18 - w; x < 18 + w; x++) p.set(x, y, 0xf4f1e8);
      p.set(18 - w - 1, y, topL);
      p.set(18 + w, y, topD);
    }
    for (let y = 25; y < 40; y++) {
      p.set(17, y, look.tie ?? 0xb8322b);
      p.set(18, y, shade(look.tie ?? 0xb8322b, 0.8));
    }
  } else if (look.outfit === 'tracksuit') {
    for (let x = 14; x <= 21; x++) p.set(x, 24, topL);
    for (let y = 25; y < BUST_H; y++) p.set(18, y, 0xd9d9d0);
    for (let y = 26; y < BUST_H; y++) {
      p.set(9, y, 0xf4f1e8);
      p.set(27, y, 0xf4f1e8);
    }
  } else {
    for (let x = 15; x <= 20; x++) p.set(x, 24, 0xf4f1e8);
    p.set(16, 25, 0xf4f1e8);
    p.set(19, 25, 0xf4f1e8);
  }

  // Testa, orecchie e ombra sul lato destro.
  ellipse(p, 18, 11, 7, 9, (x, y) => (x >= 23 || y >= 18 ? skinD : look.skin));
  for (let y = 10; y <= 13; y++) {
    p.set(10, y, skinD);
    p.set(26, y, skinD);
  }
  const hair = look.hair;
  const hairD = shade(hair, 0.75);
  if (look.hairStyle === 'bald') {
    for (let y = 7; y <= 12; y++) {
      p.set(11, y, hair);
      p.set(25, y, hairD);
    }
    p.set(16, 3, shade(look.skin, 1.12));
    p.set(17, 3, shade(look.skin, 1.12));
  } else {
    ellipse(p, 18, 5, 8, 4.5, (x) => (x >= 22 ? hairD : hair));
    for (let y = 6; y <= 10; y++) {
      p.set(10, y, hair);
      p.set(11, y, hair);
      p.set(25, y, hairD);
      p.set(26, y, hairD);
    }
    if (look.hairStyle === 'side') for (let x = 12; x <= 17; x++) p.set(x, 7, hair);
    if (look.hairStyle === 'curly')
      for (let x = 10; x <= 26; x += 2) {
        p.set(x, 1, hair);
        p.set(x + 1, 0, hairD);
      }
    else for (let x = 13; x <= 15; x++) p.set(x, 2, shade(hair, 1.4));
  }

  // Sopracciglia.
  const browY = face.brows === 'raised' ? 7 : 8;
  for (let i = 0; i < 4; i++) {
    const tilt = face.brows === 'angry' ? Math.floor(i / 2) : 0;
    p.set(13 + i, browY + tilt, dark);
    p.set(23 - i, (face.brows === 'raised' ? 8 : browY) + tilt, dark);
  }
  // Occhi.
  for (const ex of [14, 21]) {
    if (face.eyes === 'wide') {
      p.set(ex, 10, 0xffffff);
      p.set(ex + 1, 10, 0xffffff);
      p.set(ex, 11, 0xffffff);
      p.set(ex + 1, 11, dark);
    } else if (face.eyes === 'down') {
      p.set(ex, 12, dark);
      p.set(ex + 1, 12, dark);
    } else if (face.eyes === 'closed') {
      p.set(ex, 11, skinD);
      p.set(ex + 1, 11, dark);
    } else {
      p.set(ex, 11, 0xffffff);
      p.set(ex + 1, 11, dark);
      p.set(ex + 1, 10, dark);
    }
  }
  if (look.glasses) {
    for (const ex of [13, 20]) {
      for (let x = ex; x <= ex + 3; x++) {
        p.set(x, 9, 0x1b1b1f);
        p.set(x, 13, 0x1b1b1f);
      }
      for (let y = 9; y <= 13; y++) {
        p.set(ex, y, 0x1b1b1f);
        p.set(ex + 3, y, 0x1b1b1f);
      }
    }
    p.set(17, 10, 0x1b1b1f);
    p.set(18, 10, 0x1b1b1f);
  }
  // Naso e bocca.
  p.set(18, 13, skinD);
  p.set(18, 14, skinD);
  p.set(17, 14, skinD);
  const lip = 0x7a2f2a;
  if (face.mouth === 'closed') for (let x = 16; x <= 20; x++) p.set(x, 16, lip);
  else if (face.mouth === 'smile') {
    for (let x = 16; x <= 20; x++) p.set(x, 17, lip);
    p.set(15, 16, lip);
    p.set(21, 16, lip);
  } else if (face.mouth === 'talk') {
    for (let x = 16; x <= 20; x++) p.set(x, 16, lip);
    for (let x = 17; x <= 19; x++) p.set(x, 17, 0x3a1515);
  } else if (face.mouth === 'side') {
    p.set(18, 17, lip);
    p.set(19, 16, lip);
    p.set(20, 16, lip);
    p.set(21, 15, lip);
  } else
    for (let y = 15; y <= 18; y++)
      for (let x = 15; x <= 21; x++) {
        const edge = (y === 15 || y === 18) && (x === 15 || x === 21);
        if (!edge) p.set(x, y, y === 15 ? 0xf4f1e8 : 0x3a1515);
      }

  // Braccia: manica a 3 pixel, mano in fondo.
  const arm = (x0: number, y0: number, x1: number, y1: number) => {
    p.line(x0, y0, x1, y1, (t) => (t < 0.85 ? look.top : look.skin), 3);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = 0; dx <= 2; dx++) p.set(x1 + dx, y1 + dy, look.skin);
  };
  if (face.arms === 'raiseR') arm(29, 27, RAISED_HAND.x - 1, RAISED_HAND.y);
  else if (face.arms === 'up') {
    arm(5, 27, 2, 5);
    arm(29, 27, 32, 5);
  } else if (face.arms === 'slam') {
    arm(5, 28, 8, 40);
    arm(29, 28, 26, 40);
  } else if (face.arms === 'chin') arm(28, 38, 17, 19);
  else if (face.arms === 'phone') {
    for (let y = 30; y <= 36; y++)
      for (let x = 16; x <= 20; x++)
        p.set(x, y, y === 30 || x === 16 || x === 20 ? 0x1b1b1f : 0x7fd0ff);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        p.set(13 + dx, 33 + dy, look.skin);
        p.set(21 + dx, 33 + dy, look.skin);
      }
    }
  }
  return p.outlined(OUTLINE);
}

/** Striscia di tutte le espressioni per un aspetto; la chiave dipende solo dall'aspetto. */
export function ensureBust(scene: Phaser.Scene, look: BustLook): string {
  const key = `bust-${[look.skin, look.hair, look.top, look.outfit, look.tie ?? 0, look.hairStyle, look.glasses ? 1 : 0].join('-')}`;
  if (scene.textures.exists(key)) return key;
  const { tex, ctx } = canvas(scene, key, BUST_W * NAMES.length, BUST_H);
  NAMES.forEach((name, i) => {
    drawBust(look, BUST[name]).blit(ctx, i * BUST_W, 0);
    tex.add(i, 0, i * BUST_W, 0, BUST_W, BUST_H);
  });
  tex.refresh();
  const anim = (name: string, frames: BustFrame[], rate: number) =>
    scene.anims.create({
      key: `${key}-${name}`,
      frames: frames.map((f) => ({ key, frame: bustFrame(f) })),
      frameRate: rate,
      repeat: -1,
    });
  anim('talk', ['talk', 'idle', 'talk', 'talk', 'idle'], 7);
  anim('ring', ['ring', 'hold'], 8);
  anim('nod', ['idle', 'smile'], 2);
  return key;
}
