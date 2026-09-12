import {
  applyEventStormingStage,
  EVENT_STORMING_STAGES,
  eventStormingRailVisible,
  eventStormingStageOf,
  isEventStormingTab,
  toggleEventStormingRail,
  type EventStormingStage,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// Event-storming workshop views (spec/139): the thin editor seam over the
// pure stage/rail helpers in @livediagram/diagram. A stage switch is one
// ordinary tab commit (shared + synced, so the room moves together) PLUS
// activating that stage's layer, so notes added while in a stage land on
// the band the stage owns — and the active layer never strands on a band
// the switch just hid (which would pause element creation, spec/74).

const STAGE_TELEMETRY: Record<EventStormingStage, string> = {
  'big-picture': 'EventStormingBigPicture',
  process: 'EventStormingProcess',
  design: 'EventStormingDesign',
};

export function useEventStormingViews(opts: {
  activeTab: Tab;
  editsBlocked: boolean;
  commitActiveTab: (mapTab: (t: Tab) => Tab) => void;
  setActiveLayer: (layerId: string) => void;
}) {
  const { activeTab, editsBlocked, commitActiveTab, setActiveLayer } = opts;

  // Derived from tab data, so the bar appears wherever the board travels
  // (share links, imports) and reflects a peer's switch instantly.
  const esBoard = isEventStormingTab(activeTab.layers);
  const esStage = eventStormingStageOf(activeTab.layers);
  const esRailVisible = eventStormingRailVisible(activeTab.layers);

  const setEsStage = (stage: EventStormingStage) => {
    if (editsBlocked || stage === esStage) return;
    commitActiveTab((t) => applyEventStormingStage(t, stage));
    const layerId = EVENT_STORMING_STAGES.find((s) => s.stage === stage)!.layerId;
    setActiveLayer(layerId);
    track('UI', 'Used', STAGE_TELEMETRY[stage]);
  };

  const toggleEsRail = () => {
    if (editsBlocked) return;
    track('UI', 'Used', esRailVisible ? 'EventStormingRailOff' : 'EventStormingRailOn');
    commitActiveTab(toggleEventStormingRail);
  };

  return { esBoard, esStage, esRailVisible, setEsStage, toggleEsRail };
}
