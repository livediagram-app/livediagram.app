// A slide's note cards (docs/specs/012-collaboration/speaker-note-cards.md): a card in front, lined, with one more
// peeking out behind it, the stack a flashcard tab draws, at glyph size. The title bar's Notes, the Slide Deck row's
// marker, the HUD's notes button and the empty state all wear it, so "these are cards" reads the same everywhere.
import { Glyph } from '@livedocuments/ui';

export function NoteCardsIcon({ size = 14 }: { size?: number }) {
  return (
    <Glyph size={size} units={16} aria-hidden>
      <path d="M4.5 3.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H12" />
      <rect x="2" y="5" width="9.5" height="9" rx="1.2" />
      <path d="M4.5 8.5h4.5M4.5 11h3" />
    </Glyph>
  );
}
