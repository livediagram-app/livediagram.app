// The fields only the api sends through the room (its /mutation, `from: 'system'`), after it stored them: a client
// socket's op never carries them to a peer, whatever the sender's role, a token's socket too. The op itself still
// relays with what is left, so its sender's `ref` comes back as it always does.
//
//   - `document-meta`: the knowledgebase's settings (routes/knowledge-settings-routes.ts) and its Knowledgebase Style
//     (routes/documents.ts), so no peer hears a period or a look that was not saved.
//   - `tab-meta` and a whole `tab`: a page's own fields, `knowledge` (its owner, Verify and approval:
//     docs/specs/030-knowledgebase/verification.md "Share roles"), set or cleared, so no writer can make a page look
//     Verified, owned or unverified on anyone's screen. The api's own patch (knowledge/page-fields-save.ts) is the
//     one that carries them.
//
// Changes the op in place: it is the frame the room just parsed, its own copy.
export function withoutApiOnlyFields(op: unknown): void {
  if (typeof op !== 'object' || op === null) return;
  const o = op as {
    kind?: unknown;
    knowledgeSettings?: unknown;
    knowledgeStyle?: unknown;
    patch?: unknown;
    clear?: unknown;
    tab?: unknown;
  };
  if (o.kind === 'document-meta') {
    delete o.knowledgeSettings;
    delete o.knowledgeStyle;
    return;
  }
  if (o.kind === 'tab-meta') {
    if (typeof o.patch === 'object' && o.patch !== null)
      delete (o.patch as { knowledge?: unknown }).knowledge;
    if (Array.isArray(o.clear)) {
      const clear = o.clear.filter((key) => key !== 'knowledge');
      if (clear.length > 0) o.clear = clear;
      else delete o.clear;
    }
    return;
  }
  if (o.kind === 'tab' && typeof o.tab === 'object' && o.tab !== null)
    delete (o.tab as { knowledge?: unknown }).knowledge;
}
