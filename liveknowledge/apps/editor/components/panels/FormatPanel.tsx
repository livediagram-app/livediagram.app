'use client';

import { createFormatPanel } from '@liveworkspace/workbench/components/panels/FormatPanel';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

// The Format Panel (docs/specs/008-canvas/format-panel.md), shared by the editors and bound to this one's mode panel.
export const FormatPanel = createFormatPanel<ModePanelProps>({ ModePanel });
