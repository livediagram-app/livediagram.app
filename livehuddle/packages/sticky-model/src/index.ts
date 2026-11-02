// The browser-safe face of the boundary model: everything here is pure
// TypeScript with no TensorFlow.js and no Node, so the editor can import it.
// Running the network is the caller's business (a Web Worker in the editor,
// `scripts/model/infer.ts` in Node); both frame the photo through `stride.ts`
// and read the probabilities through `cues.ts`.
export * from './cues';
export * from './decode';
export * from './flatness';
export * from './mask';
export * from './stride';
