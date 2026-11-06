// Who stands on each stage, from presence, never from the document (docs/specs/012-collaboration/meeting-rooms-and-stage.md
// "The stage shows who is on it"): your character and every walking peer, on the same top-of-the-stage test the
// call uses, keyed by stage id. A character standing on two overlapping stages is on the smaller (stageAt).

import { stageAt, type CallStage } from '@livehuddle/document';

export type StageStander = { name: string; color: string };
type At = { x: number; y: number };

export function stageStanders(
  stages: readonly CallStage[],
  self: { at: At; color: string } | null,
  peers: readonly { name: string; color: string; at: At }[],
): Map<string, StageStander[]> {
  const byStage = new Map<string, StageStander[]>();
  if (stages.length === 0) return byStage;
  const add = (at: At, stander: StageStander) => {
    const stage = stageAt(at, stages);
    if (!stage) return;
    const list = byStage.get(stage.id);
    if (list) list.push(stander);
    else byStage.set(stage.id, [stander]);
  };
  if (self) add(self.at, { name: 'You', color: self.color });
  for (const peer of peers) add(peer.at, { name: peer.name, color: peer.color });
  return byStage;
}

/** The badge's names: "You", "Alex and Sam", "Alex, Sam +2". */
export function standersLabel(standers: readonly StageStander[]): string {
  const names = standers.map((s) => s.name);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}
