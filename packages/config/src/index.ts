/** Parametri di bilanciamento (JSON validati con Zod). */
import calendarJson from '../data/calendar.json';
import careerJson from '../data/career.json';
import cupsJson from '../data/cups.json';
import difficultyJson from '../data/difficulty.json';
import editorJson from '../data/editor.json';
import lookJson from '../data/look.json';
import economyJson from '../data/economy.json';
import eventsJson from '../data/events.json';
import matchJson from '../data/match.json';
import playerJson from '../data/player.json';
import progressionJson from '../data/progression.json';
import ratingsJson from '../data/ratings.json';
import worldJson from '../data/world.json';
import {
  calendarSchema,
  careerSchema,
  cupsSchema,
  difficultySchema,
  economySchema,
  editorSchema,
  lookSchema,
  eventsConfigSchema,
  matchSchema,
  playerConfigSchema,
  progressionSchema,
  ratingsSchema,
  worldSchema,
  type CalendarConfig,
  type CareerConfig,
  type CupsConfig,
  type DifficultyConfig,
  type EconomyConfig,
  type EditorConfig,
  type LookConfig,
  type EventsConfig,
  type MatchConfig,
  type PlayerConfig,
  type ProgressionConfig,
  type RatingsConfig,
  type WorldConfig,
} from './schemas';

export * from './schemas';

export const configSchema = {
  ratings: ratingsSchema,
  player: playerConfigSchema,
  calendar: calendarSchema,
  world: worldSchema,
  economy: economySchema,
  match: matchSchema,
  events: eventsConfigSchema,
  progression: progressionSchema,
  cups: cupsSchema,
  career: careerSchema,
  editor: editorSchema,
  difficulty: difficultySchema,
  look: lookSchema,
} as const;

export interface GameConfig {
  ratings: RatingsConfig;
  player: PlayerConfig;
  calendar: CalendarConfig;
  world: WorldConfig;
  economy: EconomyConfig;
  match: MatchConfig;
  events: EventsConfig;
  progression: ProgressionConfig;
  cups: CupsConfig;
  career: CareerConfig;
  editor: EditorConfig;
  difficulty: DifficultyConfig;
  look: LookConfig;
}

/** Oggetti di configurazione grezzi (non validati), uno per file JSON. */
export type RawConfig = Record<keyof GameConfig, unknown>;

/** Converte gli oggetti JSON grezzi in configurazione validata; in caso di errore lancia un messaggio leggibile. */
export function parseConfig(raw: RawConfig): GameConfig {
  const out: Partial<GameConfig> = {};
  for (const key of Object.keys(configSchema) as (keyof GameConfig)[]) {
    const result = configSchema[key].safeParse(raw[key]);
    if (!result.success) {
      throw new Error(`Invalid config "${key}.json": ${result.error.message}`);
    }
    (out as Record<string, unknown>)[key] = result.data;
  }
  const config = out as GameConfig;
  const problems = crossCheck(config);
  if (problems.length > 0) throw new Error(`Invalid config: ${problems.join('; ')}`);
  return config;
}

/** Controlli che coinvolgono più file di configurazione. */
function crossCheck(c: GameConfig): string[] {
  const problems: string[] = [];
  const { nationalCup, continental, foreign } = c.cups;
  const lastWeek = c.calendar.weeksPerSeason - 1;
  const weeks = [
    ...nationalCup.rounds.map((r) => r.weekOfSeason),
    ...continental.groupWeeks,
    ...continental.knockout.flatMap((r) => r.weeks),
  ];
  if (weeks.some((w) => w > lastWeek)) problems.push('cups: a cup week is outside the season');

  const clubsAt = (level: number) => {
    const l = c.world.levels.find((x) => x.level === level);
    return l ? l.groups * l.clubsPerGroup : undefined;
  };
  let participants = 0;
  for (const level of nationalCup.levels) {
    const n = clubsAt(level);
    if (n === undefined) problems.push(`cups: unknown level ${level}`);
    else participants += n;
  }
  const extraClubs = clubsAt(nationalCup.extra.level);
  if (extraClubs === undefined || extraClubs < nationalCup.extra.count) {
    problems.push('cups: nationalCup.extra asks for more clubs than the level has');
  }
  participants += nationalCup.extra.count;
  const entrants = nationalCup.rounds.reduce((sum, r) => sum + r.entrants, 0);
  if (entrants !== participants) {
    problems.push(
      `cups: nationalCup rounds admit ${entrants} teams, participants are ${participants}`,
    );
  }

  const topClubs = clubsAt(1) ?? 0;
  const italian = continental.cups.map((cup) => cup.leaguePlaces.length);
  const places = continental.cups.flatMap((cup) => cup.leaguePlaces);
  if (new Set(places).size !== places.length || places.some((p) => p > topClubs - 1)) {
    problems.push('cups: continental league places must be distinct and inside the top league');
  }
  // La vincitrice della coppa nazionale prende un posto in più nella sua coppa europea.
  const foreignNeeded = italian.reduce((sum, n) => sum + continental.teams - n, 0);
  const foreignClubs = foreign.tiers.reduce((sum, t) => sum + t.count, 0);
  if (foreignClubs < foreignNeeded) {
    problems.push(`cups: ${foreignClubs} foreign clubs, at least ${foreignNeeded} needed`);
  }

  // Punteggio di carriera: un valore per livello e trofei che esistono davvero.
  if (c.career.score.perLevel.length !== c.world.levels.length) {
    problems.push('career: score.perLevel must have one entry per league level');
  }
  const trophyIds = new Set([
    ...c.world.levels.map((l) => `L${l.level}`),
    nationalCup.id,
    ...continental.cups.map((cup) => cup.id),
  ]);
  for (const id of trophyIds) {
    if (!(id in c.career.score.trophies))
      problems.push(`career: missing trophy points for "${id}"`);
  }
  for (const id of Object.keys(c.career.score.trophies)) {
    if (!trophyIds.has(id)) problems.push(`career: unknown trophy "${id}"`);
  }
  return problems;
}

/** I file JSON distribuiti con il gioco, prima della validazione. */
export const rawDefaultConfig: RawConfig = {
  ratings: ratingsJson,
  player: playerJson,
  calendar: calendarJson,
  world: worldJson,
  economy: economyJson,
  match: matchJson,
  events: eventsJson,
  progression: progressionJson,
  cups: cupsJson,
  career: careerJson,
  editor: editorJson,
  difficulty: difficultyJson,
  look: lookJson,
};

/** Configurazione predefinita distribuita con il gioco. */
export const defaultConfig: GameConfig = parseConfig(rawDefaultConfig);
