import { Injectable, inject, signal } from '@angular/core';
import { parseMatchMode, type MatchMode } from './match-mode';
import type { PlayMode } from './play-mode';
import { StorageService } from './storage.service';

export type Theme = 'dark' | 'light';
const THEME_KEY = 'outstanding.theme';
const MATCH_MODE_KEY = 'outstanding.matchMode';
const SOUND_KEY = 'outstanding.sound';

/** Preferenze dell'interfaccia: tema, modalità di gioco, modalità partita predefinita e suoni. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);
  readonly theme = signal<Theme>('dark');
  readonly playMode = signal<PlayMode>('animated');
  readonly matchMode = signal<MatchMode>('full');
  readonly sound = signal(true);

  async load(): Promise<void> {
    const saved = await this.storage.get(THEME_KEY);
    this.apply(saved === 'light' ? 'light' : 'dark');
    this.matchMode.set(parseMatchMode(await this.storage.get(MATCH_MODE_KEY)));
    this.sound.set((await this.storage.get(SOUND_KEY)) !== 'off');
  }

  async setSound(on: boolean): Promise<void> {
    this.sound.set(on);
    await this.storage.set(SOUND_KEY, on ? 'on' : 'off');
  }

  async setMatchMode(mode: MatchMode): Promise<void> {
    this.matchMode.set(mode);
    await this.storage.set(MATCH_MODE_KEY, mode);
  }

  async setTheme(theme: Theme): Promise<void> {
    this.apply(theme);
    await this.storage.set(THEME_KEY, theme);
  }

  private apply(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B1F15' : '#EEF1E7');
  }
}
