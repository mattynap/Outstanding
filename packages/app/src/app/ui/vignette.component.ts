import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Vignetta piatta disegnata dal codice per beni, attività e vita privata del giocatore (stesso stile di stemmi e
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
        @case ('night') {
          <rect width="160" height="96" fill="#1F2A44" />
          <circle cx="132" cy="18" r="8" fill="#F3E9C6" />
          <circle cx="135" cy="16" r="7" fill="#1F2A44" />
          @for (st of stars; track $index) {
            <circle [attr.cx]="st[0]" [attr.cy]="st[1]" r="0.9" fill="#F3E9C6" />
          }
          <rect y="78" width="160" height="18" fill="#2B3550" />
        }
        @case ('room') {
          <rect width="160" height="96" fill="#E9D8BE" />
          <rect y="70" width="160" height="26" fill="#B98A5E" />
          <rect y="70" width="160" height="3" fill="#A07650" />
          <rect
            x="18"
            y="16"
            width="30"
            height="34"
            fill="#F6EAD2"
            stroke="#C9A97F"
            stroke-width="2"
          />
          <path d="M33 16 V50 M18 33 H48" stroke="#C9A97F" stroke-width="1.5" />
        }
        @case ('beach') {
          <rect width="160" height="96" fill="#BFE0E8" />
          <circle cx="126" cy="22" r="10" fill="#F6C85F" />
          <rect y="48" width="160" height="22" fill="#3C8FB0" />
          <path
            d="M0 52 Q20 48 40 52 T80 52 T120 52 T160 52"
            stroke="#9FD0E0"
            stroke-width="2"
            fill="none"
          />
          <path d="M0 70 Q40 62 80 68 T160 64 V96 H0Z" fill="#EBD3A0" />
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
        @case ('meet') {
          @for (b of skyline; track $index) {
            <rect
              [attr.x]="b[0]"
              [attr.y]="b[1]"
              [attr.width]="b[2]"
              [attr.height]="78 - b[1]"
              fill="#151D33"
            />
          }
          @for (w of windows; track $index) {
            <rect [attr.x]="w[0]" [attr.y]="w[1]" width="3" height="4" fill="#F2C76B" />
          }
          <path d="M0 40 Q40 52 80 42 T160 40" stroke="#5B6789" stroke-width="0.8" fill="none" />
          @for (l of bulbs; track $index) {
            <circle [attr.cx]="l[0]" [attr.cy]="l[1]" r="2" [attr.fill]="l[2]" />
          }
          <circle cx="66" cy="62" r="5" fill="#E2B48C" />
          <path d="M60 78 V70 Q66 64 72 70 V78Z" fill="#C8553D" />
          <circle cx="94" cy="62" r="5" fill="#C99470" />
          <path d="M88 78 V70 Q94 64 100 70 V78Z" fill="#3D6E8C" />
          <path d="M80 54 c-2 -3 -6 -1 -4 2 l4 4 l4 -4 c2 -3 -2 -5 -4 -2z" fill="#E86A6A" />
        }
        @case ('ask_out') {
          <rect x="44" y="54" width="72" height="5" rx="2" fill="#6B3E2A" />
          <path d="M62 59 V78 M98 59 V78" stroke="#6B3E2A" stroke-width="3" />
          <path
            d="M60 44 h12 v8 a6 6 0 0 1 -12 0z M88 44 h12 v8 a6 6 0 0 1 -12 0z"
            fill="#FAF6EA"
            stroke="#B98A5E"
            stroke-width="1"
          />
          <path
            d="M64 40 q2 -4 0 -7 M92 40 q2 -4 0 -7"
            stroke="#B9A88F"
            stroke-width="1.2"
            fill="none"
          />
          <path
            d="M80 30 c-2.5 -3.5 -7.5 -1 -5 2.5 l5 5 l5 -5 c2.5 -3.5 -2.5 -6 -5 -2.5z"
            fill="#E86A6A"
          />
        }
        @case ('dinner') {
          <rect x="34" y="54" width="92" height="6" rx="2" fill="#FAF6EA" />
          <path d="M34 60 h92 l-6 18 h-80z" fill="#C8553D" />
          <rect x="76" y="38" width="8" height="16" rx="1" fill="#F6EAD2" />
          <path d="M80 30 q4 4 0 8 q-4 -4 0 -8z" fill="#F6B23D" />
          <circle cx="56" cy="52" r="6" fill="#FAF6EA" stroke="#D9C9AE" stroke-width="1" />
          <circle cx="104" cy="52" r="6" fill="#FAF6EA" stroke="#D9C9AE" stroke-width="1" />
          <path
            d="M66 40 v10 M64 40 h4 l-1 6 h-2z M94 40 v10 M92 40 h4 l-1 6 h-2z"
            stroke="#8C3B2E"
            stroke-width="1.2"
            fill="#8C3B2E"
          />
        }
        @case ('gift') {
          <rect x="56" y="44" width="48" height="32" fill="#3D6E8C" />
          <rect x="52" y="36" width="56" height="10" fill="#2F5A74" />
          <rect x="76" y="36" width="8" height="40" fill="#F2C76B" />
          <path d="M80 36 C70 22 58 28 66 36Z M80 36 C90 22 102 28 94 36Z" fill="#F2C76B" />
        }
        @case ('holiday') {
          <path d="M46 70 L52 34" stroke="#8C6A4A" stroke-width="2.5" />
          <path d="M28 40 Q50 18 74 32Z" fill="#E8564A" />
          <path d="M40 36 Q50 22 58 34" stroke="#F6EAD2" stroke-width="3" fill="none" />
          <rect x="70" y="66" width="34" height="6" rx="2" fill="#F2C76B" />
          <rect x="108" y="66" width="30" height="6" rx="2" fill="#5BB6D6" />
          <path d="M12 20 q4 -3 8 0 q4 -3 8 0" stroke="#4A6A7A" stroke-width="1.2" fill="none" />
        }
        @case ('propose') {
          <path d="M54 70 h52 v-14 q-26 -10 -52 0z" fill="#8E1F3A" />
          <path d="M54 56 q26 -24 52 0" fill="#A3284A" />
          <rect x="54" y="68" width="52" height="8" fill="#6E1830" />
          <circle cx="80" cy="54" r="8" fill="none" stroke="#E9C46A" stroke-width="3" />
          <path d="M80 42 l4 4 l-4 4 l-4 -4z" fill="#DDEFF6" />
          @for (sp of sparkles; track $index) {
            <path [attr.d]="sparkle(sp[0], sp[1])" fill="#F3E9C6" />
          }
        }
        @case ('wedding') {
          <path d="M44 78 V44 Q80 8 116 44 V78" fill="none" stroke="#FAF6EA" stroke-width="6" />
          @for (f of flowers; track $index) {
            <circle [attr.cx]="f[0]" [attr.cy]="f[1]" r="3.2" [attr.fill]="f[2]" />
          }
          <circle cx="74" cy="56" r="7" fill="none" stroke="#E9C46A" stroke-width="2.5" />
          <circle cx="86" cy="56" r="7" fill="none" stroke="#E9C46A" stroke-width="2.5" />
        }
        @case ('child') {
          <path d="M50 52 h52 a26 26 0 0 1 -52 0z" fill="#9CC7D6" />
          <path d="M50 52 a26 26 0 0 1 26 -26 v26z" fill="#7FB0C4" />
          <circle cx="60" cy="80" r="5" fill="#2B2F36" />
          <circle cx="94" cy="80" r="5" fill="#2B2F36" />
          <path d="M102 52 l12 -12" stroke="#2B2F36" stroke-width="2.5" stroke-linecap="round" />
          <path
            d="M120 24 c-2.5 -3.5 -7.5 -1 -5 2.5 l5 5 l5 -5 c2.5 -3.5 -2.5 -6 -5 -2.5z"
            fill="#E86A6A"
          />
        }
        @case ('kids_time') {
          <path
            d="M30 78 L40 30 L50 78 M110 78 L120 30 L130 78 M38 32 H122"
            stroke="#C8553D"
            stroke-width="3"
            fill="none"
          />
          <path d="M70 32 V58 M90 32 V58" stroke="#6B6B6B" stroke-width="1.2" />
          <rect x="66" y="58" width="28" height="4" rx="1" fill="#6B3E2A" />
          <circle cx="80" cy="50" r="5" fill="#E2B48C" />
          <path d="M74 58 Q80 52 86 58" fill="#F2C76B" />
          <path d="M140 20 q-6 0 -6 7 q0 6 6 8 q6 -2 6 -8 q0 -7 -6 -7z" fill="#E8564A" />
          <path d="M140 35 q-2 10 2 22" stroke="#6B6B6B" stroke-width="0.8" fill="none" />
        }
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
    /* Cornice pixel a gradini con ombra corta, come i riquadri piccoli dello strato pixel. */
    :host {
      display: block;
      overflow: hidden;
      box-shadow:
        0 calc(-1 * var(--o-px)) 0 0 var(--o-border-strong),
        0 var(--o-px) 0 0 var(--o-border-strong),
        calc(-1 * var(--o-px)) 0 0 0 var(--o-border-strong),
        var(--o-px) 0 0 0 var(--o-border-strong),
        calc(2 * var(--o-px)) calc(2 * var(--o-px)) 0 0 var(--o-px-shadow);
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

  protected readonly stars: readonly (readonly [number, number])[] = [
    [12, 10],
    [30, 22],
    [48, 8],
    [70, 16],
    [92, 6],
    [108, 24],
    [150, 34],
    [20, 34],
  ];
  protected readonly skyline: readonly (readonly [number, number, number])[] = [
    [0, 46, 22],
    [24, 34, 18],
    [44, 52, 16],
    [108, 40, 20],
    [130, 30, 14],
    [146, 48, 14],
  ];
  protected readonly windows: readonly (readonly [number, number])[] = [
    [6, 52],
    [14, 60],
    [28, 40],
    [34, 52],
    [48, 58],
    [114, 46],
    [120, 58],
    [134, 36],
    [150, 54],
  ];
  protected readonly bulbs: readonly (readonly [number, number, string])[] = [
    [14, 44, '#F2C76B'],
    [34, 48, '#E8564A'],
    [54, 49, '#7FC8A9'],
    [74, 45, '#F2C76B'],
    [96, 43, '#E8564A'],
    [118, 42, '#7FC8A9'],
    [140, 40, '#F2C76B'],
  ];
  protected readonly sparkles: readonly (readonly [number, number])[] = [
    [60, 28],
    [100, 30],
    [112, 46],
    [46, 44],
  ];
  protected readonly flowers: readonly (readonly [number, number, string])[] = [
    [46, 46, '#E86A6A'],
    [52, 34, '#F6EAD2'],
    [62, 24, '#E86A6A'],
    [74, 18, '#F2C76B'],
    [86, 18, '#E86A6A'],
    [98, 24, '#F6EAD2'],
    [108, 34, '#E86A6A'],
    [114, 46, '#F2C76B'],
  ];

  /** Stellina a quattro punte centrata in alto su (x, y). */
  protected sparkle(x: number, y: number): string {
    return `M${x} ${y} l1.5 3 l3 1.5 l-3 1.5 l-1.5 3 l-1.5 -3 l-3 -1.5 l3 -1.5z`;
  }

  protected scene(): 'sea' | 'road' | 'pitch' | 'land' | 'night' | 'room' | 'beach' {
    const id = this.id();
    if (id === 'meet' || id === 'propose') return 'night';
    if (id === 'ask_out' || id === 'dinner' || id === 'gift' || id === 'child') return 'room';
    if (id === 'holiday') return 'beach';
    if (id === 'motoscafo' || id === 'yacht') return 'sea';
    if (id === 'utilitaria' || id === 'sportiva') return 'road';
    if (id === 'scuola_calcio') return 'pitch';
    return 'land';
  }
}
