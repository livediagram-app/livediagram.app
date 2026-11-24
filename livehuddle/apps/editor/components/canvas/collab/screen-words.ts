// The Screen's words (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows", "A file on the
// Screen"), in one place so the face, the overlay, the menu, the reader, the dialog and their tests say the same.
import { appName } from '@liveworkspace/workbench/components/connect/connect-words';
import type { LiveItem } from '@livehuddle/document';

export const screenWords = {
  // Show on the Screen.
  dialogTitle: 'Show on the Screen',
  dialogSubtitle: 'A file from any of our apps, live for everyone with access, or a video.',
  file: 'File',
  video: 'Video',
  videoLine: 'A video plays for whoever opens the Screen, from the start, on their own screen.',
  // The menu and the reader.
  nothingChosen: 'Nothing chosen',
  videoLink: 'Video link',
  untitled: 'Untitled file',
  choose: 'Choose',
  change: 'Change',
  clear: 'Clear',
  chooseWhatItShows: 'Choose What It Shows',
  menuLine:
    'A file shows live to everyone in the room with their own access. A video plays for whoever opens it.',
  // The face.
  live: 'Live',
  noAccess: 'No Access',
  gone: 'No longer there',
  failed: "Couldn't show it just now",
  // The overlay.
  showThisTab: 'Show This Tab on the Screen',
  shownTab: 'On the Screen',
  open: (app: LiveItem['app']) => `Open in ${appName(app)}`,
  overlayTitle: (name: string) => `${name} on the Screen`,
  opening: (name: string) => `Opening ${name}`,
  noAccessTitle: (name: string) => `You don't have access to ${name}.`,
  noAccessLine: 'Ask its owner to share it with you, then it shows here for you too.',
  goneTitle: 'This file is no longer there.',
  goneLine: 'It was deleted or moved to the Trash.',
  failedTitle: (name: string) => `${name} could not be shown just now.`,
  tryAgain: 'Try Again',
  appOf: (app: LiveItem['app']) => appName(app),
} as const;
