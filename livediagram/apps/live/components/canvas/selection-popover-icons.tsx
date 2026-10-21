import { lucideBringToFront, lucideSendToBack, lucideType } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// Action icons specific to the floating SelectionPopover toolbar (edit text, bring to front / send
// to back). The duplicate / lock / comment / delete glyphs it shares with the other toolbars come
// from @livediagram/ui.

// The 16px overflow ellipsis, shared with the rich-text toolbar (the same more-actions motif on the
// two floating canvas toolbars).
export { EllipsisIcon } from '@/components/rich-text/rich-text-toolbar-icons';

// "Edit text": the text glyph the palette's Add-text tile uses. Shown only when the selected element
// already has a label to edit.
export const TextIcon = lucideGlyph(lucideType, 16);

// Intra-layer z-order: the same bring-to-front / send-to-back glyphs as the context menu.
export const BringToFrontIcon = lucideGlyph(lucideBringToFront, 18);
export const SendToBackIcon = lucideGlyph(lucideSendToBack, 18);
