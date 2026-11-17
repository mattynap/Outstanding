import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { newTabs, parseSeen, unlocksKey, type TabId } from './unlocks';

/** Voci della barra già annunciate, per slot, e novità ancora da mostrare. */
@Injectable({ providedIn: 'root' })
export class UnlocksService {
  private readonly storage = inject(StorageService);
  private readonly seenBySlot = signal<ReadonlyMap<number, TabId[]>>(new Map());
  /** Voci comparse da poco: il riquadro "Novità" le annuncia finché non si chiude. */
  readonly fresh = signal<TabId[]>([]);

  seen(slot: number | null): TabId[] {
    return slot === null ? [] : (this.seenBySlot().get(slot) ?? []);
  }

  /** Confronta le voci visibili con quelle già viste e salva le nuove. */
  async sync(slot: number, visible: readonly TabId[]): Promise<void> {
    const known =
      this.seenBySlot().get(slot) ?? parseSeen(await this.storage.get(unlocksKey(slot)));
    const { tabs, seen } = newTabs(visible, known);
    if (known && tabs.length === 0) return;
    this.seenBySlot.update((m) => new Map(m).set(slot, seen));
    if (tabs.length) this.fresh.update((f) => [...f, ...tabs.filter((t) => !f.includes(t))]);
    await this.storage.set(unlocksKey(slot), JSON.stringify(seen));
  }

  dismiss(): void {
    this.fresh.set([]);
  }

  /** Una nuova carriera o una cancellazione riparte da zero nello slot. */
  async forgetSlot(slot: number): Promise<void> {
    this.seenBySlot.update((m) => {
      const next = new Map(m);
      next.delete(slot);
      return next;
    });
    this.fresh.set([]);
    await this.storage.remove(unlocksKey(slot));
  }
}
