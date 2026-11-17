import type Phaser from 'phaser';
import type { StageModel } from './stage-model';
import {
  CELL_H,
  FEET_Y,
  FRAME,
  GOAL_X,
  HAIRS,
  type Look,
  MID_Y,
  POST_FAR,
  SKINS,
  ensurePlayer,
  ensureStadium,
  shade,
} from './pixel-art';
import { director, type Track } from './director';

/** Il campo misura 240×144 pixel d'arte, mostrati a zoom 2 sul canvas 480×288. */
export const ART_W = 240;
export const ART_H = 144;
const ZOOM = 2;

interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  key: string;
}

interface Ball {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  /** Posizione a terra e altezza: l'ombra resta a terra, la palla sale. */
  pos: { x: number; y: number; h: number };
}

const parse = (v: string | undefined, fallback: number) =>
  /^#[a-f\d]{6}$/i.test(v ?? '') ? Number.parseInt(v!.slice(1), 16) : fallback;

const luminance = (c: number) =>
  0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

function kit(shirt: number): Omit<Look, 'skin' | 'hair'> {
  return { shirt, shorts: luminance(shirt) > 140 ? 0x1d2533 : 0xf1efe6 };
}

/**
 * Disegna il campo e mette in scena l'esito già deciso dal motore.
 * Restituisce la funzione che stacca l'aggiornamento per fotogramma.
 */
