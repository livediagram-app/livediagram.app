import { BAND_LEAD, BAND_SECTION, BAND_TITLE } from '@/components/band-classes';
import { EYEBROW } from '@/components/eyebrow';
import { TemplateCard } from '@/components/TemplateCard';
import { sectionTemplates } from '@/lib/section-templates';

// A category page's "Start from a template" band (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"), between its feature cards and "Explore more of liveplanner": up to nine of the
// category's best templates (lib/section-templates.ts) in a grid of threes, each a card that opens it
// in the editor, so a visitor who has just read about the feature can start on one. It sits on the
// landing gallery's inset band so it reads apart from the white feature grid above it.
export function SectionTemplates({ sectionId, label }: { sectionId: string; label: string }) {
  const templates = sectionTemplates(sectionId);
  if (templates.length === 0) return null;
  return (
    <section aria-labelledby="section-templates-title" className={BAND_SECTION}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>{label}</p>
          <h2 id="section-templates-title" className={BAND_TITLE}>
            Start from a template
          </h2>
          <p className={BAND_LEAD}>
            Pick one and you are on the canvas with it already drawn, ready to make your own.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.kind} className="enter-on-scroll">
              <TemplateCard template={t} source="Feature.Templates" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
