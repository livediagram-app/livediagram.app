// Where a live or structured element stands, in one attribute (docs/specs/024-agents/blueprints/
// document-views.md "State attributes", VW22).
import { RATING_DEFAULT, type Element } from '@livedocuments/document';
import { NOTE_CUT_CHARS, PROGRESS_DEFAULT } from './constants';
import {
  arrayField,
  numberField,
  stringField,
  textField,
} from '@liveworkspace/document-views/fields';
import { jsonString } from '@liveworkspace/document-views/text';
import {
  countAttribute,
  flagAttribute,
  shapeKindOf,
  type ViewAttribute,
} from '@liveworkspace/document-views/view-attribute';

const countOf = (el: Element, field: string) => arrayField(el, field).length;

function textState(
  key: string,
  text: string | null,
  print: (text: string) => string,
): ViewAttribute[] {
  return text === null ? [] : [{ key, value: text, text: `${key}=${print(text)}` }];
}

export function stateAttributeOf(el: Element): ViewAttribute[] {
  switch (shapeKindOf(el)) {
    case 'stat-row':
      return [countAttribute('stats', countOf(el, 'stats'))];
    case 'process':
      return [countAttribute('steps', countOf(el, 'processSteps'))];
    case 'site-header':
      return [countAttribute('links', countOf(el, 'navLinks'))];
    case 'legend':
      return [countAttribute('items', countOf(el, 'legendItems'))];
    case 'rating':
      return [countAttribute('rating', `${numberField(el, 'rating') ?? RATING_DEFAULT}/5`)];
    case 'progress-bar':
    case 'progress-ring':
      return [countAttribute('progress', numberField(el, 'progress') ?? PROGRESS_DEFAULT)];
    case 'timeline-rail':
      return [countAttribute('milestones', countOf(el, 'conceptRows'))];
    case 'badge':
    case 'step':
      // Attached to a node (docs/specs/009-elements/badge.md): it moves, copies and deletes with it.
      return stringField(el, 'attachedTo') ? [flagAttribute('attached')] : [];
    case 'card':
      return textState('title', textField(el, 'pageTitle'), (t) => jsonString(t, NOTE_CUT_CHARS));
    default:
      return [];
  }
}
