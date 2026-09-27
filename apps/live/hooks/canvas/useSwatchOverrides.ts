'use client';

// Custom swatches' state and storage (docs/specs/008-canvas/quick-style-panel.md "Custom swatches").
// PROVISIONAL store: this browser, per diagram, beside style memory, pending the
// operator's persistence decision. The storage lives only in this hook, so
// moving it is this one file. The logic is pure, in lib/swatch-overrides.

import { useState } from 'react';
import type { QuickSwatchRole, QuickSwatchSlot } from '@livediagram/diagram';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
import {
  parseSwatchOverrides,
  withOverride,
  withoutOverride,
  type SwatchOverrides,
} from '@/lib/swatch-overrides';

const keyFor = (diagramId: string) => `livediagram:v2:swatch-overrides:${diagramId}`;

export type SwatchOverridesApi = {
  overrides: SwatchOverrides;
  setOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot, hex: string) => void;
  clearOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot) => void;
};

function load(diagramId: string | null): SwatchOverrides {
  if (!diagramId) return {};
  const raw = readLocalStorageSafe(keyFor(diagramId));
  const parsed = parseSwatchOverrides(raw);
  if (raw !== null && raw !== '{}' && Object.keys(parsed).length === 0) {
    console.warn('[swatch-overrides] unreadable', keyFor(diagramId));
  }
  return parsed;
}

export function useSwatchOverrides({
  diagramId,
}: {
  diagramId: string | null;
}): SwatchOverridesApi {
  const [state, setState] = useState(() => ({ id: diagramId, overrides: load(diagramId) }));
  // Another diagram: its own overrides, read during render so the first frame
  // is already right.
  let current = state;
  if (state.id !== diagramId) {
    current = { id: diagramId, overrides: load(diagramId) };
    setState(current);
  }

  const write = (next: SwatchOverrides) => {
    if (!diagramId) return;
    setState({ id: diagramId, overrides: next });
    writeLocalStorageSafe(keyFor(diagramId), JSON.stringify(next));
  };

  return {
    overrides: current.overrides,
    setOverride: (role, slot, hex) => write(withOverride(current.overrides, role, slot, hex)),
    clearOverride: (role, slot) => write(withoutOverride(current.overrides, role, slot)),
  };
}
