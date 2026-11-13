// The look every app's emails share (each product's docs/specs/014-identity/transactional-email.md): plain,
// inline-styled, email-client-safe HTML (no external CSS, tables for layout where it matters), a brand band across
// the top of a white card, the app's lockup above and below. Each api's email/templates.ts binds it once with its
// brand (colours, logo, wordmark, tagline, default sign-off) and keeps its own builders and words.
import { cutText } from '@liveworkspace/model-core/text-cut';

// The body text and headings: slate-900 and slate-600, the same in every app.
const INK = '#0f172a';
const MUTED = '#475569';
// The logo slot, in px; the PNG is 64px, 2x the slot.
const LOGO_SIZE = 28;

export type EmailBrand = {
  // The button's fill and the links' colour (brand-500 or a darker step where white text needs AA).
  brand: string;
  // The wordmark's "live" accent, as in the site header's light mode.
  wordmarkAccent: string;
  // The brand prism's light-to-deep run, for the band across the top of the card. Outlook ignores the gradient and
  // paints `brand` underneath instead.
  bandGradient: string;
  // The page behind the card: brand-50, so the frame reads as the app before a word is read.
  canvas: string;
  // The logo mark beside the wordmark. A transparent PNG on the public site, not inline SVG: Gmail and Outlook drop
  // SVG, and most clients block data: images. A path kept for email alone, because every message ever sent points
  // at it.
  logoPath: string;
  // The wordmark after "live": `diagram`, `planner`.
  wordmarkTail: string;
  // The line under the bottom lockup, before the site link.
  tagline: string;
  // The default sign-off, for an email that names no footer of its own.
  accountFooter: string;
};

export type EmailSection = {
  heading: string;
  intro: string;
  // The dim inbox preview line shown next to the subject. Kept distinct from the heading so the two-line inbox
  // listing reads well; falls back to the intro.
  preheader?: string;
  points?: string[];
  outro?: string;
  ctaText?: string;
  ctaHref?: string;
  footer?: string;
};

// Where every opt-out category can be turned off: the Settings dialog's Notifications category, deep-linked
// (docs/specs/007-editor/user-preferences.md). Used by both the footer link and the List-Unsubscribe header. The old
// `/explorer/profile` URL still redirects here, which matters because every email already sent carries it and an
// unsubscribe link cannot rot.
export function notificationSettingsUrl(base: string): string {
  return `${base}/explorer?settings=notifications`;
}

// The plain-text form of a name for a subject line: one line, at most 80 characters, never half an emoji.
export function subjectText(s: string): string {
  return cutText(s.replace(/[\r\n]+/g, ' '), 80);
}

// docs/specs/012-collaboration/comment-mentions.md: the quote of a mention email is the author's own words, cut at a
// word.
export const MENTION_QUOTE_CHARS = 280;

export function mentionQuote(text: string): string {
  const flat = text.trim().replace(/\s+/g, ' ');
  if (flat.length <= MENTION_QUOTE_CHARS) return flat;
  const cut = cutText(flat, MENTION_QUOTE_CHARS);
  const space = cut.lastIndexOf(' ');
  return `${(space > MENTION_QUOTE_CHARS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function createEmailLayout(look: EmailBrand) {
  const { brand: BRAND, wordmarkAccent: WORDMARK_ACCENT } = look;

  // Footer for an opt-out notification email: the reason plus a link to the settings where the recipient can turn
  // the category off in one click.
  function manageNotificationsFooter(base: string, reason: string): string {
    const href = notificationSettingsUrl(base);
    return `${reason} <a href="${href}" style="color:${BRAND};text-decoration:underline">Manage your notifications</a> to turn these off.`;
  }

  // The mark + wordmark, linked home. A table rather than flex so the two sit on one baseline in Outlook too. The
  // image's alt is empty because the wordmark beside it already says the name when images are blocked.
  function lockup(base: string, fontSize: number, centred = false): string {
    const mark = Math.round((LOGO_SIZE * fontSize) / 18);
    const margin = centred ? 'margin:0 auto' : 'margin:0';
    return `<a href="${base}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" style="${margin}"><tr>
          <td style="padding-right:10px;vertical-align:middle"><img src="${base}${look.logoPath}" width="${mark}" height="${mark}" alt="" style="display:block;border:0;outline:none;width:${mark}px;height:${mark}px"></td>
          <td style="vertical-align:middle;font-size:${fontSize}px;font-weight:600;letter-spacing:-0.3px;color:${INK}"><span style="color:${WORDMARK_ACCENT}">live</span>${look.wordmarkTail}</td>
        </tr></table></a>`;
  }

  function shell(base: string, section: EmailSection): string {
    const preheader = `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden">${section.preheader ?? section.intro}</span>`;
    const points = (section.points ?? [])
      .map(
        (p) =>
          `<li style="margin:0 0 10px;color:${MUTED};font-size:15px;line-height:1.6">${p}</li>`,
      )
      .join('');
    const list = points ? `<ul style="margin:18px 0 0;padding-left:20px">${points}</ul>` : '';
    const outro = section.outro
      ? `<p style="margin:20px 0 0;color:${MUTED};font-size:15px;line-height:1.6">${section.outro}</p>`
      : '';
    const cta =
      section.ctaText && section.ctaHref
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
           <tr><td style="border-radius:8px;background:${BRAND}">
             <a href="${section.ctaHref}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">${section.ctaText}</a>
           </td></tr>
         </table>`
        : '';
    return `<!doctype html>
<html><body style="margin:0;background:${look.canvas};padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
      <tr><td style="height:6px;line-height:6px;font-size:0;background-color:${BRAND};background-image:${look.bandGradient}">&nbsp;</td></tr>
      <tr><td style="padding:24px 32px 0">
        ${lockup(base, 18)}
      </td></tr>
      <tr><td style="padding:20px 32px 32px">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK}">${section.heading}</h1>
        <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.6">${section.intro}</p>
        ${list}
        ${outro}
        ${cta}
      </td></tr>
      <tr><td style="padding:0 32px 28px">
        <p style="margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;color:#94a3b8;font-size:12px;line-height:1.6">
          ${section.footer ?? look.accountFooter}
        </p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td align="center" style="padding:20px 32px 0">
        ${lockup(base, 14, true)}
        <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">${look.tagline} <a href="${base}" style="color:${WORDMARK_ACCENT};text-decoration:none">${base.replace(/^https?:\/\//, '')}</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  }

  return { shell, manageNotificationsFooter };
}
