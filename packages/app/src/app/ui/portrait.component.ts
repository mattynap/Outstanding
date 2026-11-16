import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { defaultContext, type PartnerHair } from '@outstanding/engine';
import { mix } from './avatar-art';

/** Dati minimi per il ritratto: indici di carnagione e capelli, acconciatura. */
export interface PortraitPerson {
  firstName: string;
  skin: number;
  hairColor: number;
  hair: PartnerHair;
}

/** Colori delle magliette, scelti in modo stabile dal nome (niente estrazioni a caso). */
const TOPS = ['#C8553D', '#3D6E8C', '#6A8D4E', '#8E5A9B', '#D9A441', '#2F6F6A', '#B04A6A'];

/**
 * Ritratto piatto di una persona della vita privata (partner, persona appena conosciuta): testa e
 * spalle nello stile della figurina, su un tondo color carta. Disegnato dal codice.
 */
@Component({
  selector: 'app-portrait',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="label() || person().firstName">
      <circle cx="50" cy="50" r="50" fill="var(--o-portrait-bg, #E9DFC9)" />
      @if (c(); as k) {
        <!-- capelli dietro la testa -->
        @switch (person().hair) {
          @case ('long') {
            <path d="M27 44 Q26 22 50 20 Q74 22 73 44 L76 78 Q50 84 24 78Z" [attr.fill]="k.hair" />
          }
          @case ('bob') {
            <path d="M28 46 Q27 22 50 21 Q73 22 72 46 L73 62 Q50 68 27 62Z" [attr.fill]="k.hair" />
          }
          @case ('ponytail') {
            <path d="M70 34 Q86 40 82 64 Q80 74 74 78 Q78 62 70 50Z" [attr.fill]="k.hair" />
          }
          @case ('bun') {
            <circle cx="50" cy="17" r="9" [attr.fill]="k.hair" />
          }
          @case ('curly') {
            @for (b of curls; track $index) {
              <circle [attr.cx]="b[0]" [attr.cy]="b[1]" [attr.r]="b[2]" [attr.fill]="k.hair" />
            }
          }
        }
        <!-- spalle e maglietta -->
        <path d="M14 100 Q16 78 36 72 L64 72 Q84 78 86 100Z" [attr.fill]="k.top" />
        <path d="M40 72 Q50 82 60 72Z" [attr.fill]="k.skinShade" />
        <rect x="43" y="58" width="14" height="16" rx="5" [attr.fill]="k.skinShade" />
        <!-- testa -->
        <ellipse cx="50" cy="45" rx="19" ry="22" [attr.fill]="k.skin" />
        <ellipse cx="31.5" cy="47" rx="3" ry="4.5" [attr.fill]="k.skinShade" />
        <ellipse cx="68.5" cy="47" rx="3" ry="4.5" [attr.fill]="k.skinShade" />
        <!-- viso -->
        <path
          d="M39 40 Q43 38 46 40 M54 40 Q57 38 61 40"
          [attr.stroke]="k.brow"
          stroke-width="1.8"
          stroke-linecap="round"
          fill="none"
        />
        <circle cx="43" cy="46" r="1.9" fill="#22344A" />
        <circle cx="57" cy="46" r="1.9" fill="#22344A" />
        <path
          d="M50 48 Q48.5 53 50.5 54"
          stroke="rgba(60,25,10,0.28)"
          stroke-width="1.3"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M44 58 Q50 62.5 56 58"
          stroke="#8C3B2E"
          stroke-width="1.8"
          fill="none"
          stroke-linecap="round"
        />
        <circle cx="38" cy="54" r="3" fill="rgba(214,94,80,0.18)" />
        <circle cx="62" cy="54" r="3" fill="rgba(214,94,80,0.18)" />
        <!-- capelli davanti -->
        @switch (person().hair) {
          @case ('long') {
            <path
              d="M30 42 Q30 22 50 22 Q70 22 70 42 Q62 30 50 31 Q38 31 30 42Z"
              [attr.fill]="k.hair"
            />
          }
          @case ('bob') {
            <path
              d="M30 44 Q30 22 50 22 Q70 22 70 44 Q66 30 52 30 L46 36 Q40 30 30 44Z"
              [attr.fill]="k.hair"
            />
          }
          @case ('bun') {
            <path
              d="M31 40 Q32 23 50 23 Q68 23 69 40 Q60 30 50 30 Q40 30 31 40Z"
              [attr.fill]="k.hair"
            />
          }
          @case ('ponytail') {
            <path
              d="M31 41 Q31 22 50 22 Q69 22 69 41 Q62 29 50 29 Q38 29 31 41Z"
              [attr.fill]="k.hair"
            />
          }
          @case ('curly') {
            <path
              d="M32 38 Q34 26 50 26 Q66 26 68 38 Q58 32 50 33 Q42 32 32 38Z"
              [attr.fill]="k.hair"
            />
          }
          @case ('short') {
            <path
              d="M31 40 Q30 22 50 22 Q70 22 69 40 Q66 31 56 30 Q48 34 40 31 Q34 33 31 40Z"
              [attr.fill]="k.hair"
            />
          }
          @case ('buzz') {
            <path
              d="M31.5 40 Q31 24 50 24 Q69 24 68.5 40 Q60 30 50 30 Q40 30 31.5 40Z"
              [attr.fill]="k.hair"
              opacity="0.85"
            />
          }
          @case ('quiff') {
            <path
              d="M31 40 Q30 24 44 20 Q52 14 64 20 Q70 26 69 40 Q64 30 54 30 Q42 30 31 40Z"
              [attr.fill]="k.hair"
            />
          }
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: var(--size, 72px);
      height: var(--size, 72px);
      flex: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class PortraitComponent {
  readonly person = input.required<PortraitPerson>();
  readonly label = input('');

  protected readonly curls: readonly (readonly [number, number, number])[] = [
    [32, 36, 8],
    [38, 26, 9],
    [50, 21, 10],
    [62, 26, 9],
    [68, 36, 8],
    [29, 48, 6],
    [71, 48, 6],
  ];

  protected readonly c = computed(() => {
    const p = this.person();
    const av = defaultContext.content.avatar;
    const skin = av.skinTones[p.skin] ?? av.skinTones[0]!;
    const hair = av.hairColors[p.hairColor] ?? av.hairColors[0]!;
    let h = 0;
    for (const ch of p.firstName) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return {
      skin,
      skinShade: mix(skin, '#5A3420', 0.18),
      hair,
      brow: mix(hair, '#1A1A17', 0.3),
      top: TOPS[h % TOPS.length]!,
    };
  });
}
