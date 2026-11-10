// Illustrations for the Pages articles on Working with Pages, Infographic Layouts,
// Exporting and Presenting Pages and Writing Articles (docs/specs/018-help/help-app.md). Each draws
// the real surface with its real labels: the pages in a row with their labels, title-bar buttons,
// the title bar card with its cog (CanvasPages.tsx, PageTitleBar.tsx), the add buttons (AddPageButton.tsx), the navigator (PageNavigatorClusterStrip.tsx), the
// page panel (PagePanel.tsx, page-panel-sections.tsx), the Layout button's
// popover's layout gallery (PageLayoutsButton.tsx, layout-gallery/LayoutGallery.tsx), the export page picker (ExportPagePicker.tsx) and the
// article formatting toolbar (article/PageToolbar.tsx). Composed from the shared primitives.
//
// This module is the entry and keeps the export page picker and the article toolbar: the pages in a row and
// the page panel live in ./pages-row-panel, the Layouts browser in ./pages-layouts, and the shared bits in
// ./pages-parts.

import { Scene, Label, TextBar } from '@liveworkspace/help-site/art/primitives';
import { Sheet, SolidSegments } from './pages-parts';

export { PagesScene, PagePanelScene } from './pages-row-panel';
export { LayoutGalleryScene } from './pages-layouts';

// --- Exporting pages ---------------------------------------------------------------------------

/** The Export dialog's page picker, inside the PDF panel (reached from the format cards, with
 *  the All formats bar to go back): All pages or One page, the page the preview shows, and the
 *  line saying what the download will be, over the preview of that page. */
export function ExportPagePickerScene() {
  return (
    <Scene w={420} h={248} bg="none">
      <rect
        x={16}
        y={12}
        width={388}
        height={224}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={32} y={32} size={13} weight={700} tone="strong">
        Export Tab
      </Label>
      {/* The two-level bar back to the format cards. */}
      <Label x={32} y={56} size={10.5} weight={600} tone="muted">
        ‹ All formats
      </Label>
      <Label x={102} y={56} size={10.5} tone="muted">
        ›
      </Label>
      <Label x={112} y={56} size={10.5} weight={700} tone="strong">
        PDF
      </Label>
      <rect x={32} y={70} width={356} height={90} rx={8} className="fill-slate-50" />
      <SolidSegments x={42} y={80} items={['All pages', 'One page']} active={0} segW={72} />
      <rect
        x={42}
        y={110}
        width={336}
        height={24}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={52} y={122.5} size={10} tone="body">
        Preview: Page 1 · A4 · Portrait
      </Label>
      <path
        d="M362 120 l3.5 3.5 l3.5 -3.5"
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Label x={42} y={148} size={10.5} tone="body">
        3 pages, one PDF.
      </Label>
      {/* The preview: exactly the page, nothing around it */}
      <Sheet x={176} y={170} w={44} h={58}>
        <TextBar x={182} y={178} w={26} h={4} tone="accent" />
        <TextBar x={182} y={187} w={20} h={3} />
        <rect x={182} y={196} width={32} height={24} rx={2} className="fill-brand-100" />
      </Sheet>
    </Scene>
  );
}

// --- The article toolbar -----------------------------------------------------------------------

/** An article page with its formatting toolbar along the top, a heading and paragraphs, and a
 *  comment on some words: tinted, with its marker in the margin. */
