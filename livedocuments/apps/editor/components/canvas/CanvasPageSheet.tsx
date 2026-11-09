'use client';

import { pageImageBlurSigma } from '@livedocuments/document';
import { useBlurredPageImage } from '@/hooks/canvas/useBlurredPageImage';
import { pageImageSrc } from '@/lib/page-image-paint';
import { memo, type CSSProperties, type PointerEvent } from 'react';
import { FirstPageChoice } from './FirstPageChoice';
import { PageLockButton } from '@liveworkspace/workbench/components/canvas/PageLockButton';
import { PageCog, PageTitleBar } from '@liveworkspace/workbench/components/canvas/PageTitleBar';
import { PageLabelCard } from '@liveworkspace/workbench/components/canvas/PageLabelCard';
import { PageBackgroundButton } from './PageBackgroundButton';
import { PageTabStyleButton } from './PageTabStyleButton';
import { appearanceRows, PageAppearanceButton } from './PageAppearanceButton';
import { openTabStyleFrom } from '@/lib/tab-style-opener';
import { PageLayoutsButton } from './PageLayoutsButton';
import { EmptyPageInvite } from '@liveworkspace/workbench/components/canvas/EmptyPageInvite';
import { layoutInviteShows } from '@/lib/layout-invite';
import { track } from '@/lib/telemetry';
import { PageMotionLayer } from './PageMotionLayer';
import { PageNotesButton } from './PageNotesButton';
import { PageTidyUpButton } from './PageTidyUpButton';
import { PageArticleButtons } from './PageArticleButtons';
import {
  appearanceNamed,
  LABEL_MIN,
  titleBarFixedRoom,
  titleBarNamed,
} from './page-title-bar-room';
import {
  articleBodyLinePx,
  articleMarginPx,
  articleTopMarginPx,
  pageIsDark,
  pageKindOf,
  pageLabel,
  resolveArticleStyle,
  resolveFontStack,
  type ArticleFlow,
  type ArticleStyle,
  type LaidOutPage,
  type PageBackground,
  type PageKind,
  type ThemeBackgroundPreset,
} from '@livedocuments/document';
import type { PageLayoutId } from '@livedocuments/templates';
import type { PageDeckControls, PageEdits } from '@/hooks/editor/usePagesMode';
import { pageSheetStyle } from '@/lib/page-paint';
import { FlashcardFooter } from './FlashcardStack';
import type { CardStack } from '@/lib/flashcard-stack';
import { ArticleStyleSection } from './article/ArticleStyleSection';
import type { ArticleStyleChange } from '@/hooks/editor/useArticles';
import { pageBandLayout } from '@/lib/article/article-band-layout';
import { PageBands } from './article/PageBands';

// Canvas px the letterbox's black reaches past the presented sheet: past any screen at any zoom.
const LETTERBOX_SPREAD = 100_000;

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

/** What a page's sheet does, through handles that keep their identity across the editor's renders (CanvasPages'
 *  useStableCallbacks): each runs the newest version when called, never during render. */
export type PageSheetActions = {
  goToPage: (page: LaidOutPage) => void;
  dragDown: (pageId: string, e: PointerEvent<HTMLElement>) => void;
  dragMove: (pageId: string, e: PointerEvent<HTMLElement>) => void;
  dragUp: (pageId: string, e: PointerEvent<HTMLElement>) => void;
  dragCancel: () => void;
  endsDrag: () => boolean;
  toggle: (pageId: string) => void;
  ask: (pageId: string, row: string) => void;
  cogRef: (pageId: string, el: HTMLButtonElement | null) => void;
  layoutsOpenChange: (pageId: string, open: boolean) => void;
  requestLayouts: (pageId: string) => void;
  applyLayout: (pageId: string, layout: PageLayoutId) => void;
  previewLayout: (pageId: string, layout: PageLayoutId | null) => void;
  setBackground: (pageId: string, patch: Partial<PageBackground>) => void;
  previewBackground: (pageId: string, patch: Partial<PageBackground> | null) => void;
  applyBackgroundToAll: (pageId: string) => void;
  setLocked: (pageId: string, locked: boolean) => void;
  choosePageKind: (pageId: string, kind: PageKind) => void;
  setArticleStyle: (flow: string, change: ArticleStyleChange) => void;
  previewArticleStyle: (flow: string, style: ArticleStyle | null) => void;
  focusPage: (pageId: string) => void;
};

/** One page's sheet and chrome, from what that page shows alone (canvas-performance.md "A render of the pages
 *  re-renders only the pages it changed"). Every prop is a value or a handle that keeps its identity, so a render of
 *  the row that leaves this page as it was skips it. */
