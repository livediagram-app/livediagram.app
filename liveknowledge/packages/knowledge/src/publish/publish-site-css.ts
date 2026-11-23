// The look of a public site (docs/specs/030-knowledgebase/publishing.md "The public site"): the knowledgebase's Style
// (page-surface.md "Knowledgebase Style") as one small inline stylesheet. The accent is held to 4.5:1 on the page in
// both appearances, the fonts come from the shared catalogue with a system fallback, and the reader's appearance
// picks light or dark. No script: the phone's Pages button is a checkbox and its label.
import {
  FONTS,
  knowledgeThemeAccent,
  legibleOn,
  type KnowledgeStyle,
} from '@liveknowledge/document';

const PAPER = '#ffffff';
const PAPER_DARK = '#0f172a';
const AA = 4.5;
// A page's cover band, as the editor draws it (page-surface.md "The cover": 220 px, 140 px on a phone).
export const COVER_BAND_PX = 220;
export const COVER_BAND_PHONE_PX = 140;

/** The Style as the site draws it: resolved colours and font stacks. */
export type SiteLook = {
  accent: string;
  accentDark: string;
  headingFont: string;
  bodyFont: string;
  /** The Google Fonts stylesheet for both faces. */
  fontsHref: string;
  textPx: number;
  lineHeight: number;
  ruled: boolean;
};

const TEXT_PX = { small: 15, medium: 17, large: 19 } as const;
const LINE_HEIGHT = { compact: 1.5, comfortable: 1.65, relaxed: 1.85 } as const;

/** The knowledgebase's Style, resolved for the site. */
export function siteLook(style: KnowledgeStyle): SiteLook {
  const accent = style.accent ?? knowledgeThemeAccent(style.theme);
  // The style's fonts are catalogue ids (parseKnowledgeStyle); one the catalogue lost reads as its first.
  const fontOf = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0]!;
  const heading = fontOf(style.headingFont);
  const body = fontOf(style.bodyFont);
  const families = [...new Set([heading.google, body.google])];
  return {
    accent: legibleOn(accent, PAPER, AA),
    accentDark: legibleOn(accent, PAPER_DARK, AA),
    headingFont: heading.stack,
    bodyFont: body.stack,
    fontsHref: `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`,
    textPx: TEXT_PX[style.textSize],
    lineHeight: LINE_HEIGHT[style.lineSpacing],
    ruled: style.headingStyle === 'ruled',
  };
}

/** The site's stylesheet for a look. Every value is one this module resolved (hex colours, catalogue stacks,
 *  numbers), never text a person typed. */
