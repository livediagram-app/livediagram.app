// style_document (docs/specs/015-api/mcp-server.md §4.9f "Restyling a knowledgebase"): a knowledgebase's look, its theme,
// fonts and reading sizes, changed at any time. Its pages have no style of their own: they are drawn in this one.
import { z } from 'zod';
import { mcpTool } from '@liveworkspace/agent-verbs/mcp/tool';

export const styleDocumentShape = {
  documentId: z.string().describe('The knowledgebase (from find_documents).'),
  theme: z.string().optional().describe('A theme id.'),
  font: z.string().optional().describe('A font id for headings and text both.'),
  headingFont: z.string().optional().describe('A font id for headings.'),
  bodyFont: z.string().optional().describe('A font id for text.'),
  textSize: z.enum(['small', 'medium', 'large']).optional().describe('Text size.'),
  lineSpacing: z.enum(['compact', 'comfortable', 'relaxed']).optional().describe('Line spacing.'),
  headingStyle: z.enum(['plain', 'ruled']).optional().describe('Headings plain or ruled.'),
  accent: z.string().nullable().optional().describe('A hex accent, or null for the theme’s.'),
};

export const styleDocumentOutput = {
  documentId: z.string().describe('The knowledgebase id.'),
  style: z.record(z.string(), z.unknown()).describe('Its style as it now is.'),
  lines: z.array(z.string()).describe('What was done.'),
};

export const mcpStyleDocument = mcpTool('style_document', {
  behaviour: 'write',
  title: 'Restyle a knowledgebase',
  description:
    'Change a knowledgebase’s theme, fonts or reading sizes at any time; every page is drawn in it. Needs the write scope.',
  inputSchema: styleDocumentShape,
  outputSchema: styleDocumentOutput,
});
