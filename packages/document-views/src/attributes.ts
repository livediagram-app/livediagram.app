// The attributes of one element's line, in order (docs/specs/024-agents/blueprints/document-views.md
// "Attributes", VW14): draft, icon, link, alt, locked, action or actions, note, comments, then style.
import { isEventStormingNote, type Element } from '@livediagram/document';
import { ACTION_CUT_CHARS, ALT_CUT_CHARS, NOTE_CUT_CHARS } from './constants';
import {
  arrayField,
  flagField,
  isObject,
  objectField,
  stringField,
  textField,
  threadOf,
} from './fields';
import { styleAttributesOf, type StyleBaselines } from './style-attributes';
import { attrValue, jsonString } from './text';
import { countAttribute, flagAttribute, type ViewAttribute } from './view-attribute';

export type AttributeContext = {
  tabRefOf: (tabId: string) => string;
  // Present when the request asks for style.
  style: StyleBaselines | null;
};

function linkAttribute(el: Element, tabRefOf: (tabId: string) => string): ViewAttribute[] {
  const link = objectField(el, 'link');
  if (link === null) return [];
  const tabId = stringField(link, 'tabId');
  const target = ((): string | null => {
    switch (stringField(link, 'kind')) {
      case 'url':
        return stringField(link, 'url');
      case 'tab':
        return tabId === null ? null : `tab:${tabRefOf(tabId)}`;
      case 'element': {
        const elementId = stringField(link, 'elementId');
        return tabId === null || elementId === null ? null : `tab:${tabRefOf(tabId)}#${elementId}`;
      }
      case 'document': {
        const documentId = stringField(link, 'documentId');
        return documentId === null ? null : `doc:${documentId}`;
      }
      default:
        return null;
    }
  })();
  return target === null ? [] : [{ key: 'link', value: target, text: `link=${attrValue(target)}` }];
}

function cutAttribute(key: string, text: string | null, max: number): ViewAttribute[] {
  return text === null ? [] : [{ key, value: text, text: `${key}=${jsonString(text, max)}` }];
}

function actionAttributes(el: Element): ViewAttribute[] {
  const action = objectField(el, 'action');
  if (action !== null) {
    const name = stringField(action, 'name') ?? '';
    const assignee = objectField(action, 'assignee');
    const who = assignee === null ? null : textField(assignee, 'name');
    const text = `action=${jsonString(name, ACTION_CUT_CHARS)}${who === null ? '' : ` @${attrValue(who)}`}`;
    const done = stringField(action, 'status') === 'done';
    return [{ key: 'action', value: name, text }, ...(done ? [flagAttribute('done')] : [])];
  }
  const actions = arrayField(el, 'actions').filter(isObject);
  if (actions.length === 0) return [];
  const open = actions.filter((a) => stringField(a, 'status') !== 'done').length;
  return [countAttribute('actions', `${open} open/${actions.length}`)];
}

function commentsAttribute(el: Element): ViewAttribute[] {
  const thread = threadOf(el);
  if (thread === null) return [];
  return [
    countAttribute(
      'comments',
      `${thread.comments.length} ${thread.resolved ? 'resolved' : 'open'}`,
    ),
  ];
}

export function attributesOf(el: Element, context: AttributeContext): ViewAttribute[] {
  const iconId = textField(el, 'iconId');
  return [
    ...(isEventStormingNote(el) && flagField(el, 'esDraft') ? [flagAttribute('draft')] : []),
    ...(iconId === null ? [] : [{ key: 'icon', value: iconId, text: `icon=${attrValue(iconId)}` }]),
    ...linkAttribute(el, context.tabRefOf),
    ...(el.type === 'image' ? cutAttribute('alt', textField(el, 'alt'), ALT_CUT_CHARS) : []),
    ...(flagField(el, 'locked') ? [flagAttribute('locked')] : []),
    ...actionAttributes(el),
    ...cutAttribute('note', textField(el, 'note'), NOTE_CUT_CHARS),
    ...commentsAttribute(el),
    ...(context.style === null ? [] : styleAttributesOf(el, context.style)),
  ];
}

// Whether the budget's "attributes dropped" state keeps this one: only an open comment count (VW38).
export function isOpenCommentsAttribute(attribute: ViewAttribute): boolean {
  return (
    attribute.key === 'comments' && attribute.value !== null && attribute.value.endsWith(' open')
  );
}
