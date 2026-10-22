// The drag payload of a shape library tile (docs/specs/013-workspace/blueprints/shape-libraries.md
// "Behaviour and state" 6): which library and which item, resolved by the canvas on drop.

export const LIBRARY_SHAPE_DND_MIME = 'application/x-livediagram-library-shape';

export type LibraryShapeRef = { libraryId: string; itemId: string };

/** The ref a drop carries, or null for anything else. */
export function readLibraryShapeRef(data: string): LibraryShapeRef | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as LibraryShapeRef).libraryId === 'string' &&
      typeof (parsed as LibraryShapeRef).itemId === 'string'
    ) {
      return {
        libraryId: (parsed as LibraryShapeRef).libraryId,
        itemId: (parsed as LibraryShapeRef).itemId,
      };
    }
  } catch {
    // Not ours: the caller ignores it.
  }
  return null;
}
