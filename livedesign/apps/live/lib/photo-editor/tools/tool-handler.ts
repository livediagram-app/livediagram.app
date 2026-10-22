// A photo tool's handler (docs/specs/031-photo/photo-tools.md): what it does on a press, a drag, a
// release and a key, on the photo in photo px. `down` answers whether the gesture is the tool's (it
// then gets the moves and the release); a tool that acts on the press alone answers false.
import type { PhotoPoint } from './tool-context';

export type ToolCursor =
  'brush' | 'crosshair' | 'move' | 'text' | 'default' | 'eyedropper' | 'bucket';

export type ToolHandler = {
  cursor: ToolCursor;
  down: (p: PhotoPoint) => boolean;
  move?: (p: PhotoPoint) => void;
  up?: (p: PhotoPoint) => void;
  // A double press (closing a polygon lasso).
  double?: (p: PhotoPoint) => void;
  // Enter, Escape, Backspace, arrows while the tool is in hand. Answers whether it took the key.
  key?: (key: string, e: { shift: boolean; alt: boolean; mod: boolean }) => boolean;
  cancel?: () => void;
};
