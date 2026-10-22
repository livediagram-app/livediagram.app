// A board set-up change's telemetry (docs/specs/026-plan/plan-mode.md "Telemetry"): `Plan` · `Changed`
// with the part changed (Title, Swimlanes, ColumnAdded...), never the values.
import { track } from '@/lib/telemetry';

export function trackSetup(part: string): void {
  track('Plan', 'Changed', part);
}
