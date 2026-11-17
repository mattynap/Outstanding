import { Injectable, inject, signal } from '@angular/core';
import type { GameState } from '@outstanding/engine';
import { StorageService } from './storage.service';
import { UnlockStore, type TabId } from './unlocks';

/** Voci della barra già annunciate, per slot, e novità ancora da mostrare. */
@Injectable({ providedIn: 'root' })
export class UnlocksService {
  private readonly store = new UnlockStore(inject(StorageService));
  // L'archivio non è reattivo: ogni modifica incrementa la versione e ricalcola la barra.
  private readonly version = signal(0);
  /** Voci comparse da poco: il riquadro "Novità" le annuncia finché non si chiude. */
  readonly fresh = signal<TabId[]>([]);

  visible(slot: number | null, s: GameState, offers: number): TabId[] {
    this.version();
    return this.store.visible(slot, s, offers);
  }

  async sync(slot: number, s: GameState, offers: number): Promise<void> {
    const tabs = await this.store.sync(slot, s, offers);
    this.version.update((v) => v + 1);
    if (tabs.length) this.fresh.update((f) => [...f, ...tabs.filter((t) => !f.includes(t))]);
  }

  dismiss(): void {
    this.fresh.set([]);
  }

  /** Carriera nuova nello slot: si riparte dalle voci di base. */
  async start(slot: number, s: GameState): Promise<void> {
    this.fresh.set([]);
    await this.store.start(slot, s);
    this.version.update((v) => v + 1);
  }

  async forgetSlot(slot: number): Promise<void> {
    this.fresh.set([]);
    await this.store.forget(slot);
    this.version.update((v) => v + 1);
  }
}
