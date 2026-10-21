// The CLI's words for the MCP tools the shared refusals name (docs/specs/015-api/cli.md "Output"): one engine answers
// both, and its messages say "Make one with add_form", which is no command here. Each tool maps to the command that
// does its job, and an error names that instead.

// Each MCP tool by the command that does what it does: `<resource> <verb>`, or a top-level command and its words.
export const COMMAND_OF_TOOL: Readonly<Record<string, string>> = {
  find_documents: 'document ls',
  read_document: 'document view',
  list_templates: 'template ls',
  search_icons: 'icon search',
  create_document: 'document create',
  add_tab: 'tab add',
  update_document: 'changeset apply',
  share_document: 'document share',
  rename_document: 'document rename',
  delete_document: 'document rm',
  list_trash: 'api GET /trash',
  restore_document: 'document restore',
  list_images: 'image ls',
  list_items: 'item ls',
  change_items: 'item set',
  add_board: 'board add',
  change_board: 'board set',
  change_card_types: 'type apply',
  list_sheets: 'sheet ls',
  read_sheet: 'sheet get',
  change_sheet: 'sheet set',
  add_sheet: 'sheet add',
  change_pages: 'page set',
  write_article: 'article set',
  read_form: 'form get',
  add_form: 'form add',
  change_form: 'form change',
  share_form: 'form share',
  try_form: 'form try',
};

const TOOL_WORD = new RegExp(`\\b(${Object.keys(COMMAND_OF_TOOL).join('|')})\\b`, 'g');

/** `text` with each MCP tool it names written as the CLI command: "add_form" → "livediagram form add". */
export function inCliWords(text: string): string {
  return text.replace(TOOL_WORD, (tool) => `livediagram ${COMMAND_OF_TOOL[tool]}`);
}
