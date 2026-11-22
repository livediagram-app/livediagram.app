// Each picker group's colour (blueprint item-ui.md "Pictures"), by the group's id (rule-reads.ts groupId). A group
// the app added takes the tone it named (input.own.tones, by the group's name), violet otherwise.

import type { SceneTone } from '../../tile-picker/tile-scene';

export const TRIGGER_GROUP_TONES: Readonly<Record<string, SceneTone>> = {
  changes: 'violet',
  comments: 'orange',
  people: 'emerald',
  time: 'blue',
  other: 'emerald',
};

export const ACTION_GROUP_TONES: Readonly<Record<string, SceneTone>> = {
  snapshots: 'blue',
  tabs: 'emerald',
  messages: 'emerald',
  timing: 'orange',
  'other-tools': 'violet',
  ai: 'violet',
  'in-other-apps': 'blue',
};

export const DEFAULT_TONE: SceneTone = 'violet';
