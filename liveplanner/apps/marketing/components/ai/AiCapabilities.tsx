import {
  lucideClipboardList,
  lucideLayoutGrid,
  lucideSearch,
  lucideShare2,
  lucideSquareKanban,
  lucideTable,
  lucideTag,
  lucideUndo2,
} from '@liveplanner/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';

// What it can do (docs/specs/019-marketing/build-with-ai.md "The page" 5): the MCP's tools in plain words. Every
// card maps to a shipped tool (docs/specs/015-api/mcp-server.md §4); a new tool earns a card here only once it ships.
const CAPABILITIES = [
  {
    icon: lucideGlyph(lucideSquareKanban, 20),
    title: 'Boards and cards',
    body: 'Puts a board on a tab, from a preset or columns you name, then adds, edits and moves cards the way the board shows them.',
  },
  {
    icon: lucideGlyph(lucideTag, 20),
    title: 'Card types and fields',
    body: 'Adds and edits card types and their fields, so a Bug can carry its severity and a candidate their stage.',
  },
  {
    icon: lucideGlyph(lucideTable, 20),
    title: 'Sheets',
    body: 'Spreadsheets with formulas, formatting, dropdowns and sorting, built from rows or CSV and read back by cell.',
  },
  {
    icon: lucideGlyph(lucideClipboardList, 20),
    title: 'Forms',
    body: 'Builds a form, tries it out and publishes its link, with every answer landing as a card or a row.',
  },
  {
    icon: lucideGlyph(lucideLayoutGrid, 20),
    title: 'Templates and tabs',
    body: 'Starts a plan from a plan template, such as Kanban, OKRs or a Budget Planner, and adds the tabs it needs.',
  },
  {
    icon: lucideGlyph(lucideSearch, 20),
    title: 'Find and read',
    body: 'Searches your plans and your teams’, and reads back the boards, cards, sheets and forms inside them.',
  },
  {
    icon: lucideGlyph(lucideShare2, 20),
    title: 'Share links',
    body: 'Turns a plan or a form into a link for your team, as a Participant link unless you ask for another role.',
  },
  {
    icon: lucideGlyph(lucideUndo2, 20),
    title: 'Live, and undoable',
    body: 'Changes land in an open plan as they happen, for everyone on it, with Undo one click away.',
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
