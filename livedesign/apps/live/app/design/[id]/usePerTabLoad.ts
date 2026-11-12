// Lazy per-tab content load (docs/specs/006-design/per-tab-storage.md): the shared loader
// (@liveworkspace/workbench/hooks/persistence/usePerTabLoad), made once here around this editor's tab GET,
// telemetry and timing, and handed the open livedesign item's id as `designId`.
import type { Tab } from '@livedesign/design';
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
  designId: string | null;
};

export function usePerTabLoad({ designId, ...opts }: PerTabLoadOpts) {
  return useTabLoad({ ...opts, itemId: designId });
}
