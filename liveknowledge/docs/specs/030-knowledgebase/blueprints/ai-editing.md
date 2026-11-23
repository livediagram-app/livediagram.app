# AI Editing blueprint

Derived from [AI Editing](../ai-editing.md). Implementation detail only; the spec decides.

## Domain and naming

| Spec term                                                  | Identifier                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| AI Editing                                                 | `knowledgeSettings.aiEditing: AiEditing` (`@liveknowledge/document`) |
| Suggest Edits Only / Edit Unverified Pages / Edit Any Page | `'suggest'` / `'unverified'` / `'any'` (`AI_EDITING_LEVELS`)         |
| the default                                                | `DEFAULT_AI_EDITING = 'suggest'`                                     |
| Remove Verification When AI Edits                          | `knowledgeSettings.aiEditUnverifies?: true`                          |
| what a token may do here                                   | `aiWriteReach(level, scopes)` (`@liveknowledge/document`)            |

## Data and persistence

- Both fields ride `knowledgeSettings` (the document row's `knowledge_settings` JSON, as the Review Period and the
  labels). No schema step: the column exists. `storedKnowledgeSettings` writes `aiEditing` only when it is not the
  default and `aiEditUnverifies` only when true, so a knowledgebase that never chose keeps no row.
- `parseKnowledgeSettings` reads an unknown level as the default and anything but `true` as off. A copy, version,
  snapshot, export, Drive file and an Offline knowledgebase carry the value as they carry the period.
- The room strips `knowledgeSettings` from every socket's metadata (room-api-only-fields.ts), so only the api writes it.

## Interfaces and contracts

- `PUT /api/documents/<id>/knowledge-settings` takes any of `{ reviewEvery?, aiEditing?, aiEditUnverifies? }`, at least
  one. `aiEditing` not a level: 400 `invalid_ai_editing`; `aiEditUnverifies` not a boolean: 400
  `invalid_ai_edit_unverifies`. Either AI field from a token or a workbench session: 403 `needs_a_person`. A
  Participant or Viewer: 403. Answers `{ knowledgeSettings }`, relays `document-meta` to open editors.
- `GET .../context` (`KnowledgeAgentContextResponse`) gains `aiEditing` and `aiEditUnverifies`.
- MCP `get_context` and CLI `context` add `ai_editing`, `ai_edit_unverifies`, `ai_editing_allows`.

## Behaviour and state

- `agentWriteRefusal(document, tabId, kind)` (routes/agent-write-gate.ts) replaces `agentRewriteRefusal`:
  - level `suggest`: 409 `ai_editing_suggest_only` for every kind.
  - kind `rewrite` (article write, version restore) on a page whose state is not `never-verified` (worked out with
    `trustState`): under `unverified`, 409 `page_verified` / `page_review_due` with the setting named; under `any`,
    allowed.
  - kind `other` (a cover alone, the Pages route's page changes, a changeset submit or revert): allowed above
    `suggest`.
- After a successful `rewrite` by a token under `any` with `aiEditUnverifies` on, on a page holding `verifiedAt`:
  `clearAiEditedVerification` (knowledge/ai-edit-unverify.ts) saves the fields without `verifiedAt` and `verifiedBy`
  through `savePageFields` (the `tab-meta` relay and the Page Verified triggers' bookkeeping follow). Busy or gone is
  logged, not failed: the write already stood.

## Security and trust

- A token never sets either field, whatever its scopes; a workbench session neither. The setting only narrows.

## Presentation and UX

- Editor: `knowledgeSettingsStore` holds `aiEditing` and `aiEditUnverifies` per document (`aiEditingOf`), taken from
  the document read, the room's `document-meta` and a save here.
- `components/ai-editing/`: `AiEditingDialog.tsx` (the modal, Save and Cancel, failure callout), `AiEditingChoices.tsx`
  (the radio cards and the switch), `ai-editing-art.tsx` (the hero art and the three card illustrations),
  `ai-editing-open.ts` (the open flag), `ai-editing-words.ts` (the copy). Opened from `useKnowledgebaseMenu` row `aiEditing`, drawn
  by the views' host once opened (dynamic import).
- The panel is a fixed height (`h-[min(42rem,...)]`, a phone sheet `85dvh`), its body scrolls; the switch unfolds with grid rows.

## Accessibility

- One `role="radiogroup"` of native radios labelled by the dialog's title; each radio described by its line. The switch
  is a button with `role="switch"` and `aria-checked`. Focus rings on every control; 44 px targets under a coarse
  pointer; reduced motion drops the unfold.

## Observability

- `[knowledge] ai editing` on a change (`documentId`, `aiEditing`, `aiEditUnverifies`, `was`); `[pages-agent] refused`
  with `code` and `level` on each refusal; `[knowledge] ai edit unverified` when a write clears a mark.

## Testing

- api: level x page state x token scope (routes/knowledge-ai-editing.test.ts); unverify on and off on a verified
  page; role tests for the PUT (Editor, Participant, Viewer, token with `write`).
- document: parse and store round trips; `aiWriteReach`.
- MCP: `get_context` carries the three fields.
- editor: the dialog's cards, switch, Save, Cancel and failure (AiEditingDialog.test.tsx); the menu row per role.

## Defaults ledger

See DEFAULTS.md rows "AI Editing".
