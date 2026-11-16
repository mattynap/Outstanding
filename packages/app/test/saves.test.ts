import { describe, expect, it } from 'vitest';
import { defaultContext, newCareer, serialize, type GameState } from '@outstanding/engine';
import { decodeSave, encodeSave, SAVE_HEADER } from '../src/app/core/saves/codec';
import { LEGACY_KEY, SLOT_COUNT, SlotStore, type SaveBackend } from '../src/app/core/saves/slots';

/** Archivio in memoria per i test. */
class MemoryBackend implements SaveBackend {
  files = new Map<string, string>();
  items = new Map<string, string>();
  async readFile(path: string) {
    return this.files.get(path) ?? null;
  }
  async writeFile(path: string, data: string) {
    this.files.set(path, data);
  }
  async deleteFile(path: string) {
    this.files.delete(path);
  }
  async moveFile(from: string, to: string) {
    const data = this.files.get(from);
    if (data === undefined) throw new Error('missing');
    this.files.set(to, data);
    this.files.delete(from);
  }
  async getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  async removeItem(key: string) {
    this.items.delete(key);
  }
}

const options = {
  firstName: 'Tommaso',
  lastName: 'Ferraro',
  hometown: 'Bergamo',
  role: 'ATT' as const,
};
const state: GameState = newCareer(options, 7);
const store = (b = new MemoryBackend(), t = 1000) => ({
  b,
  s: new SlotStore(b, defaultContext, () => t),
});

describe('formato dei salvataggi', () => {
  it('comprime e rilegge la carriera identica', () => {
    const text = encodeSave(state);
    expect(text.startsWith(SAVE_HEADER)).toBe(true);
    expect(decodeSave(text)).toEqual(state);
    // Il JSON di partenza pesa oltre un megabyte: compresso deve stare sotto un quinto.
    expect(text.length).toBeLessThan(serialize(state).length / 5);
  });

  it('legge anche il JSON semplice dei salvataggi precedenti', () => {
    expect(decodeSave(serialize(state))).toEqual(state);
  });

  it('rifiuta file rovinati e versioni future', () => {
    expect(() => decodeSave('OSV1:non-base64!!')).toThrow();
    expect(() => decodeSave('{"saveVersion": 999}')).toThrow(/newer/);
  });
});

describe('slot', () => {
  it('salva, elenca e riapre le carriere', async () => {
    const { s } = store();
    expect((await s.list()).every((v) => v.summary === null)).toBe(true);
    expect(await s.list()).toHaveLength(SLOT_COUNT);
    const summary = await s.save(2, state);
    expect(summary).toMatchObject({
      slot: 2,
      playerName: 'Tommaso Ferraro',
      season: 1,
      savedAt: 1000,
    });
    expect((await s.list())[1]!.summary).toEqual(summary);
    expect(await s.load(2)).toEqual(state);
    expect(await s.lastSlot()).toBe(2);
    expect(await s.freeSlot()).toBe(1);
  });

  it('non lascia file temporanei e recupera un salvataggio interrotto', async () => {
    const { b, s } = store();
    await s.save(1, state);
    expect([...b.files.keys()]).toEqual(['slot-1.sav']);
    // Interruzione tra la cancellazione del vecchio file e lo spostamento del nuovo.
    b.files.set('slot-1.tmp', b.files.get('slot-1.sav')!);
    b.files.delete('slot-1.sav');
    expect(await s.load(1)).toEqual(state);
  });

  it('elimina uno slot con il suo riepilogo', async () => {
    const { b, s } = store();
    await s.save(1, state);
    await s.remove(1);
    expect(b.files.size).toBe(0);
    expect((await s.list())[0]!.summary).toBeNull();
    expect(await s.lastSlot()).toBeNull();
    expect(await s.load(1)).toBeNull();
  });

  it('sposta il vecchio salvataggio unico nel primo slot libero', async () => {
    const { b, s } = store();
    b.items.set(LEGACY_KEY, serialize(state));
    expect(await s.migrateLegacy()).toBe(true);
    expect(b.items.has(LEGACY_KEY)).toBe(false);
    expect(await s.load(1)).toEqual(state);
    expect(await s.migrateLegacy()).toBe(false);
  });

  it('lascia al suo posto un vecchio salvataggio illeggibile', async () => {
    const { b, s } = store();
    b.items.set(LEGACY_KEY, 'rovinato');
    expect(await s.migrateLegacy()).toBe(false);
    expect(b.items.get(LEGACY_KEY)).toBe('rovinato');
  });

  it('uno slot rovinato si segnala con un errore al caricamento', async () => {
    const { b, s } = store();
    await s.save(3, state);
    b.files.set('slot-3.sav', 'OSV1:AAAA');
    await expect(s.load(3)).rejects.toThrow();
  });
});
