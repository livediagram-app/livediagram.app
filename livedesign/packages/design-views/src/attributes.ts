// The attributes of one element's line, in order (docs/specs/024-agents/blueprints/design-views.md
// "Attributes", VW14): draft, icon, link, alt, locked, action or actions, note, comments, then style.
import { DEFAULT_PAGE_LINK_TRANSITION, type Element } from '@livedesign/design';
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
  // The tab's page ids, so a screen link to a page not on the tab prints `broken`; absent, none does.
  pageIds?: ReadonlySet<string>;
};

// A screen link's or back link's attributes (docs/specs/007-editor/wireframe-pages.md "Collaboration and agents"):
// `link=page:<pageId>` or `link=back`, `transition=` when not instant, `broken` when its page is gone.
function screenLinkAttributes(
  link: object,
  pageIds: ReadonlySet<string> | undefined,
): ViewAttribute[] | null {
  const kind = stringField(link, 'kind');
  if (kind !== 'page' && kind !== 'back') return null;
  const pageId = stringField(link, 'pageId');
  if (kind === 'page' && pageId === null) return [];
  const target = kind === 'back' ? 'back' : `page:${pageId}`;
  const transition = stringField(link, 'transition');
  const broken = kind === 'page' && pageIds !== undefined && !pageIds.has(pageId!);
  return [
    { key: 'link', value: target, text: `link=${attrValue(target)}` },
    ...(transition !== null && transition !== DEFAULT_PAGE_LINK_TRANSITION
      ? [{ key: 'transition', value: transition, text: `transition=${attrValue(transition)}` }]
      : []),
    ...(broken ? [flagAttribute('broken')] : []),
  ];
}

function linkAttribute(el: Element, context: AttributeContext): ViewAttribute[] {
  const link = objectField(el, 'link');
  if (link === null) return [];
  const screen = screenLinkAttributes(link, context.pageIds);
  if (screen !== null) return screen;
  const { tabRefOf } = context;
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
      case 'design': {
        const designId = stringField(link, 'designId');
        return designId === null ? null : `doc:${designId}`;
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
    ...(iconId === null ? [] : [{ key: 'icon', value: iconId, text: `icon=${attrValue(iconId)}` }]),
    ...linkAttribute(el, context),
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
