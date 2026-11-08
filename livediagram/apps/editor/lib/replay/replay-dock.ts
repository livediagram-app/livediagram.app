import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { readDrawPattern } from '@/lib/whiteboard-dock-prefs';
import type { ReplayState } from './replay-store';

// Draw's dock while Watch It Built runs (docs/specs/007-editor/blueprints/watch-it-built.md "The scope"): the dock's
// model is built by useEditorState, outside ReplayScope, so what a Draw topic shows on it (the tool in hand, a marker's
// colour and width, Shape recognition, the board) is drawn over the model here, for the dock's look only. The
// model's actions are untouched and never called by the replay, so nothing is picked or stored.

export function withReplayDock(
  model: WhiteboardDockModel,
  replay: Pick<ReplayState, 'active' | 'dock' | 'prefs'>,
): WhiteboardDockModel {
  if (!replay.active) return model;
  const dock = replay.dock;
  const pattern = replay.prefs?.drawPattern;
  if (!dock && pattern === undefined) return model;
  const prefs = {
    ...model.prefs,
    ...dock?.prefs,
    pens: model.prefs.pens.map((p) => ({ ...p, ...dock?.pens?.[p.id] })),
  };
  return {
    ...model,
    tool: dock?.tool ?? model.tool,
    armedShape: dock?.armedShape !== undefined ? dock.armedShape : model.armedShape,
    prefs,
    activePen: prefs.pens.find((p) => p.id === prefs.activePenId) ?? prefs.pens[0]!,
    background:
      pattern === undefined ? model.background : readDrawPattern({ drawPattern: pattern }),
  };
}
