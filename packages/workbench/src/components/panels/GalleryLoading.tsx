// A picker's gallery while its images load: the grid's own shape, square tiles four across, so the dialog keeps its
// height and nothing jumps when the pictures land (docs/specs/004-interface-design/empty-states.md). Pulses only
// where motion is allowed, and is announced once as busy.
const TILE = 'aspect-square rounded-md bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800';

export function GalleryLoading({ tiles = 8 }: { tiles?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading images"
      data-gallery-loading=""
      className="grid grid-cols-4 gap-2"
    >
      {Array.from({ length: tiles }, (_, i) => (
        <span key={i} className={TILE} />
      ))}
    </div>
  );
}
