'use client';

// The Screen's setting in the element menu (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows"):
// what it shows now (a file, with its app's logo and name; a video; or nothing chosen), Choose, which opens Show on
// the Screen on that source and closes the menu, and Clear. Only an Editor's menu renders it.
import type { ShapeElement, ScreenSource } from '@livehuddle/document';
import { screenFile, screenVideoTarget } from '@livehuddle/document';
import { AppBrandMark } from '@livehuddle/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { ToolsMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { appName } from '@liveworkspace/workbench/components/connect/connect-words';
import { openScreenPicker } from '@/lib/office/screen-picker-store';
import { ScreenSourcePanel } from '@/components/dialogs/screen-source-panel';
import { ScreenGlyph } from '@/components/canvas/collab/ScreenView';
import { screenWords } from '@/components/canvas/collab/screen-words';

const preload = () => void ScreenSourcePanel.preload();

export function ScreenMenuSection({
  target,
  sectionProps,
  onSetScreenSource,
  onCloseMenu,
}: {
  target: ShapeElement;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetScreenSource: (source: ScreenSource) => void;
  onCloseMenu?: () => void;
}) {
  const file = screenFile(target);
  const video = file ? null : screenVideoTarget(target.screenUrl);
  const chosen = !!file || !!target.screenUrl;
  return (
    <MenuAccordionSection title="Screen" icon={<ToolsMenuGlyph />} {...sectionProps('screen')}>
      <div className="px-3 pt-1">
        <div
          data-screen-source={file ? 'file' : video || target.screenUrl ? 'video' : 'none'}
          className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60"
        >
          {file ? (
            <AppBrandMark app={file.liveItem.app} className="size-4 shrink-0" />
          ) : (
            <ScreenGlyph size={16} className="shrink-0 text-slate-400" />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
              {file
                ? file.liveName || screenWords.untitled
                : video
                  ? video.label
                  : target.screenUrl
                    ? screenWords.videoLink
                    : screenWords.nothingChosen}
            </span>
            {file ? (
              <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                {appName(file.liveItem.app)}
                {file.liveTab ? ` · ${file.liveTab.name}` : ''}
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex gap-1.5 py-2">
          <button
            type="button"
            onPointerEnter={preload}
            onFocus={preload}
            onClick={() => {
              openScreenPicker(target.id, !file && target.screenUrl ? 'video' : 'file');
              onCloseMenu?.();
            }}
            className="h-7 flex-1 cursor-pointer rounded-md bg-brand-700 px-2 text-[11px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700"
          >
            {chosen ? screenWords.change : screenWords.choose}
          </button>
          <button
            type="button"
            onClick={() => onSetScreenSource({ kind: 'none' })}
            disabled={!chosen}
            className="h-7 flex-1 cursor-pointer rounded-md bg-slate-100 px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-default disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {screenWords.clear}
          </button>
        </div>
        <p className="pb-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          {screenWords.menuLine}
        </p>
      </div>
    </MenuAccordionSection>
  );
}
