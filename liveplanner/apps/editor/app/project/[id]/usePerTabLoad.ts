// Lazy per-tab content load (docs/specs/006-project/per-tab-storage.md): the shared loader
// (@liveworkspace/workbench/hooks/persistence/usePerTabLoad), made once here around this editor's tab GET,
// telemetry and timing, and handed the open liveplanner item's id as `projectId`.
import type { Tab } from '@liveplanner/project';
import { createPerTabLoad } from '@liveworkspace/workbench/hooks/persistence/usePerTabLoad';
import { apiLoadTabRevisioned } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { startEditorTiming } from '@/lib/timing';

const useTabLoad = createPerTabLoad<Tab>({
  loadTabRevisioned: apiLoadTabRevisioned,
  track,
  startEditorTiming,
});

type PerTabLoadOpts = Omit<Parameters<typeof useTabLoad>[0], 'itemId'> & {
  projectId: string | null;
};

export function usePerTabLoad({ projectId, ...opts }: PerTabLoadOpts) {
  return useTabLoad({ ...opts, itemId: projectId });
}
