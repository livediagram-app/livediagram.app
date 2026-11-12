// A page's title bar buttons (CanvasPages, PageTitleBar): the page kind's own tools in one group, then the
// lock and the cog that opens its panel (PagePanel).
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { PageLockButton } from '@liveworkspace/workbench/components/canvas/PageLockButton';
import type { LaidOutPage } from '@livedesign/design';
import type { PageEdits, PagesModeView } from '@/hooks/editor/usePagesMode';
import type { QuickStylePhoneRows } from '@/lib/quick-style-bar-slots';
import type { setPageBackgroundPreview } from '@/lib/page-background-preview';
import { LogoTitleBar } from './LogoTitleBar';
import { PageBackgroundButton } from './PageBackgroundButton';
import { appearanceRows, PageAppearanceButton } from './PageAppearanceButton';
import { PageLayoutsButton } from './PageLayoutsButton';
import { PageDeviceButton } from './wireframe/PageDeviceButton';
import type { pageChromeLayout } from './page-chrome-layout';

// A photo page's menus: the photo editor's code, fetched only for a tab with a photo page.
const PhotoTitleBar = dynamic(
  () => import('@/components/photo/PhotoTitleBar').then((m) => m.PhotoTitleBar),
  { ssr: false },
);

export function pageTitleBarGroups({
  page,
  view,
  edit,
  layout: {
    locked,
    pageButtons,
    deviceButton,
    logoButtons,
    photoButtons,
    buttons,
    labelled,
    appearanceLabelled,
  },
  mobile,
  quickStylePhone,
  cog,
  ask,
  askOf,
  setPreview,
}: {
  page: LaidOutPage;
  view: PagesModeView;
  edit: PageEdits;
  layout: ReturnType<typeof pageChromeLayout>;
  mobile: boolean;
  quickStylePhone: QuickStylePhoneRows | null;
  // The cog that opens the page's panel, made by CanvasPages, which keeps each one.
  cog: ReactNode;
  ask: (pageId: string, row: string) => void;
  askOf: (pageId: string, row: string) => number;
  setPreview: (next: Parameters<typeof setPageBackgroundPreview>[0]) => void;
}): readonly (readonly ReactNode[])[] {
  return [
    [
      // A logo page's Tidy Up, Mirror and Guides (LogoTitleBar).
      logoButtons && view.logo ? (
        <LogoTitleBar key="logo" pageId={page.id} tools={view.logo} labelled={labelled} />
      ) : null,
      // A photo page's Image, Select and Filter menus (PhotoTitleBar).
      photoButtons && view.photo ? (
        <PhotoTitleBar key="photo" pageId={page.id} photo={view.photo} labelled={labelled} />
      ) : null,
      // On a phone a wireframe page's looks gather under Appearance, their own
      // controls mounted headless.
      mobile ? (
        <PageAppearanceButton
          key="appearance"
          rows={appearanceRows(buttons)}
          device={page.device ?? 'iphone'}
          labelled={appearanceLabelled}
          selected={quickStylePhone?.pageId === page.id ? quickStylePhone : null}
          onPick={(row) => ask(page.id, row)}
        />
      ) : null,
      // A wireframe page's Device (PageDeviceButton).
      deviceButton ? (
        <PageDeviceButton
          key="device"
          page={page}
          labelled={labelled}
          headless={mobile}
          openRequest={askOf(page.id, 'device')}
          onDevice={(patch) => edit.setDevice(page.id, patch)}
          frameTheme={view.frameTheme}
        />
      ) : null,
      // A wireframe page's Layouts (PageLayoutsButton).
      pageButtons ? (
        <PageLayoutsButton
          key="layouts"
          page={page}
          labelled={labelled}
          headless={mobile}
          openRequest={askOf(page.id, 'layout')}
          onApply={(layout) => void edit.applyLayout(page.id, layout)}
          onPreview={(layout) => view.setLayoutPreview(layout ? { pageId: page.id, layout } : null)}
        />
      ) : null,
      // A wireframe page's Background (PageBackgroundButton).
      pageButtons ? (
        <PageBackgroundButton
          key="background"
          page={page}
          labelled={labelled}
          headless={mobile}
          openRequest={askOf(page.id, 'background')}
          themePresets={view.themeBackgrounds}
          onBackground={(patch) => edit.setBackground(page.id, patch)}
          onPreview={(patch) => setPreview(patch ? { pageId: page.id, patch } : null)}
          applyToAll={{
            reach: edit.applyToAllReach(page.id),
            onApply: () => edit.applyBackgroundToAll(page.id),
          }}
        />
      ) : null,
    ],
    [
      // No lock on a phone: the cog sheet holds it (PagePanel's actions).
      mobile ? null : (
        <PageLockButton
          key="lock"
          locked={locked}
          labelled={labelled}
          onToggle={() => edit.setLocked(page.id, !locked)}
        />
      ),
      cog,
    ],
  ];
}
