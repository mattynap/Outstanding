import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Archivio chiave-valore del dispositivo (Capacitor Preferences; nel browser usa localStorage).
 * Unico punto di accesso alla memoria locale, così il salvataggio si può sostituire in M10.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async get(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
