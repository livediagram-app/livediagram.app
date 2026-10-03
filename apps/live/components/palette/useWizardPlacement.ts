'use client';

import { useEffect, useState } from 'react';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import type { TemplateKind } from '@livediagram/templates';
import { parsePlacement } from '@/components/placement/PlacementBrowser';
import { debugLog } from '@/lib/debug-log';

// Where the New Document wizard files its document (docs/specs/013-workspace/default-folders.md "The
// New Document wizard"; blueprint "Wizard"): the reader's own pick wins, then the /new context, then
// the reader's default folder for the template picked, else the My documents root. Only the root
// that is shown because nothing else resolved is no choice: the create then carries no placement,
// and the server's precedence decides.

/** A template's resolved default folder, as the wizard shows it. */
export type WizardDefault = { key: PlacementDefaultKey; value: string; folderName: string };

/** What the page knows of the reader's default folders, per template. */
export type WizardDefaults = {
  resolve: (kind: TemplateKind) => { found: WizardDefault | null; skipped: PlacementDefaultKey[] };
  /** The key Always save sets for this template: its most specific. */
  alwaysSaveKey: (kind: TemplateKind) => PlacementDefaultKey;
  /** Where documents of this key go now, as a placement value ('unsorted' = the root). */
  currentValue: (key: PlacementDefaultKey) => string;
  /** Sets (a folder) or clears (null) a key's default from the wizard. Resolves whether it held. */
  change: (key: PlacementDefaultKey, folderId: string | null) => Promise<boolean>;
};

export type WizardPlacementSource = 'picked' | 'context' | 'default' | 'none';

/** The default to write on Create: a folder, or null to clear it (the root). */
export type AlwaysSave = { key: PlacementDefaultKey; folderId: string | null };

export function useWizardPlacement({
  context,
  kind,
  defaults,
}: {
  /** The /new URL's placement, when it named one. */
  context: string | undefined;
  kind: TemplateKind;
  defaults: WizardDefaults | undefined;
}) {
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const resolution = context === undefined && defaults ? defaults.resolve(kind) : null;
  const resolved = resolution?.found ?? null;
  const selected = picked ?? context ?? resolved?.value ?? 'unsorted';
  const source: WizardPlacementSource =
    picked !== undefined
      ? 'picked'
      : context !== undefined
        ? 'context'
        : resolved
          ? 'default'
          : 'none';

  const resolvedKey = resolved?.key ?? null;
  const skippedKeys = resolution?.skipped.join(',') ?? '';
  useEffect(() => {
    if (resolvedKey) debugLog(`[default-folders] pre-selected key=${resolvedKey}`);
  }, [resolvedKey]);
  useEffect(() => {
    for (const key of skippedKeys ? skippedKeys.split(',') : [])
      debugLog(`[default-folders] default-skipped key=${key} reason=folder_unknown`);
  }, [skippedKeys]);

  // Always save: offered when the selection could be a default and is not already where these
  // documents go; unticked each time the offer changes.
  const offerKey = defaults?.alwaysSaveKey(kind) ?? null;
  const chosen = parsePlacement(selected);
  const teamRoot = chosen.teamId !== null && chosen.folderId === null;
  const offer: AlwaysSave | null =
    offerKey && !teamRoot && defaults!.currentValue(offerKey) !== selected
      ? { key: offerKey, folderId: chosen.folderId }
      : null;
  const offerId = offer ? `${offer.key}|${selected}` : null;
  const [tickedFor, setTickedFor] = useState<string | null>(null);
  const alwaysSave = offer && tickedFor === offerId ? offer : null;

  return {
    selected,
    source,
    /** The default pre-selected right now, for the reason line. */
    shownDefault: source === 'default' ? resolved : null,
    pick: (value: string) => setPicked(value),
    /** Forget the reader's pick (a Change default), so the new default shows. */
    clearPick: () => setPicked(undefined),
    /** The placement to send for `value` (the selection by default): none when nothing chose it. */
    sent: (value: string = selected, src: WizardPlacementSource = source) =>
      src === 'none' ? {} : parsePlacement(value),
    offer,
    alwaysSave,
    setAlwaysSave: (on: boolean) => setTickedFor(on ? offerId : null),
  };
}
