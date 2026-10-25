// The planner with a fake splitter in place of the real one: what the plan hands the splitter (the hooks, wired to
// product code; the people; which app keeps each document, from the first pass) and what it does with any answer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  MigrationRoomPayload,
  OldDocumentInput,
  SplitHooks,
  SplitResult,
} from '@liveworkspace/migration';
import { uuidFromSeed } from '../src/ids.ts';
import { DAY, GUEST_A, NOW, putDocument } from './fixture.ts';
import { planScenario } from './helpers.ts';
import { scenario } from './scenario.ts';

const payload = (
  input: OldDocumentInput,
  app: MigrationRoomPayload['app'],
  id: string,
  tabs = input.tabs,
): MigrationRoomPayload => ({
  v: 1,
  app,
  id,
  name: input.document.name,
  ownerId: 'user_ali',
  teamId: input.document.teamId,
  createdAt: input.document.createdAt,
  savedAt: input.document.savedAt,
  source: null,
  presentation: null,
  opensIn: null,
  tabKind: null,
  tabs: tabs.map((t) => ({
    id: t.id,
    name: t.name,
    orderIndex: t.orderIndex,
    folder: t.folder,
    addedAt: t.addedAt,
    updatedAt: t.updatedAt,
    data: t.data,
    elementCount: t.elementCount ?? 0,
  })),
  changesets: [],
  imageGrants: [],
  imageOwners: [],
  plan: null,
});

describe('the planner, with a fake splitter', () => {
  it('hands the splitter the real hooks, the people and a first pass of which app keeps each id', async () => {
    const seen: { input: OldDocumentInput; hooks: SplitHooks }[] = [];
    const split = (input: OldDocumentInput, hooks: SplitHooks): SplitResult => {
      seen.push({ input, hooks });
      const app = input.document.id === 'doc-slides' ? 'livedocuments' : 'livediagram';
      return {
        parts: [payload(input, app, input.document.id)],
        moved: null,
        crossReferences: [],
        notes: [],
      };
    };
    await planScenario(scenario(), { split });
    // The first pass split only what could leave livediagram (a document with Pages or Plan content, or no tabs).
    const ids = seen.map((s) => s.input.document.id);
    const firstPass = ids.slice(0, ids.length - 5);
    expect(firstPass.sort()).toEqual(['doc-mixed', 'doc-slides']);
    const { hooks, input } = seen.find(
      (s) => s.input.document.id === 'doc-mixed' && s.hooks.keptByOf,
    )!;
    expect(hooks.keptByOf!('doc-slides')).toBe('livedocuments');
    expect(hooks.keptByOf!('doc-diagram')).toBeNull();
    expect(hooks.newId('doc-mixed:liveplanner')).toBe(uuidFromSeed('doc-mixed:liveplanner'));
    expect(hooks.ownerOf('user_bo')).toBe('user_newbo');
    expect(hooks.ownerOf(GUEST_A)).toBe(`guest_${GUEST_A}`);
    expect(hooks.imageOwner('img-1')).toBe('user_ali');
    expect(hooks.imageOwner('nope')).toBeNull();
    // livediagram's stored-tab upgrades, without the Pages drop.
    const upgraded = hooks.upgradeTab({
      opensIn: 'pages',
      pages: [{ id: 'p', kind: 'slide' }],
      elements: [],
    });
    expect(upgraded.pages).toEqual([{ id: 'p', kind: 'slide' }]);
    expect(
      hooks.pageRects({
        opensIn: 'pages',
        pages: [{ id: 'p', orientation: 'landscape', kind: 'slide', size: 'slide-16-9' }],
        elements: [],
      }),
    ).toHaveLength(1);
    // Everyone who may have written its cards: the owner, the team, the people it was shared with.
    expect(input.people).toEqual(['user_ali', 'user_bo', 'user_cy']);
  });

  it('reports a picture it could not draw and leaves the slot empty', async () => {
    const old = scenario();
    putDocument(old, { id: 'doc-pic', owner_id: GUEST_A, saved_at: NOW - DAY }, [
      {
        id: 'tq',
        body: {
          elements: [{ id: 'slot', type: 'image', x: 0, y: 0, width: 1, height: 1, imageId: null }],
        },
      },
    ]);
    const split = (input: OldDocumentInput): SplitResult => ({
      parts: [payload(input, 'livediagram', input.document.id)],
      moved: null,
      crossReferences:
        input.document.id === 'doc-pic'
          ? [
              {
                from: { app: 'livediagram', id: 'doc-pic', tabId: 'tq', elementId: 'slot' },
                to: { app: 'liveplanner', id: 'x', tabId: null },
                kind: 'plan-element',
                picture: { tabId: 'gone', elementId: null },
              },
            ]
          : [],
      notes: [],
    });
    const { outDir } = await planScenario(old, {
      split,
      drawPicture: async () => Promise.resolve(null),
    });
    const report = JSON.parse(readFileSync(join(outDir, 'report.json'), 'utf8')) as {
      picturesMissing: { items: unknown[] };
    };
    expect(report.picturesMissing.items).toEqual([
      { document: 'doc-pic', tabId: 'gone', elementId: null },
    ]);
    const room = JSON.parse(
      readFileSync(join(outDir, 'rooms', 'livediagram', 'doc-pic.json'), 'utf8'),
    ) as MigrationRoomPayload;
    expect(room.imageOwners).toEqual([]);
    expect(JSON.parse(room.tabs[0]!.data)).toEqual({
      elements: [{ id: 'slot', type: 'image', x: 0, y: 0, width: 1, height: 1, imageId: null }],
    });
  });
});
