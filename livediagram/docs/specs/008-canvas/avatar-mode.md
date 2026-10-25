# Avatar mode

Status: **implemented**.

A canvas tool (a "selection mode", the group the picker at the top of the palette holds) called **Avatar**: a small Habbo-Hotel-style pixel character stands on the canvas, walks to wherever you click, steps in whatever direction you press the arrow keys, and hops with a waved flag on Space. While the mode is active the canvas is **read-only for you**, so a walk gesture can never select, move, or edit anything. Everyone in the room sees everyone else's character.

## Why

Narrating the canvas on a call today means waving a cursor around, or reaching for Laser / Spotlight ([Canvas and palette](canvas-and-palette.md)) — both of which point AT things from outside. Walking a character to the box you are talking about puts the presenter _inside_ the canvas: the audience follows a body moving between places, which reads as a tour rather than a slideshow. It is also the cheapest possible "presentation mode": no authored steps, no reveal order, no schema (contrast [Presentation mode](../012-collaboration/presentation-mode.md), still draft).

## Where it lives

- New `CanvasTool` id `'avatar'`. **It is reached only through a [Selection Mode button](../009-elements/mode-button.md) set to Avatar**, placed on the board: the author who put the button there chose to offer the walk on that board, so the board, not the editor's chrome, is the door. The canvas-tool picker (the Selection Mode menu at the start of the palette strip) does not offer Avatar, there is no keyboard shortcut for it, and the search panel has no `tool:avatar` command. A board that wants walking gets a button; the [Avatar Pad](../009-elements/avatar-pad.md) decides where people then start.
- **The picker still shows where you are.** While you are in Avatar mode the picker's current value reads **Avatar** (the one time the entry appears in its list), so the mode you are in is never mislabelled as Select; picking any other mode there leaves it. The other ways out stay as they were: a view-tool key (`V`, `H`, `K`, `I`), reaching for the palette, or pressing an Avatar button again.
- A button hands Avatar out in **every** editor mode, and leaving Workshop while walking does not end the walk.
- Available on **every viewport** (unlike Spotlight): tap-to-walk works fine on touch, it just loses the arrow keys.
- Available to **view-role** visitors — it is a pure view aid and mutates nothing.
- **Entering the mode clears the current selection** (an element left selected would keep its handles and reappear on exit, the same reason Spotlight clears it).
- The mode's name is **Avatar**, deliberately the same word the user asked for. It is NOT the palette's **Avatar element tile** (a circular photo, [Canvas and palette](canvas-and-palette.md) Components); the two never appear on the same surface, and telemetry keeps them apart via a distinct type token (below).

## The character

