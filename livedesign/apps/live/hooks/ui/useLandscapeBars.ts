'use client';

// Whether the header and the tab bar show on a phone held sideways (docs/specs/007-editor/live-app.md
// "A phone held sideways"), from @liveworkspace/workbench/hooks/ui/useLandscapeBars.
import { createLandscapeBars } from '@liveworkspace/workbench/hooks/ui/useLandscapeBars';
import { useActiveTour } from '@liveworkspace/workbench/lib/tour-active';
import { track } from '@/lib/telemetry';

export const useLandscapeBars = createLandscapeBars({ useActiveTour, track });
