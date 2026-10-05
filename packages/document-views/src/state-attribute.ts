// Where a live or structured element stands, in one attribute (docs/specs/024-agents/blueprints/
// document-views.md "State attributes", VW22).
import { RAIL_DEFAULT_POINTS, RATING_DEFAULT, type Element } from '@livediagram/document';
import { NOTE_CUT_CHARS, PROGRESS_DEFAULT } from './constants';
import { arrayField, flagField, numberField, stringField, textField } from './fields';
import { attrValue, jsonString } from './text';
import { countAttribute, flagAttribute, shapeKindOf, type ViewAttribute } from './view-attribute';

const countOf = (el: Element, field: string) => arrayField(el, field).length;

function withFlag(attribute: ViewAttribute, flag: string, on: boolean): ViewAttribute[] {
  return on ? [attribute, flagAttribute(flag)] : [attribute];
}

function agendaState(el: Element): ViewAttribute {
  const items = countOf(el, 'agendaItems');
  const current = numberField(el, 'agendaCurrent');
  return current === null
    ? countAttribute('items', items)
    : countAttribute('item', `${current + 1}/${items}`);
}

function quizState(el: Element): ViewAttribute {
  if (flagField(el, 'quizRevealed')) return countAttribute('state', 'revealed');
  if (numberField(el, 'quizLockedAt') !== null) return countAttribute('state', 'locked');
  if (numberField(el, 'quizStartedAt') !== null) return countAttribute('state', 'open');
  return countAttribute('state', 'ready');
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
    case 'estimate':
      return withFlag(
        countAttribute('votes', countOf(el, 'responses')),
        'revealed',
        flagField(el, 'responsesRevealed'),
      );
    case 'temperature':
      return [countAttribute('votes', countOf(el, 'responses'))];
    case 'done-check':
      return [countAttribute('done', countOf(el, 'responses'))];
    case 'idea-box':
      return withFlag(
        countAttribute('ideas', countOf(el, 'ideaCards')),
        'revealed',
        flagField(el, 'ideasRevealed'),
      );
    case 'qa-board':
      return [countAttribute('questions', countOf(el, 'qaNotes'))];
    case 'agenda':
      return [agendaState(el)];
    case 'decision':
      return textState('status', stringField(el, 'decisionStatus'), attrValue);
    case 'roll-call':
      return [countAttribute('present', countOf(el, 'rollCall'))];
    case 'quiz':
      return [quizState(el)];
    case 'picker':
      return textState('picked', stringField(el, 'pickerResult'), attrValue);
    case 'reveal':
      return flagField(el, 'revealed') ? [flagAttribute('revealed')] : [];
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
      return [countAttribute('points', numberField(el, 'railCount') ?? RAIL_DEFAULT_POINTS)];
    case 'page':
      return textState('title', textField(el, 'pageTitle'), (t) => jsonString(t, NOTE_CUT_CHARS));
    default:
      return [];
  }
}
