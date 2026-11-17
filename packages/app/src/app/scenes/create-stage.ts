import Phaser from 'phaser';
import type { StageModel } from './stage-model';
import { paintPitch } from './pixel-pitch';
import { paintRoom } from './pixel-press';

export interface StageController {
  show(model: StageModel, reducedMotion: boolean): void;
  pause(paused: boolean): void;
  fps(): number;
  destroy(): void;
}

const W = 480;
const H = 288;

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
    private detach: (() => void) | undefined;
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
      this.time.removeAllEvents();
      this.cameras.main.resetFX();
      this.detach?.();
      this.detach = undefined;
      for (const object of this.objects) object.destroy();
      this.objects = [];
      const track = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
        this.objects.push(object);
        return object;
      };
      const room = ['bell', 'pendulum', 'press'].includes(model.scene);
      this.detach = (room ? paintRoom : paintPitch)(this, model, still, track);
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
