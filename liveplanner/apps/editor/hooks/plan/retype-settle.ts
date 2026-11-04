// A field's type change saved all or none (docs/specs/026-plan/item-types.md "Edit Field": Saving the type): the
// type, the cards' changed values and the filters taken off the field land together, as one undo step, or nothing
// stays changed. useItemTypes runs it once the type's save and the values' write have both answered. Pure, so the
// failures are tested without React (retype-settle.test.ts).
import { combinedStep, type ItemUndoStep, type ValuesWrite } from './item-undo-journal';

// What comes with a type's save when one of its fields changes type.
export type SaveAlong = {
  // The field's name, as the toast says it.
  name: string;
  // The cards' changed values, written as the type is saved (absent: none change).
  values?: Promise<ValuesWrite>;
  // Run once the type and the values have landed: takes the field's filters off the boards and views (one canvas
  // commit), answering whether it changed any (absent: none to take off).
  settle?: () => boolean;
};

export const retypeFailedMessage = (name: string): string =>
  `Couldn’t change ${name}’s type, so nothing was changed.`;

const NOTHING: ValuesWrite = { ok: true, step: null };

/**
 * Waits for the type's save (`saved`, true once stored) and the values' write. Both landed: the filters come off and
 * one undo step is pushed. Either failed: what landed is put back (the values by their undo, the type by
 * `rollbackType`), no step is pushed, and the toast says nothing was changed. Answers whether it all landed.
 */
export async function settleRetype(opts: {
  saved: Promise<boolean>;
  along: SaveAlong;
  typeStep: ItemUndoStep;
  rollbackType: () => void;
  push: (step: ItemUndoStep) => void;
  onError: (message: string) => void;
}): Promise<boolean> {
  const { along } = opts;
  const [typeOk, values] = await Promise.all([
    opts.saved,
    (along.values ?? Promise.resolve(NOTHING)).catch((): ValuesWrite => ({ ok: false, step: null })),
  ]);
  if (typeOk && values.ok) {
    const canvas = along.settle?.() ?? false;
    const steps = values.step ? [opts.typeStep, values.step] : [opts.typeStep];
    opts.push(steps.length === 1 && !canvas ? opts.typeStep : combinedStep(steps, canvas));
    return true;
  }
  values.step?.undo();
  if (typeOk) opts.rollbackType();
  opts.onError(retypeFailedMessage(along.name));
  return false;
}
