import { Injectable, Pipe, type PipeTransform, inject, signal } from '@angular/core';
import { defaultContent } from '@outstanding/content';
import { translate, type TextParams } from './text';

/** Testi del gioco in italiano: contenuti, motore e interfaccia (chiavi `ui.*`). */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly table = defaultContent.i18n.it;
  /** Testi sostituiti dall'editor della carriera aperta (nomi di campionati e coppe). */
  private readonly overrides = signal<Readonly<Record<string, string>>>({});

  t(key: string, params?: TextParams): string {
    return this.overrides()[key] ?? translate(this.table, key, params);
  }

  /** Testo originale, senza le modifiche dell'editor. */
  original(key: string): string {
    return translate(this.table, key);
  }

  setOverrides(map: Readonly<Record<string, string>>): void {
    this.overrides.set(map);
  }

  has(key: string): boolean {
    return key in this.table;
  }
}

/**
 * `{{ 'ui.week.title' | t }}` oppure `{{ key | t: { name: x } }}`. Non pura: i nomi cambiati
 * nell'editor devono comparire subito anche con gli stessi argomenti.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: TextParams): string {
    return this.i18n.t(key, params);
  }
}
