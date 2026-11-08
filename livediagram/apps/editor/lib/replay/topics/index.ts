import type { Topic } from '../topic';
import { basics } from './diagram-basics';
import { find } from './diagram-find';
import { look } from './diagram-look';
import { shape } from './diagram-shape';
import { tidy } from './diagram-tidy';

// Every Watch It Built replay by its id (lib/replay/curriculum.ts lists them for the start panel). Loaded with the
// player, never with the editor.
export const TOPICS: Readonly<Record<string, Topic>> = {
  [basics.id]: basics as Topic,
  [look.id]: look as Topic,
  [shape.id]: shape as Topic,
  [find.id]: find as Topic,
  [tidy.id]: tidy as Topic,
};
