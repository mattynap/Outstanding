import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { defaultContent } from '@outstanding/content';
import type { Appearance, Kit } from '@outstanding/engine';

/** Tracciati delle acconciature, per id (content/data/avatar.json). Testa centrata in 56,58. */
const HAIR: Readonly<Record<string, string>> = {
  corti: 'M33 54c0-18 10-27 23-27s24 8 23 26c-4-8-10-12-16-13-6 6-18 9-30 14z',
  rasati: 'M35 50c1-14 10-21 21-21s20 7 21 21c-6-6-13-8-21-8s-15 2-21 8z',
  ricci:
    'M32 56c-3-6-1-12 3-14-1-6 4-11 9-10 2-5 9-7 13-4 4-3 11-1 13 4 5-1 9 4 8 10 4 2 6 8 3 14-3-5-8-8-12-8-4 3-20 3-25 0-5 0-10 3-12 8z',
  lunghi:
    'M30 60c-2-22 9-33 26-33s28 11 26 33c-1 10 1 18 4 24-6-2-9-8-9-14V56c-6-5-14-7-21-7s-15 2-21 7v14c0 6-3 12-9 14 3-6 5-14 4-24z',
  cresta: 'M47 42c2-9 5-15 9-20 4 5 7 11 9 20-6-2-12-2-18 0z',
  codino:
    'M33 54c0-18 10-27 23-27s24 8 23 26c-4-8-10-12-16-13-6 6-18 9-30 14zM50 24a6 6 0 1 0 12 0 6 6 0 0 0-12 0z',
  calvo: '',
};

const BEARD: Readonly<Record<string, string>> = {
  nessuna: '',
  accenno: 'M36 66c2 12 10 19 20 19s18-7 20-19c-4 6-10 10-20 10s-16-4-20-10z',
  pizzetto: 'M50 76c2 5 10 5 12 0-1 6-3 9-6 9s-5-3-6-9z',
  barba: 'M34 60c0 16 9 27 22 27s22-11 22-27c-3 7-6 9-9 9-3-3-8-4-13-4s-10 1-13 4c-3 0-6-2-9-9z',
};

/** Avatar stilizzato e componibile: viso, carnagione, capelli, barba e maglia del club. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="(size() * 128) / 112"
      viewBox="0 0 112 128"
      role="img"
      [attr.aria-label]="label()"
    >
      <rect x="0" y="0" width="112" height="128" rx="14" fill="var(--o-surface)" />
      <path d="M14 128c2-24 18-34 42-34s40 10 42 34z" [attr.fill]="shirt().primary" />
      @if (shirt().pattern === 'vstripes') {
        <path d="M44 96v32M56 94v34M68 96v32" [attr.stroke]="shirt().secondary" stroke-width="5" />
      } @else if (shirt().pattern === 'hstripes') {
        <path d="M20 112h72M16 122h80" [attr.stroke]="shirt().secondary" stroke-width="5" />
      } @else if (shirt().pattern === 'sash') {
        <path d="M30 98l50 30" [attr.stroke]="shirt().secondary" stroke-width="7" />
      }
      <path d="M46 82h20v14c-6 4-14 4-20 0z" [attr.fill]="skin()" />
      <path d="M46 92c6 4 14 4 20 0" stroke="rgba(0,0,0,0.18)" stroke-width="3" fill="none" />
      @switch (face()) {
        @case ('squadrato') {
          <path
            d="M34 50c0-14 9-22 22-22s22 8 22 22v12c0 14-10 23-22 23S34 76 34 62z"
            [attr.fill]="skin()"
          />
        }
        @case ('tondo') {
          <ellipse cx="56" cy="58" rx="24" ry="25" [attr.fill]="skin()" />
        }
        @default {
          <ellipse cx="56" cy="58" rx="22" ry="27" [attr.fill]="skin()" />
        }
      }
      <ellipse cx="33" cy="60" rx="3" ry="5" [attr.fill]="skin()" />
      <ellipse cx="79" cy="60" rx="3" ry="5" [attr.fill]="skin()" />
      @if (beard()) {
        <path [attr.d]="beard()" [attr.fill]="hairColor()" [attr.opacity]="beardOpacity()" />
      }
      @if (hair()) {
        <path [attr.d]="hair()" [attr.fill]="hairColor()" [attr.opacity]="hairOpacity()" />
      }
      <circle cx="48" cy="61" r="2.4" fill="#1A1A17" />
      <circle cx="64" cy="61" r="2.4" fill="#1A1A17" />
      <path
        d="M45 54c2-1.5 4.5-1.5 6 0M61 54c1.5-1.5 4-1.5 6 0"
        [attr.stroke]="hairColor()"
        stroke-width="1.8"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M50 73c4 3 8 3 12 0"
        stroke="#8A4E33"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }
  `,
})
export class AvatarComponent {
  readonly appearance = input.required<Appearance>();
  /** Maglia del club; senza club una maglia neutra. */
  readonly kit = input<Kit | null>(null);
  readonly size = input(112);
  readonly label = input('');

  private readonly parts = defaultContent.avatar;
  protected readonly skin = computed(
    () => this.parts.skinTones[this.appearance().skin] ?? '#E2AE86',
  );
  protected readonly hairColor = computed(
    () => this.parts.hairColors[this.appearance().hairColor] ?? '#3B2A1E',
  );
  protected readonly hair = computed(
    () => HAIR[this.parts.hairStyles[this.appearance().hairStyle] ?? ''] ?? '',
  );
  protected readonly hairOpacity = computed(() =>
    this.parts.hairStyles[this.appearance().hairStyle] === 'rasati' ? 0.75 : 1,
  );
  protected readonly beard = computed(
    () => BEARD[this.parts.beards[this.appearance().beard] ?? ''] ?? '',
  );
  protected readonly beardOpacity = computed(() =>
    this.parts.beards[this.appearance().beard] === 'accenno' ? 0.35 : 1,
  );
  protected readonly face = computed(
    () => this.parts.faceShapes[this.appearance().face] ?? 'ovale',
  );
  protected readonly shirt = computed<Kit>(
    () => this.kit() ?? { primary: '#3A4A40', secondary: '#A9BBAE', pattern: 'solid' },
  );
}
