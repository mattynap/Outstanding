import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';
import { Sounds, zzfxPlayer, type SoundId } from './sound';

/** Suoni dell'app, legati all'interruttore "Suoni" delle impostazioni. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly settings = inject(SettingsService);
  private readonly sounds = new Sounds(zzfxPlayer(), () => this.settings.sound());

  playOnce(id: SoundId, occasion: unknown): void {
    this.sounds.playOnce(id, occasion);
  }
}
