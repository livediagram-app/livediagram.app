// Each template's style (docs/specs/011-theme/style-guide.md "Templates"): the page design, typeface and finish it
// opens in, chosen from the style guide for what the template is for, so a template lands dressed rather than plain.
// The theme stays the document's (a design draws in the theme's colours, so it follows a theme change). Text-heavy
// templates wear quiet designs; decks take rhythm (bold on title and section slides, quieter on the rest). The
// designed deliverables (poster, résumé, recipe, card, plans) carry their own art and are left as they are.
import type { Finish, PageDesign, Tab } from '@livedocuments/document';
import type { TemplateKind } from './templates';

export type TemplateStyle = { design?: PageDesign; font?: string; finish?: Finish };

const d = (id: PageDesign['id'], extra: Omit<PageDesign, 'id'> = {}): PageDesign => ({
  id,
  ...extra,
});
// A deck's design: bold on its title and section slides, quieter between.
const deck = (id: PageDesign['id']) => d(id, { rhythm: true });

const STYLES: Partial<Record<TemplateKind, TemplateStyle>> = {
  // Decks
  'slide-deck': { design: deck('soft-mesh'), font: 'poppins', finish: 'flexible' },
  'launch-keynote': { design: deck('aurora'), font: 'space-grotesk', finish: 'flexible' },
  'quarterly-review': { design: deck('corner-accents'), font: 'inter', finish: 'professional' },
  'board-update': { design: deck('side-rail'), font: 'inter', finish: 'professional' },
  'team-welcome': { design: deck('blobs'), font: 'poppins', finish: 'flexible' },
  'workshop-kickoff': { design: deck('dots'), font: 'nunito', finish: 'sketch' },
  'class-lesson': { design: deck('torn-paper'), font: 'nunito', finish: 'flexible' },
  // Flashcards
  'talk-flashcards': { design: d('paper-grain'), font: 'inter', finish: 'flexible' },
  'wedding-toast': { design: d('linen'), font: 'lora', finish: 'flexible' },
  'pitch-flashcards': { design: d('soft-mesh'), font: 'poppins', finish: 'flexible' },
  'class-presentation': { design: d('dots'), font: 'nunito', finish: 'flexible' },
  // Written documents: quiet designs that leave the words room.
  article: { design: d('side-rail'), font: 'inter', finish: 'professional' },
  'working-backwards': { design: d('paper-grain'), font: 'inter', finish: 'professional' },
  'meeting-notes': { design: d('noise'), font: 'inter', finish: 'flexible' },
  'lesson-plan': { design: d('corner-accents'), font: 'nunito', finish: 'flexible' },
  'business-proposal': { design: d('corner-accents'), font: 'inter', finish: 'professional' },
  'design-doc': { design: d('grid'), font: 'inter', finish: 'professional' },
  'status-report': { design: d('edge-bands'), font: 'inter', finish: 'professional' },
  'cover-letter': { design: d('linen'), font: 'lora', finish: 'professional' },
  'product-one-pager': { design: d('soft-shadows'), font: 'poppins', finish: 'flexible' },
  'research-report': { design: d('paper-grain'), font: 'lora', finish: 'professional' },
  newsletter: { design: d('edge-bands'), font: 'poppins', finish: 'flexible' },
  'case-study': { design: d('side-rail'), font: 'inter', finish: 'professional' },
  'onboarding-handbook': { design: d('soft-shadows'), font: 'nunito', finish: 'flexible' },
  // Infographic documents built from layouts: a finish and type that suit them, art left to their own pages.
  'data-story': { font: 'space-grotesk', finish: 'professional' },
  'how-it-works': { font: 'poppins', finish: 'flexible' },
  versus: { font: 'poppins', finish: 'flexible' },
};

/** The style a template opens in, if it has one. */
export function templateStyle(kind: TemplateKind): TemplateStyle | undefined {
  return STYLES[kind];
}

/** A template's style as tab settings (templateCanvasOverrides): its design, typeface and finish. */
export function templateStyleOverrides(kind: TemplateKind): Partial<Tab> {
  const style = STYLES[kind];
  if (!style) return {};
  return {
    ...(style.design ? { pageDesign: style.design } : {}),
    ...(style.font ? { font: style.font } : {}),
    ...(style.finish ? { finish: style.finish } : {}),
  } as Partial<Tab>;
}
