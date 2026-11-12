// The empty page's layout invite beside its cog (CanvasPages).
import { lucidePanelsTopLeft } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';

const LayoutIcon = lucideGlyph(lucidePanelsTopLeft, 14);

// On an empty page, beside its cog: start it from a layout. Its words show on a wide screen with
// room in the title bar; on a phone, or when the page is small on screen, just the icon.
export function LayoutInvite({ wide, onOpen }: { wide: boolean; onOpen: () => void }) {
  return (
    <div
      className="pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Start From a Layout">
        <button
          type="button"
          aria-label="Start From a Layout"
          onClick={onOpen}
          className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <LayoutIcon />
          {wide ? (
            <span className="hidden whitespace-nowrap sm:inline">Start From a Layout</span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}
