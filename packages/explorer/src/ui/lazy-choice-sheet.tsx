'use client';

// The phone's choice sheet (ChoiceSheet.tsx) from its own chunk the first time it opens, so the Explorer's first load
// never carries it or the dialog frame (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").
// Its trigger fetches it as a press starts (preloadChoiceSheet), so the sheet rises with the tap.

import type { ComponentType } from 'react';
import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import type { ChoiceSheetProps } from './ChoiceSheet';

const Sheet = lazyPanel('choice-sheet', () =>
  import('./ChoiceSheet').then((m) => m.ChoiceSheet as ComponentType<ChoiceSheetProps<string>>),
);

/** Fetches the sheet's code. Never rejects. */
export const preloadChoiceSheet = (): Promise<void> => Sheet.preload();

export function LazyChoiceSheet<T extends string>(props: ChoiceSheetProps<T>) {
  return props.open ? <Sheet {...(props as unknown as ChoiceSheetProps<string>)} /> : null;
}
