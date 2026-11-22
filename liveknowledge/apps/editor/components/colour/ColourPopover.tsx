'use client';

import { createColourPopover } from '@liveworkspace/workbench/components/colour/ColourPopover';
import { ColourPicker, type ColourPickerProps } from './ColourPicker';

// The picker in a popover (docs/specs/004-interface-design/colour-picker.md "Skins"), shared by the editors and
// bound to this one's picker.
export const ColourPopover = createColourPopover<ColourPickerProps>({ ColourPicker });
