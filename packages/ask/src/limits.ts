// The bounds of Ask AI (liveworkspace/docs/specs/019-ask/ask.md "Bounds"): what one question may carry, and built-in
// AI's daily allowance. The editor keeps to them before it sends; the server holds them again, since a request is
// whatever its sender wrote.

/** A question is at most this long. */
export const ASK_MAX_QUESTION_CHARS = 1000;
/** The most passages one question sends. */
export const ASK_MAX_PASSAGES = 200;
/** The most characters of passage text one question sends, across all its passages. */
export const ASK_MAX_PASSAGE_CHARS = 24_000;
/** One passage's text is cut to this, so one long note cannot take the whole budget. */
export const ASK_MAX_ONE_PASSAGE_CHARS = 2000;
/** A passage's title, its tab's name and its kind are each cut to this. */
export const ASK_MAX_LABEL_CHARS = 200;
/** A passage's ids are each at most this long; a longer one is no id of ours. */
export const ASK_MAX_ID_CHARS = 200;
/** A conversation keeps this many turns, the question being asked among them. */
export const ASK_MAX_TURNS = 10;
/** An earlier answer sent back as a turn is read up to here. */
export const ASK_MAX_TURN_ANSWER_CHARS = 8000;
/** The most of a request's body the server reads: room for every passage at its bounds' usual sizes, twice over. */
export const ASK_MAX_BODY_CHARS = 256 * 1024;
/** Questions one person may ask on built-in AI in a UTC day, in one app. A question on a key counts toward none. */
export const ASK_BUILT_IN_PER_PERSON_PER_DAY = 30;
/** Room for the answer and the thinking before it. Whoever's key it is pays for what is used, not the ceiling. */
export const ASK_MAX_TOKENS = 8000;
