import { describe, expect, it } from 'vitest';
import { dropRetiredNoteElements, dropRetiredNotes, isRetiredNote } from './retired-notes';
import { migrateIncomingElements, migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { createShape, createSticky, createText } from './factories';
import type { Tab } from './index';
import { cpuBudgetMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';

// docs/specs/002-project-scope/not-in-livehuddle.md "The Write category": a stored text or sticky note is dropped
// when its tab is read, and nothing brings one in.

const desk = { ...createShape('desk', 0, 0), id: 'desk' };
const text = { ...createText(10, 10), id: 'text', label: 'Welcome' };
const sticky = { ...createSticky(20, 20), id: 'sticky', label: 'This week' };

describe('dropRetiredNotes', () => {
  it('names texts and sticky notes alone', () => {
    expect(isRetiredNote(text)).toBe(true);
    expect(isRetiredNote(sticky)).toBe(true);
    expect(isRetiredNote(desk)).toBe(false);
    expect(isRetiredNote({ type: 'image' })).toBe(false);
    expect(isRetiredNote(null)).toBe(false);
    expect(isRetiredNote('text')).toBe(false);
  });

  it('hands back the same tab and array when there is nothing to drop', () => {
    const tab = { id: 't', name: 'T', elements: [desk] };
    expect(dropRetiredNotes(tab)).toBe(tab);
    expect(dropRetiredNoteElements(tab.elements)).toBe(tab.elements);
    const bare = { id: 't' };
    expect(dropRetiredNotes(bare)).toBe(bare);
  });

  it('drops every text and sticky note and keeps the rest in order', () => {
    const tab = { id: 't', name: 'T', elements: [text, desk, sticky] };
    expect(dropRetiredNotes(tab)).toEqual({ id: 't', name: 'T', elements: [desk] });
    expect(tab.elements).toHaveLength(3);
  });

  it('leaves an arrow pinned to a dropped note exactly as stored', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'sticky', anchor: 'e' },
      to: { kind: 'free', x: 400, y: 0 },
    };
    const out = dropRetiredNotes({ elements: [sticky, arrow] });
    expect(out.elements).toEqual([arrow]);
    expect(out.elements[0]).toBe(arrow);
  });

  it('runs in the stored-tab migration and on incoming tabs and elements', () => {
    expect(migrateStoredTab({ elements: [text, desk, sticky] } as unknown as Tab).elements).toEqual(
      [desk],
    );
    expect(
      (
        migrateIncomingTab({ id: 't', name: 'T', elements: [sticky, desk] }) as {
          elements: unknown[];
        }
      ).elements,
    ).toEqual([desk]);
    expect(migrateIncomingElements([text, desk, 'x', sticky])).toEqual([desk]);
  });

  it('reads a 5,000-element tab within budget', () => {
    const elements = Array.from({ length: 5000 }, (_, i) =>
      i % 10 === 0 ? { ...sticky, id: `s${i}` } : { ...desk, id: `d${i}` },
    );
    const clean = elements.filter((el) => el.type !== 'sticky');
    let dropped = { elements };
    let same = { elements: clean };
    const dropMs = cpuLeastMsOf(() => {
      dropped = dropRetiredNotes({ elements });
    });
    const sameMs = cpuLeastMsOf(() => {
      same = dropRetiredNotes({ elements: clean });
    });
    expect(dropped.elements).toHaveLength(4500);
    expect(same.elements).toBe(clean);
    // Measured about 0.1 ms each on an M-series laptop; 50 ms of CPU time is a generous ceiling.
    expect(dropMs).toBeLessThan(cpuBudgetMs(50));
    expect(sameMs).toBeLessThan(cpuBudgetMs(50));
  });
});
