// Browser repair (docs/specs/007-editor/load-recovery.md "Repairing a browser" and "Diagnostics"): the browser
// checks, the repair's walk over storage and the recovery panel. Each product binds them to its storage keys,
// its probe name and its words (its packages/ui/src/browser-repair/), and keeps its identity report.
export { clearRepairableStorage, type RepairResult } from './repair';
export {
  INDEXED_DB_PROBE_TIMEOUT_MS,
  formatBrowserChecks,
  probeIndexedDb,
  runBrowserChecks,
  type BrowserChecks,
  type IndexedDbCheck,
} from './checks';
export { BrowserRepairPanel, type BrowserRepairPanelProps } from './BrowserRepairPanel';
