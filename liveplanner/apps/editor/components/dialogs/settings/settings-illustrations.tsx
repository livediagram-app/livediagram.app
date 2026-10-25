import { ChoiceStates, type ChoiceIllustrationId } from '@liveworkspace/workbench/components/dialogs/settings/settings-choice-illustrations';

// Small drawings for the settings whose effect is VISUAL, the ones whose
// description is really trying to describe a picture: one drawing per option
// of a pick-one setting (settings-choice-illustrations.tsx), the one in force
// ringed, so the picture doubles as a readout of the control beside it.
//
// Kept out of settings-catalogue.ts so that file stays plain data (.ts, no
// JSX): a row names an illustration by id and this registry draws it.

export type SettingsIllustrationId = ChoiceIllustrationId;

export function SettingsIllustration({
  id,
  value = '',
  onChoose,
  disabledValues,
}: {
  id: SettingsIllustrationId;
  // The option in force, which the drawing rings.
  value?: string;
  // Clicking an option picks it (except `disabledValues`, the ones that can't
  // be picked right now).
  onChoose?: (value: string) => void;
  disabledValues?: readonly string[];
}) {
  return (
    <div className="mt-2.5 px-3.5">
      <ChoiceStates id={id} value={value} onPick={onChoose} disabledIds={disabledValues} />
    </div>
  );
}
