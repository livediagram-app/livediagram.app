// The words people search for a template by, beyond its title and description (docs/specs/008-canvas/canvas-and-palette.md
// "Template categories", Search): other names for it and the job it does. Pure data.
import type { TemplateKind } from './templates';

const OWN_KEYWORDS: Readonly<Record<TemplateKind, readonly string[]>> = {
  'blank-session': ['empty', 'blank', 'meeting', 'space', 'room'],
  'coworking-space': [
    'coworking',
    'cowork',
    'hot desk',
    'open office',
    'phone booth',
    'coffee',
    'avatar',
    'walk',
  ],
  'team-pod': [
    'team',
    'pod',
    'squad',
    'desks',
    'stand-up',
    'standup',
    'team room',
    'avatar',
    'walk',
  ],
  'all-hands-hall': [
    'all hands',
    'all-hands',
    'town hall',
    'auditorium',
    'stage',
    'demo day',
    'seats',
    'avatar',
  ],
  'virtual-office': [
    'office',
    'virtual office',
    'remote',
    'hybrid',
    'team space',
    'rooms',
    'avatar',
    'walk',
    'coffee',
    'water cooler',
    'meeting room',
    'desks',
  ],
  // Software & IT's search words, kept when it folded into Retrospectives.
};

/** The words a template is searched by. */
export function templateKeywords(kind: TemplateKind): readonly string[] {
  return OWN_KEYWORDS[kind];
}
