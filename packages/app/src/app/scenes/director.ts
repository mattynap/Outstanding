import type Phaser from 'phaser';
import { textTexture } from './pixel-art';

export type Track = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

/**
 * Strumenti di regia comuni alle scene. Con movimento ridotto ogni passo si applica subito,
 * nell'ordine in cui è scritto: resta solo il fotogramma finale, senza effetti.
 */
export function director(scene: Phaser.Scene, still: boolean, track: Track, zoom: number) {
  const cam = scene.cameras.main;
  const at = (ms: number, fn: () => void) => {
    if (still) fn();
    else scene.time.delayedCall(ms, fn);
  };
  const move = (
    target: object,
    props: Record<string, number>,
    ms: number,
    delay = 0,
    ease = 'Sine.easeInOut',
  ) => {
    if (still) Object.assign(target, props);
    else scene.tweens.add({ targets: target, ...props, duration: ms, delay, ease });
  };
  const loop = (target: object, props: Record<string, number>, ms: number, delay = 0) => {
    if (!still)
      scene.tweens.add({
        targets: target,
        ...props,
        duration: ms,
        delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
  };
  /** Fermo immagine di un istante sul contatto: dà peso al colpo. */
  const hitStop = (ms = 80) => {
    if (still) return;
    scene.tweens.pauseAll();
    scene.anims.pauseAll();
    scene.time.delayedCall(ms, () => {
      scene.tweens.resumeAll();
      scene.anims.resumeAll();
    });
  };
  const banner = (text: string, color: number, delay: number, y: number, width: number) =>
    at(delay, () => {
      const ribbon = track(
        scene.add.rectangle(0, y, width, 20, 0x0b0f14, 0.62).setOrigin(0, 0.5).setDepth(900),
      );
      const edge = track(
        scene.add
          .rectangle(0, y + 10, width, 1, color, 0.9)
          .setOrigin(0, 0.5)
          .setDepth(900),
      );
      const word = track(
        scene.add.image(width / 2, y, textTexture(scene, text, color)).setDepth(901),
      );
      if (still) {
        word.setScale(2);
        return;
      }
      ribbon.setScale(0, 1);
      edge.setScale(0, 1);
      word.setScale(0);
      scene.tweens.add({ targets: [ribbon, edge], scaleX: 1, duration: 160, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: word, scale: 2, duration: 320, delay: 60, ease: 'Back.easeOut' });
      scene.tweens.add({
        targets: word,
        y: y - 1,
        duration: 420,
        delay: 400,
        yoyo: true,
        repeat: -1,
      });
    });
  const impact = (strong: boolean, delay: number) =>
    at(delay, () => {
      if (still) return;
      cam.flash(strong ? 180 : 90, 255, 250, 225);
      cam.shake(strong ? 320 : 160, strong ? 0.012 : 0.006);
      if (strong) {
        cam.zoomTo(zoom * 1.12, 260, 'Quad.easeOut');
        scene.time.delayedCall(1300, () => cam.zoomTo(zoom, 500, 'Sine.easeInOut'));
      }
    });
  return { at, move, loop, hitStop, banner, impact };
}
