'use client';

// An infographic or slide page's Background beside its cog (docs/specs/007-editor/illustrate-pages.md
// "Beside the cog"): the page panel's Background and Pattern sections in a popover anchored to the
// button, as a logo page's Guides open theirs. Hovers preview on the page; a press commits and the
// popover stays for another pick; closing it drops any preview.
import { useEffect, useRef } from 'react';
import { lucidePaintRoller } from '@livediagram/icons/lucide';
import type { IllustratePage, PageBackground } from '@livediagram/document';
import { lucideGlyph } from '@livediagram/ui';
import type { ThemeBackgroundPreset } from '@/lib/illustrate-page-paint';
import { track } from '@/lib/telemetry';
import { BackgroundSection } from './page-background-section';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const BackgroundIcon = lucideGlyph(lucidePaintRoller, 14);

// The title-bar room it takes (24 px and the gap, or named beside its icon), so the page's label
// truncates first.
const BACKGROUND_ROOM = 28;
const BACKGROUND_LABELLED_ROOM = 104;
// The page panel's own width, so the swatches sit seven across as they do there.
const POPOVER_WIDTH = 304;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageBackgroundRoom(labelled: boolean): number {
  return labelled ? BACKGROUND_LABELLED_ROOM : BACKGROUND_ROOM;
}

// The popover's body; unmounting (the popover closing) drops any preview.
function Body({
  page,
  themePresets,
  onBackground,
  onPreview,
}: {
  page: IllustratePage;
  themePresets: readonly ThemeBackgroundPreset[];
  onBackground: (patch: Partial<PageBackground>) => void;
  onPreview: (patch: Partial<PageBackground> | null) => void;
}) {
  // Only on close: the callback is a fresh closure each render, so it is read through a ref.
  const clearPreview = useRef(onPreview);
  useEffect(() => {
    clearPreview.current = onPreview;
  });
  useEffect(() => () => clearPreview.current(null), []);
  return (
    <div data-page-background-popover="">
      <BackgroundSection
        page={page}
        themePresets={themePresets}
        onBackground={(patch) => {
          onBackground(patch);
          onPreview(null);
        }}
        onPreview={onPreview}
      />
    </div>
  );
}

export function PageBackgroundButton({
  page,
  labelled,
  themePresets,
  onBackground,
  onPreview,
}: {
  page: IllustratePage;
  // Named beside its icon (a desktop).
  labelled: boolean;
  // The tab theme's own backgrounds, offered first.
  themePresets: readonly ThemeBackgroundPreset[];
  onBackground: (patch: Partial<PageBackground>) => void;
  onPreview: (patch: Partial<PageBackground> | null) => void;
}) {
  return (
    <TitlePopoverButton
      name="Background"
      labelled={labelled}
      className={titleButtonClass}
      icon={<BackgroundIcon />}
      width={POPOVER_WIDTH}
      padded={false}
      onOpen={() => track('UI', 'Opened', 'PageBackgroundButton')}
    >
      <Body
        page={page}
        themePresets={themePresets}
        onBackground={onBackground}
        onPreview={onPreview}
      />
    </TitlePopoverButton>
  );
}
