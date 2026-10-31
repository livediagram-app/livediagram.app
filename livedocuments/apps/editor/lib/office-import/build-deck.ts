// A PowerPoint deck's slides built into a tab of slide pages
// (docs/specs/020-import-export/blueprints/office-import.md "buildDeckTab"): a slide page per slide in the slide size
// nearest the deck's shape, each item placed where it sits on its slide, scaled to the page; and each page's notes
// and hidden flag for the Slide Deck.

import {
  layOutPages,
  newSlidePage,
  nextPageId,
  type Element,
  type Page,
  type PageSizeId,
  type Tab,
  type TextElement,
} from '@livedocuments/document';
import { pictureElement } from './build-article';
import { EMU_PER_PT } from './limits';
import type { PptxRead, SlideItem } from './pptx';
import type { PictureOutcome } from './store-images';
import { zipKey } from './zip';

/** What the Slide Deck takes for one imported slide page. */
export type ImportedSlideDetail = { pageId: string; notes?: string; hidden?: true };

// The smallest text a slide brings across, px.
const MIN_TEXT_PX = 8;

/** The slide size nearest a deck's shape: 16:9 or the classic 4:3. */
export function slideSizeFor(cx: number, cy: number): PageSizeId {
  const ratio = cx / cy;
  return Math.abs(ratio - 16 / 9) <= Math.abs(ratio - 4 / 3) ? 'slide' : 'slide-classic';
}

export function buildDeckTab(
  read: Pick<PptxRead, 'cx' | 'cy' | 'slides'>,
  outcomes: ReadonlyMap<string, PictureOutcome>,
  tabName: string,
): { tab: Tab; slides: ImportedSlideDetail[] } {
  const size = slideSizeFor(read.cx, read.cy);
  const pages: Page[] = [];
  // A deck with no slides is one empty slide page (D67).
  const count = Math.max(1, read.slides.length);
  for (let i = 0; i < count; i++) pages.push(newSlidePage(nextPageId(pages), size));
  const laid = layOutPages(pages);

  const elements: Element[] = [];
  const slides: ImportedSlideDetail[] = [];
  read.slides.forEach((slide, i) => {
    const page = laid[i]!;
    const scale = Math.min(page.rect.width / read.cx, page.rect.height / read.cy);
    // The deck centred on the page when their shapes differ.
    const ox = page.rect.x + (page.rect.width - read.cx * scale) / 2;
    const oy = page.rect.y + (page.rect.height - read.cy * scale) / 2;
    for (const item of slide.items) elements.push(elementOf(item, scale, ox, oy, outcomes));
    if (slide.notes || slide.hidden) {
      slides.push({
        pageId: page.id,
        ...(slide.notes ? { notes: slide.notes } : {}),
        ...(slide.hidden ? { hidden: true as const } : {}),
      });
    }
  });

  const tab: Tab = {
    id: crypto.randomUUID(),
    name: tabName.trim() || 'Imported',
    elements,
    pages,
    // A deck holds no articles: the receiving tab's would otherwise linger (mergeImportedTab keeps what is absent).
    articles: {},
    templateChosen: true,
  };
  return { tab, slides };
}

function elementOf(
  item: SlideItem,
  scale: number,
  ox: number,
  oy: number,
  outcomes: ReadonlyMap<string, PictureOutcome>,
): Element {
  const box = {
    x: Math.round(ox + item.box.x * scale),
    y: Math.round(oy + item.box.y * scale),
    width: Math.max(1, Math.round(item.box.cx * scale)),
    height: Math.max(1, Math.round(item.box.cy * scale)),
  };
  if (item.kind === 'picture') {
    return pictureElement(item.picture, outcomes.get(zipKey(item.picture.path)), box);
  }
  const text: TextElement = {
    id: crypto.randomUUID(),
    type: 'text',
    ...box,
    label: item.label,
    textSize: Math.max(MIN_TEXT_PX, Math.round(item.sizePt * EMU_PER_PT * scale)),
    textAlignX: item.alignX,
    textAlignY: item.alignY,
    ...(item.bold ? { textBold: true } : {}),
    ...(item.italic ? { textItalic: true } : {}),
    ...(item.underline ? { textUnderline: true } : {}),
  };
  return text;
}