- Drawn in **canvas coordinates** inside the canvas's transformed wrapper, so the avatar pans and zooms with the content. Standing next to a shape therefore means something, unlike the screen-space spotlight beam.
- **Habbo style**: a chunky, flat-coloured pixel figure with hard edges, no gradients and no anti-aliased curves — inline SVG on a coarse pixel grid, ~40x56 canvas px, big head, small body, two-tone shading for depth.
- Its **position is its feet**, not its centre, so it stands _on_ the point you clicked. A soft elliptical contact shadow sits under the feet.
- **Four facings** (down / up / left / right; right mirrors left), picked from the direction of travel and held when it stops.
- **Customisable** via the Avatar Panel (below): gender, clothing, hair, and size, all costumes on the SAME skeleton so the walk / hop / flag animations are shared across every combination. **Right-clicking the character toggles gender** — the one choice reachable without the panel (a right-click anywhere else on the canvas does nothing; the context menu stays shut in this mode). None of it carries meaning beyond which sprite is drawn.
- **The shirt is the participant's presence colour** — the same colour as your cursor, your name chip, and your tab-bar dot — so on a shared document you can tell at a glance which character is whose. Falls back to the brand cyan when there is no participant colour. **Colour is deliberately not customisable**: it is the one thing on the character that carries information.
- **Walk animation**: a two-frame leg swing plus a one-pixel body bob, advanced by **distance travelled** rather than wall-clock, so the step cadence matches the speed at any zoom.
- Renders **above the element layer** (it is standing in front of what's on the canvas, not behind it) and below the palette / chrome, which stay clickable so you can leave the mode.
- **Where it appears on entry**: on the tab's [Avatar Pad](../009-elements/avatar-pad.md) when it has one (the nearest to the view's centre when it has several), arriving in a beam of light; otherwise just below the button that was pressed ([Entering from a button](#entering-from-a-button)); otherwise where it was left, while that is still on screen (a quick detour to another tool, the canvas staying mounted); otherwise the **centre of the current viewport**. It resets on the next entry after a tab change: it is transient view state that belongs to nobody.

## The Avatar Panel

While the mode is active, an **Avatar** button sits in the bottom-right cluster, **immediately right of Undo / Redo** (first in the cluster for a Viewer, who has no Undo), and opens the **Avatar** panel, the character sheet, as a popover over it, the way Layers, Contents and the Session strip's buttons open theirs. The panel is **closed when the mode starts**: the canvas is the point of the mode, and a panel that always covered a corner of it was in the way. Pressing the button again, pressing outside the popover, or Escape closes it. The button exists only while the mode does, so leaving the mode takes the button and any open panel with it. It shows on a desktop and a phone alike, named **Avatar** beside a small head-and-shoulders glyph on a desktop and the glyph alone on a phone, like its neighbours. View-role visitors get it too: the mode is theirs as well. Zen keeps the button, the mode's one piece of chrome there, and the panel opens from it as anywhere else; only the welcome flow hides it. The panel is never a corner panel: it does not dock, drag or join a corner stack.

Contents, top to bottom:

- A **cropped portrait** of the character, drawn by the same sprite component the canvas uses (standing, front-on). The box hugs the figure — the walking sprite's box reserves headroom for the hop and slack for the flag, which as a preview frame was mostly empty space — and the preview holds a fixed scale so switching to Small / Tall doesn't resize the panel. A **randomise button** (icon only, no label) sits in its top-right corner: one click rolls a whole new character, **keeping the chosen size** for the same reason the first-use roll leaves it alone. It reuses the `RefreshIcon` the welcome flow's shuffle-a-name button uses — same meaning, same glyph.
- Four **accordion rows**, one per choice, **single-open and all closed to start**, each showing its current value in the collapsed header. Sixteen outfit + hairstyle chips laid out flat would be most of the canvas; collapsed, the panel is a four-line summary of your character and you expand only the row you came to change. Built on the shared `AccordionSection` primitive (extracted on this third consumer, alongside the Settings dialog, whose Keyboard category also uses it for the shortcut groups).
  - **Gender** — Male / Female.
  - **Clothing** — sixteen outfits: T-shirt / Stripes / Jumper / Hoodie / Vest / Suit / Dress / Skirt / Polo / Flannel / Overalls / Lab coat / Hawaiian / Varsity / Turtleneck / Apron. Each is a change on the same body: stripes and a jumper's collar + ribbed hem are chest detail, the hoodie adds a hood behind the head and a kangaroo pocket, the vest and the Hawaiian shirt bare the arms, the suit is an open jacket over a white shirt with a tie, overalls and the apron are a bib over whatever is underneath, the lab coat is an open white coat, and the dress / skirt swap trousers for bare legs. The two silhouette rules travel as sets (`BARE_LEG_CLOTHING`, `BARE_ARM_CLOTHING`) so the front, back, and profile views can't disagree about what an outfit implies.
  - **Hair** — fourteen styles: Short / Buzz / Curly / Long / Ponytail / Bun / Mohawk / Bald / Pigtails / Afro / Spiky / Bob / Braid / Top knot, each drawn per view (the bun, the plait, and the tail read from behind; the mohawk shaves the sides to stubble; the afro sits proud of the head on every side).
  - **Size** — Small / Regular / Tall, a scale on the whole sprite (**1.15 / 1.5 / 1.95**). Every step sits above the base 40x56 sprite: at 1x the character read as a detail on the canvas rather than someone standing in the room, and the costume details (a tie, a bun, a pocket) were too small to see. Size scales the right-click hit box and the name chip's offset with it, so a small character isn't clickable well outside itself.

- Two **action rows** below the settings, behind the same single-open disclosure: **Behaviour** (what the character does with its body) and **Reactions** (a burst thrown around the character).
- **Behaviour** holds five short one-shot performances:
  - **Jumping jacks** — five hops, arms out and legs splayed at the top of each.
  - **Wave** — a raised hand crossing back and forth for about a second and a half.
  - **Spin** — two full turns on the spot through all four facings.
  - **Cheer** — both arms up and two bounces.
  - **Dance** — a side-to-side sway with the arms alternating.

  A Behaviour performance plays **on the spot**: starting one drops any walk in progress (sliding through a routine reads as a bug) and clicking again restarts it rather than queueing. Peers see it: the presence packet carries the **kind plus how far into it the sender is**, and each receiver derives the pose with the same pure `reactionPose` function: a kind and a clock on the wire rather than a pose.

- **Reactions** holds the same five bursts a [Reaction Pad](../009-elements/reaction-pad.md) throws (Confetti, Sparkles, Hearts, Applause, Fireworks), played around the character instead of around a pad. Unlike a Behaviour performance, a Reactions burst plays **on your own screen only**: the room's `reaction` op is keyed to a pad's element id (the character has none), and the avatar presence packet carries no burst. Showing it to peers would mean a burst field on `AvatarPresence` and a peer-side burst layer; it is not built.

- A **Send a Message** button closes the panel, full width under the action rows, for someone who may [speak](#speech-bubbles). It opens the [message popover](#the-message-popover), and it is the only way to speak on a device with no Enter key. On a desktop it carries an `Enter` key hint, so the shortcut is learned where the button is. A Viewer's panel has no such button.

**No colour picker**, deliberately — see above.

## Keyboard actions

Every Behaviour and every Reaction in the panel is also **one key**, so a presenter mid-walk can wave or throw confetti without opening the panel:

- **Behaviour on its initial**: `J` Jumping jacks, `W` Wave, `S` Spin, `C` Cheer, `D` Dance.
- **Reactions on `1` to `5`**, in the panel's order: Confetti, Sparkles, Hearts, Applause, Fireworks.
- A key plays exactly what its panel button plays (the same `playReaction` and burst handlers), the panel open or not. Pressing it again restarts the performance or replays the burst, as a second click does.
- **Plain presses only**: any modifier (Shift+D stays the mode switch, Cmd+C copies) and an autorepeat from a held key do nothing, so holding a key never machine-guns a burst.
- **Never while typing**: a focused text field (the message composer, a rename, a comment), an open dialog or a focused menu keeps the key, as it does for the arrows and Space.
- While walking these keys are the character's, so the editor's own meanings stand aside (`S` does not open Search, `1` does not pick Select). `V` / `H` / `K` / `I` / `Z` and `Escape` remain the ways out.
- The panel shows each key on its button (desktop only, as the message button's `Enter` hint), and the Settings Keyboard reference lists them under **While walking (Avatar mode)**. The key map lives in `lib/avatar-action-keys.ts` (pure, unit-tested); `hooks/canvas/useAvatarActionKeys.ts` plays it.
- Viewers have the keys too, as they have the panel's actions: nothing they do is a document write.

## Persistence

**First use rolls a random character.** A browser with nothing stored gets a random gender, clothing, and hair rather than the same default figure everyone else starts as — two people walking onto a canvas shouldn't arrive as twins. **Size is not rolled**: it changes how much of the canvas the character covers, so it starts Regular and stays a deliberate choice. The roll is **pinned to storage the first time the mode is actually entered** (not on editor mount), so it becomes _your_ character rather than re-rolling every time, and a user who never opens Avatar mode never has one written for them. `Reset position`'s sibling behaviour follows: resetting the character rolls a new random one rather than returning the plain default.

The four choices are then **remembered per browser** under `livediagram:v2:avatar-config`, so the character you built is the one waiting next time you enter the mode. Device-local by design, like the panel placements ([Panel corner docking](../007-editor/panel-docking.md)): which character you walk around as is a personal / ergonomic choice, not document data, so it never reaches the api, its storage, or the synced preferences blob — and guests get it for free.

Parsing is **field by field with per-field fallbacks**: a value this build doesn't recognise (an option retired in a later release, a hand-edited key) costs only that one choice rather than resetting the whole character, and a config written by an older build loads with the new fields defaulted. Position of the avatar itself is still never persisted — only the costume.

## Walking

- **Click / tap anywhere** on the canvas: the avatar walks there in a straight line at a constant **260 canvas px/s**, facing its direction of travel. A click mid-walk retargets immediately. It arrives and stops; there is no easing, deliberately — a constant-speed walk reads as a character, an eased glide reads as a camera.
- **Arrow keys**: while held, the avatar walks that way, mirroring the direction pressed. Two held keys compose a diagonal (normalised, so diagonal walking isn't faster). Any arrow press cancels a click-walk in progress; releasing every arrow stops the avatar where it stands.
- **No collision with ordinary elements**: they are scenery, so the avatar walks over anything except a [Fence](../009-elements/fence.md), a [Room](../009-elements/office.md#room)'s walls (it enters by the doorway) and the footprint of a plant or bookshelf ([Office](../009-elements/office.md)), none of which it can cross (it stops, or slides along them). Walking onto a water cooler or coffee machine gives it a drink, carried in its presence as `holding`. The element it is standing on gets a soft brand-tinted "you are here" ring, which is what makes the mode useful for narration — the audience can see what the character has arrived at.
- **Space hops**, and the character waves a small flag through the hop plus a short tail so it reads as a celebration rather than stopping dead on landing. The hop peaks around 70 canvas px and lands in a bit over half a second; the contact shadow shrinks as it rises, which is what sells leaving the floor. Autorepeat is ignored (one press, one hop) and a second press mid-flight does nothing. Space is the hold-to-pan modifier everywhere else, which this mode can afford to reclaim: it is read-only, so there is no selection to tap-edit, and panning stays on middle-mouse drag, the trackpad, and the zoom controls.
- **The camera follows**: when the avatar comes within ~120 screen px of a viewport edge, the viewport pans just enough to keep it in view. Zoom is never touched (a mode that zoomed for you would fight the presenter).
- Right-click never walks, and the canvas / element context menus stay suppressed while the mode is active (a menu opening mid-walk would interrupt the tour).
- Panning by hand still works: middle-mouse drag, held-Space drag, two-finger trackpad, and the zoom controls all behave as usual.
- **On touch, a finger's drag pans and its tap walks.** A finger has no middle button and no Space to hold, so a one-finger drag pans the canvas, as the Hand tool does, and only a press that lifts without moving (a tap) walks the character there, or to a peer it lands on. Pinching zooms as usual and never walks. A mouse click still walks the moment it is pressed. (`useCanvasSurfaceGestures` starts a pan whose tap is the walk; `useCanvasPanAndMarquee` runs a pan's tap on a release that never moved and counts a pinch as moved.)

## Read-only while active

"Read-only for me" is enforced the same way Spotlight and Isometric ([Isometric view](isometric-view.md)) do it, plus a keyboard gate:

- The whole canvas layer goes **pointer-inert** (`pointer-events: none`), so no click can select, drag, resize, or double-click-edit any element kind. A per-element guard cannot cover every path (boxed elements, arrow hit-bands, labels), which is why the layer-level switch is the mechanism.
- The **arrow keys belong to the avatar**, so they never nudge a selection.
- The **mutating plain-key shortcuts are suppressed** (element adds, Eraser, Pencil). The non-mutating view tools (`V` / `H` / `K` / `I` / `Z`) keep working so you can always leave, and `Escape` exits the mode to Select (Hand on touch), matching Isometric.
- Nothing is persisted. The one thing that leaves the browser is the ephemeral presence snapshot peers need to draw the character (below).
- **Reaching for the palette leaves the mode.** Picking any palette tile — or dragging one onto the canvas — exits Avatar mode back to **whichever tool was active before it** (not a hardcoded Select) and then performs the add, so a click on the palette mid-walk drops the element instead of being swallowed by a read-only canvas. Implemented as one wrapper over the whole tile-action bundle, so tiles added later inherit it.

## Realtime

**Everyone sees everyone.** The character rides the presence channel as an `avatar` `RoomOp` (alongside `cursor` / `select` / `laser` / `tab-focus` in `@livediagram/api-schema`), so a whole room can walk around one canvas at once.

- The packet is deliberately tiny — feet position, facing, the four costume tokens, walking flag, step frame, hop height, wave frame — and goes out at the **same ~30 Hz throttle as the cursor** (a packet a window holds back is sent as the window ends, so the last one said, a status picked or the step a walk ends on, is never the one dropped), from the same gates (hydrated, a document id, and either a share link or a team document). The costume is **optional on the wire**, so a packet from an older client still parses; the receiver runs it through the same field-by-field parser as storage and falls back to the default character.
- It is **ephemeral presence, not a mutation**: `avatar` is in the room's `PRESENCE_OP_KINDS`, so it relays unordered, from any role (**including view-role** — an audience member walking around a canvas someone linked them to is as harmless as their cursor), is never persisted, and is never replayed to a reconnecting client.
- **Leaving the mode publishes `avatar: null`**, which deletes the entry on every peer, and a peer who disconnects is pruned with the rest of their presence — so nobody is left standing on a canvas after they've gone.
- Peers' characters are **scoped to the tab** they were published on and are drawn with **their own presence colour on the shirt plus a small name chip** above the head, so a room of walkers stays legible. Your own character has no chip (you know who you are).
- Peer characters render **whether or not you are in Avatar mode yourself**: someone else walking you through their canvas is worth seeing from the Select tool.
- **You can push each other.** Clicking a peer's character (in Avatar mode) walks yours over to them and, on arrival, sends an `avatar-push` op naming them plus a unit direction. Only that participant acts on it, by sliding their own character a short way (70 canvas px) along the direction — so a push is a **request to the owner**, never a remote write, and someone who has already left the mode simply ignores it. Same presence trust level as `avatar`: unordered, any role, never logged, never replayed. It is not throttled, because it is an event rather than a sample.
- A **hide-cursors vote ([Session tools (timer + voting)](../012-collaboration/session-tools.md)) hides avatars too**, on both the outbound and render halves. A walking character is a position on the canvas, so showing it while cursors are hidden would leak exactly what the vote exists to hide.

## Status

Your character can say **how you are** without a word: a status set from the Avatar panel, shown to everyone on
the tab while you are in the mode. It is what makes a virtual office read at a glance:
who is free to talk, who is heads-down, who has stepped away.

| Status           | Token       | How it shows                                                   |
| ---------------- | ----------- | -------------------------------------------------------------- |
| **Available**    | `available` | A green dot above the head                                     |
| **Focusing**     | `focus`     | Headphones on the character (violet ear cups) and a violet dot |
| **In a Meeting** | `meeting`   | A red dot above the head                                       |
| **Away**         | `away`      | The character fades to half and a slow "Zz" rises above it     |

- **Set from the panel**: a **Status** row, closed until opened like the rest, with the five choices (**None** and
  the four), its current value in the collapsed header. Every role may set it: it is presence, like the character.
- **Peers see it**: the status rides the avatar presence (`status`), parsed field by field; anything else is no
  status. A peer's dot sits at the start of their name chip; yours sits above your head, where your chip would be.
- **For the session only**: it is never stored, so an "In a Meeting" set yesterday does not greet anyone today.
  Leaving the mode clears it, like the character itself.
- A screen reader hears a peer's status with their name ("Sam, Focusing"), and your own as yours ("Your status:
  Focusing"), as visually hidden text beside the character, which is itself hidden from assistive tech. A long name
  in the chip ends in an ellipsis, and the chip and the Zz always draw over the character, faded or not.
- Under reduced motion the "Zz" holds still.
- Telemetry: `UI · Changed · AvatarStatus` on a change, never which.

## Speech bubbles

A character can **say something**: a short message appears in a speech bubble above its head, then floats up and away for everyone on the tab to see. It is the lightest possible way to talk on the canvas: a "hello!", a "follow me", a "nice one" while somebody presents, without a chat panel or anything left behind.

### Who may speak

- An **Editor** and a **Participant** may speak. A **Viewer** may not: the Enter key does nothing for them and their panel has no Send a Message button, but they **see** everyone else's bubbles, as they see everyone's characters. Gated on the session's `can`, never on `isReadOnly` (Avatar mode makes the canvas read-only for everyone in it).
- The room enforces it too: it drops an `avatar-say` from a view-role sender, as it drops a Viewer's reaction or poll answer.
- Speaking needs the mode: there is no bubble without a character to say it.

### Typing a message (the composer)

- **Enter**, in Avatar mode and with nothing else holding the keyboard, opens the **composer**. A focused control Enter acts on itself keeps it: a button or link, a menu row, a tab, a switch, anything in a popover or the tour's card. The composer is a speech bubble above your own character's head with a text box in it, focused, its tail pointing at the head. It pops open with a small bounce. Its code is fetched when someone who may speak enters the mode, so the words typed straight after the first Enter land in it rather than on the editor's shortcuts.
- The composer **follows your character**: walking by click keeps it above the head. While you type, the keyboard is the composer's: arrow keys move the caret and Space types a space, so neither walks nor hops.
- **Up to 50 words**, and at most 300 characters. A word counter appears once you pass 40 words (`43 / 50`) and turns amber at 50; typing past either limit is refused rather than cut, so nothing you wrote vanishes. Text put in at once (a paste, a drop, an autocorrection, an input method's composed text) is trimmed to the limit instead, never between the halves of an emoji. Newlines become spaces: a bubble is one thought.
- **Enter sends.** So does the small send button (a paper plane) at the bubble's right edge. Sending an empty or all-space message just closes the composer.
- **Escape cancels**: the composer closes and the text is dropped. Pressing outside it on the canvas walks as usual and leaves the composer open with your text; the composer only closes on its own when it loses focus while empty.
- The composer is drawn at **reading size whatever the zoom**: it sits at a canvas point (above the head) but does not shrink as you zoom out, so it is always typeable.

### The message popover

The panel's **Send a Message** opens a popover over the Avatar button with a text area, the same 50-word and 300-character limits and counter, and **Cancel** and **Send**. **Send** (or Enter in the text area, Shift+Enter being the same as Enter) sends exactly as the composer does, closes the popover and the panel, so you see your bubble rise. Cancel or Escape closes the popover and returns to the panel. This is the phone's way to speak; a desktop has both.

### Sending: the bubble floats away

- On send the bubble **detaches**: its tail fades, and it floats **straight up from where your character's head was** when you sent it, swaying gently from side to side, so it reads as drifting rather than sliding. Your character is free to walk away from it at once.
- It **fades out over the last third** of its flight and is gone. How long it flies **scales with its length**: 4 seconds for up to two words, 0.15 seconds more for each further word, and never more than 10 seconds (reached at 42 words), so a long message stays up long enough to read. It rises at a steady 18 screen pixels a second, so a longer message also floats higher.
- Like the composer, a floating bubble is drawn at reading size whatever the zoom, anchored to its canvas point, so it pans with the canvas.
- **Several at once**: you may send again as soon as your last bubble has left your head, after a **1.5 second cooldown**; until then Enter and Send are held (the composer shows "One moment…"). Each bubble flies on its own clock, so a quick second message rises beneath the first.
- **Peers see the same flight**, starting when their copy arrives. Every bubble, yours included, has its border and tail in the speaker's **avatar colour** (their presence colour, the shirt's) and the speaker's **name** in small type **under the message**, in the same colour, so a message is still attributable once its sender has walked away. The composer wears your colour too, its send button included.
- **Bounded on every screen**: at most **three** bubbles per person are on screen; a fourth from the same person makes their oldest fade out at once. A client that ignores the cooldown therefore cannot fill anyone's canvas.

### The wire

- An `avatar-say` presence op: `{ kind: 'avatar-say', tabId, id, text, x, y }`, where `id` is the bubble's random id, `text` the message and `x, y` the canvas point the bubble starts from (the speaker's head). It is **presence**: unordered, never logged, never replayed to a late joiner (a message is about the moment), never written to the document or D1.
- The room relays it from an Editor or a Participant only, and drops one whose `text` is not a string of at most 300 characters. A receiver parses it field by field, re-applies the 50-word and 300-character limits, ignores one for another tab, ignores repeats of an id it has seen, and draws the text as **plain text**, never markup.
- A **hide-cursors vote** hides bubbles too, on both halves, as it hides characters.
- A screen reader hears a peer's message through a polite live region ("Sam says: hello!"); your own is not repeated back to you.

### Motion

The pop on opening, the sway and the rise are decoration. Under **reduced motion** a bubble neither pops nor sways nor rises: it appears above where it was sent, holds for its flight time and fades.

## Entering from a button

A [Selection Mode button](../009-elements/mode-button.md) set to Avatar drops the character **just below that button** rather than at the viewport centre: you pressed a thing on the canvas, so the character should appear where you pressed it. A pad on the tab beats it ([Entering on a pad](#entering-on-a-pad)). The spawn point is one-shot: a quick detour to Select still returns you to where you left the character. Only a press that enters the mode sets it: pressing the button while already in Avatar mode leaves the mode and leaves no spawn point behind (`avatarSpawnFromButton`).

## Entering on a pad

An [Avatar Pad](../009-elements/avatar-pad.md) is the board's entrance. While the tab has one, every entry into the mode puts the character on it (the pad nearest the view's centre, if there are several), centres the view on it when it is off screen, and plays the arrival beam in the person's colour. Placing or moving a pad never moves a character already walking. The pure choice (`pickSpawnPad`, `padSpawnPoint`) lives in `apps/editor/lib/avatar-pad.ts`; the arrivals (yours and peers', derived from presence) in `apps/editor/hooks/canvas/useAvatarPadArrivals.ts`, drawn by `AvatarPadArrivals.tsx`.

## Implementation shape

Per the no-god-files rule:

- **`apps/editor/lib/avatar-walk.ts`** — the pure geometry: one frame's step toward a target, the arrow-key direction vector, the facing from a delta, the camera-follow correction, and the element-under-the-feet lookup. Unit-tested (`avatar-walk.test.ts`); no React, no DOM.
- **`apps/editor/lib/avatar-walk.ts`** also holds the jump integration (`jumpStep`), the flag-wave frame clock (`waveFrame`), and the sprite hit-test (`hitTestAvatar`) the right-click look toggle uses.
- **`packages/api-schema/src/avatar.ts`** — the costume vocabulary itself: the four choices as closed sets of preset tokens. In the wire package because the presence packet carries a costume to peers, so both ends must agree on the tokens; it was written out twice (named types in the editor, inline in the presence message) until they were unified.
- **`apps/editor/lib/avatar-config.ts`** — everything the editor does with that vocabulary: the option catalogues (one source for the panel's rows AND the parser's validation, with their ids typed against the shared unions), the silhouette sets, the size scale, the random first-use roll, the field-by-field parser, and the localStorage read / write. Re-exports the types so its existing importers keep one path. Unit-tested (including that every rolled value parses back, so the catalogues and the roll can't drift); no React.
- **`../packages/workbench/src/components/primitives/AccordionSection.tsx`** — the shared single-open accordion row (header + chevron + grid-rows body), now used by the Avatar Panel and the Settings dialog (including its Keyboard category's shortcut groups).
- **`apps/editor/lib/avatar-reactions.ts`** — the five reactions, their durations, and `reactionPose(kind, elapsedMs)`: a pure timeline that turns "this reaction, this far in" into the pose inputs the sprite already draws (hop height, facing, arms, stance, lean). Unit-tested (five jack reps, two spin turns, no arms-up-two-ways-at-once, everything back to standing when done), and pure precisely so a peer can replay a performance from a kind + a clock.
- **`apps/editor/hooks/canvas/useAvatarConfig.ts`** — the costume state slice: load on mount, persist + report telemetry on each pick, and the gender toggle the right-click uses.
- **`apps/editor/components/panels/AvatarPanel.tsx`** — the panel: the preview, the four choices, the two action rows and Send a Message, on the shared `ModePanel`, shown as a popover over **`apps/editor/components/canvas/AvatarClusterButton.tsx`**, the bottom-bar button.
- **Speech**: **`packages/api-schema/src/avatar-say.ts`** (the `avatar-say` op, its limits and its field-by-field parser, shared by the room and the editor); **`apps/editor/lib/avatar-speech-store.ts`** (the bubbles on screen, a module store the room connection writes to and the layer reads); **`apps/editor/lib/avatar-speech.ts`** (pure: word counting and the limits, the flight time, the bubble's rise, sway and fade at a moment, the per-person cap; unit-tested); **`apps/editor/hooks/canvas/useAvatarSpeech.ts`** (the composer's open state, the cooldown, the floating bubbles, own and peers', sending and receiving); **`apps/editor/components/canvas/AvatarSpeechLayer.tsx`** (the composer and the floating bubbles, drawn in canvas space at reading size, loaded the first time somebody speaks); **`apps/editor/components/canvas/AvatarSpeechBubble.tsx`** (the bubble's look and the draft field, shared with the panel); **`apps/editor/components/panels/AvatarMessagePopover.tsx`** (the panel's message popover).
- **`apps/editor/hooks/canvas/useAvatarWalk.ts`** — the state slice: position / target / facing / hop / wave, the `requestAnimationFrame` loop, the camera nudge, and the presence publisher.
- **`apps/editor/hooks/canvas/useAvatarKeys.ts`** — the keyboard slice (held arrows + the Space jump), split out so the hook above keeps to state + loop.
- **`apps/editor/components/canvas/AvatarWalker.tsx`** — placement: the canvas-coords box, the standing-on ring, the peer name chip. The pixel art itself is three files beside it: **`avatar-sprite.tsx`** draws the body and assembles the whole figure (the walk cycle, the hop, the flag), **`avatar-sprite-head.tsx`** everything above the neck (where the eight-hairstyles-by-three-facings combinations live, which is most of what the sprite draws), and **`avatar-sprite-palette.ts`** the colours both halves have to agree on.
- **Realtime**: `AvatarPresence` + the `avatar` `RoomOp` in `@livediagram/api-schema`; `'avatar'` added to `PRESENCE_OP_KINDS` in `@livediagram/api-schema`; `broadcastAvatar` in `useEditorBroadcast`; the inbound coalescing buffer in `useRoomConnection`; `remoteAvatars` in `usePresenceState`; `buildRemoteAvatarRows` in `lib/presence-rows.ts` (unit-tested).
- Wiring, one small edit each: `canvas-tool-options.tsx` + `palette-icons.tsx` (the picker entry, shown only while in the mode), `useCanvasSurfaceGestures.ts` (the click-to-walk + right-click-gender capture intercept, next to the spotlight one), `canvas-chrome.ts` (cursor), `useEditorKeyboardShortcuts.ts` (the read-only gate, the arrow-key handover), `useCanvasTool.ts` (telemetry + the remembered pre-avatar tool), `palette-tile-actions.ts` (the leave-on-add wrapper, unit-tested), `useDockPopovers.ts` + `useCanvasChromePanels.tsx` + `CanvasChrome.tsx` (the `avatar` dock popover and its button).

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): `track('Canvas', 'Used', 'AvatarMode')` on entry, emitted from `selectCanvasTool` beside the Laser / Spotlight / Eraser lines. `AvatarMode` (not `Avatar`) keeps the mode distinct from the `Element·Added·Avatar` token the palette's photo tile already emits. Each customisation fires `track('UI', 'Changed', 'AvatarGender' | 'AvatarClothing' | 'AvatarHair' | 'AvatarSize')`, and the dice button fires `AvatarRandomised` — which KIND of choice was made, never the value, so the signal is "do people dress their character" without recording what they picked. Opening the panel from its button fires `track('UI', 'Opened', 'AvatarPanel')`. Sending a message fires `track('Canvas', 'Used', 'AvatarMessage')` from the composer and `track('Canvas', 'Used', 'AvatarMessagePanel')` from the panel's popover: that somebody spoke and by which door, **never the text** and never its length. The [Avatar tour](avatar-tour.md) has its own funnel. No per-step, per-click, or per-reaction events (chatty, no signal).

## Out of scope (v1)

- Collision with ordinary elements, or pathfinding around them (walk-around-the-box, walkable frames). Only a [Fence](../009-elements/fence.md), a room's walls and the office's scenery block ([Office](../009-elements/office.md)).
- Avatar customisation beyond the four choices and the presence-coloured shirt (hats, accessories, skin tones, a picked photo, a colour picker — the shirt colour is load-bearing).
- Emotes beyond the five Behaviour performances, the flag wave and [speech bubbles](#speech-bubbles): a reaction someone else can trigger on your character. (Sitting is the [Chair](../009-elements/chair.md)'s.)
- A message history, replies, mentions, private messages, or anything typed reaching the document or the server's storage: speech is ephemeral.
- A mobile on-screen direction pad (touch gets tap-to-walk only — no arrow keys, no Space).
- Any persistence of where the avatar was left (only the costume persists), or syncing the costume to an account across devices.
