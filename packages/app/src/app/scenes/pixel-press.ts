import type Phaser from 'phaser';
import type { StageModel } from './stage-model';
import { Pix, SKINS, canvas, glyphs, shade, textTexture } from './pixel-art';
import { BUST_H, BUST_W, RAISED_HAND, type BustLook, bustFrame, ensureBust } from './pixel-people';
import { director, type Track } from './director';

/** Le scene fuori dal campo sono inquadrature strette: 160×96 pixel d'arte a zoom 3. */
const ROOM_W = 160;
const ROOM_H = 96;
const ZOOM = 3;

const parse = (v: string | undefined, fallback: number) =>
  /^#[a-f\d]{6}$/i.test(v ?? '') ? Number.parseInt(v!.slice(1), 16) : fallback;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texture(scene: Phaser.Scene, key: string, p: Pix): string {
  if (scene.textures.exists(key)) return key;
  const { tex, ctx } = canvas(scene, key, p.w, p.h);
  p.blit(ctx, 0, 0);
  tex.refresh();
  return key;
}

function fill(
  p: Pix,
  x0: number,
  y0: number,
  w: number,
  h: number,
  c: number | ((x: number, y: number) => number),
) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) p.set(x, y, typeof c === 'number' ? c : c(x, y));
}

/* ------------------------------------------------------------------ oggetti di scena */

function props(scene: Phaser.Scene): void {
  if (scene.textures.exists('prop-bell')) return;
  const bell = new Pix(11, 12);
  const gold = 0xf2c555;
  fill(bell, 4, 0, 3, 3, 0x8a5a36);
  for (let y = 3; y < 10; y++) {
    const w = Math.min(4, 1 + Math.floor((y - 3) / 1.5));
    for (let x = 5 - w; x <= 5 + w; x++)
      bell.set(x, y, x >= 5 + w - 1 ? shade(gold, 0.75) : x <= 5 - w + 1 ? shade(gold, 1.2) : gold);
  }
  fill(bell, 4, 10, 3, 1, 0x6b5428);
  texture(scene, 'prop-bell', bell.outlined());

  const arcs = new Pix(6, 9);
  for (const [x, y] of [
    [1, 1],
    [2, 2],
    [3, 3],
    [3, 4],
    [3, 5],
    [2, 6],
    [1, 7],
  ] as const)
    arcs.set(x, y, 0xfff1b8);
  texture(scene, 'prop-ring', arcs.outlined());

  const phone = new Pix(6, 8);
  fill(phone, 1, 1, 4, 6, 0x1b1b1f);
  fill(phone, 2, 2, 2, 4, 0x7fd0ff);
  texture(scene, 'prop-phone', phone);

  const bottle = new Pix(7, 16);
  fill(bottle, 2, 0, 3, 2, 0x2f5d8a);
  fill(bottle, 1, 3, 5, 12, (x) => (x === 1 ? 0xd7f1ff : x === 5 ? 0x7fb4cf : 0xa9dbf2));
  fill(bottle, 1, 7, 5, 3, 0xf6f1e3);
  texture(scene, 'prop-bottle', bottle.outlined());

  const paper = new Pix(3, 2);
  fill(paper, 0, 0, 3, 2, 0xf6f1e3);
  texture(scene, 'prop-paper', paper);

  const flash = new Pix(9, 9);
  for (let i = 0; i < 9; i++) {
    flash.set(4, i, i === 4 ? 0xffffff : 0xfff6d6);
    flash.set(i, 4, i === 4 ? 0xffffff : 0xfff6d6);
  }
  fill(flash, 3, 3, 3, 3, 0xffffff);
  texture(scene, 'prop-flash', flash);

  const pend = new Pix(7, 30);
  for (let y = 0; y < 22; y++) pend.set(3, y, 0xd9d4bf);
  for (let y = 22; y < 29; y++) {
    const w = y < 26 ? Math.floor((y - 22) / 1.4) + 1 : 29 - y;
    for (let x = 3 - w; x <= 3 + w; x++) pend.set(x, y, x > 3 ? 0xc99a3b : 0xf2c555);
  }
  texture(scene, 'prop-pendulum', pend.outlined());
}

