import { describe, expect, it } from 'vitest';
import {
  Analytics,
  FakeRewardedAds,
  FakeStore,
  PRODUCTS,
  Purchases,
  type AnalyticsEvent,
  type KeyValue,
} from '../src/app/core/services/services';

const memory = (): KeyValue => {
  const m = new Map<string, string>();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) };
};

const event: AnalyticsEvent = { name: 'career_start', role: 'ATT', startLevel: 6 };

describe('statistiche d’uso', () => {
  it('non inviano nulla senza consenso', async () => {
    const sent: AnalyticsEvent[] = [];
    const a = new Analytics({ send: (e) => sent.push(e) }, memory());
    await a.load();
    a.track(event);
    expect(sent).toEqual([]);
  });

  it('inviano dopo il consenso e lo ricordano', async () => {
    const kv = memory();
    const sent: AnalyticsEvent[] = [];
    const a = new Analytics({ send: (e) => sent.push(e) }, kv);
    await a.setConsent(true);
    a.track(event);
    expect(sent).toEqual([event]);
    const again = new Analytics({ send: () => {} }, kv);
    await again.load();
    expect(again.hasConsent).toBe(true);
    await a.setConsent(false);
    a.track(event);
    expect(sent).toHaveLength(1);
  });
});

describe('acquisti', () => {
  it('il catalogo contiene solo prodotti senza vantaggi in carriera', () => {
    expect(PRODUCTS.map((p) => p.entitlement)).toEqual(['full']);
    expect(PRODUCTS.every((p) => p.kind === 'nonConsumable')).toBe(true);
  });

  it('la versione completa si compra, resta e si ripristina', async () => {
    const kv = memory();
    const sent: AnalyticsEvent[] = [];
    const analytics = new Analytics({ send: (e) => sent.push(e) }, memory());
    await analytics.setConsent(true);
    const p = new Purchases(new FakeStore(kv), analytics);
    await p.load();
    expect(p.has('full')).toBe(false);
    expect(await p.buy('full_version')).toBe('purchased');
    expect(p.has('full')).toBe(true);
    expect(sent).toContainEqual({ name: 'purchase', productId: 'full_version' });
    const other = new Purchases(new FakeStore(kv));
    expect(await other.restore()).toBe(1);
    expect(other.has('full')).toBe(true);
  });

  it('un prodotto sconosciuto non si compra', async () => {
    const p = new Purchases(new FakeStore(memory()));
    expect(await p.buy('monete_infinite')).toBe('failed');
  });
});

describe('pubblicità a premio', () => {
  it('per ora non è disponibile', async () => {
    const ads = new FakeRewardedAds();
    expect(await ads.isAvailable('any')).toBe(false);
    expect(await ads.show('any')).toBe('unavailable');
  });
});
