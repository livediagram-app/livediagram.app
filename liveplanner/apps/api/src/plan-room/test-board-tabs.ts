// Test helper: a Board tab holding an Archive board (`b-arch`) and an All Cards board (`b-all`), as a template's
// Past Meetings tab holds one: boards that file no card by column.
import { presetSetup } from '@liveplanner/items';

const board = (id: string, preset: 'archive' | 'all-cards', y: number) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y,
  width: 800,
  height: 500,
  planBoard: presetSetup(preset),
});

export const archiveTab = {
  id: 't2',
  name: 'Past Meetings',
  kind: 'board',
  elements: [board('b-arch', 'archive', 0), board('b-all', 'all-cards', 600)],
};
