import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  Analytics,
  ConsoleSink,
  FakeRewardedAds,
  FakeStore,
  Purchases,
  type AnalyticsEvent,
  type KeyValue,
  type PurchaseResult,
  type RewardedAds,
  type StoreProduct,
} from './services';

const prefs: KeyValue = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: async (key, value) => {
    await Preferences.set({ key, value });
  },
};

/**
 * Servizi esterni per l'app. Oggi usa le implementazioni finte; per integrare SDK reali basta
 * cambiare le tre righe del costruttore.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly analytics = new Analytics(new ConsoleSink(), prefs);
  private readonly purchases = new Purchases(new FakeStore(prefs), this.analytics);
  readonly ads: RewardedAds = new FakeRewardedAds();

  /** Stato per l'interfaccia. */
  readonly consent = signal(false);
  readonly fullVersion = signal(false);
  /** Vero finché gli acquisti sono simulati (nessun pagamento reale). */
  readonly fakeStore = true;

  async init(): Promise<void> {
    await Promise.all([this.analytics.load(), this.purchases.load()]);
    this.consent.set(this.analytics.hasConsent);
    this.fullVersion.set(this.purchases.has('full'));
  }

  track(event: AnalyticsEvent): void {
    this.analytics.track(event);
  }

  async setConsent(value: boolean): Promise<void> {
    await this.analytics.setConsent(value);
    this.consent.set(value);
  }

  products(): Promise<StoreProduct[]> {
    return this.purchases.products();
  }

  async buy(productId: string): Promise<PurchaseResult> {
    const result = await this.purchases.buy(productId);
    this.fullVersion.set(this.purchases.has('full'));
    return result;
  }

  async restore(): Promise<void> {
    await this.purchases.restore();
    this.fullVersion.set(this.purchases.has('full'));
  }
}
