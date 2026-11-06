'use client';

import type { TelemetrySummary } from '@liveworkspace/telemetry';
import { AppDashboard } from '../_shared/AppDashboard';
import { LIVEHUDDLE } from './config';

// livehuddle.app's dashboard: the shared one, filled from its config. The page loads each app's on
// demand, so this module is where its own data starts.
export function Body({ summary }: { summary: TelemetrySummary }) {
  return <AppDashboard app={LIVEHUDDLE} summary={summary} />;
}
