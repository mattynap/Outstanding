/**
 * Criteri 1–3 e 5 della settimana leggibile (spec §5.10): gioca `contextual`, la prudente e i piani
 * fissi (ogni carico con nessuna vita e con ogni azione) con gli stessi semi e stampa le 5 righe.
 *   pnpm sim:criteria [--careers 200] [--seed 42] [--workers N] [--out sim-output]
 * Il criterio 4 non gira qui: sono i test mirati ("criterio 4" in simulator.test.ts).
 * Costo: (2 + 15) corse da `--careers` carriere ciascuna.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { defaultContext } from '@outstanding/engine';
import { aggregate, criteria, FIXED_PLAN_GRID, type RunAggregate } from './criteria';
import { careerSeeds, simulate } from './simulate';
import { parsePlan } from './strategies';

const { values } = parseArgs({
  options: {
    careers: { type: 'string', default: '200' },
    seed: { type: 'string', default: '42' },
    workers: { type: 'string', default: String(Math.max(1, availableParallelism() - 1)) },
    out: { type: 'string', default: 'sim-output' },
  },
});
const careers = Number(values.careers);
const seed = Number(values.seed);
const workers = Math.max(1, Math.min(Number(values.workers), careers));
if (!Number.isInteger(careers) || careers < 1 || !Number.isInteger(seed) || seed < 0) {
  console.error('--careers deve essere un intero >= 1 e --seed un intero >= 0');
  process.exit(1);
}

const seeds = careerSeeds(seed, careers);
const run = async (label: string, strategy: 'contextual' | 'cautious', plan?: string) => {
  const start = performance.now();
  const results = await simulate(seeds, strategy, workers, undefined, undefined, {
    ...(plan ? { plan: parsePlan(plan) } : {}),
  });
  console.error(`${label}: ${((performance.now() - start) / 1000).toFixed(0)} s`);
  return aggregate(results);
};

const contextual = await run('contextual', 'contextual');
const cautious = await run('cautious', 'cautious');
const fixed: Record<string, RunAggregate> = {};
for (const plan of FIXED_PLAN_GRID) fixed[plan] = await run(plan, 'contextual', plan);

const rows = criteria({ contextual, cautious, fixed }, defaultContext.config.simulator);
mkdirSync(values.out, { recursive: true });
const file = join(values.out, `criteria-${seed}-${careers}.json`);
writeFileSync(
  file,
  JSON.stringify({ seed, careers, contextual, cautious, fixed, rows }, null, 2) + '\n',
);
console.log(`Criteri · seme ${seed} · ${careers} carriere`);
for (const r of rows) console.log(`${r.id}  ${r.pass ? 'OK ' : 'NO '} ${r.detail}`);
console.log(`\nDettaglio: ${file}`);
