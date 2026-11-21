// The CLI's words for the MCP tools the shared refusals name (docs/specs/015-api/cli.md "Output"): one engine answers
// both, and its messages say "suggest the change with suggest_edit", which is no command here. Each tool maps to the command that
// does its job, and an error names that instead.

// Each MCP tool by the command that does what it does: `<resource> <verb>`, or a top-level command and its words.
export const COMMAND_OF_TOOL: Readonly<Record<string, string>> = {
  get_context: 'context',
  list_pages: 'pages',
  search_pages: 'search',
  read_page: 'read',
  report_gap: 'gap',
  create_page: 'new',
  suggest_edit: 'suggest',
  write_page: 'write',
  move_page: 'move',
  request_approval: 'approval',
  list_page_comments: 'comments',
  change_page_comments: 'discuss',
  find_documents: 'document ls',
  list_templates: 'template ls',
  create_document: 'document create',
  share_document: 'document share',
  rename_document: 'document rename',
  delete_document: 'document rm',
  list_trash: 'api GET /trash',
  restore_document: 'document restore',
  archive_document: 'document archive',
  unarchive_document: 'document unarchive',
  list_threads: 'comment ls',
  change_threads: 'comment add',
  list_rules: 'rule ls',
  change_rules: 'rule set',
  list_images: 'image ls',
  upload_image: 'image add',
  delete_image: 'image rm',
};

const TOOL_WORD = new RegExp(`\\b(${Object.keys(COMMAND_OF_TOOL).join('|')})\\b`, 'g');

/** `text` with each MCP tool it names written as the CLI command: "read_page" → "liveknowledge read". */
export function inCliWords(text: string): string {
  return text.replace(TOOL_WORD, (tool) => `liveknowledge ${COMMAND_OF_TOOL[tool]}`);
}