export function paintPitch(
  scene: Phaser.Scene,
  model: StageModel,
  still: boolean,
  track: Track,
): () => void {
  const ours = parse(model.homeColor, 0xf2c555);
  let theirs = parse(model.awayColor, 0x719ddd);
  if (Math.abs(luminance(ours) - luminance(theirs)) < 20 && ours === theirs) theirs = 0x719ddd;
  const cam = scene.cameras.main;
  cam
    .setZoom(ZOOM)
    .centerOn(ART_W / 2, ART_H / 2)
    .setRoundPixels(true);

  const crowdKey = ensureStadium(scene, ours, theirs);
  const crowd = track(scene.add.sprite(0, 0, crowdKey, 0).setOrigin(0).setDepth(0));
  const boards = track(
    scene.add.tileSprite(0, 29, ART_W, 7, 'pitch-boards').setOrigin(0).setDepth(1),
  );
  track(scene.add.image(0, 36, 'pitch-grass').setOrigin(0).setDepth(1));
  const goal = track(
    scene.add
      .image(GOAL_X - 1, POST_FAR - 11, 'pitch-goal')
      .setOrigin(0)
      .setDepth(60),
  );
  if (!still) {
    crowd.play(`${crowdKey}-idle`);
    scene.tweens.add({ targets: boards, tilePositionX: 240, duration: 14000, repeat: -1 });
  }

  const actors: Actor[] = [];
  let n = 0;
  const spawn = (look: Omit<Look, 'skin' | 'hair'>, x: number, y: number, left = false): Actor => {
    const full: Look = {
      ...look,
      skin: SKINS[(n * 3 + 1) % SKINS.length]!,
      hair: HAIRS[(n * 2) % HAIRS.length]!,
    };
    n++;
    const key = ensurePlayer(scene, full);
    const shadow = track(scene.add.image(x, y, 'pitch-shadow').setDepth(2));
    const sprite = track(
      scene.add
        .sprite(x, y, key, FRAME.idle)
        .setOrigin(0.5, FEET_Y / CELL_H)
        .setFlipX(left),
    );
    const actor = { sprite, shadow, key };
    actors.push(actor);
    return actor;
  };
  const keeperKit = (shirt: number) => ({
    shirt: luminance(shirt) > 140 ? 0x2f9e5b : 0xe0cf3a,
    shorts: 0x1d2533,
    gloves: 0xf7f7f0,
  });

  const ballShadow = track(scene.add.image(0, 0, 'pitch-shadow').setScale(0.5, 0.7).setDepth(2));
  const ballSprite = track(scene.add.sprite(0, 0, 'pitch-ball', 0));
  const ball: Ball = { sprite: ballSprite, shadow: ballShadow, pos: { x: 0, y: 0, h: 0 } };

  /* ---------------------------------------------------------------- strumenti di regia */

  const { at, move, loop, hitStop, impact, banner: sign } = director(scene, still, track, ZOOM);
  const banner = (text: string, color: number, delay: number) =>
    sign(text, color, delay, 15, ART_W);
  const anim = (a: Actor, name: 'idle' | 'run' | 'jog') => {
    if (still) a.sprite.setFrame(name === 'idle' ? FRAME.idle : FRAME.run);
    else a.sprite.play(`${a.key}-${name}`, true);
  };
  const pose = (a: Actor, frame: number) => a.sprite.stop().setFrame(frame);
  const runTo = (a: Actor, x: number, y: number, ms: number, delay = 0) => {
    at(delay, () => {
      a.sprite.setFlipX(x < a.sprite.x);
      anim(a, 'run');
    });
    move(a.sprite, { x, y }, ms, delay, 'Linear');
    at(delay + ms, () => anim(a, 'idle'));
  };
  const ballAt = (x: number, y: number, h = 0) => Object.assign(ball.pos, { x, y, h });
  /** Tiro o passaggio: traiettoria a terra lineare, altezza a campana. */
  const kick = (x: number, y: number, peak: number, ms: number, delay = 0, endH = 0) => {
    at(delay, () => {
      if (!still) ball.sprite.play('ball-spin');
      trail?.start();
    });
    move(ball.pos, { x, y }, ms, delay, 'Quad.easeOut');
    if (still) ball.pos.h = endH;
    else
      scene.tweens.add({
        targets: ball.pos,
        h: peak,
        duration: ms / 2,
        delay,
        yoyo: endH === 0,
        ease: 'Sine.easeOut',
      });
    at(delay + ms, () => {
      ball.sprite.stop();
      trail?.stop();
    });
  };
  const trail = still
    ? undefined
    : track(
        scene.add.particles(0, 0, 'pitch-dot', {
          lifespan: 220,
          frequency: 18,
          alpha: { start: 0.55, end: 0 },
          scale: { start: 1, end: 0.4 },
          emitting: false,
        }),
      ).setDepth(500);
  trail?.startFollow(ballSprite);

  const celebrateCrowd = (delay: number) =>
    at(delay, () => {
      if (still) crowd.setFrame(3);
      else crowd.play(`${crowdKey}-cheer`);
    });
  const hushCrowd = (delay: number) => at(delay, () => crowd.stop().setFrame(0));
  const netShake = (delay: number) => {
    if (!still)
      scene.tweens.add({
        targets: goal,
        x: goal.x + 1,
        duration: 50,
        delay,
        yoyo: true,
        repeat: 5,
      });
  };
  const confetti = (delay: number) =>
    at(delay, () => {
      if (still) return;
      const burst = track(
        scene.add.particles(0, 4, 'pitch-dot', {
          x: { min: 0, max: ART_W },
          speedY: { min: -40, max: -10 },
          speedX: { min: -12, max: 12 },
          gravityY: 45,
          lifespan: 2200,
          scale: { min: 0.5, max: 1 },
          tint: [ours, 0xf6f1e3, shade(ours, 0.7), 0xf2c555],
          emitting: false,
        }),
      ).setDepth(800);
      burst.explode(70);
    });
  const turf = (x: number, y: number, delay: number) =>
    at(delay, () => {
      if (still) return;
      const bits = track(
        scene.add.particles(x, y, 'pitch-bit', {
          speed: { min: 20, max: 55 },
          angle: { min: 190, max: 350 },
          gravityY: 150,
          lifespan: 520,
          tint: [0x46a35c, 0x2c7a43, 0x6e4a2b],
          emitting: false,
        }),
      ).setDepth(400);
      bits.explode(14);
    });
  const gloom = (delay: number) =>
    at(delay, () => {
      const shade = track(
        scene.add.rectangle(0, 0, ART_W, ART_H, 0x0a1a2e, 0).setOrigin(0).setDepth(850),
      );
      move(shade, { fillAlpha: 0.38 }, 500);
    });

  /* ---------------------------------------------------------------- squadre e coreografie */

  const resultScene =
    model.result === 'goal' || model.result === 'assist' || model.result === 'pass'
      ? 'attack'
      : model.scene;
  const phase = model.phase;
  const r = model.result;

  if (
    resultScene === 'attack' ||
    resultScene === 'bell' ||
    resultScene === 'pendulum' ||
    resultScene === 'press'
  ) {
    const actor = spawn(kit(ours), 150, 96);
    const mate = spawn(kit(ours), 176, 64);
    spawn(kit(ours), 112, 122);
    const d1 = spawn(kit(theirs), 190, 102, true);
    const d2 = spawn(kit(theirs), 198, 76, true);
    spawn(kit(theirs), 138, 70, true);
    const keeper = spawn(keeperKit(theirs), 219, MID_Y, true);
    ballAt(157, 97);
    if (phase === 'ready') {
      anim(actor, 'idle');
      loop(ball.pos, { h: 6 }, 260);
      anim(mate, 'jog');
      loop(mate.sprite, { x: 182 }, 900);
      anim(d1, 'jog');
      loop(d1.sprite, { y: 98 }, 700);
      loop(keeper.sprite, { y: MID_Y - 4 }, 800);
      loop(d2.sprite, { x: 194 }, 1100);
    } else if (r === 'goal' || r === 'assist') {
      const shooter = r === 'goal' ? actor : mate;
      let t: number;
      if (r === 'assist') {
        pose(actor, FRAME.kick1);
        kick(mate.sprite.x + 6, mate.sprite.y + 1, 3, 360, 120);
        at(120, () => pose(actor, FRAME.kick1));
        runTo(mate, 182, 70, 260, 200);
        t = 520;
        banner('ASSIST!', 0xf2c555, 1400);
      } else {
        runTo(actor, 172, 94, 420);
        move(ball.pos, { x: 178, y: 95 }, 420, 0, 'Linear');
        t = 420;
        banner('GOL!', 0xf2c555, t + 380);
      }
      at(t, () => pose(shooter, FRAME.kick0));
      at(t + 70, () => {
        pose(shooter, FRAME.kick1);
        hitStop();
      });
      kick(233, 85, 8, 360, t + 80, 0);
      at(t + 160, () => pose(keeper, FRAME.stretch));
      move(keeper.sprite, { y: 98, angle: 75 }, 280, t + 160, 'Quad.easeOut');
      netShake(t + 440);
      impact(true, t + 440);
      celebrateCrowd(t + 440);
      confetti(t + 460);
      at(t + 700, () => pose(shooter, FRAME.cheer));
      runTo(shooter, shooter.sprite.x + 22, 128, 700, t + 1100);
      at(t + 1800, () => pose(shooter, FRAME.cheer));
      runTo(r === 'goal' ? mate : actor, shooter.sprite.x + 14, 122, 800, t + 1200);
    } else if (r === 'pass') {
      pose(actor, FRAME.kick0);
      at(90, () => pose(actor, FRAME.kick1));
      kick(mate.sprite.x + 6, mate.sprite.y + 1, 4, 420, 100);
      runTo(mate, 186, 66, 300, 160);
      runTo(d2, 192, 70, 400, 100);
      banner('PASSAGGIO!', 0xf6f1e3, 520);
    } else {
      // Tiro sbagliato o palla persa: il pubblico si ammutolisce.
      runTo(actor, 170, 95, 380);
      move(ball.pos, { x: 176, y: 96 }, 380, 0, 'Linear');
      at(380, () => pose(actor, FRAME.kick0));
      at(440, () => pose(actor, FRAME.kick1));
      kick(240, 66, 16, 520, 450);
      at(520, () => pose(keeper, FRAME.stretch));
      move(keeper.sprite, { y: 82, angle: -70 }, 300, 520, 'Quad.easeOut');
      hushCrowd(900);
      banner(r === 'concede' ? 'GOL SUBITO' : 'FUORI!', 0xff8a6b, 900);
      if (r === 'concede') gloom(900);
    }
  } else if (resultScene === 'defence') {
    const attacker = spawn(kit(theirs), 160, 92);
    const actor = spawn(kit(ours), 190, 92, true);
    const keeper = spawn(keeperKit(ours), 219, MID_Y, true);
    spawn(kit(theirs), 150, 62);
    spawn(kit(ours), 178, 120, true);
    spawn(kit(theirs), 128, 116);
    ballAt(166, 93);
    if (phase === 'ready') {
      anim(attacker, 'jog');
      loop(ball.pos, { x: 168 }, 300);
      loop(attacker.sprite, { x: 162 }, 300);
      loop(actor.sprite, { y: 95 }, 600);
      loop(keeper.sprite, { y: MID_Y + 3 }, 900);
    } else if (r === 'winBall' || phase === 'success') {
      runTo(attacker, 172, 92, 300);
      move(ball.pos, { x: 178, y: 93 }, 300, 0, 'Linear');
      at(220, () => pose(actor, FRAME.kick1));
      move(actor.sprite, { x: 176, y: 95, angle: -80 }, 260, 220, 'Quad.easeOut');
      turf(180, 96, 300);
      at(440, () => hitStop(70));
      kick(140, 122, 5, 520, 460);
      at(470, () => pose(attacker, FRAME.stretch));
      move(attacker.sprite, { angle: 90, y: 96 }, 260, 470, 'Quad.easeIn');
      impact(false, 470);
      celebrateCrowd(520);
      banner('RECUPERO!', 0x9df08a, 560);
      move(actor.sprite, { angle: 0 }, 200, 1300);
      at(1500, () => pose(actor, FRAME.cheer));
    } else {
      // Superato in dribbling: il difensore va a terra dalla parte sbagliata.
      move(attacker.sprite, { y: 82 }, 220, 0, 'Quad.easeOut');
      move(ball.pos, { x: 172, y: 82 }, 220);
      at(120, () => pose(actor, FRAME.stretch));
      move(actor.sprite, { y: 104, angle: 80 }, 300, 120, 'Quad.easeOut');
      runTo(attacker, 212, 80, 520, 260);
      move(ball.pos, { x: 217, y: 81 }, 520, 260, 'Linear');
      hushCrowd(500);
      if (r === 'concede') {
        at(780, () => pose(attacker, FRAME.kick1));
        kick(233, 94, 4, 200, 790);
        at(800, () => pose(keeper, FRAME.stretch));
        move(keeper.sprite, { y: 82, angle: -70 }, 240, 800);
        netShake(990);
        gloom(1000);
        banner('GOL SUBITO', 0xff5c5c, 1000);
      } else banner('SUPERATO!', 0xff8a6b, 600);
    }
  } else {
    // Portiere: il giocatore è tra i pali, l'avversario calcia da fuori area piccola.
    const shooter = spawn(kit(theirs), 178, 96);
    const actor = spawn(keeperKit(ours), 219, MID_Y, true);
    spawn(kit(ours), 196, 110, true);
    spawn(kit(theirs), 168, 66);
    spawn(kit(ours), 150, 82);
    ballAt(184, 97);
    if (phase === 'ready') {
      anim(shooter, 'jog');
      loop(shooter.sprite, { x: 174 }, 700);
      loop(actor.sprite, { y: MID_Y - 5 }, 650);
    } else {
      at(0, () => pose(shooter, FRAME.kick0));
      at(260, () => {
        pose(shooter, FRAME.kick1);
        hitStop();
      });
      const save = r === 'save' || phase === 'success';
      const post = !save && r !== 'concede';
      if (save) {
        kick(219, 80, 9, 360, 270, 9);
        at(300, () => pose(actor, FRAME.stretch));
        move(actor.sprite, { y: 82, angle: -75 }, 300, 300, 'Quad.easeOut');
        at(630, () => {
          if (!still) ball.sprite.stop();
        });
        // La palla resta tra i guanti e scende con il portiere.
        move(ball.pos, { x: 214, y: 80, h: 0 }, 300, 640, 'Bounce.easeOut');
        impact(false, 630);
        celebrateCrowd(640);
        confetti(700);
        banner('PARATA!', 0x8fe3ff, 640);
      } else if (post) {
        kick(GOAL_X, POST_FAR, 9, 340, 270);
        at(330, () => pose(actor, FRAME.stretch));
        move(actor.sprite, { y: 98, angle: 75 }, 300, 330, 'Quad.easeOut');
        netShake(610);
        impact(false, 610);
        kick(204, 66, 6, 420, 620);
        hushCrowd(640);
        banner('PALO!', 0xff8a6b, 640);
      } else {
        kick(233, 96, 3, 300, 270);
        at(330, () => pose(actor, FRAME.stretch));
        move(actor.sprite, { y: 80, angle: -75 }, 300, 330, 'Quad.easeOut');
        netShake(570);
        hushCrowd(580);
        gloom(600);
        banner('GOL SUBITO', 0xff5c5c, 600);
      }
    }
  }

  /* ---------------------------------------------------------------- aggiornamento per fotogramma */

  const sync = () => {
    for (const a of actors) {
      a.shadow.setPosition(a.sprite.x, a.sprite.y + 1);
      a.sprite.setDepth(10 + a.sprite.y);
    }
    const { x, y, h } = ball.pos;
    ball.shadow.setPosition(x, y + 1);
    ball.sprite.setPosition(Math.round(x), Math.round(y - 2 - h)).setDepth(10 + y + 0.5);
  };
  sync();
  scene.events.on('update', sync);
  return () => {
    scene.events.off('update', sync);
    cam.setZoom(1).centerOn(480 / 2, 288 / 2);
  };
}
