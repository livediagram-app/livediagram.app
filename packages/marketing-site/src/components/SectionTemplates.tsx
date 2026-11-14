import type { ComponentType } from 'react';
import { BAND_LEAD, BAND_SECTION, BAND_TITLE } from '../lib/band-classes';
import { EYEBROW } from '../lib/eyebrow';

// A category page's "Start from a template" band (each product's docs/specs/019-marketing/marketing-site.md
// "Feature category pages"), between its feature cards and "Explore more of <product>": up to nine of the
// category's best templates in a grid of threes, each a card that opens it in the editor, so a visitor who has just
// read about the feature can start on one. It sits on the landing gallery's inset band so it reads apart from the
// white feature grid above it. Each product's components/SectionTemplates.tsx hands in the templates, its card
// and its lead; a category with none shows no band.
export function SectionTemplates<T extends { kind: string }>({
  label,
  lead,
  templates,
  Card,
}: {
  label: string;
  lead: string;
  templates: readonly T[];
  Card: ComponentType<{ template: T; source: 'Feature.Templates' }>;
}) {
  if (templates.length === 0) return null;
  return (
    <section aria-labelledby="section-templates-title" className={BAND_SECTION}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className={EYEBROW}>{label}</p>
          <h2 id="section-templates-title" className={BAND_TITLE}>
            Start from a template
          </h2>
          <p className={BAND_LEAD}>{lead}</p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.kind} className="enter-on-scroll">
              <Card template={t} source="Feature.Templates" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
