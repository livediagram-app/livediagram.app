// The CLI's words for the MCP tools the shared refusals name (docs/specs/015-api/cli.md "Output"): one engine answers
// both, and its messages say "Make one with add_form", which is no command here. Each tool maps to the command that
// does its job, and an error names that instead.

// Each MCP tool by the command that does what it does: `<resource> <verb>`, or a top-level command and its words.
export const COMMAND_OF_TOOL: Readonly<Record<string, string>> = {
  find_projects: 'project ls',
  read_project: 'project view',
  list_templates: 'template ls',
  create_project: 'project create',
  add_tab: 'tab add',
  update_project: 'changeset apply',
  share_project: 'project share',
  rename_project: 'project rename',
  delete_project: 'project rm',
  list_trash: 'api GET /trash',
  restore_project: 'project restore',
  list_items: 'item ls',
  change_items: 'item set',
  list_threads: 'thread ls',
  change_threads: 'thread reply',
  add_board: 'board add',
  import_board: 'board import',
  change_board: 'board set',
  change_card_types: 'type apply',
  list_sheets: 'sheet ls',
  read_sheet: 'sheet get',
  change_sheet: 'sheet set',
  add_sheet: 'sheet add',
  read_form: 'form get',
  add_form: 'form add',
  change_form: 'form change',
  share_form: 'form share',
  try_form: 'form try',
};

const TOOL_WORD = new RegExp(`\\b(${Object.keys(COMMAND_OF_TOOL).join('|')})\\b`, 'g');

/** `text` with each MCP tool it names written as the CLI command: "add_form" → "liveplanner form add". */
export function inCliWords(text: string): string {
  return text.replace(TOOL_WORD, (tool) => `liveplanner ${COMMAND_OF_TOOL[tool]}`);
}
