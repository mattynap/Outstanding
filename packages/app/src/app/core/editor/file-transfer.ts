import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Consegna un file di testo al giocatore. Sul telefono lo scrive nella cache dell'app e apre il
 * menu di condivisione (salva su file, invia…); nel browser lo scarica.
 */
export async function deliverTextFile(
  fileName: string,
  text: string,
  title: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      data: text,
    });
    await Share.share({ title, files: [uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Si libera l'indirizzo dopo che il browser ha avviato lo scaricamento.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
