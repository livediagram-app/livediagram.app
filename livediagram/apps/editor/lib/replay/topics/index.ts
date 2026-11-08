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
import { board } from './draw-board';
import { pens } from './draw-pens';
import { recognition } from './draw-recognition';
import { shapes } from './draw-shapes';
import { sketch } from './draw-sketch';

// Every Watch It Built replay by its id (lib/replay/curriculum.ts lists them for the start panel). Loaded with the
// player, never with the editor.
export const TOPICS: Readonly<Record<string, Topic>> = {
  [basics.id]: basics,
  [look.id]: look,
  [shape.id]: shape,
  [find.id]: find,
  [tidy.id]: tidy,
  [ask.id]: ask,
  [stickies.id]: stickies,
  [reveal.id]: reveal,
  [run.id]: run,
  [sketch.id]: sketch,
  [recognition.id]: recognition,
  [pens.id]: pens,
  [shapes.id]: shapes,
  [board.id]: board,
};
