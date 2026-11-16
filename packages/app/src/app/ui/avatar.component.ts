import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { defaultContent } from '@outstanding/content';
import type { Appearance, Kit } from '@outstanding/engine';
import { avatarShapes, VIEW_H, VIEW_W } from './avatar-art';

/**
 * Avatar "figurina": mezzo busto vettoriale con corporatura, viso, capelli, accessori, tatuaggi e
 * maglia del club. Con `age` capelli e barba ingrigiscono (se il giocatore lo ha scelto).
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="(size() * viewH) / viewW"
      [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH"
      role="img"
      [attr.aria-label]="label()"
    >
      <defs>
        <clipPath [attr.id]="clipId">
          <rect [attr.width]="viewW" [attr.height]="viewH" rx="16" />
        </clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        @for (s of shapes(); track $index) {
          @switch (s.t) {
            @case ('path') {
              <path
                [attr.d]="s.d"
                [attr.fill]="s.fill ?? 'none'"
                [attr.stroke]="s.stroke ?? null"
                [attr.stroke-width]="s.sw ?? null"
                [attr.opacity]="s.op ?? null"
                [attr.stroke-dasharray]="s.dash ?? null"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            }
            @case ('circle') {
              <circle
                [attr.cx]="s.cx"
                [attr.cy]="s.cy"
                [attr.r]="s.r"
                [attr.fill]="s.fill ?? 'none'"
                [attr.stroke]="s.stroke ?? null"
                [attr.stroke-width]="s.sw ?? null"
              />
            }
            @case ('ellipse') {
              <ellipse
                [attr.cx]="s.cx"
                [attr.cy]="s.cy"
                [attr.rx]="s.rx"
                [attr.ry]="s.ry"
                [attr.fill]="s.fill"
                [attr.opacity]="s.op ?? null"
              />
            }
            @case ('rect') {
              <rect
                [attr.x]="s.x"
                [attr.y]="s.y"
                [attr.width]="s.w"
                [attr.height]="s.h"
                [attr.rx]="s.rx ?? null"
                [attr.fill]="s.fill"
                [attr.opacity]="s.op ?? null"
              />
            }
            @case ('text') {
              <text
                [attr.x]="s.x"
                [attr.y]="s.y"
                [attr.transform]="'rotate(' + s.rot + ' ' + s.x + ' ' + s.y + ')'"
                [attr.font-size]="s.size"
                [style.font-family]="s.font"
                font-weight="700"
                [attr.letter-spacing]="s.ls ?? null"
                [attr.fill]="s.fill"
                [attr.opacity]="s.op ?? null"
              >
                {{ s.text }}
              </text>
            }
          }
        }
      </g>
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
  /** Larghezza in pixel (l'altezza segue le proporzioni della figurina). */
  readonly size = input(112);
  readonly label = input('');
  /** Età del giocatore, per l'invecchiamento visibile; senza età l'avatar resta giovane. */
  readonly age = input<number | null>(null);

  protected readonly viewW = VIEW_W;
  protected readonly viewH = VIEW_H;
  protected readonly clipId = `avatar-clip-${nextId++}`;
  protected readonly shapes = computed(() =>
    avatarShapes(this.appearance(), defaultContent.avatar, this.kit(), this.age()),
  );
}

let nextId = 0;
