import { TemplatePreview } from '@livepages/template-previews';
import { ctaHref, type CtaSource } from '@livepages/api-schema';
import { templateCreateHref } from '@livepages/templates';
import type { GalleryTemplate } from '@/lib/template-gallery';
import { BAND_CARD, BAND_CONTROL_HOVER } from '@/components/band-classes';
import { createLabelPrefix } from '@/lib/create-label';

// One template as a card that creates that document straight away and opens it in the editor
// (/new?template=<kind>, docs/specs/007-editor/new-document-route.md): the editor picker's own preview
// (@livepages/template-previews), so a template looks the same here as it does in the app, then its
// title, then its description. Shared by the landing gallery and each category
// page's "Start from a template" band; `source` is the CTA slot the click is counted under.
export function TemplateCard({
  template,
  source,
}: {
  template: GalleryTemplate;
  source: CtaSource;
}) {
  return (
    <a
      href={ctaHref(templateCreateHref(template.kind), source)}
      className={`preview-motion-host group flex h-full flex-col p-3 ${BAND_CARD} ${BAND_CONTROL_HOVER}`}
    >
      {/* The picker's preview, drawn for a light tile and re-lit onto the dark canvas colour in dark
          by the editor's own rule (preview-art-tile), scaled up from its fixed picker size. */}
      <span className="preview-art-tile preview-motion flex h-24 items-center justify-center rounded-xl bg-slate-50 [&>svg]:h-16 [&>svg]:w-auto">
        <TemplatePreview kind={template.kind} />
      </span>
      <span className="mt-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
        {/* The link's name is its own text, "Create a Blank Article" and the description, so its
            visible title is part of it (WCAG 2.5.3). */}
        <span className="sr-only">{createLabelPrefix(template.title)}</span>
        {template.title}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {template.description}
      </span>
    </a>
  );
}
