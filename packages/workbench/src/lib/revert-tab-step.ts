// One tab's step taken back through the room (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md):
// its elements and its layers each through revertStep, so what the step removed comes back in its place and what it
// changed goes back, unless someone changed it since. Every other field is the tab as it is now.
import { revertStep } from '@liveworkspace/ui/undo';

type Keyed = { readonly id: string };
type StepTab = { readonly elements: readonly Keyed[]; readonly layers?: readonly Keyed[] };

export function revertTabStep<T extends StepTab>(before: T, after: T, now: T): T {
  const elements = revertStep(before.elements, after.elements, now.elements);
  const layers =
    before.layers === after.layers
      ? now.layers
      : revertStep(before.layers ?? [], after.layers ?? [], now.layers ?? []);
  if (elements === now.elements && layers === now.layers) return now;
  return { ...now, elements, ...(layers === undefined ? {} : { layers }) };
}
