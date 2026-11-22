import { describe, expect, it } from 'vitest';
import { newArticleNote } from './article-notes';
import { ELEMENT_FIELD_NAMES } from './element-fields';
import {
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
import { applyParticipantOp, participantTabChange } from './participant-content';
import { createShape } from './shape-factory';
import { ELEMENT_TYPES, isValidElement } from './validate';

// The participant content rule never leaks (docs/specs/013-workspace/share-roles.md "What a Participant changes").
// For one valid element of every type, every stored field is offered several new values by a Participant. Whatever
// the room does, no field outside the spec's list of text fields for that element may change. The lists below ARE
// the spec's table: widening what a Participant may do means editing them here, on purpose, in the same change as
// the spec.

type Bag = Record<string, unknown>;
type Sample = { name: string; el: Element; allowed: readonly string[] };

const at = (el: Element, id: string): Element => ({ ...el, id });

const SAMPLES: Sample[] = [
  {
    name: 'shape (square)',
    el: at(createShape('square', 0, 0), 'sq'),
    allowed: ['label', 'richText', 'code', 'pageTitle', 'pageSubtitle'],
  },
  { name: 'text', el: at(createText(0, 0), 'tx'), allowed: ['label', 'richText'] },
  {
    name: 'text (sizes to its words)',
    el: at({ ...createText(0, 0), sizing: 'fit' }, 'tf'),
    allowed: ['label', 'richText', 'width', 'height'],
  },
  { name: 'table', el: at(createTable(0, 0), 'tb'), allowed: ['label', 'cells'] },
  { name: 'sticky', el: at(createSticky(0, 0), 'st'), allowed: ['label', 'richText'] },
  { name: 'image', el: at(createImage(0, 0), 'im'), allowed: ['label', 'alt'] },
  {
    name: 'freehand',
    el: at(
      createFreehand(
        [
          { x: 0, y: 0 },
          { x: 40, y: 20 },
        ],
        false,
      ),
      'fh',
    ),
    allowed: ['label'],
  },
  // A margin note's marker holds no words of its own: its comments are a thread.
  { name: 'article note', el: newArticleNote('an', 'comment', { x: 0, y: 0 }), allowed: [] },
  { name: 'link card', el: at(createLinkCard(0, 0), 'lc'), allowed: ['label'] },
  { name: 'video', el: at(createVideo(0, 0), 'vi'), allowed: ['label'] },
  { name: 'arrow (free)', el: at(createArrow(0, 0, 100, 100), 'af'), allowed: ['label'] },
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
        if (field === 'id' || field === 'type') continue;
        for (const value of offers(stored[field])) {
          const incoming = { ...stored, [field]: value };
          if (value === undefined) delete incoming[field];
          const r = applyParticipantOp(tab, { kind: 'update', element: incoming as Element });
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
        }
      }
      // Not vacuous: something the list allows does land.
      if (sample.allowed.length > 0) expect(landed, sample.name).toBeGreaterThan(0);
    });
  }

  it('lets no add, remove or reorder through', () => {
    for (const s of SAMPLES) {
      const fresh = { ...(s.el as Bag), id: `new-${s.el.id}` } as Element;
      const empty = { id: 't', name: 't', elements: [] } as Tab;
      expect(applyParticipantOp(empty, { kind: 'add', element: fresh, at: 0 }).result, s.name).toBe(
        'refused',
      );
      const tab = tabFor(s);
      expect(applyParticipantOp(tab, { kind: 'remove', id: s.el.id }).result, s.name).toBe(
        'refused',
      );
    }
    const both = { id: 't', name: 't', elements: SAMPLES.slice(0, 2).map((s) => s.el) } as Tab;
    const ids = both.elements.map((e) => e.id).reverse();
    expect(applyParticipantOp(both, { kind: 'reorder', ids }).result).toBe('refused');
  });

  it("never changes a tab's own fields", () => {
    const tab = tabFor(SAMPLES[4]!);
    for (const meta of [
      { name: 'Renamed' },
      { mode: 'draw' },
      { theme: 'dark' },
      { locked: true },
    ]) {
      expect(participantTabChange(tab, { ...tab, ...meta }), JSON.stringify(meta)).toBeNull();
    }
  });
});