function microphone(scene: Phaser.Scene, flag: number): string {
  const p = new Pix(8, 18);
  for (let y = 9; y < 18; y++) p.set(4, y, 0x3a3f46);
  fill(p, 2, 0, 5, 6, (x, y) => ((x + y) % 2 ? 0x2a2e33 : 0x4a5058));
  fill(p, 1, 6, 7, 4, flag);
  fill(p, 1, 9, 7, 1, shade(flag, 0.7));
  return texture(scene, `prop-mic-${flag}`, p.outlined());
}

/** Stemma inventato: scudo o cerchio con banda, solo forme e colori. */
function crest(scene: Phaser.Scene, color: number, round: boolean): string {
  const p = new Pix(18, 20);
  const second = shade(color, 0.55);
  for (let y = 1; y < 19; y++)
    for (let x = 1; x < 17; x++) {
      const inside = round
        ? (x - 8.5) ** 2 + (y - 9.5) ** 2 <= 64
        : y < 12 || Math.abs(x - 8.5) < (19 - y) * 1.1;
      if (inside) p.set(x, y, Math.abs(x - y) < 3 ? 0xf6f1e3 : x < 9 ? color : second);
    }
  return texture(scene, `prop-crest-${color}-${round ? 1 : 0}`, p.outlined());
}

/* ------------------------------------------------------------------ fondali */

function pressBackdrop(scene: Phaser.Scene, ours: number): string {
  const key = `room-press-${ours}`;
  if (scene.textures.exists(key)) return key;
  const p = new Pix(ROOM_W, ROOM_H);
  fill(p, 0, 0, ROOM_W, ROOM_H, (_x, y) => (y < 30 ? 0x16365a : 0x13304d));
  const words = ['CALCIO', 'STAMPA'];
  for (let row = 0; row < 5; row++)
    for (let col = -1; col < 5; col++) {
      const g = glyphs(words[(row + col + 8) % 2]!, 0x2b4c70);
      const x = col * 44 + (row % 2 ? 22 : 0) + Math.floor((44 - g.w) / 2);
      for (let y = 0; y < g.h; y++)
        for (let gx = 0; gx < g.w; gx++)
          if (g.get(gx, y) >= 0) p.set(x + gx, row * 14 + 3 + y, 0x2b4c70);
    }
  // Tavolo: piano in legno e telo con il colore del club.
  fill(p, 0, 62, ROOM_W, 4, (x) => (x % 23 === 0 ? 0xa97b4c : 0xc89a62));
  fill(p, 0, 66, ROOM_W, 30, (x, y) =>
    x % 14 < 2 ? shade(ours, 0.75) : y > 90 ? shade(ours, 0.8) : ours,
  );
  fill(p, 0, 66, ROOM_W, 1, shade(ours, 0.6));
  fill(p, 64, 71, 32, 9, 0xf6f1e3);
  const plate = glyphs('MISTER', 0x13304d);
  for (let y = 0; y < plate.h; y++)
    for (let x = 0; x < plate.w; x++)
      if (plate.get(x, y) >= 0) p.set(80 - Math.floor(plate.w / 2) + x, 72 + y, 0x13304d);
  return texture(scene, key, p);
}

