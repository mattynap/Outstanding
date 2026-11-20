import { describe, expect, it } from 'vitest';
import { SOUNDS, Sounds, zzfxPlayer, type SoundId, type SoundPlayer } from '../src/app/core/sound';
import { zzfxBuildSamples, ZZFX_SAMPLE_RATE } from '../src/app/core/vendor/zzfx';

const fake = (): SoundPlayer & { played: SoundId[] } => {
  const played: SoundId[] = [];
  return { played, play: (id) => void played.push(id) };
};

describe('suoni', () => {
  it('con i suoni spenti non suona nulla', () => {
    const p = fake();
    const s = new Sounds(p, () => false);
    s.playOnce('point', {});
    s.playOnce('point', {});
    expect(p.played).toEqual([]);
  });

  it('suona una volta per ogni stop', () => {
    const p = fake();
    const s = new Sounds(p, () => true);
    const stopA = {};
    const stopB = {};
    s.playOnce('point', stopA);
    s.playOnce('point', stopA);
    s.playOnce('point', stopB);
    expect(p.played).toEqual(['point', 'point']);
  });

  it('riaccendere i suoni non ripete lo stop già passato in silenzio', () => {
    const p = fake();
    let on = false;
    const s = new Sounds(p, () => on);
    const stop = {};
    s.playOnce('point', stop);
    on = true;
    s.playOnce('point', stop);
    expect(p.played).toEqual([]);
  });

  it('un lettore che si rompe non propaga l’errore', () => {
    const s = new Sounds(
      {
        play: () => {
          throw new Error('audio bloccato');
        },
      },
      () => true,
    );
    expect(() => s.playOnce('point', {})).not.toThrow();
  });

  it('senza Web Audio il lettore ZzFX tace senza errori', () => {
    expect(() => zzfxPlayer().play('point')).not.toThrow();
  });

  it('il +1 è un suono breve', () => {
    const samples = zzfxBuildSamples(SOUNDS.point);
    expect(samples.length / ZZFX_SAMPLE_RATE).toBeLessThan(0.3);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1);
  });
});
