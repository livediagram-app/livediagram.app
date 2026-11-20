'use client';

// A page's title bar row (docs/specs/007-editor/pages-mode.md "Beside the cog"): the Quick Style bar's slot, then the
// page's own controls, one toolbar card in three groups (PageTitleBar): how the page looks, then tools, then the page
// itself at its corner. A press on them keeps an article's toolbar. The slot sits first in the row, left of it, empty
// until the selection is on this page; the row itself takes no presses, only the cards in it.
//
// Its own memoised component, out of CanvasPageSheet (docs/specs/007-editor/blueprints/flashcards.md "Performance and
// limits"): the sheet renders for its card's writing on every typing commit (FlashcardFooter reads it), and this row
// reads none of it, so it skips those renders.

import { memo, type CSSProperties } from 'react';
import { PageLockButton } from '@liveworkspace/workbench/components/canvas/PageLockButton';
import { PageCog, PageTitleBar } from '@liveworkspace/workbench/components/canvas/PageTitleBar';
import {
  sameArticleValue,
  type ArticleStyle,
  type LaidOutPage,
  type ThemeBackgroundPreset,
} from '@liveknowledge/document';
import type { PageDeckControls, PageEdits } from '@/hooks/editor/usePagesMode';
import { openTabStyleFrom } from '@/lib/tab-style-opener';
import { appearanceRows, PageAppearanceButton } from './PageAppearanceButton';
import { ArticleStyleSection } from './article/ArticleStyleSection';
import { PageArticleButtons } from './PageArticleButtons';
import { PageBackgroundButton } from './PageBackgroundButton';
import { PageLayoutsButton } from './PageLayoutsButton';
import { PageNotesButton } from './PageNotesButton';
import { PageTabStyleButton } from './PageTabStyleButton';
import { PageTidyUpButton } from './PageTidyUpButton';
import { QuickStyleBarSlot } from './QuickStyleBarSlot';
import type { PageSheetActions } from './CanvasPageSheet';

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
export const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

export type PageSheetTitleBarProps = {
  page: LaidOutPage;
  zoom: number;
  mobile: boolean;
  // The buttons named (a desktop's, the page wide enough on screen), and a phone's Appearance named.
  labelled: boolean;
  appearanceLabelled: boolean;
  // Which of the buttons show (CanvasPageSheet works them out, as the label's room needs them too).
  locked: boolean;
  pageButtons: boolean;
  articleButtons: boolean;
  styleButton: boolean;
  notesButton: boolean;
  tidyButton: boolean;
  tabStyle: boolean;
  hasArticle: boolean;
  storedArticleStyle: ArticleStyle | undefined;
  themeAccent: string;
  themePresets: ThemeBackgroundPreset[];
  deck: PageDeckControls | undefined;
  tidyEdit: Pick<PageEdits, 'tidyPage' | 'previewTidy'> | undefined;
  applyReach: number;
  open: boolean;
  styleRequest: number;
  textRequest: number;
  layoutsRequest: number;
  backgroundRequest: number;
  shownName: string | undefined;
  many: boolean;
  act: PageSheetActions;
};

function PageSheetTitleBarView({
  page,
  zoom,
  mobile,
  labelled,
  appearanceLabelled,
  locked,
  pageButtons,
  articleButtons,
  styleButton,
  notesButton,
  tidyButton,
  tabStyle,
  hasArticle,
  storedArticleStyle,
  themeAccent,
  themePresets,
  deck,
  tidyEdit,
  applyReach,
  open,
  styleRequest,
  textRequest,
  layoutsRequest,
  backgroundRequest,
  shownName,
  many,
  act,
}: PageSheetTitleBarProps) {
  const id = page.id;
  const buttons = {
    edit: true,
    locked,
    notes: notesButton,
    page: pageButtons,
    article: articleButtons,
    style: styleButton,
    tidy: tidyButton,
  };
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
  return (
    <div
      className="pointer-events-none absolute right-0 flex items-center gap-1.5"
      style={{ bottom: '100%', marginBottom: 6 / zoom, ...steady(zoom, 'bottom right') }}
    >
      <QuickStyleBarSlot pageId={id} named={labelled} />
      <PageTitleBar
        keepArticleActive
        groups={[
          [
            // On a phone the looks gather under Appearance, their own controls mounted headless.
            mobile ? (
              <PageAppearanceButton
                key="appearance"
                pageId={id}
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
            styleButton && !mobile ? <PageTabStyleButton key="style" labelled={labelled} /> : null,
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
    </div>
  );
}

// The stored style compared by value: a typing commit parses the article afresh, so its style comes back an equal new
// object (parseArticleFlow), and the row would render for every key.
function sameTitleBarProps(a: PageSheetTitleBarProps, b: PageSheetTitleBarProps): boolean {
  for (const key of Object.keys(b) as (keyof PageSheetTitleBarProps)[]) {
    if (Object.is(a[key], b[key])) continue;
    if (key === 'storedArticleStyle' && sameArticleValue(a[key], b[key])) continue;
    return false;
  }
  return Object.keys(a).length === Object.keys(b).length;
}

export const PageSheetTitleBar = memo(PageSheetTitleBarView, sameTitleBarProps);
