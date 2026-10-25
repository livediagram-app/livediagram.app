// The frame every accounts email is drawn in (liveworkspace/docs/accounts.md "Emails"), the same as the apps' own
// (each product's docs/specs/014-identity/transactional-email.md): a card on the brand's palest tint, its prism's
// colours in a band across the top, the logo mark beside the wordmark, and a sign-off. Plain, inline-styled HTML in
// tables, which email clients keep. An email speaks for liveworkspace, or for the app it was sent through, in that
// app's colours and logo.
import { BRAND_APPS, type BrandApp } from '@liveworkspace/brand/svg';
import { APP_SITES, LOCAL_PORTS, type AppSiteId, type SiteId } from '@liveworkspace/sites';
import type { Env } from './env.ts';

export const INK = '#0f172a';
export const MUTED = '#475569';
const FAINT = '#94a3b8';
const RULE = '#e2e8f0';

export type EmailBrand = {
  // The wordmark after "live".
  word: string;
  // Where the lockup links: the site's home in this environment.
  home: string;
  // The mark, a transparent 64px PNG on the site (Gmail and Outlook drop SVG, and most clients block data: images).
  logo: string;
  // "live" in the wordmark, and links: the lockup's light-mode accent.
  accent: string;
  // The band across the top: the prism's light, vivid and deep stops. Outlook ignores the gradient and paints
  // `vivid` underneath.
  band: { light: string; vivid: string; deep: string };
  // The page behind the card (brand-50), and the tint and edge of a panel inside it (brand-50 / brand-200).
  canvas: string;
  panel: string;
  panelEdge: string;
};

const origin = (url: string) => url.replace(/\/+$/, '');

// An app's address in this environment: its live site, staging's, or its local port (AGENTS.md).
export function appUrl(env: Pick<Env, 'ENVIRONMENT'>, app: SiteId): string {
  if (env.ENVIRONMENT === 'development') return `http://localhost:${LOCAL_PORTS[app]}`;
  if (env.ENVIRONMENT === 'staging') return `https://staging.${app}`;
  return `https://www.${app}`;
}

// liveworkspace's own: the slate prism of the site's icon (apps/site/app/icon.svg), on slate.
function workspaceBrand(env: Pick<Env, 'BASE_URL'>): EmailBrand {
  const home = origin(env.BASE_URL);
  return {
    word: 'workspace',
    home,
    logo: `${home}/email/liveworkspace-mark-64.png`,
    accent: '#334155',
    band: { light: '#93a7be', vivid: '#64748b', deep: '#46567b' },
    canvas: '#f1f5f9',
    panel: '#f8fafc',
    panelEdge: RULE,
  };
}

/** The brand an email wears: `app`'s, or liveworkspace's for null. */
export function emailBrand(
  env: Pick<Env, 'ENVIRONMENT' | 'BASE_URL'>,
  app: AppSiteId | null,
): EmailBrand {
  const site = app ? APP_SITES.find((s) => s.id === app) : undefined;
  if (!app || !site) return workspaceBrand(env);
  const identity = BRAND_APPS[site.name as BrandApp];
  const home = appUrl(env, app);
  const palette = identity.palettes.light;
  return {
    word: identity.word,
    home,
    logo: `${home}/email/${site.name}-mark-64.png`,
    accent: identity.lockup.light.accent,
    band: { light: palette.light, vivid: palette.vivid, deep: palette.deep },
    canvas: identity.ramp[50],
    panel: identity.ramp[50],
    panelEdge: identity.ramp[200],
  };
}

// The mark and the "live" + word wordmark, linked home. A table rather than flex so the two share a baseline in
// Outlook too; the image's alt is empty because the wordmark beside it says the name when images are blocked.
function lockup(brand: EmailBrand): string {
  return `<a href="${brand.home}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0"><tr>
          <td style="padding-right:10px;vertical-align:middle"><img src="${brand.logo}" width="28" height="28" alt="" style="display:block;border:0;outline:none;width:28px;height:28px"></td>
          <td style="vertical-align:middle;font-size:18px;font-weight:600;letter-spacing:-0.3px;color:${INK}"><span style="color:${brand.accent}">live</span>${brand.word}</td>
        </tr></table></a>`;
}

export type Frame = {
  // The dim line an inbox shows after the subject.
  preheader: string;
  heading: string;
  // The card's body, already HTML.
  body: string;
  // The sign-off under the rule, already HTML.
  footer: string;
};

/** A whole email's HTML: `frame` in `brand`'s card. */
export function frame(brand: EmailBrand, content: Frame): string {
  const { band } = brand;
  return `<!doctype html>
<html><body style="margin:0;background:${brand.canvas};padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden">${content.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${RULE};border-radius:14px;overflow:hidden">
      <tr><td style="height:6px;line-height:6px;font-size:0;background-color:${band.vivid};background-image:linear-gradient(90deg,${band.light} 0%,${band.vivid} 45%,${band.deep} 100%)">&nbsp;</td></tr>
      <tr><td style="padding:24px 32px 0">
        ${lockup(brand)}
      </td></tr>
      <tr><td style="padding:20px 32px 32px">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK}">${content.heading}</h1>
        ${content.body}
      </td></tr>
      <tr><td style="padding:0 32px 28px">
        <p style="margin:24px 0 0;border-top:1px solid ${RULE};padding-top:16px;color:${FAINT};font-size:12px;line-height:1.6">${content.footer}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** A paragraph of body copy. */
export const paragraph = (html: string, top = 0) =>
  `<p style="margin:${top}px 0 0;color:${MUTED};font-size:15px;line-height:1.6">${html}</p>`;
