import { describe, expect, it } from 'vitest';
import {
  buildupLines,
  checkContent,
  checkHeadlineKeys,
  defaultContent,
  parseContent,
  rawDefaultContent,
  type GameEvent,
} from '../src/index';

describe('content', () => {
  it('default content passes all cross checks', () => {
    expect(checkContent(defaultContent)).toEqual([]);
  });

  it('rejects malformed data with a readable error', () => {
    expect(() =>
      parseContent({ ...rawDefaultContent, names: { firstNames: [], lastNames: [] } }),
    ).toThrow(/names\.json/);
  });

  it('reports missing text keys', () => {
    const broken = { ...defaultContent, i18n: { it: {} } };
    expect(checkContent(broken).some((e) => e.includes('missing text key'))).toBe(true);
  });
});

describe('preavviso della partita', () => {
  it('content:check finds buildup keys', () => {
    const t = defaultContent.i18n.it;
    expect(buildupLines(t, 'attack')).toBeGreaterThanOrEqual(4);
    expect(buildupLines(t, 'defense')).toBeGreaterThanOrEqual(4);
    // Togliere la seconda riga di difesa interrompe la serie: restano meno di 4 righe valide.
    const { ['match.buildup.defense.2']: _gone, ...rest } = t;
    const errors = checkContent({ ...defaultContent, i18n: { it: rest } });
    expect(errors).toContain('match: 1 buildup lines for "defense", need 4');
  });
});

describe('eventi', () => {
  const base = defaultContent.events[0]!;
  const withEvents = (events: GameEvent[], texts: Record<string, string> = {}) => ({
    ...defaultContent,
    events,
    i18n: { it: { ...defaultContent.i18n.it, ...texts } },
  });

  it('i 20 eventi iniziali sono presenti e validi', () => {
    expect(defaultContent.events.length).toBeGreaterThanOrEqual(20);
    expect(checkContent(defaultContent)).toEqual([]);
  });

  it('segnala id duplicati', () => {
    const errors = checkContent(withEvents([...defaultContent.events, base]));
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true);
  });

  it('segnala catene verso eventi inesistenti', () => {
    const broken: GameEvent = {
      ...base,
      id: 'catena_rotta',
      choices: [
        {
          textKey: base.choices[0]!.textKey,
          effects: [{ type: 'schedule', eventId: 'nessuno', inWeeks: 2 }],
        },
      ],
    };
    const errors = checkContent(withEvents([...defaultContent.events, broken]));
    expect(errors.some((e) => e.includes('unknown event "nessuno"'))).toBe(true);
  });

  it('segnala segnaposto sconosciuti, tratti inesistenti e catene mai attivate', () => {
    const broken: GameEvent = {
      ...base,
      id: 'difettoso',
      chainOnly: true,
      titleKey: 'events.difettoso.title',
      textKey: 'events.difettoso.text',
      textVariants: 1,
      conditions: { traits: ['tratto_inventato'] },
    };
    const errors = checkContent(
      withEvents([...defaultContent.events, broken], {
        'events.difettoso.title': 'Titolo',
        'events.difettoso.text': 'Ciao {soprannome}',
      }),
    );
    expect(errors.some((e) => e.includes('{soprannome}'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown trait'))).toBe(true);
    expect(errors.some((e) => e.includes('never scheduled'))).toBe(true);
  });

  it('lo schema rifiuta percorsi di statistiche inesistenti', () => {
    const bad = [
      {
        ...base,
        choices: [{ textKey: 'x', effects: [{ type: 'stat', path: 'player.magic', delta: 1 }] }],
      },
    ];
    expect(() =>
      parseContent({ ...rawDefaultContent, events: [{ file: 'events/prova.json', data: bad }] }),
    ).toThrow(/events\/prova\.json/);
  });

  it('rifiuta chiavi di testo duplicate tra file di traduzione', () => {
    const dup = { 'roles.GK': 'Portiere' };
    expect(() =>
      parseContent({
        ...rawDefaultContent,
        i18n: { it: [...rawDefaultContent.i18n.it, { file: 'i18n/dup.json', data: dup }] },
      }),
    ).toThrow(/duplicate text key/);
  });
});

describe('prima pagina', () => {
  it('content:check finds headline keys', () => {
    const t = defaultContent.i18n.it;
    expect(checkHeadlineKeys(3, t)).toEqual([]);
    const { ['headlines.legend.success.2']: _gone, ...rest } = t;
    expect(checkHeadlineKeys(3, rest)).toContain(
      'headlines: missing text "headlines.legend.success.2"',
    );
    // Chiedere più varianti di quelle scritte è un errore.
    expect(checkHeadlineKeys(9, t).length).toBeGreaterThan(0);
  });

  it('rejects chapter goals whose metric is impossible for the allowed roles', () => {
    const base = defaultContent.chapterGoals.find((g) => g.metric === 'goals')!;
    const bad = [
      { ...base, id: 'x_gk', conditions: { roles: ['GK' as const] } },
      { ...base, id: 'x_any', conditions: undefined },
      {
        ...base,
        id: 'x_clean',
        metric: 'cleanSheets' as const,
        conditions: { roles: ['ATT' as const] },
      },
    ];
    const t = { ...defaultContent.i18n.it };
    for (const g of bad) {
      for (const sfx of ['text', 'met', 'missed']) t[`chapterGoals.${g.id}.${sfx}`] = 'x';
    }
    const errors = checkContent({
      ...defaultContent,
      chapterGoals: [
        ...defaultContent.chapterGoals,
        ...bad.map((g) => ({ ...g, textKey: `chapterGoals.${g.id}.text` })),
      ],
      i18n: { it: t },
    });
    expect(errors.filter((e) => e.includes('chapterGoals.x_'))).toHaveLength(3);
  });
});
