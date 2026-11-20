// What the MCP's knowledgebase tools and the CLI's commands share (docs/specs/024-agents/
// knowledgebase-for-agents.md): the routes' paths and the trust fields every answer carries.
export { jsonBody, knowledgePath } from './paths';
export { pageRefOf, resultTrustOf, trustFieldsOf, trustLine, type TrustFields } from './trust';
