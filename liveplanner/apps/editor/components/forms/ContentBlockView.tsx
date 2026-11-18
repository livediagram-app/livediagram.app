'use client';

// A content block as a respondent sees it (docs/specs/030-forms/forms.md "Content blocks"): words to explain something,
// a tinted callout, a button to a page or a picture with its caption. It asks nothing, so it has no control, no
// required mark and no error. The builder draws an unselected block with this too.
import type { PublicQuestion } from '@liveplanner/forms';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideExternalLink,
  lucideImage,
  lucideInfo,
  lucideLightbulb,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import { LinkedText } from './LinkedText';
import { useFormImage } from './form-images';

const OutIcon = lucideGlyph(lucideExternalLink, 15);
const PictureIcon = lucideGlyph(lucideImage, 28);
const TONE_ICONS = {
  info: lucideGlyph(lucideInfo, 18),
  tip: lucideGlyph(lucideLightbulb, 18),
  warning: lucideGlyph(lucideTriangleAlert, 18),
} as const;
// A callout's tint: the form colour for Info, amber for a Tip, red for a Warning; each text keeps 4.5:1 on its tint.
const TONE_CLASSES = {
  info: 'border-[color-mix(in_srgb,var(--form-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--form-accent)_8%,white)] dark:bg-[color-mix(in_srgb,var(--form-accent)_14%,rgb(15_23_42))]',
  tip: 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10',
  warning: 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10',
} as const;
const TONE_ICON_CLASSES = {
  info: 'text-[var(--form-accent)]',
  tip: 'text-amber-600 dark:text-amber-300',
  warning: 'text-red-600 dark:text-red-300',
} as const;

export function ContentBlockView({
  block: q,
  aside,
  domId,
}: {
  block: PublicQuestion;
  // Beside the heading (the builder's problem mark).
  aside?: React.ReactNode;
  domId?: string;
}) {
  const heading = q.prompt.trim();
  const kind = q.block ?? 'text';
  if (kind === 'callout') {
    const tone = q.tone ?? 'info';
    const Icon = TONE_ICONS[tone];
    return (
      <div
        id={domId}
        role="note"
        className={`form-box flex gap-3 rounded-xl border p-5 max-sm:p-4 ${TONE_CLASSES[tone]}`}
      >
        <Icon aria-hidden className={`mt-0.5 shrink-0 ${TONE_ICON_CLASSES[tone]}`} />
        <div className="min-w-0 flex-1">
          {heading ? (
            <p className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
              {heading}
            </p>
          ) : null}
          {q.help ? (
            <LinkedText
              text={q.help}
              className={`text-[14px] leading-relaxed text-slate-700 dark:text-slate-200 ${heading ? 'mt-1' : ''}`}
            />
          ) : !heading ? (
            <p className="text-[14px] italic text-slate-500 dark:text-slate-400">Empty callout</p>
          ) : null}
        </div>
        {aside}
      </div>
    );
  }
  return (
    <div
      id={domId}
      className="form-box form-ink rounded-xl border border-slate-200 bg-white p-5 max-sm:p-4 dark:border-slate-700/80 dark:bg-slate-900"
    >
      {heading || aside ? (
        <div className="flex items-start gap-3">
          {heading ? (
            <h2 className="min-w-0 flex-1 text-[18px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
              {heading}
            </h2>
          ) : (
            <span className="flex-1" />
          )}
          {aside}
        </div>
      ) : null}
      {kind === 'image' ? <BlockPicture q={q} /> : null}
      {q.help ? (
        <LinkedText
          text={q.help}
          className={`text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 ${heading || kind === 'image' ? 'mt-2' : ''}`}
        />
      ) : kind === 'text' && !heading ? (
        <p className="text-[14px] italic text-slate-500 dark:text-slate-400">Empty text block</p>
      ) : null}
      {kind === 'link' ? (
        q.url ? (
          <a
            href={q.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="form-box mt-3 inline-flex h-10 max-w-full items-center gap-2 rounded-lg bg-[var(--form-accent)] px-4 text-[14px] font-semibold text-[var(--form-on-accent)] shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <span className="truncate">{q.linkLabel || hostOf(q.url)}</span>
            <OutIcon aria-hidden className="shrink-0" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <p className="mt-3 text-[14px] italic text-slate-500 dark:text-slate-400">
            Add a web address in this block&rsquo;s settings
          </p>
        )
      ) : null}
    </div>
  );
}

// The page a link goes to, by its host ("example.com"), when the button has no words of its own.
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function BlockPicture({ q }: { q: PublicQuestion }) {
  const src = useFormImage(q.imageId);
  const alt = q.prompt.trim() || q.help?.trim() || 'Picture';
  return (
    <div
      className={`overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 ${q.prompt.trim() ? 'mt-3' : ''}`}
    >
      {src ? (
        <img src={src} alt={alt} className="block h-auto max-h-[520px] w-full object-contain" />
      ) : (
        <div className="grid h-40 place-items-center text-slate-400">
          {src === undefined && q.imageId ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-[13px]">
              <PictureIcon aria-hidden />
              {q.imageId ? 'This picture can’t be shown' : 'No picture yet'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
