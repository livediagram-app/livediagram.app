// Picker candidates + the roll (docs/specs/012-collaboration/picker.md), from @liveworkspace/workbench/lib/picker,
// with this editor's participants.
import type { PickerCandidate as Candidate } from '@liveworkspace/workbench/lib/picker';
import type { Participant } from './identity';

export {
  PICKER_SPIN_MS,
  pickerCandidates,
  rollPicker,
  spinFrameDelays,
  spinReel,
} from '@liveworkspace/workbench/lib/picker';

export type PickerCandidate = Candidate<Participant>;
