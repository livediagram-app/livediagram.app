# Voice input: blueprint

Derived from [Voice input](../voice-input.md). Paths start at the repo root.

## The package

`@liveworkspace/ui/voice-input` (`packages/ui/src/voice-input/`), the one copy every app uses:

- `speech-recognition.ts`: the slice of the Web Speech API it calls (`SpeechRecognitionLike`), `speechRecognitionCtor()`
  (`window.SpeechRecognition`, else `window.webkitSpeechRecognition`, else null), `speechLanguage()`
  (`<html lang>`, else `navigator.language`), `listensContinuously(userAgent)` (false on Android, whose Chrome repeats
  earlier phrases in continuous mode), `heardText(event)` (every result's first alternative joined, a space added
  where a piece has none), `speechBase(value)` (the field's words plus a space unless empty or already spaced),
  `withSpeech(base, heard, max)` (cut to `max`), `noteForError(error)` and `VOICE_NOTE_WORDS`.
- `useVoiceInput({ value, onText, max?, field?, disabled? })` returns `{ supported, listening, disabled, note, status,
toggle, stop, placeholder }`.
  - `supported` reads the constructor through `useSyncExternalStore` (null on the server), so the first client render
    matches the static HTML and the button appears after hydration.
  - `toggle` starts a recognizer: `lang`, `interimResults: true`, `continuous` by user agent, `maxAlternatives: 1`.
    It keeps `base` (the field's words with a space) and `wrote` (what it last wrote). Each result writes
    `withSpeech(base, heardText(event), max)` through `onText`. Pressed while listening, `stop()` calls `recognizer.stop()`
    (the final result still lands), sets `listening` false and the status "Stopped listening"; `onend` then clears the
    recognizer and puts the caret at the end of `field`.
  - A press while the last session is still ending aborts and detaches it, then starts afresh.
  - Typing or sending: an effect on `value` cancels (abort, handlers detached) when the field holds anything but
    `wrote`; a result that lands first checks the same and cancels instead of writing.
  - `disabled` cancels. Unmount aborts.
  - Escape, while listening: a `keydown` listener on `window` in the capture phase calls `preventDefault`,
    `stopPropagation` and `stopImmediatePropagation`, then `stop()`, so the `Dialog` (`useEscape` on `document`) and Tools
    never see it. An input method's composing Escape is left alone.
  - `note`: `not-allowed` and `service-not-allowed` are `denied`, `audio-capture` `no-microphone`, `no-speech`,
    `network` `offline`, `language-not-supported` `language`, `aborted` nothing, anything else and a throwing
    `start()` `failed`. The next start clears it.
  - `placeholder(idle)` is "Listening…" while listening to an empty field.
- `VoiceInputButton({ voice })`: null when unsupported. A `button` (`type="button"`, `data-voice-input`,
  `aria-pressed`, `aria-label` and `Tooltip` "Speak Your Request" or "Stop Speaking"), `size-[34px] rounded-full`,
  `touch-target` (44 px on a coarse pointer), the brand focus ring. Idle: slate-600 lucide mic at 18 px, hover well
  slate-100 (dark slate-800). Listening: `bg-red-600` (dark `bg-red-500`), a white 12 px filled square, and an `::after`
  ring (`-inset-[5px]`, `border-2 border-red-500/40`) on `motion-safe:animate-voice-pulse`. A sibling `role="status"`
  `aria-live="polite"` `sr-only` span says `status`.
- `VoiceInputNote({ voice })`: null unless supported with a note; a `p role="alert"` `data-voice-input-note`, 12 px
  amber-800 (dark amber-200), the note's words.
- `fake-speech.ts` (`@liveworkspace/ui/voice-input-testing`): `FakeSpeech`, `installFakeSpeech`, `removeFakeSpeech`,
  `lastSpeech`, for every host's tests.

`--animate-voice-pulse` (`packages/tailwind-config/theme.css`): `voice-pulse 1.6s cubic-bezier(0, 0, 0.2, 1)
infinite`, scale 0.9 to 1.35 and opacity 1 to 0. Ambient (infinite), so the motion budget skips it; the class is
`motion-safe:` only.

## The hosts

| Field                                                                                                                 | File                                                                                  | Where the mic sits                                             |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Ask (livediagram, livedesign, livedocuments, livehuddle, liveplanner Tools; liveknowledge Ask; liveplanner AI button) | `packages/ask/src/ui/AskComposer.tsx`                                                 | lower row, after New Chat, before Send; the note under the row |
| Describe a Rule, Describe a Plan, Describe a Form, Describe a Page                                                    | `packages/automations-ui/src/DescribePrompt.tsx`                                      | under the box, before the count; the note under it             |
| Describe the Structure                                                                                                | `liveknowledge/apps/editor/components/describe-structure/DescribeStructureDialog.tsx` | the hint row's right, before the count                         |
| Describe to Set Up, Describe to Add Pages                                                                             | `liveknowledge/apps/editor/components/setup/DescribeStep.tsx`                         | the hint row's right, before the count                         |

Each host passes its field ref, its limit where it has one, and its busy flag (`streaming`, `busy`) as `disabled`, and
swaps its placeholder through `voice.placeholder`. A count with `aria-live="polite"` turns `off` while listening, so a
screen reader is not read every word's count.

## Tests

- `packages/ui/src/voice-input/useVoiceInput.test.tsx`: unsupported, both constructors, language and settings,
  interim then final, joins and the limit, stop keeps the last words and places the caret, restart while ending,
  silence, Escape not reaching the document, typing and sending, a late result, busy, denied then cleared, abort,
  a refused start, unmount.
- `packages/ui/src/voice-input/speech-recognition.test.ts`: the helpers and every error's note.
- `packages/ui/src/voice-input/VoiceInputButton.test.tsx`: hidden, pressed and named, live text, status, the denied
  note with the button still live, busy.
- `packages/ask/src/ui/AskComposer.test.tsx` "speaking a question", `packages/automations-ui/src/DescribePrompt.test.tsx`,
  `liveknowledge/apps/editor/components/describe-structure/DescribeStructure.test.tsx` (Escape stops listening and the
  dialog stays).

## Performance

No work until pressed: one `useSyncExternalStore` read and a few refs per field. While listening, one `onText` per
result (the browser sends a few a second). The Escape listener exists only while listening. Bundle: the hook, the
button and the mic glyph, a few KB, on paths that already load `@liveworkspace/ui`.
