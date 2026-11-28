// The avatar palette's flyouts, preview card and message popover, in one module so they load
// together, on demand, the first time Walk is picked (AvatarPalette;
// lib/editor-deferred-code.ts fetches it once the editor is idle).
export { AvatarPaletteFlyout } from '@/components/palette/AvatarPaletteFlyouts';
export { AvatarPalettePreview } from '@/components/palette/AvatarPalettePreview';
export { AvatarMessagePopover } from '@livehuddle/avatar/components/AvatarMessagePopover';
