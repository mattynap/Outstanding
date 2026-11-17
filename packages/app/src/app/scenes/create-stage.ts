import Phaser from 'phaser';
import type { StageModel } from './stage-model';

export interface StageController {
  show(model: StageModel, reducedMotion: boolean): void;
  pause(paused: boolean): void;
  fps(): number;
  destroy(): void;
}

const W = 480;
const H = 288;
const INK = 0x101c28;

/** Il tempo grafico non entra mai nel motore: la scena mostra soltanto l'esito ricevuto. */
export function createStage(
  parent: HTMLElement,
  initial: StageModel,
  reduced: boolean,
): StageController {
  let model = initial;
  let still = reduced;
  let ready = false;
  class Stadium extends Phaser.Scene {
    private objects: Phaser.GameObjects.GameObject[] = [];
    private previous = '';
    constructor() {
      super('outstanding-stage');
    }
    create(): void {
      ready = true;
      this.paint();
    }
    paint(): void {
      parent.dataset['scene'] = model.scene;
      parent.dataset['phase'] = model.phase;
      this.tweens.killAll();
      for (const object of this.objects) object.destroy();
      this.objects = [];
      this.previous = model.key;
      if (['bell', 'pendulum', 'press'].includes(model.scene)) this.pressRoom();
      else this.pitch();
    }
    private rect(x: number, y: number, w: number, h: number, color: number, alpha = 1) {
      const object = this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0);
      this.objects.push(object);
      return object;
    }
    private player(x: number, y: number, color: number, scale = 1): Phaser.GameObjects.Container {
      const parts: Phaser.GameObjects.GameObject[] = [];
      const part = (px: number, py: number, w: number, h: number, c: number) => {
        const item = this.add.rectangle(px, py, w, h, c).setOrigin(0);
        parts.push(item);
        return item;
      };
      part(-9, 10, 20, 5, 0x102a24).setAlpha(0.55);
      part(-5, -1, 4, 12, 0x152130);
      part(2, -1, 4, 12, 0x152130);
      part(-6, 10, 6, 3, 0xf1e8d1);
      part(2, 10, 6, 3, 0xf1e8d1);
      part(-9, -16, 18, 17, color);
      part(-12, -14, 4, 12, 0xd7a87c);
      part(9, -14, 4, 12, 0xd7a87c);
      part(-5, -27, 11, 12, 0xd7a87c);
      part(-6, -29, 12, 5, 0x332934);
      part(-1, -10, 3, 5, 0xfaf2da);
      const container = this.add.container(x, y, parts).setScale(scale);
      this.objects.push(container);
      return container;
    }
    private motion(targets: object, props: object, duration: number, delay = 0): void {
      if (still) return;
      this.tweens.add({ targets, ...props, duration, delay, ease: 'Sine.easeInOut' });
    }
    private pitch(): void {
      this.rect(0, 0, W, H, INK);
      this.rect(8, 9, 464, 46, 0x293944);
      for (let row = 0; row < 4; row++)
        for (let n = 0; n < 58; n++) {
          const colors = [0x50636c, 0xe6c55e, 0xb6baae, 0x6d8e83, 0x263647];
          this.rect(11 + n * 8, 12 + row * 9, 4, 4, colors[(n * 7 + row * 3) % colors.length]!);
        }
      this.rect(0, 54, W, 8, 0xd6c7a0);
      for (let n = 0; n < 8; n++) this.rect(n * 60, 62, 60, 226, n % 2 ? 0x277550 : 0x2b8057);
      const lines = this.add.graphics().lineStyle(2, 0xc5dfb7, 0.8);
      lines.strokeRect(22, 74, 436, 200);
      lines.lineBetween(240, 74, 240, 274);
      lines.strokeCircle(240, 174, 37);
      lines.strokeRect(350, 111, 108, 126);
      lines.strokeRect(410, 143, 48, 64);
      lines.fillStyle(0xc5dfb7).fillCircle(386, 174, 2);
      lines.strokeRect(22, 111, 108, 126);
      lines.strokeRect(22, 143, 48, 64);
      this.objects.push(lines);
      this.rect(455, 145, 19, 58, 0xe1e3d5, 0.9);
      for (let n = 0; n < 5; n++) this.rect(457 + n * 4, 147, 1, 54, 0x6e8f86);
      for (let n = 0; n < 7; n++) this.rect(456, 148 + n * 8, 18, 1, 0x6e8f86);
      const color = (v: string | undefined, fallback: number) =>
        /^#[a-f\d]{6}$/i.test(v ?? '') ? Number.parseInt(v!.slice(1), 16) : fallback;
      const ours = color(model.homeColor, 0xf2c555),
        theirs = color(model.awayColor, 0x719ddd);
      const attack = model.scene === 'attack';
      const actor = this.player(
        attack ? 309 : 370,
        attack ? 194 : 175,
        attack ? ours : 0xefad60,
        0.92,
      );
      const keeper = this.player(438, 175, model.scene === 'keeper' ? ours : 0xea7c70, 0.9);
      const runner = this.player(265, 132, ours, 0.8);
      this.player(222, 221, ours, 0.8);
      this.player(181, 145, theirs, 0.8);
      const defender = this.player(359, 211, theirs, 0.85);
      this.player(333, 113, theirs, 0.8);
      this.player(119, 204, theirs, 0.75);
      const ball = this.rect(321, 197, 6, 6, 0xfffaeb).setAngle(16);
      this.rect(322, 199, 2, 2, INK);
      if (model.phase === 'ready') {
        this.motion(runner, { x: 280, y: 127 }, 1800);
        this.motion(defender, { x: 348, y: 201 }, 1800);
        if (!still)
          this.tweens.add({
            targets: actor,
            y: actor.y - 2,
            duration: 500,
            yoyo: true,
            repeat: -1,
          });
        return;
      }
      const goal = model.result === 'goal' || model.result === 'concede';
      const assist = model.result === 'assist' || model.result === 'pass';
      const save = model.result === 'save';
      if (still) {
        ball.setPosition(
          goal ? 465 : save ? 425 : assist ? 285 : 399,
          goal ? 169 : save ? 163 : assist ? 128 : 92,
        );
        return;
      }
      this.motion(actor, { x: actor.x + 15, y: actor.y - 5 }, 280);
      if (model.result === 'winBall') {
        ball.setPosition(382, 184);
        this.motion(defender, { x: 380, y: 179, angle: 12 }, 420);
        this.motion(ball, { x: 350, y: 181 }, 650, 180);
        return;
      }
      this.motion(
        ball,
        {
          x: goal ? 465 : save ? 426 : assist ? 284 : 401,
          y: goal ? 169 : save ? 163 : assist ? 128 : 91,
          angle: 220,
        },
        720,
        160,
      );
      this.motion(
        keeper,
        { x: save ? 425 : 435, y: goal ? 195 : 155, angle: save ? -65 : -35 },
        580,
        210,
      );
      if (goal) {
        const ring = this.add.circle(462, 172, 10).setStrokeStyle(3, 0xf2d66e).setAlpha(0);
        this.objects.push(ring);
        this.tweens.add({
          targets: ring,
          alpha: { from: 1, to: 0 },
          scale: 4,
          duration: 550,
          delay: 820,
        });
        for (let n = 0; n < 18; n++) {
          const piece = this.rect(185 + n * 8, 65, 3, 6, n % 2 ? 0xf2c555 : 0xe8f0d4);
          this.tweens.add({
            targets: piece,
            y: 130 + (n % 4) * 15,
            x: piece.x + (n % 2 ? 20 : -20),
            alpha: 0,
            angle: 180,
            duration: 1200,
            delay: 850 + n * 15,
          });
        }
      }
    }
    private pressRoom(): void {
      this.rect(0, 0, W, H, 0x162b38);
      this.rect(0, 0, W, 18, 0xd7c89e);
      this.rect(0, 18, W, 4, 0x9d7955);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 7; c++) {
          this.rect(24 + c * 65, 42 + r * 32, 50, 22, (c + r) % 2 ? 0x25424b : 0x213b45);
          this.rect(34 + c * 65, 49 + r * 32, 14, 3, 0x74958f, 0.6);
        }
      this.rect(0, 226, W, 62, 0x111c27);
      const coach = this.player(240, 183, 0x263540, 3.1);
      this.rect(37, 205, 406, 17, 0xb47f50);
      this.rect(37, 222, 406, 7, 0x775239);
      this.rect(220, 116, 40, 17, 0x283541);
      const mic = this.rect(294, 167, 4, 38, 0x7b8b8b);
      this.rect(290, 162, 12, 9, 0xc7c9b8);
      this.rect(57, 186, 80, 19, 0xe7dfbd);
      this.rect(65, 193, 41, 3, 0x7e8a76);
      if (model.scene === 'bell') {
        const bell = this.add.container(170, 165, [
          this.add.rectangle(0, 0, 18, 15, 0xf2c555),
          this.add.rectangle(0, 9, 26, 4, 0xe4ac43),
          this.add.rectangle(0, -10, 4, 7, 0xc28a3f),
        ]);
        this.objects.push(bell);
        this.motion(coach, { angle: -3 }, 400);
        if (!still)
          this.tweens.add({
            targets: bell,
            angle: { from: -25, to: 25 },
            duration: 120,
            yoyo: true,
            repeat: 9,
          });
        for (let i = 0; i < 3; i++) {
          const ray = this.rect(142 - i * 6, 154 - i * 7, 3, 7, 0xf2d77f, still ? 1 : 0);
          if (!still)
            this.tweens.add({
              targets: ray,
              alpha: 1,
              duration: 180,
              delay: 150 + i * 100,
              yoyo: true,
              repeat: 3,
            });
        }
      } else if (model.scene === 'pendulum') {
        const chain = this.add.container(193, 112, [
          this.add.rectangle(0, 35, 2, 70, 0xc9c5a8),
          this.add.rectangle(0, 74, 10, 13, 0xf2c555),
        ]);
        this.objects.push(chain);
        chain.setAngle(still ? 18 : -25);
        if (!still)
          this.tweens.add({ targets: chain, angle: 25, duration: 650, yoyo: true, repeat: 3 });
        this.rect(304, 185, 46, 17, 0xe7dfbd);
      } else {
        this.motion(coach, { x: 258, angle: -4 }, 400);
        this.motion(mic, { angle: 17, x: 304 }, 400, 170);
        const paper = this.rect(133, 184, 54, 21, 0xe7dfbd);
        this.motion(paper, { x: 120, y: 174, angle: -15 }, 500, 180);
      }
    }
    override update(): void {
      if (this.previous !== model.key) this.paint();
    }
  }
  const scene = new Stadium();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#101c28',
    pixelArt: true,
    antialias: false,
    banner: false,
    audio: { noAudio: true },
    fps: { target: 60, min: 20 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  });
  return {
    show(next, reducedMotion) {
      model = next;
      still = reducedMotion;
      if (ready) scene.paint();
    },
    pause(paused) {
      if (paused) game.loop.sleep();
      else game.loop.wake();
    },
    fps() {
      return Math.round(game.loop.actualFps);
    },
    destroy() {
      ready = false;
      game.destroy(true);
    },
  };
}