function pressCrowd(scene: Phaser.Scene): string {
  const key = 'room-journalists';
  if (scene.textures.exists(key)) return key;
  const p = new Pix(ROOM_W, 22);
  const rnd = seeded(11);
  const body = 0x0d141c;
  for (let i = 0; i < 9; i++) {
    const cx = 8 + i * 18 + Math.floor(rnd() * 6);
    const top = 6 + Math.floor(rnd() * 4);
    for (let y = top; y < top + 8; y++)
      for (let x = cx - 4; x <= cx + 4; x++)
        if ((x - cx) ** 2 / 16 + (y - top - 4) ** 2 / 16 <= 1) p.set(x, y, body);
    fill(p, cx - 8, top + 7, 17, 22 - top - 7, body);
    if (rnd() < 0.5) {
      // Telefono alzato verso il palco.
      fill(p, cx + 5, top - 4, 4, 6, 0x1b1b1f);
      fill(p, cx + 6, top - 3, 2, 4, 0x9fe0ff);
      p.line(cx + 6, top + 2, cx + 4, top + 8, () => body, 2);
    }
  }
  // Telecamera a sinistra.
  fill(p, 0, 2, 22, 11, 0x23272e);
  fill(p, 22, 4, 6, 7, 0x2f343c);
  fill(p, 24, 6, 3, 3, 0x6fa8dc);
  fill(p, 3, 4, 3, 2, 0xd33b3b);
  return texture(scene, key, p.outlined(0x05080c));
}

function lockerBackdrop(scene: Phaser.Scene, ours: number): string {
  const key = `room-lockers-${ours}`;
  if (scene.textures.exists(key)) return key;
  const p = new Pix(ROOM_W, ROOM_H);
  fill(p, 0, 0, ROOM_W, 62, (x, y) => (x % 8 === 0 || y % 8 === 0 ? 0xcfc6ad : 0xe9e2cf));
  for (let i = 0; i < 5; i++) {
    const x0 = 4 + i * 31;
    fill(p, x0, 6, 28, 56, 0x6e4528);
    fill(p, x0 + 2, 8, 24, 52, 0x8a5a36);
    fill(p, x0 + 2, 8, 24, 1, 0xa7744a);
    for (let v = 0; v < 3; v++) fill(p, x0 + 8, 12 + v * 2, 12, 1, 0x5a3820);
    // Maglia appesa al gancio.
    fill(p, x0 + 13, 20, 2, 2, 0xc9c5a8);
    const shirt = i === 2 ? 0xf6f1e3 : ours;
    for (let y = 0; y < 14; y++) {
      const w = y < 4 ? 6 + y : 5;
      fill(p, x0 + 14 - w, 22 + y, w * 2, 1, y > 10 ? shade(shirt, 0.82) : shirt);
    }
    fill(p, x0 + 12, 22, 4, 2, shade(shirt, 0.6));
  }
  fill(p, 0, 62, ROOM_W, 34, (x, y) => ((x + (y - 62) * 2) % 20 === 0 ? 0x4c6676 : 0x3d5566));
  fill(p, 0, 62, ROOM_W, 2, 0x2b3d4a);
  return texture(scene, key, p);
}

function bench(scene: Phaser.Scene): string {
  const p = new Pix(ROOM_W, 18);
  fill(p, 0, 0, ROOM_W, 6, (x, y) => (y === 0 ? 0xc89a62 : x % 31 === 0 ? 0x8a5a36 : 0xa97b4c));
  fill(p, 0, 6, ROOM_W, 2, 0x6e4528);
  for (const x of [10, 75, 145]) fill(p, x, 8, 4, 10, 0x4a3020);
  return texture(scene, 'room-bench', p);
}

