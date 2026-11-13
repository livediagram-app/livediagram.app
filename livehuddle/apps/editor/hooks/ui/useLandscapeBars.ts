'use client';

// Whether the header and the tab bar show on a phone held sideways (docs/specs/007-editor/editor-app.md
// "A phone held sideways"), from @liveworkspace/workbench/hooks/ui/useLandscapeBars, with this editor's tours.
import { createLandscapeBars } from '@liveworkspace/workbench/hooks/ui/useLandscapeBars';
import { track } from '@/lib/telemetry';
import { useActiveTour } from '@/lib/tour-active';

export const useLandscapeBars = createLandscapeBars({ useActiveTour, track });
