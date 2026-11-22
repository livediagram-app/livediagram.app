'use client';

// The pictures of liveknowledge' own kinds (docs/specs/013-workspace/automations.md "The screen"; the platform's
// item-ui.md "Pictures"): the moment each trigger hears, or each step makes, resting just before and playing on hover
// or focus of its tile, a trigger's bolt lighting as it fires. Drawn from the platform's scene parts at their fixed
// sizes and moved by its automation-scenes.css alone (transform and opacity, no timers), so they sit beside the
// shared kinds' pictures as one family, and stand still on the played moment with no hover, reduced motion or Reduce
// motion. Loaded with the screen. Decoration only.

import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideBookmark, lucideBookmarkPlus, lucideRotateCcw } from '@liveworkspace/icons/lucide';
import type { GlyphType } from '@liveworkspace/automations-ui/kit';
import type { ItemVignette } from '@liveworkspace/automations-ui/item';
import { Fire, FlowLine, Page } from '@liveworkspace/automations-ui/item';
import { Chip, Cursor, Pill, SparklesGlyph } from '@liveworkspace/automations-ui/scene-parts';
import { PANEL, at, type ToneClasses } from '@liveworkspace/automations-ui/tile-picker/tile-scene';

const MarkGlyph = lucideGlyph(lucideBookmark, 7);
const BackGlyph = lucideGlyph(lucideRotateCcw, 8);

// A text line, as the shared scenes draw one (scene-bits.tsx INK and INK_SOFT), and one in the tone's ink.
const LINE = 'h-[3px] rounded-full';
const INK = `${LINE} bg-slate-300 dark:bg-slate-600`;
const INK_SOFT = `${LINE} bg-slate-200 dark:bg-slate-700`;
const inkOf = (tone: ToneClasses) => `${LINE} ${tone.dot}`;

/** The two steps' icons on their blue tiles, as the shared steps' (ITEM_ACTION_GLYPHS). */
export const DOCUMENT_ACTION_GLYPHS: Readonly<Record<string, GlyphType>> = {
  name_version: lucideGlyph(lucideBookmarkPlus, 16),
  restore_version: lucideGlyph(lucideRotateCcw, 16),
};

// A version list's older rows: the line's width, and whether it is a named one (its mark shown).
const OLDER: readonly (readonly [string, boolean])[] = [
  ['w-9', false],
  ['w-7', true],
];

