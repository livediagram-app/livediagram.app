// A presented template's slides on the document's deck (docs/specs/015-api/mcp-server.md §4.3 and §4.3a,
// docs/specs/012-collaboration/presentation-mode.md "Decks a template seeds"). create_document sends the deck with
// the create; add_tab appends the new tab's slides after the deck's own, read and written back whole.
import type { DocumentResponse } from '@livediagram/api-schema';
import type { Slide, Tab } from '@livediagram/document';
import { templateSlides, withAppendedSlides, type TemplateKind } from '@livediagram/templates';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiJson } from './api';

const newSlideId = () => crypto.randomUUID();

// The slides a template's tab presents as; none for a template that is not presented.
export const slidesForTemplateTab = (kind: TemplateKind, tab: Tab): Slide[] =>
  templateSlides(kind, tab, newSlideId);

// The note a result carries for the slides it added, so the model can say the deck is ready.
export const deckNote = (count: number, tabName: string) =>
  `Tab "${tabName}": ${count} slide${count === 1 ? '' : 's'} added to the deck, in the order the template is presented.`;

/**
 * Appends a template tab's slides to the document's deck. Answers the note to show: what was added, or, when the
 * deck could not be written, that the tab was made without them. Null when the template seeds no slides.
 */
export async function appendTemplateDeck(
  env: Env,
  token: string,
  documentId: string,
  kind: TemplateKind,
  tab: Tab,
): Promise<string | null> {
  const slides = slidesForTemplateTab(kind, tab);
  if (slides.length === 0) return null;
  const path = `/documents/${encodeURIComponent(documentId)}`;
  try {
    const { document } = await apiJson<DocumentResponse>(env, token, path);
    const presentation = withAppendedSlides(document.presentation ?? null, slides);
    await apiJson(env, token, path, { method: 'PUT', body: JSON.stringify({ presentation }) });
  } catch {
    return `Tab "${tab.name}": the tab was made, but its slides could not be added to the deck.`;
  }
  return deckNote(slides.length, tab.name);
}
