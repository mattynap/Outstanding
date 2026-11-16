/** Content validator: `pnpm content:check`. Schema errors throw while loading the content. */
import { checkContent, defaultContent } from '../src/index';

const errors = checkContent(defaultContent);
if (errors.length > 0) {
  console.error(`content:check — ${errors.length} problemi trovati:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('content:check — contenuti validi.');
