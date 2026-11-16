/**
 * Elenco dei file di eventi. Aggiungere un evento a un file esistente non richiede codice; un nuovo
 * file va registrato qui (l'app non può leggere le cartelle a runtime).
 */
import allenamento from '../data/events/training/allenamento.json';
import famiglia from '../data/events/family/famiglia.json';
import media from '../data/events/media/media.json';
import mercato from '../data/events/transfer/mercato.json';
import spogliatoio from '../data/events/dressing_room/spogliatoio.json';
import vita from '../data/events/life/vita.json';

export const rawEvents: { file: string; data: unknown }[] = [
  { file: 'events/dressing_room/spogliatoio.json', data: spogliatoio },
  { file: 'events/training/allenamento.json', data: allenamento },
  { file: 'events/media/media.json', data: media },
  { file: 'events/life/vita.json', data: vita },
  { file: 'events/family/famiglia.json', data: famiglia },
  { file: 'events/transfer/mercato.json', data: mercato },
];