export function siteCss(look: SiteLook): string {
  return `
:root{color-scheme:light dark;--accent:${look.accent};--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--bg:${PAPER};--surface:#f8fafc;--wash:#f1f5f9}
@media (prefers-color-scheme:dark){:root{--accent:${look.accentDark};--ink:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--bg:${PAPER_DARK};--surface:#111c2e;--wash:#1e293b}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${look.bodyFont};font-size:${look.textPx}px;line-height:${look.lineHeight}}
a{color:var(--accent)}
a:focus-visible,.pages-toggle:focus-visible~.head .pages-button,input[type=search]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:8px;z-index:10;background:var(--bg);padding:8px 12px;border-radius:6px}
.head{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;height:64px;padding:0 16px;border-bottom:1px solid var(--line);background:var(--bg)}
.brand{font-family:${look.headingFont};font-weight:700;font-size:17px;color:var(--ink);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.search{margin-left:auto;display:flex;min-width:0}
.search input{box-sizing:border-box;width:min(280px,44vw);height:36px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:15px}
.pages-toggle{position:absolute;opacity:0;width:1px;height:1px}
.pages-button{display:none;cursor:pointer;align-items:center;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:8px;font-size:15px;font-weight:500;white-space:nowrap}
.layout{display:flex;max-width:1180px;margin:0 auto}
.side{flex:0 0 260px;position:sticky;top:64px;align-self:flex-start;max-height:calc(100vh - 64px);overflow:auto;padding:24px 12px 24px 16px;border-right:1px solid var(--line);font-size:15px;line-height:1.4}
.side ul{list-style:none;margin:0;padding:0}.side ul ul{padding-left:14px}
.side a{display:block;padding:6px 8px;border-radius:6px;color:var(--muted);text-decoration:none}
.side a:hover{background:var(--wash);color:var(--ink)}
.side a[aria-current=page]{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--ink);font-weight:600}
.side summary{list-style:none;cursor:pointer}.side summary::-webkit-details-marker{display:none}
.side summary a{display:inline-block;width:calc(100% - 22px)}
.side summary::after{content:'';display:inline-block;width:6px;height:6px;margin-left:6px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:rotate(-45deg);vertical-align:middle}
.side details[open]>summary::after{transform:rotate(45deg)}
main{flex:1;min-width:0;padding:32px 48px 64px}
.column{max-width:720px;margin:0 auto}
.crumbs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;padding:0;list-style:none;font-size:14px;color:var(--muted)}
.crumbs li+li::before{content:'/';margin-right:6px}.crumbs a{color:var(--muted)}
h1,h2,h3,h4{font-family:${look.headingFont};line-height:1.25;color:var(--ink)}
h1{font-size:2.1em;margin:0 0 8px}
h2,h3,h4{color:var(--accent)}
h2{font-size:1.5em;margin:1.6em 0 .5em${look.ruled ? ';padding-bottom:.25em;border-bottom:1px solid var(--line)' : ''}}
h3{font-size:1.25em;margin:1.4em 0 .4em}h4{font-size:1.05em;margin:1.2em 0 .3em}
.icon{font-size:2.4em;line-height:1;margin:0 0 8px}
.meta{margin:0 0 28px;font-size:14px;color:var(--muted)}
.lead{font-size:1.15em;color:var(--muted)}
blockquote{margin:1em 0;padding:.2em 0 .2em 1em;border-left:3px solid var(--accent);color:var(--muted)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--wash);padding:.1em .3em;border-radius:4px}
pre{overflow:auto;padding:14px 16px;border-radius:8px;background:var(--wash);border-left:3px solid var(--accent)}pre code{background:none;padding:0}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}
.table{overflow-x:auto;margin:1em 0}table{border-collapse:collapse;width:100%;font-size:.95em}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:color-mix(in srgb,var(--accent) 12%,var(--bg))}
ul.todo{list-style:none;padding-left:4px}ul.todo input{margin-right:6px}
.toc{margin:1em 0;padding:12px 16px;border:1px solid var(--line);border-radius:8px}.toc ol{margin:0;padding-left:18px}.toc-2{margin-left:14px}.toc-3{margin-left:28px}
.footnotes{margin-top:2.5em;padding-top:1em;border-top:1px solid var(--line);font-size:.9em;color:var(--muted)}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:48px;padding-top:24px;border-top:1px solid var(--line)}
.pager a{display:flex;flex-direction:column;max-width:48%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink)}
.pager a:hover{border-color:var(--accent)}.pager span{font-size:13px;color:var(--muted)}.pager .next{margin-left:auto;text-align:right}
.results{list-style:none;padding:0}.results li{padding:14px 0;border-bottom:1px solid var(--line)}.results a{font-weight:600}
.results p{margin:4px 0 0;color:var(--muted);font-size:.95em}mark{background:color-mix(in srgb,var(--accent) 22%,transparent);color:inherit;border-radius:2px}
.cover{position:relative;height:${COVER_BAND_PX}px;margin:-32px -48px 32px;overflow:hidden;background:color-mix(in srgb,var(--accent) 14%,var(--bg))}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover .credit{position:absolute;left:12px;bottom:8px;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,.45);color:rgba(255,255,255,.9);font-size:11px;line-height:16px}
.zone{margin:1.4em auto;border-radius:12px;overflow:hidden}.zone svg{display:block;width:100%;height:auto}
.zone.align-left{margin-left:0}.zone.align-right{margin-right:0}
.pager{clear:both}
@media (min-width:640px){.zone.wrap-left{float:left;max-width:50%!important;margin:.3em 1.4em .8em 0}.zone.wrap-right{float:right;max-width:50%!important;margin:.3em 0 .8em 1.4em}}
@media (prefers-color-scheme:dark){.zone:not(.zone-picture){background:${PAPER}}}
.foot{padding:24px 16px 40px;text-align:center;font-size:13px;color:var(--muted)}.foot a{color:var(--muted)}
@media (max-width:959px){
.pages-button{display:inline-flex}
.side{display:none;position:fixed;inset:64px 0 0 0;z-index:4;max-height:none;background:var(--bg);border-right:0;padding:16px}
.pages-toggle:checked~.layout .side{display:block}
.side a{padding:11px 8px}
main{padding:24px 16px 48px}
.cover{margin:-24px -16px 24px}
.search{flex:0 1 220px}.search input{width:100%;min-width:96px}
}
@media (max-width:639px){.cover{height:${COVER_BAND_PHONE_PX}px}}`;
}
