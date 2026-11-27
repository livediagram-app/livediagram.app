'use client';

// The Picker's face (docs/specs/012-collaboration/picker.md) in livediagram: the one shared reel
// (@liveworkspace/workbench PickerFace), with this editor's participant avatars, and Reset offered in the
// element's kind tools (face-controls) as well as on the card.

import { ownColours, type ShapeElement } from '@livediagram/document';
import { PickerFace as SharedPickerFace } from '@liveworkspace/workbench/components/canvas/picker/PickerFace';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { usePublishFaceControls } from '@/components/canvas/collab/face-controls';
import type { PickerCandidate, PickerOffer } from '@/lib/picker';

export { pickerOffer } from '@/lib/picker';

export function PickerFace({
  element,
  label,
  textColor,
  picker,
  cornerMenu = false,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // The element's `…` settings button is in the card's corner (ElementFaceRouter's settingsButton).
  cornerMenu?: boolean;
  // What the canvas offers this viewer (pickerOffer); absent on a surface with no session behind it.
  picker?: PickerOffer<PickerCandidate>;
}) {
  const reset = picker?.reset;
  usePublishFaceControls(element.id, [
    reset &&
      element.pickerRemoveDrawn === true &&
      (element.pickerDrawn?.length ?? 0) > 0 && {
        key: 'reset',
        label: 'Reset the Draw',
        description: 'Put every drawn name back.',
        icon: 'reset',
        run: reset,
      },
  ]);
  return (
    <SharedPickerFace
      label={label}
      result={element.pickerResult}
      rolledAt={element.pickerRolledAt}
      candidates={picker?.candidates ?? []}
      source={element.pickerSource ?? 'participants'}
      removeDrawn={element.pickerRemoveDrawn === true}
      drawn={element.pickerDrawn}
      textColor={textColor}
      strokeColor={ownColours(element).stroke}
      width={element.width}
      height={element.height}
      shared={picker?.shared ?? false}
      cornerMenu={cornerMenu}
      onRoll={picker?.roll}
      onReset={reset}
      renderAvatar={(participant, size) => (
        <ParticipantAvatar participant={participant} size={size} />
      )}
    />
  );
}
