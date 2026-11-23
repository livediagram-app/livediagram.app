// The model's answer, read (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): the reader is the
// platform's (@liveworkspace/ask), shared with every other app's Ask AI.
export {
  ASK_MAX_GAPS,
  ASK_MAX_GAP_CHARS,
  askAnswerStream,
  parseAskAnswer,
  type AskAnswer,
  type AskCitation,
  type CitationOrder,
} from '@liveworkspace/ask';
