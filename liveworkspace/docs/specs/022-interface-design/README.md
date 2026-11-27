# Interface design

Follow the references below only as needed; never upfront.

- ./action-parity.md - when adding, renaming or moving an action every app shares (share, rename, duplicate, move to
  the Trash, restore, export, search, open recent, copy link): where each one lives in every app, its label, its
  shortcut and how it says it worked, the one tab menu every editor binds, and the rule that keeps them the same
- ./close-button.md - when adding or changing a modal's or a drawer's header: the one circled X close every modal and
  drawer wears, on a phone and a desktop, and what keeps its own (popovers, search fields, bars)
- ./error-words.md - when writing what an error says: the voice (what happened, then what to do), the classes
  (offline, signed out, no access, not found, conflict, rate limited, server) and their words, and when Try Again shows
- ./undo-not-confirm.md - when adding or changing a destructive action in any app: restorable actions act at once
  with an Undo toast, permanent ones keep a confirm, and every confirm sorted into one or the other
- ./voice-input.md - when adding or changing a field where a person writes to an AI: the microphone every AI prompt
  field wears, where it sits, how listening starts and stops, what it says when it can't, and who hears the sound
- ./blueprints/README.md - when implementing an interface design spec: the blueprints hold the engineering detail derived from it
