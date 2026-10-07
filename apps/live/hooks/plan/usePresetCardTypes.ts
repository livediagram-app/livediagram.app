'use client';

// A board placed from a preset brings its card types (docs/specs/026-plan/plan-mode.md "The palette"): a Bug
// Triage board adds Bug, a Sprint board Story, when the document lacks them. Only a board that appears while the
// document is open counts (placed here, by a template, or by someone else): the boards it opened with never add a
// type back, so a type someone deleted stays deleted. A board's types arrive with its set-up (`addTypes`).
import { useEffect, useRef } from 'react';
import type { Tab } from '@livediagram/document';
import { normaliseBoardSetup, presetTypesToAdd, type ItemTypeDef } from '@livediagram/items';
import { debugLog } from '@/lib/debug-log';

type Board = { id: string; addTypes: readonly string[] | undefined };

function boardsOf(tab: Tab | undefined): Board[] {
  const out: Board[] = [];
  for (const el of tab?.elements ?? []) {
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    const setup = normaliseBoardSetup(el.planBoard);
    out.push({ id: el.id, addTypes: setup?.addTypes });
  }
  return out;
}

export function usePresetCardTypes({
  tabs,
  activeId,
  enabled,
  types,
  addTypes,
}: {
  tabs: readonly Tab[];
  activeId: string;
  // Plan in play, the document's types read, and this person may change them.
  enabled: boolean;
  types: readonly ItemTypeDef[];
  addTypes: (defs: readonly ItemTypeDef[]) => void;
}): void {
  // The boards seen so far, per tab; null until the tab is first read (its boards then are where it started).
  const seen = useRef(new Map<string, Set<string>>());
  const tab = tabs.find((t) => t.id === activeId);
  useEffect(() => {
    if (!enabled || !tab) return;
    const boards = boardsOf(tab);
    const known = seen.current.get(tab.id);
    seen.current.set(tab.id, new Set(boards.map((b) => b.id)));
    if (!known) return;
    const fresh = boards.filter((b) => !known.has(b.id));
    if (fresh.length === 0) return;
    const missing = presetTypesToAdd(
      fresh.flatMap((b) => b.addTypes ?? []),
      types,
    );
    if (missing.length === 0) return;
    debugLog('[item-types] preset.added', { types: missing.map((t) => t.id) });
    addTypes(missing);
  }, [enabled, tab, types, addTypes]);
}
