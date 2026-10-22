// The bar a Plan tab brings in place of the Palette strip, in the scenes' editor-window mock
// (docs/specs/019-marketing/marketing-site.md "Feature scenes"), each as that tab draws it: a board's
// own bar (docs/specs/026-plan/plan-board.md), a Sheet's toolbar in its header band
// (docs/specs/029-sheets/sheet.md "Sheet tab", "Toolbar"), and a Form's status bar
// (docs/specs/030-forms/forms.md "Building a form"). A Sheet has no board widgets and a Form no
// toolbar, so each draws only its own. At the mock's scale, from the editor's own glyphs.

import {
  lucideAlignLeft,
  lucideCircleHelp,
  lucideEye,
  lucideMaximize2,
  lucidePaintbrush,
  lucidePlus,
  lucideSettings,
  lucideTableCellsMerge,
} from '@livepages/icons/lucide';
import { ChevronDownIcon, Glyph, lucideGlyph, SearchIcon } from '@livepages/ui';

// Which tab a Plan scene is (hero-scene-data.ts): its bar follows.
export type PlanTab = 'board' | 'sheet' | 'form';

const PlusGlyph = lucideGlyph(lucidePlus, 10);
const CogGlyph = lucideGlyph(lucideSettings, 11);
const PaintGlyph = lucideGlyph(lucidePaintbrush, 10);
const AlignGlyph = lucideGlyph(lucideAlignLeft, 10);
const MergeGlyph = lucideGlyph(lucideTableCellsMerge, 10);
const MaximiseGlyph = lucideGlyph(lucideMaximize2, 10);
const PreviewGlyph = lucideGlyph(lucideEye, 10);
const HelpGlyph = lucideGlyph(lucideCircleHelp, 10);

const BAR =
  'pointer-events-none absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-0.5 shadow-sm sm:flex dark:border-slate-700 dark:bg-slate-900/90';
const CHIP =
  'flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
const BUTTON =
  'flex h-6 w-6 items-center justify-center rounded text-slate-600 dark:text-slate-300';

function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

export function PlanTabBar({ tab }: { tab: PlanTab }) {
  return tab === 'sheet' ? <SheetBar /> : tab === 'form' ? <FormBar /> : <PlanBoardBar />;
}

// A Plan board fills its tab, so its own bar stands at the top right where the strip would be:
// how much is done, whether every column is within its WIP limit, the card filter, add, and the
// board's settings (docs/specs/026-plan/plan-board.md).
function PlanBoardBar() {
  const chip =
    'flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-0.5 shadow-sm sm:flex dark:border-slate-700 dark:bg-slate-900/90">
      <span className={chip}>
        {/* The done ring: a third of the way round. */}
        <Glyph size={10} units={10} weight={1.6}>
          <circle cx="5" cy="5" r="4" className="stroke-slate-200 dark:stroke-slate-700" />
          <circle
            cx="5"
            cy="5"
            r="4"
            stroke="#10b981"
            strokeDasharray="8.3 25.1"
            transform="rotate(-90 5 5)"
          />
        </Glyph>
        <span className="text-optical-line font-semibold text-slate-800 dark:text-slate-100">
          33%
        </span>
        <span className="text-optical-line">done · 4/12</span>
      </span>
      <span className={`${chip} text-emerald-700 dark:text-emerald-300`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-optical-line">Within WIP</span>
      </span>
      <span className={`${chip} hidden w-24 text-slate-400 @[600px]:flex`}>
        <SearchIcon size={8} />
        <span className="text-optical-line">Filter cards</span>
      </span>
      <span className={`${chip} w-6 justify-center border-dashed px-0`}>
        <PlusGlyph size={10} />
      </span>
      <span className="flex h-6 w-6 items-center justify-center text-slate-500">
        <CogGlyph size={11} />
      </span>
    </div>
  );
}

// A Sheet filling its tab: its toolbar rides the header band, the category switcher (Cells open) and
// that category's buttons, then Search for a function, then the Sheet's own controls.
function SheetBar() {
  return (
    <div className={BAR}>
      <span className={CHIP}>
        <Glyph size={10} units={10} weight={1.4}>
          <rect x="1" y="1" width="8" height="8" rx="1" />
          <path d="M1 5h8M5 1v8" />
        </Glyph>
        <span className="text-optical-line">Cells</span>
        <ChevronDownIcon size={7} />
      </span>
      <span className={BUTTON}>
        <PaintGlyph size={10} />
      </span>
      {/* Fill Colour: the swatch under its bucket, as the toolbar shows the colour in hand. */}
      <span className={BUTTON}>
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-300 ring-1 ring-slate-300 dark:ring-slate-600" />
      </span>
      <span className={BUTTON}>
        <Glyph size={10} units={10} weight={1.4}>
          <rect x="1" y="1" width="8" height="8" />
        </Glyph>
      </span>
      <span className={`${BUTTON} max-[720px]:hidden`}>
        <AlignGlyph size={10} />
      </span>
      <span className={`${BUTTON} max-[720px]:hidden`}>
        <MergeGlyph size={10} />
      </span>
      <Divider />
      <span className="flex h-6 items-center gap-1 px-1.5 text-[9px] font-medium text-slate-600 dark:text-slate-300">
        <SearchIcon size={9} />
        <span className="text-optical-line">Search</span>
      </span>
      <Divider />
      <span className={BUTTON}>
        <MaximiseGlyph size={10} />
      </span>
      <span className={BUTTON}>
        <CogGlyph size={11} />
      </span>
    </div>
  );
}

// A Form's status bar over the form: its state, the responses so far, then Preview, help and the cog.
function FormBar() {
  return (
    <div className={BAR}>
      <span className={`${CHIP} text-emerald-700 dark:text-emerald-300`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-optical-line">Accepting Responses</span>
      </span>
      <span className={CHIP}>
        <span className="text-optical-line font-semibold text-slate-800 dark:text-slate-100">
          14
        </span>
        <span className="text-optical-line">responses · 3 new</span>
      </span>
      <Divider />
      <span className="flex h-6 items-center gap-1 px-1.5 text-[9px] font-medium text-slate-600 dark:text-slate-300">
        <PreviewGlyph size={10} />
        <span className="text-optical-line">Preview</span>
      </span>
      <span className={BUTTON}>
        <HelpGlyph size={10} />
      </span>
      <span className={BUTTON}>
        <CogGlyph size={11} />
      </span>
    </div>
  );
}
