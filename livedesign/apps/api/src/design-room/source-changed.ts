// A Sheet a chart in this design reads changed (liveworkspace/docs/specs/004-index/sheet-sources.md "Keeping in
// step"; docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"): the index's `source-changed`
// door lands here, and the room tells every open session, ids only. Each session reads the range again with its own
// access, so nobody learns a value they could not read. Nothing is stored.
import type { SourceChange } from '@liveworkspace/index-client';
import type { ServerMessage } from '../types';

type FrameRoom = {
  bindDesign: (designId: string) => void;
  broadcast: (payload: ServerMessage) => void;
};

export function sourceChanged(room: FrameRoom, designId: string, change: SourceChange): void {
  room.bindDesign(designId);
  room.broadcast({
    kind: 'source-changed',
    app: change.app,
    itemId: change.itemId,
    sheetIds: change.sheetIds,
  });
}
