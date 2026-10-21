// A glyph per card field, from the Plan glyph set: the Display tab's chips and Available Fields.
import type { CardField } from '@livediagram/items';

export const FIELD_GLYPHS: Record<CardField, string> = {
  key: 'bookmark',
  type: 'task',
  assignee: 'person',
  priority: 'flag',
  labels: 'bookmark',
  estimate: 'cube',
  start: 'calendar',
  due: 'calendar',
  votes: 'star',
  checklist: 'action',
  comments: 'chat',
  description: 'note',
  parent: 'project',
};
