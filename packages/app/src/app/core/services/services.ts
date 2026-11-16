/**
 * Servizi esterni (statistiche d'uso, pubblicità a premio, acquisti in-app) dietro interfacce,
 * con implementazioni finte per lo sviluppo. L'integrazione con SDK reali si fa solo su richiesta,
 * sostituendo `ConsoleSink`, `FakeRewardedAds` e `FakeStore` senza toccare il resto dell'app.
 * Classi senza Angular, testabili con Vitest.
 *
 * Vincoli (CLAUDE.md): nessun pay to win, nessun azzardo, gioco offline. Gli acquisti non danno
 * vantaggi in carriera; le statistiche partono solo con il consenso del giocatore.
 */

/** Archivio chiave-valore minimo (Capacitor Preferences nell'app, memoria nei test). */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// --- Statistiche d'uso ---------------------------------------------------------------------

/** Eventi anonimi: niente nomi, niente testi scritti dal giocatore. */
export type AnalyticsEvent =
  | { name: 'career_start'; role: string; startLevel: number; difficulty: string }
  | { name: 'season_end'; season: number; level: number | null; promoted: boolean }
  | { name: 'retire'; age: number; seasons: number; tier: string }
  | { name: 'purchase'; productId: string };

/** Destinazione degli eventi (un SDK di analytics, in futuro). */
export interface AnalyticsSink {
  send(event: AnalyticsEvent): void;
}

/** Implementazione finta: scrive gli eventi nella console di sviluppo. */
export class ConsoleSink implements AnalyticsSink {
  send(event: AnalyticsEvent): void {
    console.debug('[analytics]', event);
  }
}

const CONSENT_KEY = 'outstanding.analyticsConsent';

/** Statistiche d'uso con consenso esplicito: senza "sì" non parte nessun evento. */
export class Analytics {
  private consent = false;

  constructor(
    private readonly sink: AnalyticsSink,
    private readonly kv: KeyValue,
  ) {}

  get hasConsent(): boolean {
    return this.consent;
  }

  async load(): Promise<void> {
    this.consent = (await this.kv.get(CONSENT_KEY)) === 'yes';
  }

  async setConsent(value: boolean): Promise<void> {
    this.consent = value;
    await this.kv.set(CONSENT_KEY, value ? 'yes' : 'no');
  }

  track(event: AnalyticsEvent): void {
    if (this.consent) this.sink.send(event);
  }
}

// --- Pubblicità a premio -------------------------------------------------------------------

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

/**
 * Video a premio guardati volontariamente. Decisione dell'utente (2026-11-16): per ora nessun premio
 * nel gioco, solo l'interfaccia; il "placement" dirà in futuro a cosa serve il video.
 */
export interface RewardedAds {
  isAvailable(placement: string): Promise<boolean>;
  show(placement: string): Promise<AdResult>;
}

/** Implementazione finta: nessuna pubblicità finché non c'è un premio deciso. */
export class FakeRewardedAds implements RewardedAds {
  constructor(private readonly enabled = false) {}

  async isAvailable(): Promise<boolean> {
    return this.enabled;
  }

  async show(): Promise<AdResult> {
    return this.enabled ? 'rewarded' : 'unavailable';
  }
}

// --- Acquisti in-app -----------------------------------------------------------------------

/** Diritto sbloccato da un acquisto. `full`: versione completa, senza pubblicità. */
export type Entitlement = 'full';

export interface ProductDef {
  id: string;
  /** Acquisto una tantum (non consumabile): si può ripristinare su un altro dispositivo. */
  kind: 'nonConsumable';
  entitlement: Entitlement;
}

/** Catalogo dei prodotti. Solo versione completa: nessun acquisto che dia vantaggi in carriera. */
export const PRODUCTS: readonly ProductDef[] = [
  { id: 'full_version', kind: 'nonConsumable', entitlement: 'full' },
];

export interface StoreProduct {
  id: string;
  /** Prezzo già formattato dallo store nella valuta del giocatore. */
  price: string;
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

/** Negozio della piattaforma (Google Play / App Store, in futuro). */
export interface Store {
  products(): Promise<StoreProduct[]>;
  buy(productId: string): Promise<PurchaseResult>;
  /** Id dei prodotti già acquistati con l'account del giocatore. */
  restore(): Promise<string[]>;
}

const FAKE_OWNED_KEY = 'outstanding.fakeStore.owned';

/** Negozio finto: nessun pagamento, l'acquisto riesce subito e resta sul dispositivo. */
export class FakeStore implements Store {
  constructor(private readonly kv: KeyValue) {}

  async products(): Promise<StoreProduct[]> {
    return PRODUCTS.map((p) => ({ id: p.id, price: '—' }));
  }

  async buy(productId: string): Promise<PurchaseResult> {
    if (!PRODUCTS.some((p) => p.id === productId)) return 'failed';
    const owned = new Set(await this.restore());
    owned.add(productId);
    await this.kv.set(FAKE_OWNED_KEY, JSON.stringify([...owned]));
    return 'purchased';
  }

  async restore(): Promise<string[]> {
    const raw = await this.kv.get(FAKE_OWNED_KEY);
    try {
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}

/** Diritti del giocatore, ricavati dai prodotti posseduti. */
export class Purchases {
  private owned = new Set<string>();

  constructor(
    private readonly store: Store,
    private readonly analytics?: Analytics,
  ) {}

  async load(): Promise<void> {
    this.owned = new Set(await this.store.restore());
  }

  has(entitlement: Entitlement): boolean {
    return PRODUCTS.some((p) => p.entitlement === entitlement && this.owned.has(p.id));
  }

  products(): Promise<StoreProduct[]> {
    return this.store.products();
  }

  async buy(productId: string): Promise<PurchaseResult> {
    const result = await this.store.buy(productId);
    if (result === 'purchased') {
      this.owned.add(productId);
      this.analytics?.track({ name: 'purchase', productId });
    }
    return result;
  }

  /** Ripristina gli acquisti (cambio di telefono, reinstallazione). */
  async restore(): Promise<number> {
    await this.load();
    return this.owned.size;
  }
}
