import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

/** Messaggi brevi in basso (esiti, errori). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  async show(message: string, tone: 'info' | 'error' = 'info'): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: tone === 'error' ? 3500 : 2200,
      position: 'bottom',
      cssClass: tone === 'error' ? 'o-toast o-toast--error' : 'o-toast',
    });
    await toast.present();
  }
}
