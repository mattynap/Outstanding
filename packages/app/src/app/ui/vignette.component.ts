import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Vignetta piatta disegnata dal codice per beni e attività del giocatore (stesso stile di stemmi e
 * avatar). Una scena per id del catalogo; gli id sconosciuti mostrano solo cielo e terreno.
 */
@Component({
  selector: 'app-vignette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 160 96" role="img" [attr.aria-label]="label()">
      @switch (scene()) {
        @case ('sea') {
          <rect width="160" height="96" fill="#BFD9DE" />
          <circle cx="132" cy="20" r="9" fill="#F2D27A" />
          <rect y="62" width="160" height="34" fill="#2F6F8F" />
          <path
            d="M0 66 Q10 62 20 66 T40 66 T60 66 T80 66 T100 66 T120 66 T140 66 T160 66"
            stroke="#9CC7D6"
            stroke-width="2"
            fill="none"
          />
          <path
            d="M8 84 q8 -4 16 0 M70 88 q8 -4 16 0 M126 82 q8 -4 16 0"
            stroke="#5B98B2"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          />
        }
        @case ('road') {
          <rect width="160" height="96" fill="#BFD9DE" />
          <path d="M0 58 L30 40 L52 52 L84 30 L118 50 L160 36 V62 H0Z" fill="#9DBF8E" />
          <rect y="62" width="160" height="34" fill="#4A4F55" />
          <path
            d="M6 80 H30 M50 80 H74 M94 80 H118 M138 80 H160"
            stroke="#E8E2D2"
            stroke-width="2.5"
          />
        }
        @case ('pitch') {
          <rect width="160" height="96" fill="#BFD9DE" />
          <rect y="44" width="160" height="52" fill="#3E8A55" />
          <path d="M0 56 H160 M0 70 H160 M0 84 H160" stroke="#47975F" stroke-width="7" />
        }
        @default {
          <rect width="160" height="96" fill="#BFD9DE" />
          <circle cx="28" cy="20" r="8" fill="#F2D27A" />
          <rect y="74" width="160" height="22" fill="#9DBF8E" />
          <rect y="74" width="160" height="4" fill="#86AD78" />
        }
      }

      @switch (id()) {
        @case ('monolocale') {
          <rect x="54" y="30" width="52" height="46" fill="#D9A27A" />
          <rect x="50" y="26" width="60" height="6" fill="#A8694A" />
          @for (r of [36, 52]; track r) {
            @for (c of [60, 76, 92]; track c) {
              <rect [attr.x]="c" [attr.y]="r" width="9" height="10" fill="#F6E7C1" />
            }
          }
          <rect x="74" y="64" width="12" height="12" fill="#6B3E2A" />
        }
        @case ('appartamento') {
          <rect x="40" y="14" width="44" height="62" fill="#C9C2B2" />
          <rect x="84" y="28" width="38" height="48" fill="#B5AE9E" />
          @for (r of [20, 32, 44, 56]; track r) {
            @for (c of [46, 58, 70]; track c) {
              <rect [attr.x]="c" [attr.y]="r" width="8" height="8" fill="#F6E7C1" />
            }
          }
          @for (r of [34, 46, 58]; track r) {
            @for (c of [90, 104]; track c) {
              <rect [attr.x]="c" [attr.y]="r" width="9" height="8" fill="#8FB3C6" />
            }
          }
          <rect x="44" y="40" width="34" height="2" fill="#8D8677" />
          <rect x="44" y="52" width="34" height="2" fill="#8D8677" />
        }
        @case ('villa') {
          <rect x="34" y="44" width="74" height="32" fill="#F1EBDD" />
          <path d="M28 46 L71 26 L114 46Z" fill="#B5452A" />
          <rect x="44" y="54" width="12" height="12" fill="#8FB3C6" />
          <rect x="86" y="54" width="12" height="12" fill="#8FB3C6" />
          <rect x="65" y="56" width="12" height="20" fill="#6B3E2A" />
          <rect x="112" y="72" width="40" height="10" rx="2" fill="#5BB6D6" />
          <path d="M18 76 C14 60 16 44 20 34 C24 44 26 60 22 76Z" fill="#2E5E3E" />
        }
        @case ('palazzo') {
          <rect x="30" y="34" width="100" height="42" fill="#E8DFC8" />
          <path d="M26 36 L80 14 L134 36Z" fill="#D4C7A6" />
          <circle cx="80" cy="28" r="4" fill="#B88A2A" />
          @for (c of [38, 52, 66, 86, 100, 114]; track c) {
            <rect [attr.x]="c" y="40" width="7" height="32" fill="#FAF6EA" />
          }
          <rect x="74" y="54" width="12" height="22" fill="#6B3E2A" />
          <rect x="26" y="72" width="108" height="5" fill="#C7B994" />
        }
        @case ('utilitaria') {
          <path d="M44 72 V62 Q46 54 56 52 L66 42 H96 L108 52 Q118 54 118 62 V72Z" fill="#3D6E8C" />
          <path d="M70 46 H82 V52 H64Z M86 46 H94 L102 52 H86Z" fill="#CFE6EF" />
          <circle cx="62" cy="74" r="8" fill="#1A1A17" />
          <circle cx="62" cy="74" r="3" fill="#9A9A9A" />
          <circle cx="102" cy="74" r="8" fill="#1A1A17" />
          <circle cx="102" cy="74" r="3" fill="#9A9A9A" />
        }
        @case ('sportiva') {
          <path d="M30 74 V66 Q34 58 52 56 L72 46 H98 L116 56 Q132 58 134 66 V74Z" fill="#C8202F" />
          <path d="M76 50 H96 L108 56 H66Z" fill="#2B2F36" />
          <path d="M30 66 H134" stroke="#8E1620" stroke-width="2" />
          <circle cx="52" cy="76" r="8" fill="#1A1A17" />
          <circle cx="52" cy="76" r="3.5" fill="#D9D9D9" />
          <circle cx="112" cy="76" r="8" fill="#1A1A17" />
          <circle cx="112" cy="76" r="3.5" fill="#D9D9D9" />
        }
        @case ('motoscafo') {
          <path d="M34 60 H124 L114 72 H46Z" fill="#F1EBDD" />
          <path d="M34 60 H124 L120 64 H38Z" fill="#C8202F" />
          <path d="M66 60 L76 50 H98 L104 60Z" fill="#2B2F36" />
          <path d="M114 72 Q132 70 150 74" stroke="#E8F2F5" stroke-width="2" fill="none" />
        }
        @case ('yacht') {
          <path d="M20 58 H142 L128 74 H34Z" fill="#FAF6EA" />
          <path d="M20 58 H142 L139 62 H23Z" fill="#1F3FA0" />
          <path d="M44 58 V46 H118 L128 58Z" fill="#F1EBDD" />
          <path d="M62 46 V36 H104 L112 46Z" fill="#E8E2D2" />
          <path d="M50 50 H112 M68 40 H102" stroke="#2B2F36" stroke-width="3" />
          <path d="M84 36 V24 M84 26 L94 30" stroke="#6B6B6B" stroke-width="1.5" fill="none" />
        }
        @case ('bar') {
          <rect x="40" y="30" width="80" height="46" fill="#F1EBDD" />
          <path d="M36 32 H124 L118 44 H42Z" fill="#1E7A46" />
          <path
            d="M48 32 L46 44 M62 32 L61 44 M76 32 V44 M90 32 L91 44 M104 32 L106 44"
            stroke="#F1EBDD"
            stroke-width="3"
          />
          <rect x="48" y="50" width="30" height="20" fill="#8FB3C6" />
          <rect x="88" y="50" width="16" height="26" fill="#6B3E2A" />
          <path
            d="M56 58 h10 v6 a5 5 0 0 1 -10 0z M66 59 a3 3 0 0 1 0 5"
            fill="#F1EBDD"
            stroke="#6B3E2A"
            stroke-width="1.2"
          />
        }
        @case ('ristorante') {
          <rect x="30" y="30" width="100" height="46" fill="#E8DFC8" />
          <path d="M26 32 H134 L128 44 H32Z" fill="#B5452A" />
          <path
            d="M40 32 L38 44 M56 32 L55 44 M72 32 V44 M88 32 V44 M104 32 L105 44 M120 32 L122 44"
            stroke="#F1EBDD"
            stroke-width="3"
          />
          <rect x="38" y="50" width="40" height="18" fill="#F6E7C1" />
          <rect x="86" y="50" width="14" height="26" fill="#6B3E2A" />
          <path
            d="M112 50 v14 M108 50 v5 q0 3 4 3 q4 0 4 -3 v-5"
            stroke="#1A1A17"
            stroke-width="1.6"
            fill="none"
          />
          <rect x="132" y="66" width="18" height="3" fill="#6B3E2A" />
          <path d="M136 69 v7 M146 69 v7" stroke="#6B3E2A" stroke-width="1.6" />
        }
        @case ('palestra') {
          <rect x="34" y="28" width="92" height="48" fill="#C9C2B2" />
          <rect x="34" y="28" width="92" height="10" fill="#2B2F36" />
          <path d="M66 33 H94" stroke="#F2B830" stroke-width="3" />
          <rect x="60" y="29" width="6" height="8" rx="1" fill="#F2B830" />
          <rect x="94" y="29" width="6" height="8" rx="1" fill="#F2B830" />
          @for (c of [42, 64, 86, 108]; track c) {
            <rect [attr.x]="c" y="44" width="12" height="20" fill="#8FB3C6" />
          }
          <rect x="72" y="62" width="16" height="14" fill="#2B2F36" />
        }
        @case ('scuola_calcio') {
          <path d="M20 46 H140 L150 92 H10Z" fill="none" stroke="#F1EBDD" stroke-width="1.6" />
          <path d="M80 46 V92" stroke="#F1EBDD" stroke-width="1.6" />
          <path d="M56 46 V38 H104 V46" fill="none" stroke="#F1EBDD" stroke-width="3" />
          <path d="M56 38 L60 46 M104 38 L100 46" stroke="#D6E4D9" stroke-width="1" />
          @for (c of [34, 52, 108, 126]; track c) {
            <path [attr.d]="'M' + c + ' 74 l4 -8 l4 8z'" fill="#F28C28" />
          }
          <circle cx="80" cy="68" r="5" fill="#FAF6EA" />
          <circle cx="80" cy="68" r="1.8" fill="#1A1A17" />
        }
        @case ('marchio') {
          <rect x="30" y="26" width="100" height="50" fill="#1A1A17" />
          <rect x="30" y="26" width="100" height="10" fill="#F2B830" />
          <rect x="40" y="42" width="52" height="28" fill="#F1EBDD" />
          <path
            d="M56 46 l-8 4 3 5 4 -2 v13 h18 v-13 l4 2 3 -5 -8 -4 q-8 5 -16 0z"
            fill="#C8202F"
          />
          <rect x="100" y="44" width="20" height="32" fill="#6B3E2A" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      border-radius: var(--o-radius-md);
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
  `,
})
export class VignetteComponent {
  readonly id = input.required<string>();
  readonly label = input('');

  protected scene(): 'sea' | 'road' | 'pitch' | 'land' {
    const id = this.id();
    if (id === 'motoscafo' || id === 'yacht') return 'sea';
    if (id === 'utilitaria' || id === 'sportiva') return 'road';
    if (id === 'scuola_calcio') return 'pitch';
    return 'land';
  }
}
