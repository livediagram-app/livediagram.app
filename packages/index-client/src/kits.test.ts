import { describe, expect, it } from 'vitest';
import { APP_LINK_LEVELS } from './constants';
import {
  isKitId,
  kitById,
  kitPartsOf,
  kitPartTitle,
  kitPassLevel,
  KIT_IDS,
  KIT_NAME_MAX,
  KIT_PARTS_MAX,
  KIT_TEMPLATE_MAX,
  KITS,
  readKitRemoveInput,
  readKitStartInput,
} from './kits';

describe('the kit catalogue', () => {
  it('lists every kit once, in KIT_IDS order', () => {
    expect(KITS.map((k) => k.id)).toEqual([...KIT_IDS]);
  });

  it('gives each kit 2 to KIT_PARTS_MAX parts, each in its own app, with distinct slots', () => {
    for (const kit of KITS) {
      expect(kit.parts.length).toBeGreaterThanOrEqual(2);
      expect(kit.parts.length).toBeLessThanOrEqual(KIT_PARTS_MAX);
      expect(new Set(kit.parts.map((p) => p.app)).size).toBe(kit.parts.length);
      expect(new Set(kit.parts.map((p) => p.slot)).size).toBe(kit.parts.length);
      expect(kit.title.trim()).toBe(kit.title);
      expect(kit.summary.length).toBeGreaterThan(0);
      for (const part of kit.parts) {
        expect(part.template.length).toBeLessThanOrEqual(KIT_TEMPLATE_MAX);
        expect(part.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('finds a kit and an app’s parts', () => {
    expect(isKitId('website-build')).toBe(true);
    expect(isKitId('nope')).toBe(false);
    expect(kitById('website-build').parts).toHaveLength(3);
    expect(kitPartsOf('livedesign').map((p) => p.template)).toEqual(['wireframe-website']);
    expect(kitPartsOf('liveplanner').length).toBe(KITS.length);
  });

  it('names a part after its project', () => {
    expect(kitPartTitle('Apollo', kitById('software-project').parts[0]!)).toBe('Apollo Plan');
  });
});

describe('kitPassLevel', () => {
  it('keeps a role the app offers', () => {
    for (const level of ['edit', 'participate', 'view'] as const)
      expect(kitPassLevel('livediagram', level)).toBe(level);
  });

  it('takes the nearest offered role below one the app lacks', () => {
    expect(APP_LINK_LEVELS.livehuddle).not.toContain('view');
    expect(kitPassLevel('livehuddle', 'view')).toBe('participate');
    expect(kitPassLevel('livehuddle', 'edit')).toBe('edit');
  });
});

describe('readKitStartInput', () => {
  const good = { kit: 'website-build', level: 'edit', name: '  Apollo  ' };

  it('reads a first run, trimming the name', () => {
    expect(readKitStartInput(good)).toEqual({
      kit: 'website-build',
      level: 'edit',
      name: 'Apollo',
    });
  });

  it('reads a retry with its folder and what was made', () => {
    expect(readKitStartInput({ ...good, folderId: 'f1', made: { board: 'i1' } })).toEqual({
      kit: 'website-build',
      level: 'edit',
      name: 'Apollo',
      folderId: 'f1',
      made: { board: 'i1' },
    });
    expect(readKitStartInput({ ...good, folderId: 'f1' })).toMatchObject({ made: {} });
  });

  it('refuses anything malformed', () => {
    for (const bad of [
      null,
      [],
      'kit',
      { ...good, kit: 'nope' },
      { ...good, level: 'owner' },
      { ...good, level: 3 },
      { ...good, name: '   ' },
      { ...good, name: 4 },
      { ...good, name: 'x'.repeat(KIT_NAME_MAX + 1) },
      { ...good, made: { board: 'i1' } },
      { ...good, folderId: '', made: {} },
      { ...good, folderId: 'f1', made: { nope: 'i1' } },
      { ...good, folderId: 'f1', made: { board: 7 } },
      { ...good, folderId: 'f1', made: [] },
    ])
      expect(readKitStartInput(bad)).toBeNull();
  });
});

describe('readKitRemoveInput', () => {
  it('reads a folder and the items a run made', () => {
    expect(readKitRemoveInput({ folderId: 'f1', made: { plan: 'i1', space: 'i2' } })).toEqual({
      folderId: 'f1',
      made: { plan: 'i1', space: 'i2' },
    });
  });

  it('refuses anything malformed, or more items than a kit has', () => {
    const many = Object.fromEntries(
      ['plan', 'space', 'board', 'brief', 'deck'].map((slot, i) => [slot, `i${i}`]),
    );
    for (const bad of [
      null,
      { made: {} },
      { folderId: 'f1' },
      { folderId: 'f1', made: { nope: 'i1' } },
      { folderId: 'f1', made: many },
    ])
      expect(readKitRemoveInput(bad)).toBeNull();
  });
});
