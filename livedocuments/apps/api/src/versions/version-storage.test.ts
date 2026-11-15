import { describe, expect, it } from 'vitest';
import {
  MAX_TAB_BYTES,
  VERSION_AUTO_MAX,
  VERSION_AUTO_MAX_BYTES,
  VERSION_IDLE_MS,
} from '@livedocuments/api-schema';
import type { Element } from '@livedocuments/document';
import { buildTemplate } from '@livedocuments/templates';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1 } from '../test-sqlite-d1';

// What versions cost (docs/specs/006-document/version-history.md "What it costs"): the stored body of a typical tab
// and of a large one, measured as a version stores it (the tab row's `data`), and what the bounds then let a tab hold.
// The numbers in the spec come from this test's log; the assertions keep them from drifting far.

const bytesOf = (text: string) => new TextEncoder().encode(text).length;

// A typical tab: the slide-deck template's twelve slides, each with ten elements (the built deck's own elements
// repeated across slides, as a written deck repeats its layout).
function typicalTab(): string {
  const deck = buildTemplate('slide-deck', 0, 0);
  const elements: Element[] = [];
  for (let slide = 0; slide < 12; slide += 1) {
    for (let i = 0; i < 10; i += 1) {
      const base = deck[(slide * 10 + i) % deck.length]!;
      elements.push({ ...base, id: `s${slide}-${i}`, y: base.y + slide * 1200 } as Element);
    }
  }
  const pages = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, orientation: 'landscape' }));
  return JSON.stringify({ elements, pages, theme: 'ocean' });
}

// A large tab: a 30-page article of 600 paragraphs (about 45 words each) with 60 elements on its pages.
function largeTab(): string {
  const words =
    'The quarterly review covers revenue, retention, hiring and the roadmap, with notes from each team on what ' +
    'moved, what slipped and what we will change next quarter as a result of it';
  const blocks = Array.from({ length: 600 }, (_, i) => ({
    id: `b${i}`,
    type: 'paragraph',
    runs: [{ text: `${i}. ${words}` }],
  }));
  const deck = buildTemplate('slide-deck', 0, 0);
  const elements = Array.from({ length: 60 }, (_, i) => ({
    ...deck[i % deck.length]!,
    id: `e${i}`,
  }));
  const pages = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`,
    orientation: 'portrait',
    flow: 'f1',
  }));
  return JSON.stringify({ elements, pages, articles: { f1: { blocks } } });
}

describe('what a version costs', () => {
  it('measures a typical and a large tab, and what the bounds let a tab keep', () => {
    const typical = bytesOf(typicalTab());
    const large = bytesOf(largeTab());
    const keep = (bytes: number) =>
      Math.min(VERSION_AUTO_MAX, Math.floor(VERSION_AUTO_MAX_BYTES / bytes));
    console.info('[versions] storage', {
      typicalKB: Math.round(typical / 1024),
      typicalKept: keep(typical),
      typicalAtCapMB: +((keep(typical) * typical) / 1024 / 1024).toFixed(1),
      largeKB: Math.round(large / 1024),
      largeKept: keep(large),
      largeAtCapMB: +((keep(large) * large) / 1024 / 1024).toFixed(1),
      largestTabKept: keep(MAX_TAB_BYTES),
    });
    // A typical tab keeps the full count; the largest tab stays under the byte cap.
    expect(keep(typical)).toBe(VERSION_AUTO_MAX);
    expect(typical).toBeLessThan(200 * 1024);
    expect(large).toBeGreaterThan(typical);
    expect(keep(MAX_TAB_BYTES) * MAX_TAB_BYTES).toBeLessThanOrEqual(VERSION_AUTO_MAX_BYTES);
  });

  it('keeps a version of the largest tab in well under a save’s budget', () => {
    const db = sqliteD1();
    db.sql
      .prepare(
        "INSERT INTO document (id, saved_at, created_at, name, owner_id) VALUES ('D', 0, 1, '', 'o')",
      )
      .run();
    const big = JSON.stringify({ elements: [], note: 'x'.repeat(MAX_TAB_BYTES - 64) });
    db.sql
      .prepare(
        "INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('t', 'T', ?, 1, 0, 1)",
      )
      .run(big);
    const update = db.sql.prepare(
      "UPDATE tabs SET data = ?, updated_at = ?, rev = rev + 1 WHERE id = 't'",
    );
    // The same write without a pause (no copy) and after one (a 2 MB copy): the copy's own cost is the difference.
    const plain = cpuMsOf(() => update.run(big.replace('x', 'y'), 2));
    const kept = cpuMsOf(() => update.run(big.replace('x', 'z'), 2 + VERSION_IDLE_MS));
    console.info('[versions] keep cost', { plainMs: plain, keptMs: kept });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM tab_versions').get()).toEqual({ n: 1 });
    expect(kept).toBeLessThan(cpuBudgetMs(250));
  });
});
