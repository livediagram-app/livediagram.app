'use client';

import { createLaserPanel } from '@liveworkspace/workbench/components/panels/LaserPanel';
import { LaserColourRow } from '@/components/panels/LaserColourRow';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

// The Laser Panel (docs/specs/008-canvas/laser-panel.md), shared by the editors and bound to this one's mode-panel
// chrome and colour row.
export const LaserPanel = createLaserPanel<ModePanelProps>({ ModePanel, LaserColourRow });