export type PageSheetProps = {
  page: LaidOutPage;
  // The row's pages (one array per change of the stored pages): an article page's header and footer number it
  // among its article's own.
  pages: readonly LaidOutPage[];
  // More than one page: an unnamed page's cog names its number.
  many: boolean;
  zoom: number;
  bare: boolean;
  placing: boolean;
  mobile: boolean;
  letterbox: boolean;
  background: PageBackground | undefined;
  pictureOf: (imageId: string) => string | undefined;
  // Its name (its own, else its article's title).
  shownName: string | undefined;
  // An article page's style as shown (a hover in its Style tab previews one), and as stored (for its Style section).
  // Absent off an article, or where the page's article is not on the tab.
  articleStyle: ArticleStyle | undefined;
  storedArticleStyle: ArticleStyle | undefined;
  hasArticle: boolean;
  documentName: string;
  themeAccent: string;
  themePresets: ThemeBackgroundPreset[];
  // May edit the pages (not bare): the title bar and its buttons show.
  editable: boolean;
  tabStyle: boolean;
  tidy: boolean;
  choosing: boolean;
  // Set only when its button shows, so a page without one never re-renders for them.
  deck: PageDeckControls | undefined;
  tidyEdit: Pick<PageEdits, 'tidyPage' | 'previewTidy'> | undefined;
  applyReach: number;
  open: boolean;
  styleRequest: number;
  textRequest: number;
  layoutsRequest: number;
  backgroundRequest: number;
  dragging: boolean;
  reorderable: boolean;
  empty: boolean;
  previewing: boolean;
  layoutsOpen: boolean;
  // A stack's card in front: its place, the row and its article (FlashcardFooter).
  stack: CardStack | undefined;
  row: readonly LaidOutPage[] | undefined;
  flow: ArticleFlow | undefined;
  act: PageSheetActions;
};