function studioBackdrop(scene: Phaser.Scene, ours: number): string {
  const key = `room-studio-${ours}`;
  if (scene.textures.exists(key)) return key;
  const p = new Pix(ROOM_W, ROOM_H);
  fill(p, 0, 0, ROOM_W, ROOM_H, (x, y) => {
    const beam = Math.abs(x - 30 - y * 0.4) < 6 || Math.abs(x - 130 + y * 0.4) < 6;
    const base = y < 48 ? 0x1a2340 : 0x151c33;
    return beam ? shade(base, 1.35) : x % 20 === 0 ? shade(base, 0.85) : base;
  });
  // Maxischermo.
  fill(p, 14, 4, 132, 44, 0x0a0f1c);
  fill(p, 16, 6, 128, 40, (x, y) => ((x + y) % 4 === 0 ? 0x123f63 : 0x0f3a5c));
  const vs = glyphs('VS', 0xf6f1e3);
  for (let y = 0; y < vs.h; y++)
    for (let x = 0; x < vs.w; x++)
      if (vs.get(x, y) >= 0) p.set(80 - Math.floor(vs.w / 2) + x, 22 + y, 0xf6f1e3);
  // Bancone lucido con striscia luminosa.
  fill(p, 0, 64, ROOM_W, 32, (x, y) =>
    y < 66 ? 0xf4f6f8 : y < 70 ? 0xdfe4e8 : y < 72 ? ours : x % 16 === 0 ? 0xb9c1c8 : 0xcfd6dc,
  );
  return texture(scene, key, p);
}

/* ------------------------------------------------------------------ regia */

