import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { parseTutorial, tipVisible, TIP_IDS, type TipId, type TutorialData } from './tutorial';

export { TIP_IDS, type TipId } from './tutorial';

const TUTORIAL_KEY = 'outstanding.tutorial';

/**
 * Settimana guidata: una vera prima settimana con i consigli sulle schermate. Vale per una sola
 * carriera (lo slot in cui è stata avviata) e finisce quando il giocatore la chiude o la salta.
 */
@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly storage = inject(StorageService);
  private readonly data = signal<TutorialData | null>(null);

  /** Consigli in tutto e consigli già letti, per il contatore. */
  readonly total = TIP_IDS.length;
  readonly progress = computed(() => this.data()?.seen.length ?? 0);

  async load(): Promise<void> {
    this.data.set(parseTutorial(await this.storage.get(TUTORIAL_KEY)));
  }

  /** Slot in cui la guida è in corso, se c'è. */
  slot(): number | null {
    return this.data()?.slot ?? null;
  }

  visible(id: TipId, slot: number | null): boolean {
    return tipVisible(this.data(), slot, id);
  }

  async start(slot: number): Promise<void> {
    await this.save({ slot, seen: [] });
  }

  async dismiss(id: TipId): Promise<void> {
    const d = this.data();
    if (!d || d.seen.includes(id)) return;
    const seen = [...d.seen, id];
    await this.save(seen.length === TIP_IDS.length ? null : { ...d, seen });
  }

  /** Chiude la guida (finita o saltata). */
  async stop(): Promise<void> {
    await this.save(null);
  }

  /** Una nuova carriera o una cancellazione nello slot della guida la chiude. */
  async forgetSlot(slot: number): Promise<void> {
    if (this.data()?.slot === slot) await this.stop();
  }

  private async save(data: TutorialData | null): Promise<void> {
    this.data.set(data);
    if (data) await this.storage.set(TUTORIAL_KEY, JSON.stringify(data));
    else await this.storage.remove(TUTORIAL_KEY);
  }
}
