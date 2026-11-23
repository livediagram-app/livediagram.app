import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/knowledge-labels', () => ({
  apiCreateLabel: vi.fn(),
  apiUpdateLabel: vi.fn(),
  apiDeleteLabel: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({ offlineSaveDocumentMeta: vi.fn() }));

import type { KnowledgeLabel } from '@liveknowledge/document';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { createKnowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import {
  LabelRefusedError,
  changeLabels,
  labelFailureText,
  type LabelDoors,
  type LabelTarget,
} from './label-writes';
import { chosenOf, createLabelSelectionStore, labelNamesText } from './label-selection-store';

// Page labels in the editor (docs/specs/030-knowledgebase/page-surface.md "Page labels"): the one optimistic write of
// the knowledgebase's labels, and the choices (the tree's filter, Answer From) held for the browser tab.
const NOW = Date.UTC(2026, 10, 23, 12);
const eng: KnowledgeLabel = { id: 'lbl_eng', name: 'Engineering', colour: 'blue' };
const who = { ownerId: 'u1', shareCode: null };
const target = (over: Partial<LabelTarget> = {}): LabelTarget => ({
  who,
  documentId: 'd1',
  offline: false,
  ...over,
});

function doorsOf(over: Partial<LabelDoors> = {}): LabelDoors {
  const store = createKnowledgeSettingsStore();
  store.setLabels('d1', [eng]);
  // The api answers the list the change makes, as stored.
  const answer = () => ({ labels: [...store.labelsOf('d1')] });
  return {
    create: vi.fn(async () => answer()),
    update: vi.fn(async () => answer()),
    remove: vi.fn(async () => answer()),
    saveOffline: vi.fn(async () => {}),
    store,
    ...over,
  };
}

describe('changing the labels', () => {
  it('shows a new label at once, sends it with its id, and answers it', async () => {
    const doors = doorsOf();
    let seen: readonly KnowledgeLabel[] = [];
    doors.create = vi.fn(async () => {
      seen = doors.store.labelsOf('d1');
      return { labels: [...seen] };
    });
    const made = await changeLabels(
      target(),
      { kind: 'add', id: 'lbl_new', name: ' Onboarding ', colour: 'green' },
      NOW,
      doors,
    );
    expect(made).toEqual({ id: 'lbl_new', name: 'Onboarding', colour: 'green' });
    expect(seen.map((l) => l.name)).toEqual(['Engineering', 'Onboarding']);
    expect(doors.create).toHaveBeenCalledWith(who, 'd1', {
      id: 'lbl_new',
      name: 'Onboarding',
      colour: 'green',
    });
  });

  it('renames, recolours and deletes in one request each, and holds what the api answers', async () => {
    const doors = doorsOf();
    await changeLabels(target(), { kind: 'rename', id: 'lbl_eng', name: 'Platform' }, NOW, doors);
    expect(doors.update).toHaveBeenLastCalledWith(who, 'd1', 'lbl_eng', { name: 'Platform' });
    await changeLabels(
      target(),
      { kind: 'recolour', id: 'lbl_eng', colour: '#AA0000' },
      NOW,
      doors,
    );
    expect(doors.update).toHaveBeenLastCalledWith(who, 'd1', 'lbl_eng', { colour: '#AA0000' });
    expect(doors.store.labelsOf('d1')).toEqual([{ ...eng, name: 'Platform', colour: '#aa0000' }]);
    doors.remove = vi.fn(async () => ({ labels: [] }));
    expect(
      await changeLabels(target(), { kind: 'delete', id: 'lbl_eng' }, NOW, doors),
    ).toBeUndefined();
    expect(doors.remove).toHaveBeenCalledWith(who, 'd1', 'lbl_eng');
    expect(doors.store.labelsOf('d1')).toEqual([]);
  });

  it('refuses what it can judge before sending, by name', async () => {
    const doors = doorsOf();
    const refused = changeLabels(
      target(),
      { kind: 'add', id: 'lbl_x', name: 'engineering', colour: 'red' },
      NOW,
      doors,
    );
    await expect(refused).rejects.toBeInstanceOf(LabelRefusedError);
    await refused.catch((err: LabelRefusedError) => expect(err.refusal).toBe('label_name_taken'));
    expect(doors.create).not.toHaveBeenCalled();
  });

  it('puts the labels back when the server refuses, unless something newer has changed them', async () => {
    const refusal = new ApiError('update label', 403, 'forbidden');
    const doors = doorsOf({ update: vi.fn().mockRejectedValue(refusal) });
    await expect(
      changeLabels(target(), { kind: 'rename', id: 'lbl_eng', name: 'X' }, NOW, doors),
    ).rejects.toBe(refusal);
    expect(doors.store.labelsOf('d1')).toEqual([eng]);

    let fail: (err: Error) => void = () => {};
    doors.update = vi.fn(() => new Promise<never>((_resolve, reject) => (fail = reject)));
    const first = changeLabels(target(), { kind: 'rename', id: 'lbl_eng', name: 'Y' }, NOW, doors);
    doors.store.setLabels('d1', [{ ...eng, name: 'Newer' }]);
    fail(new Error('down'));
    await expect(first).rejects.toThrow('down');
    expect(doors.store.labelsOf('d1')[0]!.name).toBe('Newer');
  });

  it('writes a knowledgebase kept Offline to its record, and asks no server', async () => {
    const doors = doorsOf();
    await changeLabels(
      target({ offline: true }),
      { kind: 'recolour', id: 'lbl_eng', colour: 'pink' },
      NOW,
      doors,
    );
    expect(doors.saveOffline).toHaveBeenCalledWith(
      'd1',
      { knowledgeSettings: { labels: [{ ...eng, colour: 'pink' }] } },
      NOW,
    );
    expect(doors.update).not.toHaveBeenCalled();
  });

  it('says a failure in words', () => {
    expect(labelFailureText(new LabelRefusedError('label_limit'))).toMatch(/100 labels/);
    expect(labelFailureText(new ApiError('x', 409, 'label_name_taken'))).toBe(
      'A label is already called that.',
    );
    expect(labelFailureText(new ApiError('x', 403, 'forbidden'))).toMatch(
      /Editor or a Participant/,
    );
    expect(labelFailureText(new Error('down'))).toMatch(/could not be saved/);
  });
});

describe('the label choices', () => {
  it('holds a choice per knowledgebase, one list until it changes, and tells its readers', () => {
    const store = createLabelSelectionStore();
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    expect(store.idsOf('d1')).toEqual([]);
    expect(store.idsOf(null)).toBe(store.idsOf('d9'));
    store.toggle('d1', 'a');
    store.toggle('d1', 'b');
    const held = store.idsOf('d1');
    expect(held).toEqual(['a', 'b']);
    store.set('d1', ['a', 'b']);
    expect(store.idsOf('d1')).toBe(held);
    store.toggle('d1', 'a');
    expect(store.idsOf('d1')).toEqual(['b']);
    expect(store.idsOf('d2')).toEqual([]);
    store.clear('d1');
    expect(store.idsOf('d1')).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(4);
    stop();
    store.toggle('d1', 'z');
    expect(heard).toHaveBeenCalledTimes(4);
  });

  it('counts each ask to be shown, even of the same choice', () => {
    const store = createLabelSelectionStore();
    store.set('d1', ['a'], true);
    store.set('d1', ['a'], true);
    expect(store.revealCount()).toBe(2);
    store.set('d1', ['b']);
    expect(store.revealCount()).toBe(2);
    store.reset();
    expect([store.revealCount(), store.idsOf('d1')]).toEqual([0, []]);
  });

  it('reads only the chosen labels that still exist, and names them', () => {
    const onb = { id: 'lbl_onb', name: 'Onboarding', colour: 'green' };
    expect(chosenOf(['lbl_onb', 'gone', 'lbl_eng'], [eng, onb])).toEqual([onb, eng]);
    expect(chosenOf([], [eng])).toEqual([]);
    expect(labelNamesText([eng, onb])).toBe('Engineering, Onboarding');
  });
});
