/** Validatore dei contenuti: `pnpm content:check`. Gli errori di schema vengono lanciati al caricamento. */
import { checkContent, checkMomentKeys, defaultContent } from '../src/index';
// I tipi dei momenti stanno nella config; il pacchetto dei contenuti non dipende da essa, quindi
// lo script legge il file direttamente per controllare che ogni testo esista.
import moments from '../../config/data/moments.json';

const errors = [
  ...checkContent(defaultContent),
  ...checkMomentKeys(moments.types, defaultContent.i18n.it),
];
if (errors.length > 0) {
  console.error(`content:check — ${errors.length} problemi trovati:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('content:check — contenuti validi.');
