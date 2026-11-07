// Where a structured element stands, in one attribute (docs/specs/024-agents/blueprints/
// document-views.md "State attributes", VW22). A retired element (docs/specs/002-project-scope/not-in-livehuddle.md)
// has none: its kind word already says livehuddle does not know it.
import type { Element } from '@livehuddle/document';
import { NOTE_CUT_CHARS } from './constants';
import { arrayField, stringField, textField } from '@liveworkspace/document-views/fields';
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
