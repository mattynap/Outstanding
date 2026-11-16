import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import type { SaveBackend } from './slots';

/** Cartella dei salvataggi dentro la memoria privata dell'app (IndexedDB nel browser). */
const DIR = 'saves';

const missing = (err: unknown) => /not exist|does not exist|not found|ENOENT/i.test(String(err));

/** Archivio reale: file per le carriere, Preferences per l'indice degli slot. */
export class CapacitorSaveBackend implements SaveBackend {
  private ready: Promise<void> | null = null;

  private ensureDir(): Promise<void> {
    this.ready ??= Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true })
      .then(() => undefined)
      .catch(() => undefined); // esiste già
    return this.ready;
  }

  async readFile(path: string): Promise<string | null> {
    await this.ensureDir();
    try {
      const res = await Filesystem.readFile({
        path: `${DIR}/${path}`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return typeof res.data === 'string' ? res.data : await res.data.text();
    } catch (err) {
      if (missing(err)) return null;
      throw err;
    }
  }

  async writeFile(path: string, data: string): Promise<void> {
    await this.ensureDir();
    await Filesystem.writeFile({
      path: `${DIR}/${path}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data,
    });
  }

  async deleteFile(path: string): Promise<void> {
    await this.ensureDir();
    try {
      await Filesystem.deleteFile({ path: `${DIR}/${path}`, directory: Directory.Data });
    } catch (err) {
      if (!missing(err)) throw err;
    }
  }

  async moveFile(from: string, to: string): Promise<void> {
    // Non tutte le piattaforme sovrascrivono la destinazione: prima si cancella.
    await this.deleteFile(to);
    await Filesystem.rename({
      from: `${DIR}/${from}`,
      to: `${DIR}/${to}`,
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });
  }

  async getItem(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  }

  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
