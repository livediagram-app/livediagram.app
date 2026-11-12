// Pictures for agents (docs/specs/015-api/mcp-server.md §4.5b): a canvas image element stays an empty placeholder, so
// an image id in an element write is refused (placed.ts), and a card's pictures are uploaded for its plan
// (plan-upload.ts) and then placed by change_items (plan/card-pictures.ts).
export * from './placed';
export * from './plan-upload';
