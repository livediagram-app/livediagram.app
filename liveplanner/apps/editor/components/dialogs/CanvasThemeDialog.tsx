'use client';

// The Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md), opened from the Theme & canvas dock button:
// the one dialog every editor shares (@liveworkspace/workbench, liveworkspace/docs/specs/011-workbench/tab-style.md),
// handed this editor's profile. Loaded on demand (EditorModals), the profile with it.

import type { BackgroundPattern } from '@liveplanner/project';
import {
  TabStyleDialog,
  type TabStyleDialogProps,
} from '@liveworkspace/workbench/components/dialogs/tab-style/TabStyleDialog';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import type { TabLook } from '@/lib/tab-looks';
import { TAB_STYLE_PROFILE } from './tab-style-profile';

// 'looks' is the home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"); the others are its Fine-tune panels.
export type CanvasThemeTab = TabStyleView;

export function CanvasThemeDialog(props: TabStyleDialogProps<TabLook, BackgroundPattern>) {
  return <TabStyleDialog profile={TAB_STYLE_PROFILE} {...props} />;
}
