// What the shared verbs need to know of a product: its CLI's name, which hints and examples print, and what it
// calls the files people make in it, which its api and links use. Each product's agent-verbs binds the shared
// modules with one of these (its `agent-product.ts`), so the words its CLI and MCP print stay its own.

export type AgentProduct<N extends string = string, C extends string = string> = {
  // The CLI's command, as hints and examples print it: `<cli> tab ls`.
  cli: string;
  // One of the product's files as the api and its links name it: `/<noun>/<id>` links, `{ <noun> }` answers,
  // `restore_<noun>`, and an address failure's `what`.
  noun: N;
  // Its collection on the api: `/<collection>/<id>`, `{ <collection>: [...] }` lists, `find_<collection>`.
  collection: C;
  // How a message names one, and several, when not as the noun and collection do.
  word?: string;
  words?: string;
};

// The word for one, and for several, in a message.
export const wordOf = (product: AgentProduct) => product.word ?? product.noun;
export const wordsOf = (product: AgentProduct) => product.words ?? product.collection;
