// Re-export the shared Tooltip from @livediagram/ui so the editor's
// 15+ existing `./Tooltip` import sites don't have to move. The
// canonical implementation lives in packages/ui (also used by the
// telemetry dashboard).
export { Tooltip } from '@livediagram/ui';
