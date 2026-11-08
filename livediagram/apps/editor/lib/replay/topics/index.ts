import type { Topic } from '../topic';
import { basics } from './diagram-basics';

// Every Watch It Built replay by its id (lib/replay/curriculum.ts lists them for the start panel). Loaded with the
// player, never with the editor.
export const TOPICS: Readonly<Record<string, Topic>> = {
  [basics.id]: basics as Topic,
};
