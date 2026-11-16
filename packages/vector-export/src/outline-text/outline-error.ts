// Why the Logo Kit could not outline its text (livedesign/docs/specs/007-editor/logo-pages.md "Outlined text"): the panel shows
// the message, so it names the face and, for missing letters, the letters. Never the logo's text in a log.

export type OutlineErrorKind = 'font' | 'letters' | 'layout';

export class OutlineError extends Error {
  readonly kind: OutlineErrorKind;
  readonly face: string;

  constructor(kind: OutlineErrorKind, face: string, letters = '') {
    super(
      kind === 'font'
        ? `Couldn't fetch ${face}, so the logo's text can't be outlined. Check your connection and try again.`
        : kind === 'letters'
          ? `The letters “${letters}” aren't in ${face}'s Latin set, so they can't be outlined.`
          : "The logo's text couldn't be outlined. Try again.",
    );
    this.name = 'OutlineError';
    this.kind = kind;
    this.face = face;
  }
}
