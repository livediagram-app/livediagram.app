// The named rejections of Microsoft Whiteboard import and their copy
// (docs/specs/020-import-export/blueprints/whiteboard-import.md "Errors and edge cases").
// A refusal leaves the tab untouched.

import { WHITEBOARD_MAX_FILE_BYTES } from './limits';

export type WhiteboardRefusal =
  | 'too-large'
  | 'not-whiteboard'
  | 'several-boards'
  | 'zip-damaged'
  | 'zip-encrypted'
  | 'empty-board'
  | 'board-too-large'
  | 'unreadable';

const MB = 1024 * 1024;

const MESSAGES: Record<WhiteboardRefusal, string> = {
  'too-large': `This file is too large to import (over ${WHITEBOARD_MAX_FILE_BYTES / MB} MB).`,
  'not-whiteboard':
    "This isn't a Microsoft Whiteboard export. Choose the Zip from Export, Full export, or the PNG.",
  'several-boards': 'This Zip holds more than one board. Import them one at a time.',
  'zip-damaged': 'This Zip is damaged. Export the board again.',
  'zip-encrypted': 'This Zip is password-protected. Unzip it and import the .html file inside.',
  'empty-board': 'This board is empty.',
  'board-too-large': 'This board is too big for one tab. Import its PNG instead.',
  unreadable: "This file couldn't be read.",
};

export const refusalMessage = (refusal: WhiteboardRefusal): string => MESSAGES[refusal];
