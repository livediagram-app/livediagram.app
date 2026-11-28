'use client';

// The Picker's face (docs/specs/012-collaboration/picker.md) in liveplanner: the one shared reel
// (@liveworkspace/workbench PickerFace), with this editor's participant avatars.

import { ownColours, type ShapeElement } from '@liveplanner/project';
import { PickerFace as SharedPickerFace } from '@liveworkspace/workbench/components/canvas/picker/PickerFace';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
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
      onReset={picker?.reset}
      renderAvatar={(participant, size) => (
        <ParticipantAvatar participant={participant} size={size} />
      )}
    />
  );
}
