import { SectionTemplates as Band } from '@liveworkspace/marketing-site/components/SectionTemplates';
import { TemplateCard } from '@/components/TemplateCard';
import { sectionTemplates } from '@/lib/section-templates';

// A category page's "Start from a template" band (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"), between its feature cards and "Explore more of livehuddle": up to nine of the
// category's best templates (lib/section-templates.ts) in a grid of threes, each a card that opens it
// in the editor, so a visitor who has just read about the feature can start on one. It sits on the
// landing gallery's inset band so it reads apart from the white feature grid above it.
// The band is @liveworkspace/marketing-site's components/SectionTemplates.tsx.
export function SectionTemplates({ sectionId, label }: { sectionId: string; label: string }) {
  return (
    <Band
      label={label}
      lead="Pick one and you are on the canvas with it already drawn, ready to make your own."
      templates={sectionTemplates(sectionId)}
      Card={TemplateCard}
    />
  );
}
