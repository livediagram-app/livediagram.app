// The Settings dialog's frame (every app's Settings and liveworkspace.app's): wide enough on desktop for the rail
// and a readable pane side by side (the Dialog's `3xl`, 60rem, never more than 92% of the window), one fixed height
// so the frame doesn't jump between categories, and the whole screen on a phone.
export const SETTINGS_DIALOG_SIZE = '3xl' as const;
export const SETTINGS_DIALOG_CLASS =
  'max-h-[calc(100%-2rem)] sm:h-[min(44rem,calc(100%-6rem))] sm:max-h-[min(44rem,calc(100%-6rem))]';
