// Where a live or structured element stands, in one attribute (docs/specs/024-agents/blueprints/
// project-views.md "State attributes", VW22).
import {
  RATING_DEFAULT,
  sessionButtonPlan,
  type Element,
  type SessionButtonConfig,
} from '@liveplanner/project';
import { NOTE_CUT_CHARS, PROGRESS_DEFAULT } from './constants';
import { arrayField, numberField, stringField, textField } from './fields';
import { attrValue, jsonString } from './text';
import { countAttribute, flagAttribute, shapeKindOf, type ViewAttribute } from './view-attribute';

const countOf = (el: Element, field: string) => arrayField(el, field).length;

// What pressing a session button starts: its tool and the setting it starts with.
function sessionState(el: Element): ViewAttribute {
  const plan = sessionButtonPlan(Reflect.get(el, 'session') as SessionButtonConfig | undefined);
  const setting =
    plan.tool === 'timer' ? `:${plan.minutes}m` : plan.tool === 'vote' ? `:${plan.dots}` : '';
  return countAttribute('session', `${plan.tool}${setting}`);
}

function textState(
  key: string,
  text: string | null,
  print: (text: string) => string,
): ViewAttribute[] {
  return text === null ? [] : [{ key, value: text, text: `${key}=${print(text)}` }];
}

export function stateAttributeOf(el: Element): ViewAttribute[] {
  switch (shapeKindOf(el)) {
    case 'temperature':
      return [countAttribute('votes', countOf(el, 'responses'))];
    case 'session-button':
      return [sessionState(el)];
    case 'decision':
      return textState('status', stringField(el, 'decisionStatus'), attrValue);
    case 'picker':
      return textState('picked', stringField(el, 'pickerResult'), attrValue);
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
    case 'page':
      return textState('title', textField(el, 'pageTitle'), (t) => jsonString(t, NOTE_CUT_CHARS));
    default:
      return [];
  }
}
