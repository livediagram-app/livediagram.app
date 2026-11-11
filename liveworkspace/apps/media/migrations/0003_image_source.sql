-- The tool that uploaded each image (liveworkspace/docs/specs/006-media/media.md "Uploaded by a tool"): 'mcp' for an AI
-- assistant through an app's MCP server, 'cli' for an app's command line. Null for a person's upload, and for every
-- image uploaded before this column. Only 'mcp' reads as Made by AI.
ALTER TABLE images ADD COLUMN source TEXT;
