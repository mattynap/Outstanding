import {
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
  type ApplicationConfig,
} from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { RouteReuseStrategy } from '@angular/router';
import { routes } from './app.routes';
import { GameService } from './core/game.service';
import { SettingsService } from './core/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Prima di mostrare qualsiasi schermata: tema e salvataggio automatico.
    provideAppInitializer(() => {
      // inject() va chiamato subito, prima di qualsiasi await.
      const settings = inject(SettingsService);
      const game = inject(GameService);
      return settings.load().then(() => game.init());
    }),
  ],
};
