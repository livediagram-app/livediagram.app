import {
  lucidePresentation,
  lucideSearch,
  lucideShare2,
  lucideSquareKanban,
  lucideTable,
  lucideUndo2,
  lucideWorkflow,
  lucideFileText,
} from '@liveplanner/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';

// What it can do (docs/specs/019-marketing/build-with-ai.md "The page" 5): the MCP's tools in plain words. Every
// card maps to a shipped tool (docs/specs/015-api/mcp-server.md §4); a new tool earns a card here only once it ships.
const CAPABILITIES = [
  {
    icon: lucideGlyph(lucideWorkflow, 20),
    title: 'Diagrams from a sentence',
    body: 'Flowcharts, architecture, org charts, mind maps and state machines. Your AI names the boxes and links; liveplanner lays them out. Mermaid works too.',
  },
  {
    icon: lucideGlyph(lucideSquareKanban, 20),
    title: 'Boards and templates',
    body: 'Kanban, sprints, retros, SWOT and more from the template library, with Plan cards your AI can add, edit and move.',
  },
  {
    icon: lucideGlyph(lucideTable, 20),
    title: 'Sheets',
    body: 'Spreadsheets with formulas, formatting, dropdowns and sorting, built from rows or CSV and read back by cell.',
  },
  {
    icon: lucideGlyph(lucidePresentation, 20),
    title: 'Slides, posters and logos',
    body: 'Decks from ready-made slide layouts, infographics and logo artboards, all on pages you can polish by hand.',
  },
  {
    icon: lucideGlyph(lucideFileText, 20),
    title: 'Articles',
    body: 'Written up in Markdown and flowed onto pages, then read back and revised whenever you ask.',
  },
  {
    icon: lucideGlyph(lucideSearch, 20),
    title: 'Find and read',
    body: 'Searches your documents and your teams’, and reads any tab back as an outline and a picture.',
  },
  {
    icon: lucideGlyph(lucideShare2, 20),
    title: 'Share links',
    body: 'Turns a document into a link for your team, as a Participant link unless you ask for another role.',
  },
  {
    icon: lucideGlyph(lucideUndo2, 20),
    title: 'Live, and undoable',
    body: 'Changes land on an open canvas as they happen, outlined so you can see them, with Undo one click away.',
  },
];

export function AiCapabilities() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CAPABILITIES.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Icon aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {body}
          </p>
        </li>
      ))}
    </ul>
  );
}
