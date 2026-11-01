'use client';

// The Components category's In This Design band (docs/specs/009-elements/components.md "The library"): every main
// in the design's library not removed from it, newest first, each drawn as it is and placed at the view's centre on
// a click. Shown to Editors only (placing is theirs), with a line saying how to make one while the library is empty.
import { memo, useMemo } from 'react';
import {
  canvasSurface,
  EXPORT_BG,
  placeableComponents,
  prefixSvgIds,
  type CanvasSurface,
  type DesignComponent,
  type Tab,
} from '@livedesign/design';
import { lucidePackage } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip, trustedHtml } from '@livedesign/ui';
import { useOptionalEditorContext } from '@/app/design/[id]/EditorContext';
import { instanceMarkup } from '@/lib/instance-svg';

const ComponentIcon = lucideGlyph(lucidePackage, 16);

export function DesignComponentsBand({ variant = 'band' }: { variant?: 'band' | 'flyout' }) {
  const editor = useOptionalEditorContext();
  if (!editor || !editor.componentActions.canEdit) return null;
  const mains = placeableComponents(editor.componentLibrary.library.values());
  const { activeTab } = editor;
  const surface = canvasSurface(activeTab.backgroundColor ?? EXPORT_BG);
  const flyout = variant === 'flyout';
  const count =
    mains.length > 0 ? (
      <span className="inline-flex h-[12.6px] items-center rounded-full bg-slate-100 px-1.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        <span className="text-optical-centre">{mains.length}</span>
      </span>
    ) : null;
  return (
    <section
      aria-label="In This Design"
      className={flyout ? 'flex flex-col' : 'flex flex-col gap-1 pb-1'}
      data-design-components=""
    >
      {flyout ? (
        // The category flyout's own group heading (CategoryFlyout), so the band reads as its first group.
        <h4 className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          In This Design
          {count}
          <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
        </h4>
      ) : (
        <div className="flex items-center gap-1.5 px-2 pt-1">
          <span className="text-slate-500 dark:text-slate-400">
            <ComponentIcon />
          </span>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            In This Design
          </span>
          {count}
        </div>
      )}
      {mains.length === 0 ? (
        <p className="px-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Select elements and choose Make Component to reuse them on every screen.
        </p>
      ) : (
        <div className={flyout ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-2 gap-1 px-1'}>
          {mains.map((main) => (
            <ComponentTile
              key={main.id}
              main={main}
              tab={activeTab}
              surface={surface}
              onPlace={() => editor.componentActions.placeInstance(main.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const ComponentTile = memo(function ComponentTile({
  main,
  tab,
  surface,
  onPlace,
}: {
  main: DesignComponent;
  tab: Pick<Tab, 'font' | 'finish' | 'theme' | 'backgroundColor'>;
  surface: CanvasSurface;
  onPlace: () => void;
}) {
  const { font, finish, theme, backgroundColor } = tab;
  const markup = useMemo(() => {
    const box = {
      id: `tile-${main.id}`,
      type: 'shape' as const,
      shape: 'instance' as const,
      componentId: main.id,
      x: 0,
      y: 0,
      width: main.width,
      height: main.height,
    };
    const inner = instanceMarkup(
      box,
      main,
      { font, finish, theme },
      surface,
      backgroundColor ?? '#ffffff',
    );
    return prefixSvgIds(inner, `ct-${main.id}-`.replace(/[^a-zA-Z0-9-]/g, ''));
  }, [main, font, finish, theme, surface, backgroundColor]);
  return (
    <Tooltip label={`Place ${main.name}`}>
      <button
        type="button"
        data-component-tile={main.id}
        onClick={onPlace}
        className="flex cursor-pointer flex-col items-stretch gap-1 rounded-lg border border-slate-200 p-1 text-left transition hover:border-brand-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-slate-800/60"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${main.width} ${main.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-12 w-full rounded"
          style={{ background: backgroundColor ?? undefined }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
        />
        <span className="truncate px-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
          {main.name}
        </span>
      </button>
    </Tooltip>
  );
});