export function ArticleToolbarScene() {
  return (
    <Scene w={420} h={250}>
      <Sheet x={60} y={16} w={300} h={226}>
        {/* The toolbar, inside the top of the page */}
        <rect
          x={70}
          y={26}
          width={280}
          height={26}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={80} y={39.5} size={10.5} weight={600} tone="body">
          Text
        </Label>
        <path d="M104 37.5 l3 3 l3 -3" fill="none" className="stroke-slate-500" strokeWidth={1.3} />
        <line x1={116} y1={31} x2={116} y2={47} className="stroke-slate-200" strokeWidth={1} />
        <Label x={124} y={39.5} size={12} weight={800} tone="strong">
          B
        </Label>
        <Label
          x={142}
          y={39.5}
          size={12}
          weight={500}
          tone="strong"
          className="fill-slate-800 italic"
        >
          I
        </Label>
        <Label x={156} y={39.5} size={12} weight={500} tone="strong">
          U
        </Label>
        <line x1={156} y1={46} x2={164} y2={46} className="stroke-slate-800" strokeWidth={1.1} />
        <Label x={176} y={38.5} size={12} weight={700} tone="strong">
          A
        </Label>
        <rect x={175} y={45} width={10} height={2.5} rx={1} className="fill-brand-500" />
        {/* Link */}
        <path
          d="M199 41 a3 3 0 0 1 0 -4 l2 -2 a3 3 0 0 1 4 4 l-1 1 M205 37 a3 3 0 0 1 0 4 l-2 2 a3 3 0 0 1 -4 -4 l1 -1"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.3}
        />
        {/* Lists */}
        <g className="stroke-slate-600" strokeWidth={1.3} strokeLinecap="round">
          <line x1={220} y1={34} x2={230} y2={34} />
          <line x1={220} y1={39} x2={230} y2={39} />
          <line x1={220} y1={44} x2={230} y2={44} />
          <circle cx={216} cy={34} r={0.8} />
          <circle cx={216} cy={39} r={0.8} />
          <circle cx={216} cy={44} r={0.8} />
          {/* Alignment */}
          <line x1={242} y1={34} x2={254} y2={34} />
          <line x1={242} y1={39} x2={250} y2={39} />
          <line x1={242} y1={44} x2={254} y2={44} />
        </g>
        {/* More formatting */}
        <g className="fill-slate-600">
          <circle cx={264} cy={39} r={1.3} />
          <circle cx={269} cy={39} r={1.3} />
          <circle cx={274} cy={39} r={1.3} />
        </g>
        <line x1={282} y1={31} x2={282} y2={47} className="stroke-slate-200" strokeWidth={1} />
        {/* Insert */}
        <path
          d="M292 34 v10 M287 39 h10"
          className="stroke-slate-600"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        {/* Comment */}
        <path
          d="M306 34 h12 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-7 l-3 3 v-3 h-2 a2 2 0 0 1 -2 -2 v-5 a2 2 0 0 1 2 -2 Z"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.2}
        />
        {/* Assign Action */}
        <circle cx={334} cy={36} r={3} fill="none" className="stroke-slate-600" strokeWidth={1.2} />
        <path
          d="M328 45 a6 5 0 0 1 12 0"
          fill="none"
          className="stroke-slate-600"
          strokeWidth={1.2}
        />
        {/* The writing */}
        <Label x={84} y={74} size={16} weight={800} tone="strong">
          Project brief
        </Label>
        <TextBar x={84} y={92} w={250} />
        <TextBar x={84} y={104} w={232} />
        {/* Commented words: tinted amber */}
        <rect x={84} y={113} width={96} height={10} rx={2} className="fill-amber-100" />
        <TextBar x={86} y={115.5} w={92} tone="muted" />
        <TextBar x={184} y={115.5} w={140} />
        <TextBar x={84} y={128} w={196} />
        <Label x={84} y={152} size={12} weight={700} tone="strong">
          Goals
        </Label>
        <TextBar x={84} y={166} w={240} />
        <TextBar x={84} y={178} w={210} />
        <TextBar x={84} y={190} w={226} />
        <TextBar x={84} y={202} w={150} />
      </Sheet>
      {/* The comment's marker in the margin, beside its words (amber in both appearances) */}
      <g className="help-art-as-drawn" transform="translate(362 104) scale(1.1)">
        <path
          d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-8l-4.5 3.5v-3.5H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z"
          className="fill-amber-500"
        />
        <Label x={12} y={11.4} anchor="middle" size={9.5} weight={700} className="fill-white">
          1
        </Label>
      </g>
    </Scene>
  );
}
