'use client';

import { createColourSwatchButton } from '@liveworkspace/workbench/components/colour/ColourSwatchButton';
import { ColourPopover } from './ColourPopover';
import type { ColourPickerProps } from './ColourPicker';

// The swatch-button skin (docs/specs/004-interface-design/colour-picker.md "Skins"), shared by the editors and bound
// to this one's popover.
export const ColourSwatchButton = createColourSwatchButton<ColourPickerProps>({ ColourPopover });
