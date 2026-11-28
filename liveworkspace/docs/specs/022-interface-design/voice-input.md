# Voice input

Every field where a person writes to an AI, built-in or their own key, has a microphone button, so they can speak the
request instead of typing it (Work Tracker 1510). Speaking fills the field; nothing is sent until they send it.

## Where it shows

One button, on every AI prompt field in every app:

- **Ask** ([ask.md](../020-ask/ask.md)): the question box of the Ask tool in livediagram, livedesign, livedocuments,
  livehuddle and liveplanner, liveknowledge's Ask, and liveplanner's AI button beside Card Types. The mic sits in the
  box's lower row, just before Send.
- **Describe with AI**: Describe a Rule (every app's Automations), Describe a Plan, Describe a Form (liveplanner),
  Describe a Page (livedocuments). The mic sits under the box, at the left of its count.
- **liveknowledge**: Describe the Structure and the setup's Describe step (and Describe to Add Pages). The mic sits in
  the row under the field, before its count.

A field that is not a prompt to an AI (a comment, a card title, a search) has none.

## How it behaves

- **Idle.** A quiet 34 px round button with a microphone, named and tooltipped "Speak Your Request". It is hidden
  where the browser has no speech recognition (Firefox, for one): never a dead button.
- **Listening.** A press starts it. The button fills red with a white Stop square and a soft pulse ring (no pulse
  under reduced motion), is named "Stop Speaking" and pressed (`aria-pressed`). An empty field's placeholder says
  "Listening…". What is heard is written into the field as it is heard, the guesses replaced as they firm up; words
  already in the field stay, and the speech follows them after a space. The field's limit holds.
- **Stopping.** A second press, Escape (only that: the dialog or panel around it stays open), sending, or typing in
  the field stops it. The browser also stops on its own after a long silence. The caret then goes to the end of the
  field, so the person reads and edits before they send. Nothing is ever sent by speaking.
- **Words heard by a screen reader.** A polite live region says "Listening" and "Stopped listening".
- **When it can't.** A blocked microphone says, under the field, "The microphone is blocked. Allow it in the
  browser's site settings to speak." No microphone, no speech heard, or no connection to the browser's speech
  service each say so in a short line there. The next press tries again and clears the line.
- **Busy fields.** While the field is read-only or disabled (a draft running, an answer streaming), the button is
  disabled and listening stops.
- **Phone and dark mode.** The same button, a 44 px touch target on touch screens; dark mode has its own red and well.

## What hears it

The browser's own speech recognition (the Web Speech API), in the page's language. No audio reaches liveworkspace and
nothing costs AI credits. Some browsers (Chrome, Edge, Safari) send the audio to their vendor's speech service to
turn it into words: the help says so in one line wherever it describes speaking a request.

## Not in scope

Reading answers aloud, a wake word, sending on a spoken "send", and dictation into ordinary text fields.
