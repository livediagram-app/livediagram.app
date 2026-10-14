// The CSS an animated GIF's frames carry (docs/specs/020-import-export/blueprints/animated-gif-export.md "The
// snapshot"): the app's own stylesheets, once per export, and per frame the rules that pin every animation at a
// moment of the page's clock.

/** A node (or one of its pseudo-elements) with CSS animations, tagged `data-gif-id="<id>"` in the clone. */
export type AnimatedNode = { id: number; pseudo: '' | '::before' | '::after'; delaysMs: number[] };

/** Rules that stop every animation at `t` ms of the page's clock: an animation whose delay is `d` stands where it
 *  stands `t` ms after it starts, with a delay of `d - t` and paused. Everything else stays paused where it is. */
export function pinRules(nodes: readonly AnimatedNode[], t: number): string {
  let out = '*,*::before,*::after{animation-play-state:paused!important}';
  for (const { id, pseudo, delaysMs } of nodes) {
    const delays = delaysMs.map((d) => `${Math.round(d - t)}ms`).join(',');
    out += `[data-gif-id="${id}"]${pseudo}{animation-delay:${delays}!important;animation-play-state:paused!important}`;
  }
  return out;
}

// The CSSOM a stylesheet reading needs (a CSSRuleList, CSSMediaRule and the rest are this shape).
type RuleLike = {
  cssText: string;
  cssRules?: ArrayLike<RuleLike>;
  media?: { mediaText: string };
};
type SheetLike = { cssRules: ArrayLike<RuleLike> };

/** Every rule of every same-origin stylesheet, as text. Reduce Motion never stills a GIF (spec "What a frame
 *  shows"): a `prefers-reduced-motion: reduce` block is dropped and a `no-preference` block is kept unwrapped, since
 *  inside the image those queries would answer for the exporter's screen. Cross-origin sheets (the webfonts) cannot
 *  be read and are skipped: the tab's fonts travel as embedded @font-face rules instead. */
export function collectCss(sheets: Iterable<SheetLike>): string {
  const out: string[] = [];
  for (const sheet of sheets) {
    let rules: ArrayLike<RuleLike>;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    writeRules(rules, out);
  }
  return out.join('\n');
}

function writeRules(rules: ArrayLike<RuleLike>, out: string[]): void {
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i]!;
    const media = rule.media?.mediaText ?? '';
    if (/prefers-reduced-motion/.test(media)) {
      if (/prefers-reduced-motion\s*:\s*no-preference/.test(media) && !/\bnot\b/.test(media))
        writeRules(rule.cssRules ?? [], out);
      continue;
    }
    const prelude = groupPrelude(rule);
    if (prelude === null) {
      out.push(rule.cssText);
      continue;
    }
    const inner: string[] = [];
    writeRules(rule.cssRules ?? [], inner);
    out.push(`${prelude}{${inner.join('\n')}}`);
  }
}

// A grouping rule (@media, @supports, @layer, @container) re-written round its filtered rules; null for any other
// rule, which is kept as it is (a style rule's own nested rules included).
function groupPrelude(rule: RuleLike): string | null {
  if (!rule.cssRules) return null;
  const head = /^@(media|supports|layer|container)\b[^{]*/i.exec(rule.cssText);
  return head ? head[0].trim() : null;
}
