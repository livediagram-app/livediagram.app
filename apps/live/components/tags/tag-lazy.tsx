'use client';

// The tag surfaces that only open on a press (docs/specs/013-workspace/tags.md "Making, renaming, recolouring and
// deleting"): the tag dialog and the colour popover carry the colour picker, so they load on first open rather than
// with every Explorer page and sidebar.
import dynamic from 'next/dynamic';

export const LazyTagDialog = dynamic(() => import('./TagDialog').then((m) => m.TagDialog), {
  ssr: false,
});

export const LazyTagColourPopover = dynamic(
  () => import('./TagColourButton').then((m) => m.TagColourPopover),
  { ssr: false },
);
