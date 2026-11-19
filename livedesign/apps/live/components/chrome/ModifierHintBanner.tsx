'use client';

import type { ComponentProps } from 'react';
import type { DragState } from '@/lib/canvas';
import { ModifierHint as SharedModifierHint } from '@liveworkspace/workbench/components/chrome/ModifierHintBanner';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';

const wholeDrag = (drag: DragState | null) => drag;

// The modifier hint (docs/specs/008-canvas/canvas-and-palette.md) is workbench's; this binding reads its drag from the
// drag store (canvas-performance.md "The drag state lives in a store"): a press renders this, not the editor view
// that places it.
export function ModifierHint({
  dragStore,
  ...hint
}: {
  dragStore: ReadableStore<DragState | null>;
} & Omit<ComponentProps<typeof SharedModifierHint>, 'drag'>) {
  const drag = useStoreSlice(dragStore, wholeDrag);
  return <SharedModifierHint {...hint} drag={drag} />;
}
