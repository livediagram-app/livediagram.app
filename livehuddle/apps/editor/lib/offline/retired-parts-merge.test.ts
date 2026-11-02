import { describe, expect, it } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { OfflineDocumentRecord } from './offline-store';
import type { RetiredPartsRecord } from './retired-parts';
import { mergeKeptTabs } from './retired-parts-merge';

// docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps", "Writing `keep` back".

const raw = (id: string, extra: object = {}) => ({ id, name: id, elements: [], ...extra });
const record = (
  tabs: unknown[],
  over: Partial<OfflineDocumentRecord> = {},
): OfflineDocumentRecord => ({
  id: 'doc',
  name: 'Doc',
  folderId: 'f1',
  createdAt: 1,
  savedAt: 2,
  tabs: tabs as Tab[],
  ...over,
});
const aside = (tabs: unknown[]): RetiredPartsRecord => ({ ...record([]), tabs });

describe('writing kept tabs back', () => {
  const diagram = raw('d', { elements: [{ id: 'e1' }] });
  const mixed = raw('m', { pages: [{ id: 'p' }], elements: [{ id: 'e2' }] });
  const deck = raw('s', { pages: [{ id: 'q' }] });
  const setAside = aside([diagram, mixed, deck]);
  const keep = [diagram, raw('m', { elements: [{ id: 'e2' }] })];

  it('takes the kept version of each unchanged tab and drops the tabs that moved whole', () => {
    const merged = mergeKeptTabs(record([diagram, mixed, deck]), setAside, keep);
    expect(merged.tabs).toEqual(keep);
  });

  it('keeps a tab edited since the set-aside as it is', () => {
    const edited = raw('m', { elements: [{ id: 'e2' }, { id: 'new' }] });
    const merged = mergeKeptTabs(record([diagram, edited, deck]), setAside, keep);
    expect(merged.tabs).toEqual([diagram, edited]);
  });

  it('keeps a tab added since, and never brings back one deleted since', () => {
    const added = raw('n');
    const merged = mergeKeptTabs(record([mixed, deck, added]), setAside, keep);
    expect(merged.tabs).toEqual([keep[1], added]);
  });

  it('adds a kept tab the set-aside never had', () => {
    const extra = raw('x');
    const merged = mergeKeptTabs(record([diagram, mixed, deck]), setAside, [...keep, extra]);
    expect(merged.tabs).toEqual([...keep, extra]);
  });

  it('leaves the rest of the record as it is', () => {
    const current = record([diagram, mixed, deck], { favourite: true, trashedAt: 9, savedAt: 7 });
    const merged = mergeKeptTabs(current, setAside, keep);
    expect({ ...merged, tabs: [] }).toEqual({ ...current, tabs: [] });
  });

  it('leaves no tabs when everything moved', () => {
    expect(mergeKeptTabs(record([deck]), aside([deck]), []).tabs).toEqual([]);
  });
});
