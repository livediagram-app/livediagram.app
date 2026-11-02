'use client';

import {
  BrowserRepairPanel as SharedPanel,
  type BrowserRepairPanelProps as SharedProps,
} from '@liveworkspace/ui';
import { repairBrowserStorage } from './repair';

// The recovery actions (docs/specs/007-editor/load-recovery.md "The recovery card" and "Repair page in
// the help centre"): @liveworkspace/ui's panel, naming this product and what people make here, with its repair.
export type BrowserRepairPanelProps = Omit<SharedProps, 'product' | 'noun' | 'repair'>;

export function BrowserRepairPanel(props: BrowserRepairPanelProps) {
  return (
    <SharedPanel
      product="livehuddle"
      noun="canvases"
      repair={() => repairBrowserStorage()}
      {...props}
    />
  );
}