/** One row of Version History: its dot on the rail and its line, a named one marked. */
function VersionRow({ width, named, tone }: { width: string; named: boolean; tone: ToneClasses }) {
  return (
    <span className="flex h-[10px] items-center gap-1">
      <span
        className={`size-[5px] shrink-0 rounded-full ${named ? tone.dot : 'bg-slate-300 dark:bg-slate-600'}`}
      />
      <span className={`${width} ${named ? INK : INK_SOFT}`} />
      {named ? (
        <span className={`ml-auto ${tone.label}`}>
          <MarkGlyph aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

/** A tab's Version History: a newest row the scene puts on top (`newest`), over the older ones. */
function VersionList({
  tone,
  newest,
  children,
}: {
  tone: ToneClasses;
  newest: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`relative flex w-[84px] shrink-0 flex-col gap-[3px] p-1.5 ${PANEL}`}>
      <span className={`mb-[1px] w-2/5 ${INK}`} />
      {newest}
      {OLDER.map(([width, named]) => (
        <VersionRow key={width} width={width} named={named} tone={tone} />
      ))}
      {children}
    </div>
  );
}

// A page's lines where they rest, out of place, before it rolls back to the marked version.
const ASTRAY: readonly (readonly [string, string])[] = [
  ['w-full', 'translate(6px, 2px) rotate(-6deg)'],
  ['w-4/5', 'translate(-5px, 3px) rotate(5deg)'],
  ['w-3/5', 'translate(7px, -2px) rotate(-4deg)'],
];

/** A page of text gone astray, its lines winding back into place as it plays; `children` stand on it. */
function RollingPage({ children }: { children?: ReactNode }) {
  return (
    <div className={`relative flex h-[44px] w-[56px] shrink-0 flex-col gap-[4px] p-1.5 ${PANEL}`}>
      <span className={`w-1/2 ${INK}`} />
      {ASTRAY.map(([width, rest], i) => (
        <span
          key={width}
          className={`ats-t ats-drag ${width} ${INK_SOFT}`}
          style={at('none', rest, 120 + i * 80)}
        />
      ))}
      {children}
    </div>
  );
}

/** The marked version a page rolls back to: a small sheet with its bookmark. */
function MarkedVersion({ tone }: { tone: ToneClasses }) {
  return (
    <div className="relative shrink-0 rounded-[5px] bg-white p-[3px] shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-700">
      <span
        className={`flex h-[22px] w-[24px] flex-col gap-[3px] rounded-[3px] p-[3px] ${tone.soft}`}
      >
        <span className="h-[2px] w-full rounded-full bg-current opacity-50" />
        <span className="h-[2px] w-3/4 rounded-full bg-current opacity-40" />
      </span>
      <span
        className={`absolute -left-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full ${tone.solid}`}
      >
        <MarkGlyph aria-hidden />
      </span>
    </div>
  );
}

export const DOCUMENT_TRIGGER_SCENES: Readonly<Record<string, ItemVignette>> = {
  // A tab's version list gaining a named entry on top.
  version_named: ({ tone }) => (
    <VersionList
      tone={tone}
      newest={
        <span
          className="ats-t ats-in ats-pop flex h-[10px] items-center gap-1"
          style={at('none', 'translateY(-8px) scale(0.85)', 80)}
        >
          <span className={`size-[5px] shrink-0 rounded-full ${tone.dot}`} />
          <Chip className={tone.soft}>
            <MarkGlyph aria-hidden />
            Signed Off
          </Chip>
        </span>
      }
    >
      <Fire tone={tone} d={420} />
    </VersionList>
  ),
  // A page rolling back to a marked version.
  version_restored: ({ tone }) => (
    <>
      <MarkedVersion tone={tone} />
      <FlowLine tone={tone} className="w-4" />
      <RollingPage>
        <Fire tone={tone} d={480} />
      </RollingPage>
    </>
  ),
  // An agent's pointer writing lines onto a page, a sparkle where it ends.
  agent_changed: ({ tone }) => (
    <div className="relative shrink-0">
      <Page className="h-[46px] w-[70px]" lines={2}>
        <span
          className={`ats-t ats-in origin-left ${INK_SOFT}`}
          style={at('none', 'scaleX(0.1)', 160)}
        />
        <span
          className={`ats-t ats-in w-3/5 origin-left ${inkOf(tone)}`}
          style={at('none', 'scaleX(0.1)', 300)}
        />
        <span
          className={`ats-t ats-in ats-pop absolute right-[6px] top-[3px] ${tone.label}`}
          style={at('none', 'scale(0.3) rotate(-30deg)', 520)}
        >
          <SparklesGlyph aria-hidden />
        </span>
      </Page>
      <span
        className="ats-t ats-drag absolute left-[16px] top-[22px]"
        style={at('translate(24px, 6px)', 'none', 120)}
      >
        <Cursor name="Agent" />
      </span>
      <Fire tone={tone} d={620} />
    </div>
  ),
};

export const DOCUMENT_ACTION_SCENES: Readonly<Record<string, ItemVignette>> = {
  // A version list where a name tag lands on the newest entry.
  name_version: ({ tone }) => (
    <VersionList
      tone={tone}
      newest={
        <span className="relative flex h-[10px] items-center gap-1">
          <span className={`size-[5px] shrink-0 rounded-full ${tone.dot}`} />
          <span className={`w-6 ${INK}`} />
          <Pill
            className={`ats-t ats-in ats-pop -right-1 -top-[2px] ${tone.solid}`}
            style={at('none', 'translate(10px, -10px) scale(0.4) rotate(-12deg)', 160)}
          >
            <MarkGlyph aria-hidden />
            Week 47
          </Pill>
        </span>
      }
    />
  ),
  // A page winding back to the marked version it names.
  restore_version: ({ tone }) => (
    <>
      <MarkedVersion tone={tone} />
      <FlowLine tone={tone} className="w-4" />
      <RollingPage>
        <Pill
          className={`ats-t ats-in ats-pop -bottom-1.5 -right-1.5 ${tone.solid}`}
          style={at('none', 'scale(0.4)', 480)}
        >
          <BackGlyph aria-hidden />
          Back
        </Pill>
      </RollingPage>
    </>
  ),
};
