import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from './element-fields';
import {
  createAnnotation,
  createArrow,
  createFreehand,
  createImage,
  createLinkCard,
  createSticky,
  createTable,
  createText,
  createVideo,
} from './factories';
import type { Element, Tab } from './index';
import { createPath } from './path-element';
import { applyParticipantOp, participantTabChange } from './participant-content';
import { createShape } from './shape-factory';
import { ELEMENT_TYPES, isValidElement } from './validate';

// The participant content rule never leaks (docs/specs/013-workspace/share-roles.md "A Participant walks").
// For one valid element of every type (and the kinds the rule treats apart), every stored field is offered several
// new values by a Participant, whether or not it added the element. Whatever the room does, no field outside the
// spec's list for that element may change, and a Participant changes content through no field at all: only a piece
// (a Door's `doorClosed`) has a list. The list below IS the spec's table: widening what a Participant may do means
// editing it here, on purpose, in the same change as the spec.

const ME = 'a'.repeat(32);
const THEM = 'b'.repeat(32);

type Bag = Record<string, unknown>;
type Sample = { name: string; el: Element; allowed: readonly string[] };

const theirs = (el: Element, id: string): Element => ({ ...el, id, addedBy: THEM }) as Element;
// Its own earlier element: no different from anyone's.
const mine = (el: Element, id: string): Element => ({ ...el, id, addedBy: ME }) as Element;

const SAMPLES: Sample[] = [
  { name: 'shape (square)', el: theirs(createShape('square', 0, 0), 'sq'), allowed: [] },
  {
    name: 'shape (Behaviour: mode button)',
    el: theirs(createShape('mode-button', 0, 0), 'sb'),
    allowed: [],
  },
  { name: 'text', el: theirs(createText(0, 0), 'tx'), allowed: [] },
  {
    name: 'text (sizes to its words)',
    el: theirs({ ...createText(0, 0), sizing: 'fit' }, 'tf'),
    allowed: [],
  },
  { name: 'table', el: theirs(createTable(0, 0), 'tb'), allowed: [] },
  {
    name: 'sticky',
    el: theirs(createSticky(0, 0), 'st'),
    allowed: [],
  },
  { name: 'image', el: theirs(createImage(0, 0), 'im'), allowed: [] },
  {
    name: 'freehand',
    el: theirs(
      createFreehand(
        [
          { x: 0, y: 0 },
          { x: 40, y: 20 },
        ],
        false,
      ),
      'fh',
    ),
    allowed: [],
  },
  {
    name: 'path',
    el: theirs(
      createPath(
        [
          { x: 0, y: 0, mode: 'corner' },
          { x: 40, y: 20, mode: 'corner' },
        ],
        false,
      ),
      'pa',
    ),
    allowed: [],
  },
  { name: 'annotation', el: theirs(createAnnotation(0, 0), 'an'), allowed: [] },
  { name: 'link card', el: theirs(createLinkCard(0, 0), 'lc'), allowed: [] },
  { name: 'video', el: theirs(createVideo(0, 0), 'vi'), allowed: [] },
  { name: 'arrow (free)', el: theirs(createArrow(0, 0, 100, 100), 'af'), allowed: [] },
  { name: 'its own earlier sticky', el: mine(createSticky(0, 0), 'ms'), allowed: [] },
  { name: 'its own earlier text', el: mine(createText(0, 0), 'mt'), allowed: [] },
  {
    name: 'shape (a Door: its swing alone)',
    el: theirs(createShape('door', 0, 0), 'dr'),
    allowed: ['doorClosed'],
  },
  {
    // A stage's settings and name are an Editor's (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Share
    // roles"): a Participant's change to Who Can Speak or Show Cameras stays as stored.
    name: 'shape (Behaviour: stage)',
    el: theirs({ ...createShape('stage', 0, 0), stageSpeakers: 'edit', stageCameras: false }, 'sg'),
    allowed: [],
  },
];

// Values a field is offered: the kind a real client would send for it, and some it would not.
function offers(stored: unknown): unknown[] {
  const out: unknown[] = ['leak', 7, true, null, undefined, ['leak'], { leak: true }];
  if (typeof stored === 'number') out.unshift(stored + 37, stored * 2 + 1);
  if (typeof stored === 'string') out.unshift(`${stored}-leak`);
  if (typeof stored === 'boolean') out.unshift(!stored);
  if (stored && typeof stored === 'object') out.unshift(structuredClone(stored));
  return out;
}

function tabFor(sample: Sample): Tab {
  return { id: 't', name: 't', elements: [sample.el] };
}

describe('the participant content rule never leaks', () => {
  it('has a sample for every element type, each one valid', () => {
    const covered = new Set(SAMPLES.map((s) => s.el.type));
    expect(covered).toEqual(ELEMENT_TYPES);
    for (const s of SAMPLES) expect(isValidElement(s.el), s.name).toBe(true);
  });

  for (const sample of SAMPLES) {
    it(`changes nothing outside its list on ${sample.name}`, () => {
      const tab = tabFor(sample);
      const stored = sample.el as Bag;
      const fields = (ELEMENT_FIELD_NAMES as Record<string, readonly string[]>)[sample.el.type]!;
      let landed = 0;
      for (const field of fields) {
        if (field === 'id' || field === 'type' || field === 'addedBy') continue;
        for (const value of offers(stored[field])) {
          const incoming = { ...stored, [field]: value };
          if (value === undefined) delete incoming[field];
          const r = applyParticipantOp(tab, { kind: 'update', element: incoming as Element }, ME);
          if (r.result !== 'applied') continue;
          const merged = r.tab.elements.find((e) => e.id === sample.el.id) as Bag;
          for (const key of new Set([...Object.keys(stored), ...Object.keys(merged)])) {
            if (sample.allowed.includes(key)) continue;
            expect(
              merged[key],
              `${sample.name}: ${field}=${JSON.stringify(value)} moved ${key}`,
            ).toEqual(stored[key]);
          }
          if (r.changed) landed++;
          // A connector's ends never move to another element.
          if (sample.el.type === 'arrow' && sample.allowed.includes('from')) {
            for (const end of ['from', 'to'] as const) {
              expect((merged[end] as Bag).elementId).toEqual((stored[end] as Bag).elementId);
            }
          }
        }
      }
      // Not vacuous: something the list allows does land (a Behaviour allows nothing).
      if (sample.allowed.length > 0) expect(landed, sample.name).toBeGreaterThan(0);
    });
  }

  it('lets no add through at all, a sticky, text or image included', () => {
    const tab = { id: 't', name: 't', elements: [] } as Tab;
    const verdict = (el: Element) =>
      applyParticipantOp(tab, { kind: 'add', element: el, at: 1 }, ME).result;
    for (const s of SAMPLES) {
      const fresh = { ...(s.el as Bag) };
      delete fresh.addedBy;
      fresh.id = `new-${s.el.id}`;
      expect(verdict(fresh as Element), s.name).toBe('refused');
    }
  });

  it("removes nothing, someone else's or its own", () => {
    for (const s of SAMPLES) {
      const tab = tabFor(s);
      const r = applyParticipantOp(tab, { kind: 'remove', id: s.el.id }, ME);
      expect(r.result, s.name).toBe('refused');
    }
  });

  it("never changes a tab's own fields", () => {
    const tab = tabFor(SAMPLES[6]!);
    for (const meta of [
      { name: 'Renamed' },
      { mode: 'draw' },
      { theme: 'dark' },
      { locked: true },
    ]) {
      expect(participantTabChange(tab, { ...tab, ...meta }, ME), JSON.stringify(meta)).toBeNull();
    }
  });
});
