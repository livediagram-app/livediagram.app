import { describe, expect, it } from 'vitest';
import type { DesignComponent } from '@livedesign/design';
import { sqliteD1 } from '../test-sqlite-d1';
import { putComponent, readComponents } from '../db/components';
import { sharedTabComponents, takeSharedTabComponents } from './component-share';

// The mains a shared tab carries (docs/specs/009-elements/components.md "Sharing, collaboration and storage"): what a
// body sends, and what a design taking it in keeps. The round trip between two designs is in
// design-room-store.test.ts.

const main = (id: string, label = 'x'): DesignComponent => ({
  id,
  name: id,
  width: 10,
  height: 10,
  elements: [{ id: 'e', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }],
  updatedAt: 1,
});

const body = (...componentIds: string[]) =>
  JSON.stringify({
    elements: componentIds.map((componentId, i) => ({
      id: `i${i}`,
      type: 'shape',
      shape: 'instance',
      componentId,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })),
  });

describe('what a shared body carries', () => {
  it('sends the mains its instances use, within the budget', async () => {
    const db = sqliteD1();
    await putComponent(db.env, main('a', 'x'.repeat(500)));
    await putComponent(db.env, main('b'));
    await putComponent(db.env, main('unused'));
    expect((await sharedTabComponents(db.env, body('a', 'b'))).map((m) => m.id)).toEqual([
      'a',
      'b',
    ]);
    // Past the budget a main stays behind; a smaller one after it still goes.
    expect((await sharedTabComponents(db.env, body('a', 'b'), 400)).map((m) => m.id)).toEqual([
      'b',
    ]);
    expect(await sharedTabComponents(db.env, body())).toEqual([]);
  });
});

describe('what a design taking a body in keeps', () => {
  it('takes only well-formed mains the body uses', async () => {
    const db = sqliteD1();
    expect(takeSharedTabComponents(db.env, body('a'), undefined)).toEqual([]);
    expect(takeSharedTabComponents(db.env, body('a'), [])).toEqual([]);
    const big: DesignComponent = {
      ...main('big'),
      elements: Array.from({ length: 200 }, (_, i) => ({
        ...main('big').elements[0]!,
        id: `e${i}`,
        label: 'x'.repeat(1_400),
      })),
    };
    const statements = takeSharedTabComponents(db.env, body('a', 'big'), [
      main('a'),
      big,
      main('not-used'),
      { id: 'a', name: '' },
      'junk',
    ]);
    await db.env.DESIGN_DB.batch(statements);
    expect((await readComponents(db.env)).map((m) => m.id)).toEqual(['a']);
  });
});
