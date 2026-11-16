/**
 * Simboli araldici degli stemmi (viewBox 24×24, riempimento pieno). Gli id coincidono con
 * `symbols` di content/data/clubs.json; un simbolo sconosciuto ricade sulla stella.
 */
export const CREST_SYMBOLS: Readonly<Record<string, string>> = {
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z',
  tower: 'M5 22V9h2V6h2v3h2V6h2v3h2V6h2v3h2v13h-5v-5h-4v5z',
  lion: 'M12 2l2 3 3.5-1 .5 3.5 3 2-2 3 2 3-3 2-.5 3.5L14 20l-2 3-2-3-3.5 1-.5-3.5-3-2 2-3-2-3 3-2 .5-3.5L10 5z',
  eagle: 'M12 4l2 4 8-2-5 6 3 1-6 2-2 5-2-5-6-2 3-1-5-6 8 2z',
  wolf: 'M4 3l5 5h6l5-5-1 9-7 9-7-9z',
  ball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5l3.8 2.8-1.5 4.4H9.7L8.2 9.8z',
  wave: 'M2 14c3-4 5-4 8 0s5 4 8 0 3-3 4-2v6c-1-1-2-1-4 1-3 4-5 4-8 0s-5-4-8 0z',
  crown: 'M3 18l-1-11 5 4 5-7 5 7 5-4-1 11z',
  cross: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z',
  sun: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM11 0h2v4h-2zM11 20h2v4h-2zM0 11h4v2H0zM20 11h4v2h-4z',
  bull: 'M2 4c2 4 4 5 7 5h6c3 0 5-1 7-5 0 5-2 8-5 9l-1 7H8l-1-7C4 12 2 9 2 4z',
  horse: 'M8 22l1-7-4-3 1-4 5-5 2 2 4 1 4 6-2 2-3-2-1 3 2 7z',
  anchor:
    'M11 2h2v3h3v2h-3v11c3-.4 5-2.5 5.5-5H16l3.5-4L23 13h-2.5C20 18 16.5 21 12 21S4 18 3.5 13H1l3.5-4L8 13H5.5C6 15.5 8 17.6 11 18V7H8V5h3z',
  oak: 'M12 2c4 0 7 3 7 6 2 1 3 3 2 5s-3 3-5 3h-3v6h-2v-6H8c-2 0-4-1-5-3s0-4 2-5c0-3 3-6 7-6z',
  griffin: 'M3 20c0-8 5-15 15-17-2 3-2 5-1 7-2 0-3 1-3 3 2 0 3 1 3 3-3 0-5 1-6 4z',
  lily: 'M12 2c2 3 3 6 1 10h4c0-3 2-5 5-5-1 4-3 7-7 7h-2v2h3v2h-3v4h-2v-4H8v-2h3v-2H9c-4 0-6-3-7-7 3 0 5 2 5 5h4c-2-4-1-7 1-10z',
};

export const symbolPath = (id: string): string => CREST_SYMBOLS[id] ?? CREST_SYMBOLS['star']!;
