/**
 * CLI del simulatore di carriere:
 *   pnpm sim --careers 1000 --strategy cautious --seed 42 [--difficulty normal] [--workers 8] [--out sim-output]
 *     [--isolate] [--quality 0..1]
 * `--strategy all` esegue tutte le strategie. `--isolate`: tutte usano le scelte fuori campo della
 * prudente e cambiano solo i momenti chiave. `--quality`: qualità del gesto (0..1) per ogni momento.
 * Scrive un riepilogo JSON e stampa una tabella.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { defaultContext, DIFFICULTIES, type Difficulty } from '@outstanding/engine';
import { formatTable, summarize } from './metrics';
import { careerSeeds, simulate } from './simulate';
import { STRATEGIES, type StrategyId } from './strategies';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const next = args[i + 1];
  // parseArgs interpreta un valore negativo separato come un'altra opzione.
  if (args[i] === '--quality' && next?.startsWith('-') && !next.startsWith('--')) {
    args.splice(i, 2, `--quality=${next}`);
  }
}

const { values } = parseArgs({
  args,
  options: {
    careers: { type: 'string', default: '100' },
    strategy: { type: 'string', default: 'cautious' },
    seed: { type: 'string', default: '42' },
    difficulty: { type: 'string', default: defaultContext.config.difficulty.default },
    workers: { type: 'string', default: String(Math.max(1, availableParallelism() - 1)) },
    out: { type: 'string', default: 'sim-output' },
    isolate: { type: 'boolean', default: false },
    quality: { type: 'string' },
    details: { type: 'boolean', default: false },
  },
});

function int(name: string, raw: string, min: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    console.error(`--${name} deve essere un intero >= ${min} (ricevuto "${raw}")`);
    process.exit(1);
  }
  return n;
}

const quality = values.quality === undefined ? undefined : Number(values.quality);
if (
  quality !== undefined &&
  (values.quality?.trim() === '' || !Number.isFinite(quality) || quality < 0 || quality > 1)
) {
  console.error('--quality deve essere un numero tra 0 e 1');
  process.exit(1);
}

const careers = int('careers', values.careers, 1);
const seed = int('seed', values.seed, 0);
const workers = Math.min(int('workers', values.workers, 1), careers);
const strategies: StrategyId[] =
  values.strategy === 'all' ? [...STRATEGIES] : [values.strategy as StrategyId];
if (!strategies.every((s) => STRATEGIES.includes(s))) {
  console.error(`--strategy deve essere uno tra: ${STRATEGIES.join(', ')}, all`);
  process.exit(1);
}

const difficulty = values.difficulty as Difficulty;
if (!DIFFICULTIES.includes(difficulty)) {
  console.error(`--difficulty deve essere uno tra: ${DIFFICULTIES.join(', ')}`);
  process.exit(1);
}

mkdirSync(values.out, { recursive: true });
for (const strategy of strategies) {
  const start = performance.now();
  const step = Math.max(1, Math.floor(careers / 20));
  // Avanzamento solo in un terminale interattivo, per non sporcare i log.
  const tty = process.stderr.isTTY;
  const results = await simulate(
    careerSeeds(seed, careers),
    strategy,
    workers,
    (done) => {
      if (tty && (done % step === 0 || done === careers)) {
        process.stderr.write(`\r${strategy}: ${done}/${careers}`);
      }
    },
    difficulty,
    { isolate: values.isolate, quality },
  );
  if (tty) process.stderr.write('\n');
  const summary = {
    ...summarize(results, strategy, seed, defaultContext),
    difficulty,
    ...(values.isolate ? { isolate: true } : {}),
    ...(quality !== undefined ? { quality } : {}),
  };
  const suffix = `${values.isolate ? '-isolate' : ''}${quality !== undefined ? `-q${quality}` : ''}`;
  const file = join(values.out, `sim-${strategy}-${difficulty}-${seed}-${careers}${suffix}.json`);
  writeFileSync(
    file,
    JSON.stringify(values.details ? { ...summary, results } : summary, null, 2) + '\n',
  );
  console.log(`Difficoltà: ${difficulty}`);
  console.log(formatTable(summary));
  console.log(`\nRiepilogo: ${file} (${((performance.now() - start) / 1000).toFixed(1)} s)\n`);
}
