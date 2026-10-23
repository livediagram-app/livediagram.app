// The CLI's words for the MCP tools the shared refusals name (docs/specs/015-api/cli.md "Output"): one engine answers
// both, and its messages say "read it with read_design", which is no command here. Each tool maps to the command that
// does its job, and an error names that instead.

// Each MCP tool by the command that does what it does: `<resource> <verb>`, or a top-level command and its words.
export const COMMAND_OF_TOOL: Readonly<Record<string, string>> = {
  find_designs: 'design ls',
  read_design: 'design view',
  list_templates: 'template ls',
  search_icons: 'icon search',
  create_design: 'design create',
  add_tab: 'tab add',
  update_design: 'changeset apply',
  share_design: 'design share',
  rename_design: 'design rename',
  delete_design: 'design rm',
  list_trash: 'api GET /trash',
  restore_design: 'design restore',
  list_images: 'image ls',
  change_pages: 'page set',
};

const TOOL_WORD = new RegExp(`\\b(${Object.keys(COMMAND_OF_TOOL).join('|')})\\b`, 'g');

/** `text` with each MCP tool it names written as the CLI command: "add_tab" → "livedesign tab add". */
export function inCliWords(text: string): string {
  return text.replace(TOOL_WORD, (tool) => `livedesign ${COMMAND_OF_TOOL[tool]}`);
}
