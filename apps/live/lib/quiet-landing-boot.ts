import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DARK_CANVAS_PATTERN_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@livediagram/document';
import { WELCOME_PARAM } from './new-document-params';

// The quiet landing's pre-paint guard (docs/specs/007-editor/new-document-route.md). The hero's
// launch window grows into a full-screen blank canvas and navigates to /new?blank=1&welcome=1;
// that page must paint the same canvas from its very first frame. The root layout renders these
// in <head>, so the flag is on <html> before the body exists: the body hides and <html> paints the Default scheme's paper and dots
// (BlankCanvasScreen's canvas) until /new mounts BlankCanvasScreen and lifts the flag.
export const QUIET_LANDING_ATTR = 'data-quiet-landing';
// The /new page's prerendered loader (CanvasLoader), shown only under the flag: the body is hidden
// until React mounts BlankCanvasScreen, and a visibility:visible child still paints inside it, so
// the canvas shows its loader from the first frame rather than sitting blank until hydration.
export const QUIET_LANDING_LOADER_CLASS = 'quiet-landing-loader';

export const QUIET_LANDING_BOOT_SCRIPT = `try{var p=new URLSearchParams(location.search);if(/^\\/new\\/?$/.test(location.pathname)&&p.has('blank')&&p.has('${WELCOME_PARAM}'))document.documentElement.setAttribute('${QUIET_LANDING_ATTR}','')}catch(e){}`;

const dots = (paper: string, dot: string) =>
  `${paper} radial-gradient(circle,${dot} 1px,transparent 1px) 0 0/24px 24px`;

export const QUIET_LANDING_CSS = `.${QUIET_LANDING_LOADER_CLASS}{display:none}
html[${QUIET_LANDING_ATTR}] .${QUIET_LANDING_LOADER_CLASS}{display:flex;visibility:visible;position:fixed;inset:0;z-index:1;align-items:center;justify-content:center;padding:0 24px}
html[${QUIET_LANDING_ATTR}] body{visibility:hidden}
html[${QUIET_LANDING_ATTR}]{background:${dots(DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR)}}
html.dark[${QUIET_LANDING_ATTR}]{background:${dots(DARK_CANVAS_BACKGROUND_COLOR, DARK_CANVAS_PATTERN_COLOR)}}`;
