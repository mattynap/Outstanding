import type { InterviewContext, Tone } from '@outstanding/config';
import type { FanContext } from '@outstanding/content';
import { defaultContext, type GameContext } from '../context';
import type { PrivateWeek } from '../private/private';
import { scaledCost } from '../private/private';
import { Rng } from '../rng';
import { computeStandings } from '../season/standings';
import { playerFixture } from '../season/week';
import type { FeedItem, Fixture, GameState, MatchMedia, MediaState, Player } from '../types';
import { clamp } from '../util';
import { getAnyClub, getClub, getGroup } from '../world/queries';

export type { FeedItem, InterviewContext, MatchMedia, MediaState, Tone };

const PRESS_MEMORY = 12;

export function createMedia(): MediaState {
  return { feed: [], postWeek: -1, pressDone: [] };
}

export function mediaOf(state: GameState): MediaState {
  return state.media ?? createMedia();
}

const withMedia = (state: GameState, media: MediaState, player: Player = state.player) => ({
  ...state,
  player,
  media,
});

function pushFeed(media: MediaState, items: FeedItem[], ctx: GameContext): MediaState {
  return { ...media, feed: [...items, ...media.feed].slice(0, ctx.config.media.feedSize) };
}

/** Generatore dei media: ricavato da seme, settimana e un sale, non tocca quello della carriera. */
function mediaRng(state: GameState, salt: number): Rng {
  return Rng.fromSeed((state.seed ^ Math.imul(state.week + 1, 0x85ebca6b) ^ salt) >>> 0);
}

/** Piccolo hash stabile di una stringa, per scegliere varianti senza estrazioni. */
function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

// --- Follower ---------------------------------------------------------------------------------

/** Follower "naturali" per la popolarità attuale. */
export function naturalFollowers(popularity: number, ctx: GameContext = defaultContext): number {
  const f = ctx.config.media.followers;
  return f.base * Math.pow(f.growthPerPopularity, popularity);
}

/**
 * Valore dei follower (0..max): un bonus per ogni decina di volte sopra il riferimento. Lo usano
 * sponsor (frequenza e compenso) e attività (clienti).
 */
export function followersBonus(followers: number, ctx: GameContext = defaultContext): number {
  const v = ctx.config.media.followers.value;
  return clamp(Math.log10(Math.max(1, followers) / v.reference) * v.perDecade, 0, v.max);
}

function addFollowers(p: Player, share: number): Player {
  return {
    ...p,
    image: { ...p.image, followers: Math.max(0, Math.round(p.image.followers * (1 + share))) },
  };
}

interface Delta {
  coach?: number;
  morale?: number;
  popularity?: number;
  reputation?: number;
  happiness?: number;
  discipline?: number;
  followers?: number;
}

function applyDelta(state: GameState, p: Player, d: Delta): Player {
  let out: Player = {
    ...p,
    condition: { ...p.condition, morale: clamp(p.condition.morale + (d.morale ?? 0), 0, 100) },
    persona: {
      ...p.persona,
      happiness: clamp(p.persona.happiness + (d.happiness ?? 0), 0, 100),
      discipline: clamp(p.persona.discipline + (d.discipline ?? 0), 0, 100),
    },
    image: {
      ...p.image,
      popularity: clamp(p.image.popularity + (d.popularity ?? 0), 0, 100),
      reputation: clamp(p.image.reputation + (d.reputation ?? 0), 0, 100),
    },
  };
  if (d.followers) out = addFollowers(out, d.followers);
  if (d.coach && out.clubId) {
    const coachId = getClub(state.world, out.clubId).coachId;
    const before = out.relationships[coachId] ?? 0;
    out = {
      ...out,
      relationships: { ...out.relationships, [coachId]: clamp(before + d.coach, -100, 100) },
    };
  }
  return out;
}

// --- Settimana --------------------------------------------------------------------------------