export function paintRoom(
  scene: Phaser.Scene,
  model: StageModel,
  still: boolean,
  track: Track,
): () => void {
  const ours = parse(model.homeColor, 0xf2c555);
  const theirs = parse(model.awayColor, 0x719ddd);
  const cam = scene.cameras.main;
  cam
    .setZoom(ZOOM)
    .centerOn(ROOM_W / 2, ROOM_H / 2)
    .setRoundPixels(true);
  props(scene);
  const { at, move, loop, hitStop, banner, impact } = director(scene, still, track, ZOOM);
  const ready = model.phase === 'ready';
  const sign = (text: string, color: number, delay: number) =>
    banner(text, color, delay, 12, ROOM_W);

  const person = (
    look: BustLook,
    x: number,
    bottom: number,
    frame: Parameters<typeof bustFrame>[0],
    depth: number,
  ) => {
    const key = ensureBust(scene, look);
    const sprite = track(
      scene.add.sprite(x, bottom, key, bustFrame(frame)).setOrigin(0.5, 1).setDepth(depth),
    );
    return { sprite, key };
  };
  const pose = (p: { sprite: Phaser.GameObjects.Sprite }, frame: Parameters<typeof bustFrame>[0]) =>
    p.sprite.stop().setFrame(bustFrame(frame));
  const play = (
    p: { sprite: Phaser.GameObjects.Sprite; key: string },
    name: string,
    fallback: Parameters<typeof bustFrame>[0],
  ) => {
    if (still) pose(p, fallback);
    else p.sprite.play(`${p.key}-${name}`);
  };
  /** Punto della mano alzata nel mondo, per agganciare campanella e pendolino. */
  const hand = (x: number, bottom: number) => ({
    x: x - BUST_W / 2 + RAISED_HAND.x + 1,
    y: bottom - BUST_H + RAISED_HAND.y,
  });

  if (model.scene === 'bell') {
    track(scene.add.image(0, 0, lockerBackdrop(scene, ours)).setOrigin(0).setDepth(0));
    const coach = person(
      {
        skin: SKINS[0],
        hair: 0x8f8f8f,
        top: shade(ours, 0.55),
        outfit: 'tracksuit',
        hairStyle: 'side',
      },
      80,
      72,
      'idle',
      10,
    );
    track(scene.add.image(0, 64, bench(scene)).setOrigin(0).setDepth(20));
    const left = person(
      { skin: SKINS[2], hair: 0x111114, top: ours, outfit: 'shirt', hairStyle: 'curly' },
      32,
      104,
      'phone',
      30,
    );
    const right = person(
      { skin: SKINS[1], hair: 0x5b3a1f, top: ours, outfit: 'shirt', hairStyle: 'short' },
      128,
      104,
      'yawn',
      30,
    );
    const grip = hand(80, 72);
    const bell = track(
      scene.add
        .image(grip.x, grip.y - 1, 'prop-bell')
        .setOrigin(0.5, 0.1)
        .setDepth(12)
        .setAlpha(0),
    );
    if (ready) {
      play(coach, 'talk', 'talk');
      loop(right.sprite, { y: 105 }, 900);
      loop(left.sprite, { y: 103 }, 1300);
    } else {
      at(0, () => {
        play(coach, 'ring', 'ring');
        bell.setAlpha(1);
      });
      if (!still)
        scene.tweens.add({
          targets: bell,
          angle: { from: -35, to: 35 },
          duration: 90,
          yoyo: true,
          repeat: 9,
        });
      for (const [i, side] of [-1, 1].entries()) {
        const ring = track(
          scene.add
            .image(grip.x + side * 9, grip.y + 3, 'prop-ring')
            .setFlipX(side < 0)
            .setDepth(13)
            .setAlpha(still ? 1 : 0),
        );
        if (!still)
          scene.tweens.add({
            targets: ring,
            alpha: 1,
            x: ring.x + side * 2,
            duration: 140,
            delay: 80 + i * 70,
            yoyo: true,
            repeat: 5,
          });
      }
      for (const mate of [left, right]) {
        at(320, () => pose(mate, 'wide'));
        move(mate.sprite, { y: 100 }, 120, 320, 'Quad.easeOut');
        move(mate.sprite, { y: 104 }, 160, 460, 'Quad.easeIn');
        at(340, () => {
          const mark = track(
            scene.add
              .image(mate.sprite.x + 8, 56, textTexture(scene, '!', 0xf2c555))
              .setDepth(40)
              .setScale(2),
          );
          move(mark, { y: 53 }, 160, 0, 'Back.easeOut');
        });
      }
      // Il telefono vola via dalle mani del distratto.
      const phone = track(
        scene.add
          .image(32, 90, 'prop-phone')
          .setDepth(35)
          .setAlpha(still ? 0 : 1),
      );
      if (!still) {
        scene.tweens.add({
          targets: phone,
          x: 4,
          angle: -540,
          duration: 700,
          delay: 320,
          ease: 'Linear',
        });
        scene.tweens.add({
          targets: phone,
          y: 62,
          duration: 300,
          delay: 320,
          ease: 'Quad.easeOut',
          yoyo: true,
        });
      }
      impact(false, 320);
      sign('DIN DON!', 0xf2c555, 260);
      at(1600, () => pose(coach, 'hold'));
      move(bell, { angle: 0 }, 200, 1600);
    }
  } else if (model.scene === 'pendulum') {
    track(scene.add.image(0, 0, studioBackdrop(scene, ours)).setOrigin(0).setDepth(0));
    const home = track(scene.add.image(42, 26, crest(scene, ours, false)).setDepth(2));
    const away = track(scene.add.image(118, 26, crest(scene, theirs, true)).setDepth(2));
    const host = person(
      {
        skin: SKINS[0],
        hair: 0xb9b9b9,
        top: 0x5c6470,
        outfit: 'suit',
        tie: 0x2f5d8a,
        hairStyle: 'side',
        glasses: true,
      },
      80,
      72,
      'hold',
      10,
    );
    const desk = track(
      scene.add
        .image(0, 64, studioBackdrop(scene, ours))
        .setOrigin(0, 64 / ROOM_H)
        .setCrop(0, 64, ROOM_W, 32)
        .setDepth(20),
    );
    desk.setPosition(0, 64);
    const grip = hand(80, 72);
    const pendulum = track(
      scene.add
        .image(grip.x, grip.y + 1, 'prop-pendulum')
        .setOrigin(0.5, 0)
        .setDepth(15),
    );
    if (ready) {
      play(host, 'ring', 'hold');
      pendulum.setAngle(-24);
      loop(pendulum, { angle: 24 }, 760);
    } else {
      pose(host, 'hold');
      pendulum.setAngle(-30);
      if (!still)
        scene.tweens.add({
          targets: pendulum,
          angle: 30,
          duration: 260,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
        });
      // Pausa teatrale, poi il verdetto verso lo stemma di casa.
      at(1150, () => pose(host, 'wide'));
      move(pendulum, { angle: 26 }, 500, 1100, 'Back.easeOut');
      at(1500, () => pose(host, 'ring'));
      impact(false, 1500);
      if (!still) {
        scene.tweens.add({
          targets: home,
          scale: 1.25,
          duration: 160,
          delay: 1500,
          yoyo: true,
          repeat: 2,
        });
        scene.tweens.add({ targets: away, alpha: 0.35, duration: 300, delay: 1500 });
      } else away.setAlpha(0.35);
      banner('HA PARLATO!', 0xf2c555, 1500, 82, ROOM_W);
    }
  } else {
    track(scene.add.image(0, 0, pressBackdrop(scene, ours)).setOrigin(0).setDepth(0));
    const coach = person(
      {
        skin: SKINS[1],
        hair: 0x2a1c15,
        top: 0x1f2a36,
        outfit: 'suit',
        tie: ours,
        hairStyle: 'short',
      },
      80,
      72,
      'idle',
      10,
    );
    const desk = track(
      scene.add
        .image(0, 62, pressBackdrop(scene, ours))
        .setOrigin(0)
        .setCrop(0, 62, ROOM_W, 34)
        .setDepth(20),
    );
    desk.setPosition(0, 0);
    const mics = [0xb8322b, 0x2f5d8a, 0xf2c555].map((flag, i) =>
      track(
        scene.add
          .image(66 + i * 14, 66, microphone(scene, flag))
          .setOrigin(0.5, 1)
          .setDepth(25)
          .setAngle((i - 1) * -8),
      ),
    );
    const bottle = track(scene.add.image(122, 64, 'prop-bottle').setOrigin(0.5, 1).setDepth(25));
    track(scene.add.image(0, ROOM_H, pressCrowd(scene)).setOrigin(0, 1).setDepth(40));
    const rnd = seeded(5);
    const flashes = Array.from({ length: 7 }, () =>
      track(
        scene.add
          .image(10 + rnd() * 140, 76 + rnd() * 14, 'prop-flash')
          .setDepth(45)
          .setAlpha(0),
      ),
    );
    const blink = (count: number, start: number, spread: number) => {
      if (still) return;
      flashes.forEach((f, i) =>
        scene.tweens.add({
          targets: f,
          alpha: 1,
          duration: 50,
          delay: start + ((i * 397) % spread),
          yoyo: true,
          repeat: count,
          repeatDelay: spread / 2,
        }),
      );
    };
    if (ready) {
      play(coach, 'talk', 'talk');
      blink(-1, 300, 2400);
    } else {
      play(coach, 'talk', 'talk');
      at(450, () => pose(coach, 'shout'));
      at(780, () => {
        pose(coach, 'slam');
        hitStop(90);
      });
      impact(true, 800);
      mics.forEach((mic, i) => {
        move(mic, { y: 61, angle: (i - 1) * -8 + (i % 2 ? 18 : -14) }, 110, 800, 'Quad.easeOut');
        move(mic, { y: 66, angle: (i - 1) * -8 + (i % 2 ? 8 : -6) }, 220, 910, 'Bounce.easeOut');
      });
      move(bottle, { angle: 90, x: 128, y: 66 }, 260, 820, 'Quad.easeIn');
      at(800, () => {
        if (still) return;
        const papers = track(
          scene.add.particles(80, 62, 'prop-paper', {
            speed: { min: 30, max: 80 },
            angle: { min: 200, max: 340 },
            gravityY: 90,
            rotate: { min: 0, max: 360 },
            lifespan: 1400,
            emitting: false,
          }),
        ).setDepth(30);
        papers.explode(16);
      });
      blink(6, 820, 900);
      sign('SFOGO!', 0xff8a6b, 820);
    }
  }

  return () => cam.setZoom(1).centerOn(480 / 2, 288 / 2);
}
