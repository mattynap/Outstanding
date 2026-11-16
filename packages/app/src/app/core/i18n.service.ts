import { Injectable, Pipe, type PipeTransform, inject } from '@angular/core';
import { defaultContent } from '@outstanding/content';
import { translate, type TextParams } from './text';

/** Testi del gioco in italiano: contenuti, motore e interfaccia (chiavi `ui.*`). */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly table = defaultContent.i18n.it;

  t(key: string, params?: TextParams): string {
    return translate(this.table, key, params);
  }

  has(key: string): boolean {
    return key in this.table;
  }
}

/** `{{ 'ui.week.title' | t }}` oppure `{{ key | t: { name: x } }}` */
@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: TextParams): string {
    return this.i18n.t(key, params);
  }
}
