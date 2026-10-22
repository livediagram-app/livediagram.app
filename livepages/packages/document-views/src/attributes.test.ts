import { describe, expect, it } from 'vitest';
import { createSticky, type Element } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { attributesOf, isOpenCommentsAttribute, type AttributeContext } from './attributes';
import { styleBaselines } from './style-attributes';

const plain: AttributeContext = { tabRefOf: (id) => id.slice(0, 4), style: null };
const printed = (el: Element, context = plain) =>
  attributesOf(el, context)
    .map((a) => a.text)
    .join(' ');
const comment = { id: 'c', text: 't', createdAt: 0, authorName: 'A', authorColor: '#000' };
const action = (status: 'open' | 'done', name = 'Fix retries', assignee = 'Sam') => ({
  id: 'a',
  name,
  description: '',
  assignee: { userId: null, name: assignee },
  teamId: null,
  assignerId: 'u',
  assignerName: null,
  status,
  createdAt: 0,
  updatedAt: 0,
});

describe('attributesOf (VW14)', () => {
  it('prints nothing for a plain element', () => {
    expect(printed(shapeAt('square', 'x', 0, 0))).toBe('');
  });

  it('prints every attribute in order', () => {
    const el = {
      ...shapeAt('square', 'x', 0, 0),
      iconId: 'server',
      link: { kind: 'url', url: 'https://stripe.com/docs/api' },
      locked: true,
      action: action('done'),
      note: 'Owns the order lifecycle and is the source of truth for order state.',
      commentThread: { comments: [comment], resolved: true },
    } as Element;
    expect(printed(el)).toBe(
      'icon=server link=https://stripe.com/docs/api locked action="Fix retries" @Sam done ' +
        'note="Owns the order lifecycle and is the source of"… comments=1 resolved',
    );
  });

  it('prints links to tabs, elements and documents (VW28)', () => {
    const link = (l: object) => printed({ ...shapeAt('square', 'x', 0, 0), link: l } as Element);
    expect(link({ kind: 'tab', tabId: '51c9abcd' })).toBe('link=tab:51c9');
    expect(link({ kind: 'element', tabId: '51c9abcd', elementId: 'e4a8-1' })).toBe(
      'link=tab:51c9#e4a8-1',
    );
    expect(link({ kind: 'document', documentId: 'doc-1', name: 'Other' })).toBe('link=doc:doc-1');
    expect(link({ kind: 'url', url: 'not a url' })).toBe('link="not a url"');
    expect(link({ kind: 'tab' })).toBe('');
    expect(link({ kind: 'element', tabId: 't' })).toBe('');
    expect(link({ kind: 'document' })).toBe('');
    expect(link({ kind: 'url' })).toBe('');
    expect(link({ kind: 'wormhole' })).toBe('');
  });

  it('marks a draft event-storming note first (VW13)', () => {
    const note = {
      ...createSticky(0, 0),
      id: 'n',
      esKind: 'domain-event',
      esDraft: true,
      locked: true,
    } as Element;
    expect(printed(note)).toBe('draft locked');
    const sticky = { ...createSticky(0, 0), id: 's', esDraft: true } as Element;
    expect(printed(sticky)).toBe('');
  });

  it("prints an image's alt text, cut", () => {
    const image = {
      id: 'i',
      type: 'image',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      src: 's',
      alt: 'A diagram of the whole checkout platform, end to end',
    } as unknown as Element;
    expect(printed(image)).toBe('alt="A diagram of the whole checkout platform, end to"…');
  });

  it('prints an action without an assignee, quoting a spaced name (VW29)', () => {
    const el = (a: object) => printed({ ...shapeAt('square', 'x', 0, 0), action: a } as Element);
    expect(el(action('open', 'Ship', 'Sam Lee'))).toBe('action="Ship" @"Sam Lee"');
    expect(el({ ...action('open', 'Ship'), assignee: null })).toBe('action="Ship"');
    expect(el({ ...action('open'), name: undefined, assignee: { name: ' ' } })).toBe('action=""');
  });

  it('counts an actions list', () => {
    const el = (list: unknown[]) =>
      printed({ ...shapeAt('square', 'x', 0, 0), actions: list } as Element);
    expect(el([action('open'), action('done'), action('open'), 'junk'])).toBe('actions=2 open/3');
    expect(el([])).toBe('');
  });

  it('prints an open thread', () => {
    const el = {
      ...shapeAt('square', 'x', 0, 0),
      commentThread: { comments: [comment, comment], resolved: false },
    } as Element;
    const [attribute] = attributesOf(el, plain);
    expect(attribute?.text).toBe('comments=2 open');
    expect(isOpenCommentsAttribute(attribute!)).toBe(true);
  });

  it('keeps only an open comment count through the budget (VW38)', () => {
    expect(isOpenCommentsAttribute({ key: 'comments', value: '1 resolved', text: '' })).toBe(false);
    expect(isOpenCommentsAttribute({ key: 'note', value: 'x open', text: '' })).toBe(false);
    expect(isOpenCommentsAttribute({ key: 'comments', value: null, text: '' })).toBe(false);
  });

  it('adds style that differs from the factory, only when asked (VW50)', () => {
    const styled = {
      ...shapeAt('square', 'x', 0, 0),
      fillColor: '#fde68a',
      strokeStyle: 'dashed',
      textSize: 'lg',
    } as Element;
    expect(printed(styled)).toBe('');
    const context = { ...plain, style: styleBaselines() };
    expect(printed(styled, context)).toBe('fill=#fde68a border=dashed text=lg');
    expect(printed(shapeAt('square', 'y', 0, 0), context)).toBe('');
    expect(
      printed(arrowBetween('a', 'x', 'y', { arrowStyle: 'angled', strokeColor: '#f00' }), context),
    ).toBe('stroke=#f00 line=angled');
  });
});
