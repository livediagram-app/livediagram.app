// Text DSL (spec/66): a human-editable, round-trip text representation of a Tab
// that preserves the connection graph (arrows reference node ids). `serializeTab`
// writes it, `parseTab` reads it back; the codec is an internal detail.
export { serializeTab } from './serialize';
export { parseTab, type ParseResult } from './parse';
