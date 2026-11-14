'use client';

import { createUsePanelDock } from '@liveworkspace/workbench/hooks/ui/usePanelDock';
import * as panelLayout from '@/lib/panel-layout';

// The corner-panel dock (docs/specs/007-editor/panel-docking.md), bound to this editor's panel ids and storage names.
export const usePanelDock = createUsePanelDock<panelLayout.PanelId>(panelLayout);
