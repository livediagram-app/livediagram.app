'use client';

// Change Theme, top right of a page's layout pickers (the Layout popover and the in-page Start From
// a Layout card), left of their X (docs/specs/007-editor/pages-mode.md "Layouts"): opens the
// Tab Style popover, as the dock's Theme button does, so a layout and the look it wears are chosen
// side by side.
import { lucidePalette } from '@livediagram/icons/lucide';
import { Button, lucideGlyph } from '@livediagram/ui';

const ThemeIcon = lucideGlyph(lucidePalette, 14);

export function ChangeThemeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" size="xs" data-change-theme="" onClick={onClick}>
      <ThemeIcon />
      Change Theme
    </Button>
  );
}
