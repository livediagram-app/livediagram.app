import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from './element-fields';
import {
  createAnnotation,
  createArrow,
  createFreehand,
  createImage,
  createLinkCard,
  createPinnedArrow,
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

// The participant content rule never leaks (docs/specs/013-workspace/share-roles.md "What a Participant changes").
// For one valid element of every type (and the kinds the rule treats apart), every stored field is offered several
// new values by a Participant who did not add the element. Whatever the room does, no field outside the spec's list
// for that element may change. The list below IS the spec's table: widening what a Participant may do means editing
// it here, on purpose, in the same change as the spec.

const ME = 'a'.repeat(32);
const THEM = 'b'.repeat(32);

type Bag = Record<string, unknown>;
type Sample = { name: string; el: Element; allowed: readonly string[] };

const TEXT = ['label', 'richText'];
const PLACE = ['x', 'y', 'width', 'height'];
const STICKY_COLOURS = ['fillColor', 'strokeColor', 'textColor', 'penTextColour'];
const IMAGE = ['imageId', 'naturalWidth', 'naturalHeight', 'alt', 'credit'];

const theirs = (el: Element, id: string): Element => ({ ...el, id, addedBy: THEM }) as Element;

const root = theirs({ ...createShape('mind-node', 0, 0), label: 'Root' } as Element, 'root');
const SAMPLES: Sample[] = [
  { name: 'shape (square)', el: theirs(createShape('square', 0, 0), 'sq'), allowed: TEXT },
  {
    name: 'shape (Behaviour: session button)',
    el: theirs(createShape('session-button', 0, 0), 'sb'),
    allowed: [],
  },
  {
    name: 'shape (mind node)',
    el: theirs({ ...createShape('mind-node', 300, 0), mindParentId: 'root' } as Element, 'mn'),
    allowed: [...TEXT, 'x', 'y'],
  },
  { name: 'text', el: theirs(createText(0, 0), 'tx'), allowed: TEXT },
  {
    name: 'text (sizes to its words)',
    el: theirs({ ...createText(0, 0), sizing: 'fit' } as Element, 'tf'),
    allowed: [...TEXT, 'width', 'height'],
  },
  { name: 'table', el: theirs(createTable(0, 0), 'tb'), allowed: [...TEXT, 'cells'] },
  {
    name: 'sticky',
    el: theirs(createSticky(0, 0), 'st'),
    allowed: [...TEXT, ...PLACE, ...STICKY_COLOURS],
  },
  { name: 'image', el: theirs(createImage(0, 0), 'im'), allowed: [...TEXT, ...PLACE, ...IMAGE] },
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
    allowed: TEXT,
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
    allowed: TEXT,
  },
  { name: 'annotation', el: theirs(createAnnotation(0, 0), 'an'), allowed: TEXT },
  { name: 'link card', el: theirs(createLinkCard(0, 0), 'lc'), allowed: TEXT },
  { name: 'video', el: theirs(createVideo(0, 0), 'vi'), allowed: TEXT },
  { name: 'arrow (free)', el: theirs(createArrow(0, 0, 100, 100), 'af'), allowed: TEXT },
  {
    // Only the faces turn: the ends stay pinned to the same nodes (checked below).
    name: 'arrow (mind connector)',
    el: theirs(createPinnedArrow('root', 'e', 'mn', 'w'), 'ac'),
    allowed: [...TEXT, 'from', 'to'],
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
  const elements =
    sample.el.id === 'mn' || sample.el.id === 'ac'
      ? [root, ...(sample.el.id === 'ac' ? [SAMPLES[2]!.el] : []), sample.el]
      : [sample.el];
  return { id: 't', name: 't', elements } as Tab;
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
          const incoming = { ...stored, [field]: value } as Bag;
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

  // A connector is addable only between two mind nodes on the tab, and this tab holds the root alone.
  it('lets no add through but a sticky, text, image, or a mind node on a map', () => {
    const tab = { id: 't', name: 't', elements: [root] } as Tab;
    const verdict = (el: Element) =>
      applyParticipantOp(tab, { kind: 'add', element: el, at: 1 }, ME).result;
    for (const s of SAMPLES) {
      const fresh = { ...(s.el as Bag) } as Bag;
      delete fresh.addedBy;
      fresh.id = `new-${s.el.id}`;
      const ok = ['sticky', 'text', 'image'].includes(s.el.type) || s.el.id === 'mn';
      expect(verdict(fresh as Element), s.name).toBe(ok ? 'applied' : 'refused');
    }
  });

  it("removes nothing of someone else's but a mind node or its connector", () => {
    for (const s of SAMPLES) {
      const tab = tabFor(s);
      const r = applyParticipantOp(tab, { kind: 'remove', id: s.el.id }, ME);
      const ok = s.el.id === 'mn' || s.el.id === 'ac';
      expect(r.result, s.name).toBe(ok ? 'applied' : 'refused');
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
      expect(
        participantTabChange(tab, { ...tab, ...meta } as Tab, ME),
        JSON.stringify(meta),
      ).toBeNull();
    }
  });
});
