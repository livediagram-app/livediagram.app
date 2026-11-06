// A mode chosen before the wizard hydrates (docs/specs/007-editor/new-document-route.md "A choice before hydration").
// `/new` is a static export, so its mode cards are on screen before React attaches their handlers, and a click in that
// gap used to do nothing (#238). The inline script below runs as the HTML parses: until the wizard mounts, it takes a
// click on a mode card (capture on window, ahead of React's root listener, so the card never also sees it), remembers
// the mode, and flags the root element so the page shows it is working. The wizard's first layout effect turns the
// script off and creates the remembered mode, so the choice is kept and nothing is created twice.

import { EDITOR_MODES, type EditorMode } from '@livediagram/document';

// The window property the script and the wizard share: undefined before the script runs, null while it listens with
// nothing chosen, a mode once one was chosen, and false once the wizard took over.
const EARLY_MODE_KEY = '__lvdEarlyMode';
// The root element's flag while a chosen mode waits for the wizard.
export const EARLY_MODE_ATTRIBUTE = 'data-early-mode';

type EarlyWindow = { [EARLY_MODE_KEY]?: string | null | false };

export const EARLY_MODE_SCRIPT =
  '(function(){var w=window;if(w.' +
  EARLY_MODE_KEY +
  '!==undefined)return;w.' +
  EARLY_MODE_KEY +
  "=null;w.addEventListener('click',function(e){if(w." +
  EARLY_MODE_KEY +
  "===false)return;var t=e.target,c=t&&t.closest?t.closest('[data-new-mode]'):null;if(!c)return;" +
  'e.preventDefault();e.stopPropagation();w.' +
  EARLY_MODE_KEY +
  "=c.getAttribute('data-new-mode');document.documentElement.setAttribute('" +
  EARLY_MODE_ATTRIBUTE +
  "','')},true)})();";

// While a choice waits: the page says it is working.
export const EARLY_MODE_STYLE = `html[${EARLY_MODE_ATTRIBUTE}],html[${EARLY_MODE_ATTRIBUTE}] *{cursor:progress}`;

/** Turns the script off and answers the mode chosen before hydration, once; null when none was. */
export function takeEarlyModeChoice(): EditorMode | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as EarlyWindow;
  const chosen = w[EARLY_MODE_KEY];
  w[EARLY_MODE_KEY] = false;
  document.documentElement.removeAttribute(EARLY_MODE_ATTRIBUTE);
  return typeof chosen === 'string' && (EDITOR_MODES as readonly string[]).includes(chosen)
    ? (chosen as EditorMode)
    : null;
}

// The bypass pre-hydration guard (docs/specs/007-editor/new-document-route.md): this static page's prerendered HTML is
// the wizard, and React only learns about ?blank=1 / ?template= at hydration. The script runs as the HTML parses,
// before the wizard markup paints, and flags the root element; the style hides the wizard-only content under that flag
// until React swaps in the opening screen.
export const BYPASS_GUARD_SCRIPT =
  "try{var p=new URLSearchParams(location.search);if(p.has('blank')||p.has('template'))document.documentElement.setAttribute('data-just-draw','');if(p.has('mode')||p.has('q'))document.documentElement.setAttribute('data-wizard-preset','')}catch(e){}";
export const BYPASS_GUARD_STYLE =
  'html[data-just-draw] [data-wizard-only],html[data-wizard-preset] [data-wizard-only]{visibility:hidden}';
