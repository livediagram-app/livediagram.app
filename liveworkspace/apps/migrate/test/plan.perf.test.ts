// Plan time on a generated old site of 10,000 documents (the brief: up to ~100k documents and 50k images in
// production, so this is a tenth): a budget that keeps the plan linear, with the measured time printed.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createPictureDrawer } from '../src/pictures.ts';
import { DAY, NOW, oldDatabase, put, shape } from './fixture.ts';
import { fakeDrawer, planScenario } from './helpers.ts';

const DOCS = 10_000;
// Generous for a laptop under load; a quadratic step would blow far past it.
const BUDGET_MS = 90_000;

function generated() {
  const db = oldDatabase();
  db.exec('BEGIN');
  const owners = Array.from({ length: 500 }, (_, i) => `user_${String(i).padStart(4, '0')}`);
  for (let i = 0; i < DOCS; i++) {
    const id = `doc-${String(i).padStart(6, '0')}`;
    const owner = owners[i % owners.length]!;
    put(db, 'documents', {
      id,
      owner_id: owner,
      name: `Document ${i}`,
      saved_at: NOW - (i % 90) * DAY,
      created_at: NOW - 100 * DAY,
    });
    const tabs: Record<string, unknown>[] = [
      { elements: Array.from({ length: 20 }, (_, e) => shape(`s${e}`, e * 140, 0)) },
    ];
    // One in ten has a slide deck with a tab window onto its diagram (a split and a picture); one in twenty a board.
    if (i % 10 === 0) {
      tabs.push({
        opensIn: 'pages',
        pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide', size: 'slide-16-9' }],
        elements: [
          {
            ...shape('w', 0, 0),
            shape: 'tab-window',
            windowTabId: `${id}-t0`,
            width: 640,
            height: 360,
          },
        ],
      });
    }
    if (i % 20 === 0)
      tabs.push({
        kind: 'board',
        opensIn: 'plan',
        elements: [{ ...shape('b', 0, 0), shape: 'plan-board', planBoard: { columns: [] } }],
      });
    tabs.forEach((body, t) => {
      put(db, 'tabs', {
        id: `${id}-t${t}`,
        name: `Tab ${t}`,
        data: JSON.stringify(body),
        updated_at: NOW - DAY,
      });
      put(db, 'document_tabs', {
        document_id: id,
        tab_id: `${id}-t${t}`,
        order_index: t,
        added_at: NOW - DAY,
      });
    });
    if (i % 20 === 0) {
      for (let c = 0; c < 10; c++) {
        put(db, 'items', {
          document_id: id,
          id: `c${c}`,
          type: 'task',
          item_key: c + 1,
          rank: `a${c}`,
          fields: '{"title":"Card"}',
          rev: 1,
          created_at: NOW,
          updated_at: NOW,
          created_by: '{}',
          updated_by: '{}',
        });
      }
    }
    put(db, 'document_opens', {
      owner_id: owners[(i + 1) % owners.length]!,
      document_id: id,
      last_opened_at: NOW - (i % 120) * DAY,
      last_open_day: '2026-09-01',
    });
    put(db, 'share_links', {
      code: `CODE${String(i).padStart(10, '0')}`,
      document_id: id,
      role: 'view',
      created_at: NOW - DAY,
    });
    if (i % 2 === 0) {
      put(db, 'images', {
        id: `img-${i}`,
        owner_id: owner,
        content_type: 'image/png',
        byte_size: 10,
        width: 1,
        height: 1,
        sha256: `sha-${i}`,
        original_name: null,
        created_at: NOW,
      });
    }
  }
  db.exec('COMMIT');
  return db;
}

it(`plans ${DOCS} documents within budget`, { timeout: BUDGET_MS * 2 }, async () => {
  const db = generated();
  const heapBefore = process.memoryUsage().heapUsed;
  const { ms, manifest, outDir, report } = await planScenario(db, { drawPicture: fakeDrawer });
  const heapAfter = process.memoryUsage().heapUsed;
  const rooms = readdirSync(join(outDir, 'rooms', 'livediagram')).length;
  console.log(
    `plan: ${DOCS} documents in ${Math.round(ms)} ms (${(ms / DOCS).toFixed(2)} ms each), ` +
      `${report.counts['pictures']} pictures, ${manifest.steps.flatMap((s) => (s.step === 'sql' ? s.files : [])).length} SQL files, ` +
      `heap +${Math.round((heapAfter - heapBefore) / 1e6)} MB`,
  );
  expect(rooms).toBe(DOCS);
  expect(ms).toBeLessThan(BUDGET_MS);
});

it('draws a picture in bounded time', { timeout: 60_000 }, async () => {
  const draw = createPictureDrawer();
  const inputOf = (count: number) => ({
    document: {
      id: 'd',
      ownerId: 'user_a',
      name: 'D',
      teamId: null,
      source: null,
      presentation: null,
      savedAt: NOW,
      createdAt: NOW,
      trashedAt: null,
      opensIn: null,
      tabKind: null,
      templateFamily: null,
    },
    tabs: [
      {
        id: 't',
        name: 'T',
        data: JSON.stringify({
          elements: Array.from({ length: count }, (_, e) =>
            shape(`s${e}`, (e % 20) * 140, Math.floor(e / 20) * 90),
          ),
        }),
        updatedAt: NOW,
        orderIndex: 0,
        addedAt: NOW,
        folder: null,
        elementCount: count,
      },
    ],
    plan: null,
    changesets: [],
    imageGrants: [],
  });
  const upgrade = (b: Record<string, unknown>) => b;
  await draw(inputOf(1), { tabId: 't', elementId: null }, upgrade); // loads resvg and the fonts once
  for (const count of [20, 200]) {
    const input = inputOf(count);
    const started = performance.now();
    const n = 10;
    for (let i = 0; i < n; i++) await draw(input, { tabId: 't', elementId: null }, upgrade);
    const each = (performance.now() - started) / n;
    console.log(`picture: a ${count}-element tab in ${each.toFixed(1)} ms`);
    expect(each).toBeLessThan(2_000);
  }
});
