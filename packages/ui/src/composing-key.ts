// Whether a key press belongs to an input method that is composing text (Japanese, Chinese or Korean input, a
// phone's handwriting or dictation), not to the field it types into (docs/specs/004-interface-design/
// design-principles.md "A key that confirms a word is the input method's"). While it composes, Enter picks the
// conversion, Escape drops it and the arrows move through its candidates, so a field's own Enter (commit, submit,
// pick), Escape (cancel) and arrow keys stand aside. Safari ends a composition before the keydown of the Enter that
// confirmed it, which then reads `isComposing: false` and keyCode 229 ("an input method is handling this key"), so
// that code counts too.

type KeyLike = { isComposing?: boolean; keyCode?: number };

/** The key press is an input method's: a React keyboard event (through its native event) or a DOM one. */
export function isComposingKey(e: KeyLike & { nativeEvent?: KeyLike }): boolean {
  const key = e.nativeEvent ?? e;
  return key.isComposing === true || key.keyCode === 229;
}
