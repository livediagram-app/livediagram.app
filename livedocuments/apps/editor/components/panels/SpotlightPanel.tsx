'use client';

import { createSpotlightPanel } from '@liveworkspace/workbench/components/panels/SpotlightPanel';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

// The Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md), shared by the editors and bound to this one's
// mode-panel chrome.
export const SpotlightPanel = createSpotlightPanel<ModePanelProps>({ ModePanel });
