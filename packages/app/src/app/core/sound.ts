import { zzfxBuildSamples, zzfxPlaySamples, type ZzfxParams } from './vendor/zzfx';

export type SoundId = 'point';

/** Chi emette davvero il suono: in app ZzFX, nei test un finto che registra le chiamate. */
export interface SoundPlayer {
  play(id: SoundId): void;
}

// Due note brevi e morbide (do6 che sale), senza variazione casuale: un "ding" da +1.
export const SOUNDS: Record<SoundId, ZzfxParams> = {
  point: [0.6, 0, 1046, 0.005, 0.04, 0.14, 0, 1, 0, 0, 520, 0.05],
};

/**
 * Suoni dell'interfaccia. Rispetta l'interruttore e suona una volta sola per ogni
 * occasione (per esempio uno stop del capitolo), anche se la vista si ridisegna.
 */
export class Sounds {
  private lastFor: unknown = undefined;

  constructor(
    private readonly player: SoundPlayer,
    private readonly enabled: () => boolean,
  ) {}

  /** Suona `id` per l'occasione `occasion`; una seconda chiamata con la stessa occasione tace. */
  playOnce(id: SoundId, occasion: unknown): void {
    if (occasion === this.lastFor) return;
    this.lastFor = occasion;
    if (!this.enabled()) return;
    try {
      this.player.play(id);
    } catch {
      // Un suono mancato non deve mai fermare il gioco.
    }
  }
}

type AudioContextCtor = new () => AudioContext;

/**
 * Lettore ZzFX. L'AudioContext nasce alla prima riproduzione, che arriva sempre dopo un
 * tocco del giocatore (iOS e Chrome bloccano l'audio prima). Senza Web Audio, per
 * esempio in jsdom, non fa nulla e non scrive errori.
 */
export function zzfxPlayer(): SoundPlayer {
  let ctx: AudioContext | null = null;
  const cache = new Map<SoundId, Float32Array>();
  return {
    play(id) {
      try {
        const g = globalThis as {
          AudioContext?: AudioContextCtor;
          webkitAudioContext?: AudioContextCtor;
        };
        const Ctor = g.AudioContext ?? g.webkitAudioContext;
        if (!Ctor) return;
        ctx ??= new Ctor();
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
        let samples = cache.get(id);
        if (!samples) {
          samples = zzfxBuildSamples(SOUNDS[id]);
          cache.set(id, samples);
        }
        zzfxPlaySamples(ctx, samples);
      } catch {
        // Audio non disponibile o bloccato: si resta in silenzio.
      }
    },
  };
}
