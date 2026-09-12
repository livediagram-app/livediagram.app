import { useEffect } from 'react';
import {
  applyEventStormingStage,
  EVENT_STORMING_STAGES,
  eventStormingStageOf,
  isEventStormingTab,
  isLayerVisible,
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
  activeLayerId: string;
  editsBlocked: boolean;
  commitActiveTab: (mapTab: (t: Tab) => Tab) => void;
  setActiveLayer: (layerId: string) => void;
}) {
  const { activeTab, activeLayerId, editsBlocked, commitActiveTab, setActiveLayer } = opts;

  // Derived from tab data, so the bar appears wherever the board travels
  // (share links, imports) and reflects a peer's switch instantly.
  const esBoard = isEventStormingTab(activeTab.layers);
  const esStage = eventStormingStageOf(activeTab.layers);

  // Self-heal a stranded active layer: opening (or being walked into) a
  // shallower stage leaves the remembered/default active layer pointing at
  // a now-HIDDEN stage layer — the top layer is Design, so anyone loading a
  // board parked in Big picture would land with creation paused (spec/74
  // blocks adding to a hidden layer). Whenever the active layer is a stage
  // layer the current view hides, activate the current stage's layer
  // instead. Deliberately scoped to the three stage layers: a user who
  // activated their own custom layer keeps it.
  useEffect(() => {
    if (!esBoard) return;
    const active = EVENT_STORMING_STAGES.find((s) => s.layerId === activeLayerId);
    if (!active) return;
    const layer = activeTab.layers?.find((l) => l.id === activeLayerId);
    if (layer && !isLayerVisible(layer)) {
      setActiveLayer(EVENT_STORMING_STAGES.find((s) => s.stage === esStage)!.layerId);
    }
    // Reacts to view switches (local or a peer's) + tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esBoard, esStage, activeLayerId, activeTab.layers]);

  const setEsStage = (stage: EventStormingStage) => {
    if (editsBlocked || stage === esStage) return;
    commitActiveTab((t) => applyEventStormingStage(t, stage));
    const layerId = EVENT_STORMING_STAGES.find((s) => s.stage === stage)!.layerId;
    setActiveLayer(layerId);
    track('UI', 'Used', STAGE_TELEMETRY[stage]);
  };

  return { esBoard, esStage, setEsStage };
}
