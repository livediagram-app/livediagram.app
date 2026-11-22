// The Import and Export page's card drawings (docs/specs/019-marketing/marketing-site.md "Feature pages",
// `import`): Notion, Confluence, a Markdown folder, the review before importing, links kept, and export.
import { ConfluenceMark, NotionMark } from '@/components/hero/BrandMarks';

import { Arrow, Bars, Button, GUIDE, PageGlyph, Pill, Scene, Sheet, Tick, Txt, at } from './kit';

/** An export's file on the left, the page tree it becomes on the right. */
function SourceToTree({
  mark,
  file,
  pages,
}: {
  mark: 'notion' | 'confluence';
  file: string;
  pages: readonly { t: string; d: 0 | 1; table?: boolean }[];
}) {
  const Mark = mark === 'notion' ? NotionMark : ConfluenceMark;
  return (
    <Scene>
      <Sheet x={18} y={22} w={96} h={52}>
        <svg x={28} y={30} width={20} height={20} viewBox="0 0 20 20" overflow="visible">
          <Mark size={20} />
        </svg>
        <Txt x={28} y={64} size={6.2} weight={600}>
          {file}
        </Txt>
      </Sheet>
      <Arrow x1={122} x2={150} y={48} />
      <Sheet x={158} y={8} w={128} h={80} lime>
        {pages.map((p, i) => (
          <g key={p.t} className="kb-in" style={at(0.9 + i * 0.22)}>
            <PageGlyph x={168 + p.d * 12} y={16 + i * 17} />
            <Txt x={178 + p.d * 12} y={22.5 + i * 17} size={6.4} weight={p.d ? 500 : 700}>
              {p.t}
            </Txt>
            {p.table ? (
              <g>
                {[0, 1, 2].map((c) => (
                  <rect
                    key={c}
                    x={240 + c * 12}
                    y={17 + i * 17}
                    width={11}
                    height={7}
                    rx={1}
                    className="fill-white stroke-brand-300 dark:fill-slate-800 dark:stroke-brand-700"
                    strokeWidth={0.7}
                  />
                ))}
              </g>
            ) : null}
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}

/** Notion's Markdown and CSV export: nesting kept, a database becoming a table on its page. */
export function NotionImportArt() {
  return (
    <SourceToTree
      mark="notion"
      file="Export.zip"
      pages={[
        { t: 'Product', d: 0 },
        { t: 'Roadmap', d: 1, table: true },
        { t: 'Specs', d: 1 },
        { t: 'Design Reviews', d: 1 },
      ]}
    />
  );
}

/** A Confluence space's HTML export: the space's order and nesting kept. */
export function ConfluenceImportArt() {
  return (
    <SourceToTree
      mark="confluence"
      file="SUPPORT.zip"
      pages={[
        { t: 'Support', d: 0 },
        { t: 'Escalations', d: 1 },
        { t: 'Refunds', d: 1 },
        { t: 'Macros', d: 1 },
      ]}
    />
  );
}

/** A folder of Markdown: folders become the page tree, a README its folder's page. */
export function MarkdownFolderArt() {
  const files = [
    { t: 'docs/', d: 0, folder: true },
    { t: 'README.md', d: 1 },
    { t: 'deploy.md', d: 1 },
    { t: 'runbooks/', d: 1, folder: true },
  ];
  return (
    <Scene>
      <Sheet x={18} y={10} w={110} h={76}>
        {files.map((f, i) => (
          <g key={f.t}>
            <rect
              x={26 + f.d * 10}
              y={18 + i * 16}
              width={8}
              height={f.folder ? 6 : 8}
              rx={1.2}
              className={
                f.folder ? 'fill-sky-300 dark:fill-sky-700' : 'fill-slate-200 dark:fill-slate-600'
              }
            />
            <Txt x={38 + f.d * 10} y={24 + i * 16} size={6.2} weight={500} mono>
              {f.t}
            </Txt>
          </g>
        ))}
      </Sheet>
      <Arrow x1={136} x2={156} y={48} />
      <Sheet x={164} y={10} w={122} h={76} lime>
        {[
          { t: 'Docs', d: 0 },
          { t: 'Deploy', d: 1 },
          { t: 'Runbooks', d: 1 },
        ].map((p, i) => (
          <g key={p.t} className="kb-in" style={at(0.9 + i * 0.25)}>
            <PageGlyph x={174 + p.d * 12} y={20 + i * 18} />
            <Txt x={184 + p.d * 12} y={26.5 + i * 18} size={6.6} weight={p.d ? 500 : 700}>
              {p.t}
            </Txt>
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}

/** The review step: what was found and what will be left out, before anything is imported. */
export function ImportReviewArt() {
  return (
    <Scene>
      <Sheet x={40} y={6} w={220} h={84}>
        <Txt x={50} y={20} size={6.6} weight={700}>
          Ready to Import
        </Txt>
        <Tick cx={54} cy={32} r={3.6} />
        <Txt x={62} y={34.3} size={6.2} weight={500}>
          42 pages, 3 levels deep
        </Txt>
        <Tick cx={54} cy={44} r={3.6} delay={1.2} />
        <Txt x={62} y={46.3} size={6.2} weight={500}>
          18 pictures
        </Txt>
        <circle cx={54} cy={56} r={3.6} className="kb-pop fill-orange-400" style={at(1.5)} />
        <Txt x={62} y={58.3} size={6.2} weight={500}>
          2 attachments left out: budget.xlsx, intro.mp4
        </Txt>
        <Button x={150} y={70} w={44}>
          Cancel
        </Button>
        <Button x={198} y={70} w={54} filled>
          Import
        </Button>
      </Sheet>
    </Scene>
  );
}

/** Links between imported pages arrive as page links, so Linked From is right on day one. */
export function ImportLinksArt() {
  return (
    <Scene>
      <Sheet x={20} y={14} w={104} h={68}>
        <Txt x={28} y={28} size={6.6} weight={700}>
          Escalations
        </Txt>
        <Bars x={28} y={36} widths={[80, 60]} />
        <rect
          x={28}
          y={52}
          width={66}
          height={10}
          rx={5}
          className="fill-brand-100 dark:fill-brand-900"
        />
        <PageGlyph x={31} y={53.5} />
        <Txt x={40} y={59.5} size={6} weight={700} tone="brand">
          Refunds
        </Txt>
      </Sheet>
      <path
        d="M96 57 C 140 57, 140 40, 176 40"
        fill="none"
        strokeWidth={1.1}
        strokeDasharray="3 3"
        className={`kb-link ${GUIDE}`}
      />
      <Sheet x={176} y={14} w={104} h={68}>
        <Txt x={184} y={28} size={6.6} weight={700}>
          Refunds
        </Txt>
        <Bars x={184} y={36} widths={[80]} />
        <Txt x={184} y={56} size={5.4} weight={700} tone="quiet">
          LINKED FROM
        </Txt>
        <PageGlyph x={185} y={62} />
        <Txt x={195} y={68.5} size={6} weight={600} tone="brand">
          Escalations
        </Txt>
      </Sheet>
    </Scene>
  );
}

/** A page going out as Markdown, PDF and Word. */
export function ExportArt() {
  const formats = [
    { t: 'Markdown', f: '.md' },
    { t: 'PDF', f: '.pdf' },
    { t: 'Word', f: '.docx' },
  ];
  return (
    <Scene>
      <Sheet x={20} y={10} w={110} h={76} lime>
        <Txt x={30} y={26} size={7} weight={700}>
          Team Handbook
        </Txt>
        <Bars x={30} y={34} widths={[88, 76, 90, 60, 80]} />
      </Sheet>
      <Arrow x1={138} x2={164} y={48} />
      {formats.map((x, i) => (
        <g key={x.t} className="kb-in" style={at(0.8 + i * 0.3)}>
          <Sheet x={172} y={12 + i * 25} w={110} h={20}>
            <PageGlyph x={180} y={18 + i * 25} />
            <Txt x={190} y={24.5 + i * 25} size={6.4} weight={700}>
              {x.t}
            </Txt>
            <Pill x={244} y={16.5 + i * 25} w={32} tone="plain">
              {x.f}
            </Pill>
          </Sheet>
        </g>
      ))}
    </Scene>
  );
}
