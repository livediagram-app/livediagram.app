import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationStepDoorCall } from '@liveworkspace/index-client';
import { automationTabTemplates } from '@livediagram/templates';
import { box, DOC, ANA, roomWorld, type RoomWorld } from './test-automation-world';

// Add a Tab to a Document, a rule's step from another app (docs/specs/013-workspace/automations.md "Steps in other
// apps"): a tab from the template, named by the rule, made as its author through this app's own Add a Tab.

afterEach(() => {
  vi.restoreAllMocks();
});

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([{ id: 't1', name: 'Overview', elements: [box('a', 'Checkout')] }]);
  return w;
}

const template = () => automationTabTemplates()[0]!.id;
const call = (over: Record<string, unknown> = {}): AutomationStepDoorCall => ({
  author: ANA,
  rule: { id: 'r1', name: 'Card Done', app: 'liveplanner', item: 'p1' },
  from: { title: 'Launch', url: 'https://liveplanner.app/plan/p1' },
  chain: { id: 'c1', hops: 1, rules: ['liveplanner:p1:r1'] },
  step: {
    kind: 'doc_tab',
    target: { app: 'livediagram', item: DOC, title: 'Studio' },
    docTemplate: template(),
    name: 'Release Notes',
    ...over,
  },
});

describe('Add a Tab to a Document', () => {
  it('adds the tab from the template as the author, and offers the templates to the pickers', async () => {
    const w = await started();
    expect(await w.room.automationStep(DOC, call())).toMatchObject({
      ok: true,
      text: 'Added a tab “Release Notes” to “Studio”',
    });
    expect(w.rows('SELECT name FROM tabs ORDER BY name')).toEqual(
      expect.arrayContaining([{ name: 'Release Notes' }]),
    );
    const { templates } = await w.room.automationTarget(DOC);
    expect(templates?.length).toBeGreaterThan(0);
  });

  it('answers a template gone, and a step it does not take', async () => {
    const w = await started();
    expect(
      await w.room.automationStep(DOC, call({ docTemplate: 'no-such-template' })),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await w.room.automationStep(DOC, { ...call(), step: { kind: 'space_post' } } as never),
    ).toMatchObject({ ok: false, code: 'invalid' });
  });
});
