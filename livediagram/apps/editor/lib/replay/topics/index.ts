import type { Topic } from '../topic';
import { basics } from './diagram-basics';
import { find } from './diagram-find';
import { look } from './diagram-look';
import { shape } from './diagram-shape';
import { tidy } from './diagram-tidy';
import { ask } from './workshop-ask';
import { reveal } from './workshop-reveal';
import { run } from './workshop-run';
import { stickies } from './workshop-stickies';

// Every Watch It Built replay by its id (lib/replay/curriculum.ts lists them for the start panel). Loaded with the
// player, never with the editor.
export const TOPICS: Readonly<Record<string, Topic>> = {
  [basics.id]: basics as Topic,
  [look.id]: look as Topic,
  [shape.id]: shape as Topic,
  [find.id]: find as Topic,
  [tidy.id]: tidy as Topic,
  [ask.id]: ask as Topic,
  [stickies.id]: stickies as Topic,
  [reveal.id]: reveal as Topic,
  [run.id]: run as Topic,
};