export interface MediaWeek {
  /** Variazione dei follower nella settimana. */
  followers: number;
  comments: number;
}

function fanParams(state: GameState, fixture: Fixture | undefined): Record<string, string> {
  const p = state.player;
  const params: Record<string, string> = { firstName: p.firstName, lastName: p.lastName };
  if (p.clubId) params['club'] = getClub(state.world, p.clubId).shortName;
  if (fixture && p.clubId) {
    const opp = fixture.homeId === p.clubId ? fixture.awayId : fixture.homeId;
    params['opponent'] = getAnyClub(state.world, opp).shortName;
  }
  return params;
}

/**
 * I media della settimana: i follower si avvicinano al valore naturale per la popolarità, gli
 * scandali ne fanno perdere, i tifosi commentano risultato e vita privata. Usa un generatore suo:
 * il resto della carriera non cambia.
 */
export function applyWeeklyMedia(
  state: GameState,
  privateWeek: PrivateWeek | null,
  ctx: GameContext = defaultContext,
): { state: GameState; week: MediaWeek } {
  const cfg = ctx.config.media;
  const media = mediaOf(state);
  let p = state.player;
  const before = p.image.followers;
  const target = naturalFollowers(p.image.popularity, ctx);
  p = {
    ...p,
    image: {
      ...p.image,
      followers: Math.max(0, Math.round(before + (target - before) * cfg.followers.driftPerWeek)),
    },
  };
  const scandal = Boolean(privateWeek?.affairDiscovered || privateWeek?.partnerLeft);
  if (scandal) p = addFollowers(p, -cfg.followers.scandalLoss);

  const rng = mediaRng(state, 0x51ed);
  const clubId = p.clubId;
  const fixture = clubId
    ? state.calendar.find(
        (f) => f.week === state.week && f.result && (f.homeId === clubId || f.awayId === clubId),
      )
    : undefined;
  const contexts: FanContext[] = [];
  if (fixture?.result && clubId) {
    const home = fixture.homeId === clubId;
    const mine = home ? fixture.result.home : fixture.result.away;
    const theirs = home ? fixture.result.away : fixture.result.home;
    contexts.push(mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw');
  } else contexts.push('quiet');
  if (scandal) contexts.push('gossip');
  if (privateWeek?.born) contexts.push('born');
  const [lo, hi] = cfg.fans.commentsPerWeek;
  const n = Math.max(contexts.length, rng.int(lo, hi));
  while (contexts.length < n) contexts.push(p.image.popularity >= 60 ? 'star' : contexts[0]!);

  const params = fanParams({ ...state, player: p }, fixture);
  const items: FeedItem[] = contexts.map((c) => ({
    week: state.week,
    kind: 'fan',
    author: rng.pick(ctx.content.media.handles),
    textKey: `media.fans.${c}.${rng.int(1, ctx.content.media.fanComments[c])}`,
    params,
    likes: Math.round(p.image.followers * cfg.fans.likesPerFollower * rng.float(0.2, 1.2)),
    tone: c === 'win' || c === 'born' || c === 'star' ? 'pos' : c === 'quiet' ? 'neutral' : 'neg',
  }));
  return {
    state: withMedia(state, pushFeed(media, items, ctx), p),
    week: { followers: p.image.followers - before, comments: items.length },
  };
}

/** Commento di benvenuto e conferenza di presentazione dopo un trasferimento. */
export function welcomeToClub(
  state: GameState,
  clubId: string,
  ctx: GameContext = defaultContext,
): GameState {
  const media = mediaOf(state);
  const rng = mediaRng(state, hash(clubId));
  const item: FeedItem = {
    week: state.week,
    kind: 'fan',
    author: rng.pick(ctx.content.media.handles),
    textKey: `media.fans.transfer.${rng.int(1, ctx.content.media.fanComments.transfer)}`,
    params: fanParams(state, undefined),
    likes: Math.round(state.player.image.followers * ctx.config.media.fans.likesPerFollower),
    tone: 'pos',
  };
  return withMedia(state, { ...pushFeed(media, [item], ctx), presentation: clubId });
}

// --- Post -------------------------------------------------------------------------------------

export interface PostOption {
  id: string;
  cost: number;
  available: boolean;
  reasonKey?: string;
}

/** I post possibili questa settimana (uno solo a settimana). */
export function getPostOptions(state: GameState, ctx: GameContext = defaultContext): PostOption[] {
  const done = mediaOf(state).postWeek === state.week;
  return ctx.config.media.posts.map((post) => {
    const cost = scaledCost(post.cost, state.player);
    const reasonKey = done
      ? 'media.blocked.done'
      : cost > Math.max(0, state.player.money.cash)
        ? 'media.blocked.money'
        : undefined;
    return { id: post.id, cost, available: !reasonKey, ...(reasonKey ? { reasonKey } : {}) };
  });
}

export interface PostReport {
  postId: string;
  followers: number;
  likes: number;
  backlash: boolean;
  cost: number;
}

/** Pubblica il post della settimana. */
export function publishPost(
  state: GameState,
  postId: string,
  ctx: GameContext = defaultContext,
): { state: GameState; report: PostReport } {
  if (state.retired) throw new Error('The career is over');
  const post = ctx.config.media.posts.find((x) => x.id === postId);
  if (!post) throw new Error(`Unknown post "${postId}"`);
  const option = getPostOptions(state, ctx).find((o) => o.id === postId)!;
  if (!option.available) throw new Error(`Post "${postId}" is not available: ${option.reasonKey}`);

  const rng = Rng.fromState(state.rngState);
  const before = state.player.image.followers;
  let p: Player = {
    ...state.player,
    money: { ...state.player.money, cash: state.player.money.cash - option.cost },
  };
  const backlash = Boolean(post.backlash && rng.chance(post.backlash.chance));
  if (backlash && post.backlash) {
    p = applyDelta(state, p, {
      followers: post.backlash.followers,
      reputation: post.backlash.reputation,
      coach: post.backlash.coach,
    });
  } else {
    p = applyDelta(state, p, { ...post.effects, followers: post.followers });
  }
  let life = state.privateLife;
  if (post.affinity && life?.partner) {
    life = {
      ...life,
      partner: { ...life.partner, affinity: clamp(life.partner.affinity + post.affinity, 0, 100) },
    };
  }
  const likeRate = backlash ? (post.backlash?.likeRate ?? 0) : post.likeRate;
  const likes = Math.round(
    p.image.followers * ctx.config.media.fans.likesPerFollower * likeRate * rng.float(0.7, 1.3),
  );
  const caption = rng.int(1, ctx.content.media.postCaptions);
  const media = mediaOf(state);
  const item: FeedItem = {
    week: state.week,
    kind: 'post',
    textKey: `media.posts.${post.id}.caption.${caption}`,
    params: {},
    likes,
    tone: backlash ? 'neg' : 'pos',
  };
  const items: FeedItem[] = backlash
    ? [
        {
          week: state.week,
          kind: 'press',
          textKey: 'media.posts.backlash',
          params: {},
          likes: 0,
          tone: 'neg',
        },
        item,
      ]
    : [item];
  const next: GameState = {
    ...withMedia(state, { ...pushFeed(media, items, ctx), postWeek: state.week }, p),
    ...(life ? { privateLife: life } : {}),
    rngState: rng.getState(),
  };
  return {
    state: next,
    report: { postId, followers: p.image.followers - before, likes, backlash, cost: option.cost },
  };
}

// --- Intervista dopo la partita ---------------------------------------------------------------

/** Contesto dell'intervista dal risultato e dal voto della partita appena giocata. */
export function interviewContext(
  result: 'win' | 'draw' | 'loss',
  minutesPlayed: number,
  rating: number | null,
  ctx: GameContext = defaultContext,
): InterviewContext {
  const cfg = ctx.config.media.interview;
  if (minutesPlayed === 0) return 'bench';
  if (result === 'win') return rating !== null && rating >= cfg.heroRating ? 'win_hero' : 'win';
  if (result === 'loss') return rating !== null && rating <= cfg.flopRating ? 'loss_flop' : 'loss';
  return 'draw';
}

/** Ricorda la partita appena finita per l'intervista (chiamata dalla partita). */
export function recordMatchForMedia(state: GameState, lastMatch: MatchMedia): GameState {
  return { ...state, media: { ...mediaOf(state), lastMatch } };
}

export interface InterviewView {
  fixtureId: string;
  context: InterviewContext;
  questionKey: string;
  answers: { tone: Tone; textKey: string }[];
  params: Record<string, string>;
}

const TONE_LIST: readonly Tone[] = ['humble', 'confident', 'polemic'];

/** L'intervista della partita appena giocata, se non è già stata fatta. */
export function getInterview(
  state: GameState,
  ctx: GameContext = defaultContext,
): InterviewView | null {
  const m = state.media?.lastMatch;
  if (!m || m.week !== state.week || state.media?.interviewed === m.fixtureId) return null;
  const variant = (hash(m.fixtureId) % ctx.content.media.interviewQuestions) + 1;
  return {
    fixtureId: m.fixtureId,
    context: m.context,
    questionKey: `media.interview.${m.context}.q.${variant}`,
    answers: TONE_LIST.map((tone) => ({ tone, textKey: `media.interview.${m.context}.${tone}` })),
    params: { firstName: state.player.firstName, opponent: m.opponent },
  };
}

/** Risponde all'intervista (o `null` per "nessun commento", senza effetti). */
export function answerInterview(
  state: GameState,
  tone: Tone | null,
  ctx: GameContext = defaultContext,
): GameState {
  const view = getInterview(state, ctx);
  if (!view) throw new Error('No interview pending');
  const p = tone
    ? applyDelta(state, state.player, ctx.config.media.interview.effects[view.context][tone])
    : state.player;
  const media = mediaOf(state);
  const headline: FeedItem = {
    week: state.week,
    kind: 'press',
    textKey: `media.headline.${tone ?? 'none'}`,
    params: { firstName: p.firstName, lastName: p.lastName },
    likes: 0,
    tone: tone === 'polemic' ? 'neg' : tone === null ? 'neutral' : 'pos',
  };
  return withMedia(state, { ...pushFeed(media, [headline], ctx), interviewed: view.fixtureId }, p);
}

// --- Conferenze stampa ------------------------------------------------------------------------

export type PressKind = 'cup' | 'derby' | 'top' | 'presentation';

export interface PressView {
  kind: PressKind;
  /** Chiave per ricordare che è già stata fatta. */
  key: string;
  fixtureId?: string;
  clubId: string;
  questions: { questionKey: string; answers: { tone: Tone; textKey: string }[] }[];
  params: Record<string, string>;
}

/** Se la partita della settimana è una partita da conferenza stampa, di che tipo. */
export function bigMatchKind(
  state: GameState,
  fixture: Fixture,
  ctx: GameContext = defaultContext,
): PressKind | null {
  const cfg = ctx.config.media.press;
  if (fixture.cup) return cfg.finalStages.includes(fixture.cup.stage) ? 'cup' : null;
  const clubId = state.player.clubId;
  if (!clubId) return null;
  const club = getClub(state.world, clubId);
  const oppId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
  const opp = state.world.clubs.find((c) => c.id === oppId);
  if (opp && opp.city === club.city) return 'derby';
  if (fixture.matchday >= cfg.topFromMatchday) {
    const { group } = getGroup(state.world, club.groupId);
    const table = computeStandings(
      state.calendar.filter((f) => f.groupId === group.id && f.season === state.season),
      group.clubIds,
      ctx.config.world.points,
    );
    const top = new Set(table.slice(0, cfg.topPlaces).map((r) => r.clubId));
    if (top.has(clubId) && top.has(oppId)) return 'top';
  }
  return null;
}

/** La conferenza stampa possibile adesso: presentazione nel nuovo club o vigilia di una grande partita. */
export function getPressConference(
  state: GameState,
  ctx: GameContext = defaultContext,
): PressView | null {
  if (state.retired || state.currentMatch) return null;
  const media = mediaOf(state);
  const p = state.player;
  let kind: PressKind | null;
  let key: string;
  let clubId: string;
  let fixtureId: string | undefined;
  if (media.presentation) {
    kind = 'presentation';
    clubId = media.presentation;
    key = `p:${clubId}:${state.season}`;
  } else {
    const fixture = playerFixture(state);
    if (!fixture || !p.clubId) return null;
    kind = bigMatchKind(state, fixture, ctx);
    clubId = p.clubId;
    fixtureId = fixture.id;
    key = `m:${fixture.id}`;
  }
  if (!kind || media.pressDone.includes(key)) return null;
  const total = ctx.content.media.pressQuestions;
  const asked = Math.min(ctx.config.media.press.questions, total);
  const start = hash(key) % total;
  const questions = Array.from({ length: asked }, (_, i) => {
    const q = ((start + i) % total) + 1;
    return {
      questionKey: `media.press.${kind}.q${q}`,
      answers: TONE_LIST.map((tone) => ({ tone, textKey: `media.press.${kind}.q${q}.${tone}` })),
    };
  });
  return {
    kind,
    key,
    clubId,
    ...(fixtureId ? { fixtureId } : {}),
    questions,
    params: {
      firstName: p.firstName,
      club: getAnyClub(state.world, clubId).shortName,
    },
  };
}

export interface PressReport {
  /** Effetto sui momenti chiave della partita (0 per le presentazioni). */
  chance: number;
}

/** Risponde alle domande della conferenza (una risposta per domanda). */
export function answerPress(
  state: GameState,
  tones: readonly Tone[],
  ctx: GameContext = defaultContext,
): { state: GameState; report: PressReport } {
  const view = getPressConference(state, ctx);
  if (!view) throw new Error('No press conference available');
  if (tones.length !== view.questions.length) throw new Error('One answer per question');
  const cfg = ctx.config.media.press;
  let p = state.player;
  let chance = 0;
  for (const tone of tones) {
    const e = cfg.effects[tone];
    if (!e) throw new Error(`Unknown tone "${tone}"`);
    p = applyDelta(state, p, e);
    chance += e.chance ?? 0;
  }
  chance = view.fixtureId ? clamp(chance, -cfg.maxBoost, cfg.maxBoost) : 0;
  // Il tono che prevale fa il titolo.
  const counts = TONE_LIST.map((t) => tones.filter((x) => x === t).length);
  const main = TONE_LIST[counts.indexOf(Math.max(...counts))]!;
  const media = mediaOf(state);
  const { presentation: _done, ...rest } = media;
  const next: MediaState = {
    ...pushFeed(
      view.kind === 'presentation' ? rest : media,
      [
        {
          week: state.week,
          kind: 'press',
          textKey: `media.press.headline.${main}`,
          params: { lastName: p.lastName },
          likes: 0,
          tone: main === 'polemic' ? 'neg' : 'pos',
        },
      ],
      ctx,
    ),
    pressDone: [view.key, ...media.pressDone].slice(0, PRESS_MEMORY),
    ...(view.fixtureId && chance !== 0 ? { boost: { fixtureId: view.fixtureId, chance } } : {}),
  };
  return { state: withMedia(state, next, p), report: { chance } };
}

/** Effetto della conferenza stampa sulle probabilità dei momenti chiave di una partita. */
export function pressBonus(state: GameState, fixtureId: string): number {
  const b = state.media?.boost;
  return b && b.fixtureId === fixtureId ? b.chance : 0;
}
