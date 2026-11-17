import { Injectable, inject, signal } from '@angular/core';
import type { PlayMode } from './play-mode';
import { StorageService } from './storage.service';

export type Theme = 'dark' | 'light';
const THEME_KEY = 'outstanding.theme';

/** Preferenze dell'interfaccia: tema e modalità di gioco. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);
  readonly theme = signal<Theme>('dark');
  readonly playMode = signal<PlayMode>('animated');

  async load(): Promise<void> {
    const saved = await this.storage.get(THEME_KEY);
    this.apply(saved === 'light' ? 'light' : 'dark');
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