export const CanvasPageSheet = memo(function CanvasPageSheet({
  page,
  pages,
  many,
  zoom,
  bare,
  placing,
  mobile,
  letterbox,
  background,
  pictureOf,
  shownName,
  articleStyle,
  storedArticleStyle,
  hasArticle,
  documentName,
  themeAccent,
  themePresets,
  editable,
  tabStyle,
  tidy,
  choosing,
  deck,
  tidyEdit,
  applyReach,
  open,
  styleRequest,
  textRequest,
  layoutsRequest,
  backgroundRequest,
  dragging,
  reorderable,
  empty,
  previewing,
  layoutsOpen,
  stack,
  row,
  flow,
  act,
}: PageSheetProps) {
  const id = page.id;
  // An article page's Lines pattern ruled on its writing's baselines, inside its margins.
  const ruling =
    page.flow && hasArticle
      ? {
          pitch: articleBodyLinePx(articleStyle),
          inset: articleMarginPx(articleStyle),
          top: articleTopMarginPx(articleStyle),
        }
      : undefined;
  // An article page's header and footer (its page number among them), when its article has them. A card
  // says its place in the stack instead (FlashcardFooter).
  const bands =
    page.flow && hasArticle
      ? pageBandLayout(
          articleStyle,
          pages.filter((p) => p.flow === page.flow),
          page,
          documentName,
        )
      : null;
  // No "Page n": the page navigator under the page says which it is.
  const label = pageLabel({ ...page, name: shownName }, page.index, 1);
  // The name (when the page has one) and the rest (its size and kind), as pageLabel joins them.
  const labelParts = shownName
    ? { name: shownName, rest: label.slice(shownName.length + 3) }
    : { name: '', rest: label };
  // The label fits the page's on-screen width, less the title bar's buttons; too narrow, it
  // hides. The title bar's room on screen: the page's width at this zoom. The cog takes its
  // corner.
  const room = page.rect.width * zoom;
  // A locked page offers nothing to add (docs/specs/007-editor/pages-mode.md
  // "Locking a page"): no Layouts, no layout invite, no kind choice.
  const locked = page.locked === true;
  // An infographic or slide page's Layouts and Background sit beside its cog, always; a
  // locked page offers neither.
  const pageButtons =
    editable &&
    !locked &&
    !page.flow &&
    (page.kind === 'slide' || pageKindOf(page) === 'infographic');
  // An infographic or slide page's Tidy, left of its Background, shown only while it would
  // change something.
  const tidyButton = pageButtons && tidy;
  // An article page's Style, Text and Background sit beside its cog (PageArticleButtons); a locked page
  // offers none.
  const articleButtons = editable && !locked && !!page.flow && hasArticle;
  // Notes, first, once the deck has a slide of the page (PageNotesButton), on a phone too,
  // so note cards can be written anywhere (docs/specs/012-collaboration/speaker-note-cards.md
  // "Writing note cards"). Its place in the deck is in Contents' ⋯ menu (page-row-slides).
  const notesButton = editable && !!deck;
  // Tab Style, first in the looks group; an article page's own Style leads with it instead.
  const styleButton = editable && tabStyle && !articleButtons;
  // The title bar's fixed buttons (the cog, the lock, Notes and an infographic or slide
  // page's): the label has what they leave.
  const buttons = {
    edit: editable,
    locked,
    notes: notesButton,
    page: pageButtons,
    article: articleButtons,
    style: styleButton,
    tidy: tidyButton,
  };
  // The buttons name themselves on a desktop while the page is wide enough on screen to hold
  // them named; zoomed out further they drop to their icons, as a phone shows them.
  const labelled = titleBarNamed(room, buttons, mobile);
  // A phone's Appearance is named while the page on screen holds it (appearanceNamed).
  const appearanceLabelled = mobile && appearanceNamed(room, buttons);
  const fixedRoom = titleBarFixedRoom(buttons, mobile ? appearanceLabelled : labelled, mobile);
  const labelRoom = room - fixedRoom;
  // An article's Style or Text sections (ArticleStyleSection), for the buttons beside an article page's cog.
  const articleSection = (part: 'style' | 'text') =>
    page.flow && hasArticle ? (
      <ArticleStyleSection
        part={part}
        card={page.kind === 'flashcard'}
        style={storedArticleStyle}
        themeAccent={themeAccent}
        onChange={(change) => act.setArticleStyle(page.flow!, change)}
        onPreview={(style) => act.previewArticleStyle(page.flow!, style)}
      />
    ) : null;
  // A blurred picture paints from its blurred copy, the tone showing until it is ready (pages-mode.md "Image
  // backgrounds", Blur); a hover preview (an Openverse thumbnail) shows sharp.
  const imageFill = background?.fill?.kind === 'image' ? background.fill : undefined;
  const blurSigma = imageFill && !imageFill.preview ? pageImageBlurSigma(imageFill, page.rect) : 0;
  const blurredSrc = useBlurredPageImage(
    blurSigma > 0 && imageFill ? pageImageSrc(imageFill, pictureOf) : undefined,
    page.rect,
    blurSigma,
  );
  const blurredPicture = blurSigma > 0 ? () => blurredSrc ?? undefined : undefined;
  return (
    <div
      data-page={page.orientation}
      data-page-id={id}
      // The Pages tour picks its track from the page's kind (docs/specs/007-editor/pages-tour.md).
      data-page-kind={pageKindOf(page)}
      data-page-locked={locked ? '' : undefined}
      className={`pointer-events-none absolute transition-[left,top,width,height,opacity] duration-200 ease-out motion-reduce:transition-none ${
        dragging ? 'opacity-60' : ''
      } ${
        background?.fill ? '' : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
      }`}
      style={{
        left: page.rect.x,
        top: page.rect.y,
        width: page.rect.width,
        height: page.rect.height,
        // Presenting a page slide, a spread shadow blacks out the whole surround.
        boxShadow: letterbox
          ? `0 0 0 ${LETTERBOX_SPREAD}px #000`
          : '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
        ...pageSheetStyle(background, ruling, blurredPicture ?? pictureOf),
      }}
    >
      {/* A slide's animated background, over its gradient and under all on it. */}
      {background?.fill?.kind === 'gradient' && background.fill.motion ? (
        <PageMotionLayer
          motion={background.fill.motion}
          fill={background.fill}
          width={page.rect.width}
          height={page.rect.height}
        />
      ) : null}
      <div
        // As tall as the title bar beside it, so the two sit on one line.
        // None on a phone ("Beside the cog"): the name is in Contents and the cog sheet.
        className={`absolute left-0 flex h-[34px] items-center ${labelRoom < LABEL_MIN || bare || mobile ? 'hidden' : ''}`}
        style={{
          bottom: '100%',
          marginBottom: 6 / zoom,
          maxWidth: labelRoom,
          ...steady(zoom, 'bottom left'),
        }}
      >
        <PageLabelCard
          label={label}
          name={labelParts.name}
          rest={labelParts.rest}
          grab={editable && reorderable}
          onPointerDown={(e) => act.dragDown(id, e)}
          onPointerMove={(e) => act.dragMove(id, e)}
          onPointerUp={(e) => act.dragUp(id, e)}
          onPointerCancel={act.dragCancel}
          onClick={() => {
            if (!act.endsDrag()) act.goToPage(page);
          }}
        />
      </div>
      {editable ? (
        // The page's own controls, one toolbar card in three groups (PageTitleBar): how the
        // page looks, then tools, then the page itself at its corner. A press on them keeps an
        // article's toolbar.
        <PageTitleBar
          keepArticleActive
          className="absolute right-0"
          style={{ bottom: '100%', marginBottom: 6 / zoom, ...steady(zoom, 'bottom right') }}
          groups={[
            [
              // On a phone the looks gather under Appearance, their own controls mounted headless.
              mobile ? (
                <PageAppearanceButton
                  key="appearance"
                  rows={appearanceRows(buttons)}
                  article={articleButtons}
                  labelled={appearanceLabelled}
                  onPick={(choice, from) =>
                    choice === 'style' && !articleButtons
                      ? openTabStyleFrom(from)
                      : act.ask(id, choice)
                  }
                />
              ) : null,
              // Tab Style (PageTabStyleButton): the whole tab's look.
              styleButton && !mobile ? (
                <PageTabStyleButton key="style" labelled={labelled} />
              ) : null,
              // An article page's Style (leading with Tab Style) and Text (PageArticleButtons).
              articleButtons && page.flow ? (
                <PageArticleButtons
                  key="article"
                  tabStyle={tabStyle}
                  labelled={labelled}
                  headless={mobile}
                  styleRequest={styleRequest}
                  textRequest={textRequest}
                  section={articleSection}
                />
              ) : null,
              // An infographic or slide page's Layouts (PageLayoutsButton).
              pageButtons ? (
                <PageLayoutsButton
                  key="layouts"
                  page={page}
                  labelled={labelled}
                  headless={mobile}
                  openRequest={layoutsRequest}
                  onOpenChange={(isOpen) => act.layoutsOpenChange(id, isOpen)}
                  onApply={(layout) => act.applyLayout(id, layout)}
                  onPreview={(layout) => act.previewLayout(id, layout ?? null)}
                />
              ) : null,
              // An infographic, slide or article page's Background (PageBackgroundButton).
              pageButtons || articleButtons ? (
                <PageBackgroundButton
                  key="background"
                  page={page}
                  labelled={labelled}
                  themePresets={themePresets}
                  headless={mobile}
                  openRequest={backgroundRequest}
                  onBackground={(patch) => act.setBackground(id, patch)}
                  onPreview={(patch) => act.previewBackground(id, patch ?? null)}
                  applyToAll={{
                    reach: applyReach,
                    onApply: () => act.applyBackgroundToAll(id),
                  }}
                />
              ) : null,
            ],
            [
              // This slide's notes once it is in the deck (PageNotesButton).
              notesButton && deck ? (
                <PageNotesButton key="notes" pageId={id} deck={deck} labelled={labelled} />
              ) : null,
              // An infographic or slide page's Tidy, while it would change something; never on a phone.
              tidyButton && tidyEdit && !mobile ? (
                <PageTidyUpButton key="tidy" pageId={id} edit={tidyEdit} labelled={labelled} />
              ) : null,
            ],
            [
              // No lock on a phone: the cog sheet holds it (PagePanel's actions).
              mobile ? null : (
                <PageLockButton
                  key="lock"
                  locked={locked}
                  labelled={labelled}
                  onToggle={() => act.setLocked(id, !locked)}
                />
              ),
              <PageCog
                key="cog"
                name={`${shownName ?? (many ? `Page ${page.index + 1}` : 'Page')} settings`}
                open={open}
                onToggle={() => act.toggle(id)}
                cogRef={(el) => act.cogRef(id, el)}
              />,
            ],
          ]}
        />
      ) : null}
      {pageButtons &&
      layoutInviteShows(page, {
        editable,
        placing,
        empty,
        choosing,
        previewing,
        layoutsOpen,
        zoom,
      }) ? (
        <EmptyPageInvite
          pageId={id}
          zoom={zoom}
          label="Use a Layout"
          onOpen={() => {
            track('UI', 'Opened', 'EmptyPageInvite');
            act.requestLayouts(id);
          }}
        />
      ) : null}
      {choosing && editable ? (
        <FirstPageChoice zoom={zoom} onChoose={(kind) => act.choosePageKind(id, kind)} />
      ) : null}
      {bands ? <PageBands layout={bands} dark={pageIsDark(page)} /> : null}
      {stack && row && page.flow ? (
        <FlashcardFooter
          card={page}
          stack={stack}
          row={row}
          // Zen shows the card alone: its place, no buttons.
          {...(bare ? {} : { onGo: act.focusPage })}
          flow={flow}
          margin={articleMarginPx(articleStyle)}
          font={resolveFontStack(resolveArticleStyle(articleStyle).bodyFont)}
        />
      ) : null}
    </div>
  );
});
