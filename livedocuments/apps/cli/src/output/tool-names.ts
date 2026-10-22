// The CLI's words for the MCP tools the shared refusals name (docs/specs/015-api/cli.md "Output"): one engine answers
// both, and its messages say "read it with read_document", which is no command here. Each tool maps to the command that
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
  change_pages: 'page set',
  write_article: 'article set',
};

const TOOL_WORD = new RegExp(`\\b(${Object.keys(COMMAND_OF_TOOL).join('|')})\\b`, 'g');

/** `text` with each MCP tool it names written as the CLI command: "add_tab" → "livedocuments tab add". */
export function inCliWords(text: string): string {
  return text.replace(TOOL_WORD, (tool) => `livedocuments ${COMMAND_OF_TOOL[tool]}`);
}
