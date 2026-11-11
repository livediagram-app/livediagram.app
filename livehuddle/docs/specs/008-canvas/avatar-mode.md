# Avatar mode

Status: **implemented**.

A canvas tool called **Avatar**, named **Walk** wherever an Editor switches to it (the [Edit | Walk toggle](#the-edit--walk-toggle)): a small Habbo-Hotel-style pixel character stands on the canvas, walks to wherever you click, steps in whatever direction you press the arrow keys, and hops with a waved flag on Space. While the mode is active the canvas is **read-only for you**, so a walk gesture can never select, move, or edit anything. Everyone in the room sees everyone else's character.

## Why

Narrating the canvas on a call today means waving a cursor around, or reaching for a laser pointer, which points AT things from outside. Walking a character to the box you are talking about puts the presenter _inside_ the canvas: the audience follows a body moving between places, which reads as a tour rather than a slideshow. It is also the cheapest possible "presentation mode": no authored steps, no reveal order, no schema (contrast [Presentation mode](../012-collaboration/presentation-mode.md), still draft).

## Where it lives

- New `CanvasTool` id `'avatar'`. In livehuddle walking is the point, so the mode is **first-class** (D7 (a) in [Open decisions](../005-project-roadmap/open-decisions.md)). An Editor reaches it four ways:
  - **The Edit | Walk toggle** ([below](#the-edit--walk-toggle)): the first control on the strip, building or walking, the one switch in and out, in one press on any board.
  - **`W`**, from editing ([below](#the-edit--walk-toggle)). Walking, `W` is the Wave ([Keyboard actions](#keyboard-actions)), so it never toggles back; `E` does.
  - **Search** finds it as **Walk** (`tool:avatar`), and editing again as **Edit** (`tool:select`).
  - **A [Selection Mode button](../009-elements/mode-button.md) set to Avatar**, placed on the board, as in livediagram, and pressing it again goes back. The Spaces templates no longer place one: their way in is an [Avatar Pad](../009-elements/avatar-pad.md) ([Every Space has a pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)); a board made before keeps its **Walk In** button, and it still works.
  - **Opening walking** ([below](#opening-walking)): a tab that offers the walk puts you in the mode when it is first shown.
- **A Participant and a Viewer are always in it** ([Always walking](../013-workspace/share-roles.md#always-walking), owner 2026-11-06): their canvas opens walking on every tab, they have no Edit | Walk toggle, and none of the ways out below works for them.
- **The ways out**, an Editor's alone: the toggle's **Edit**, `E` (or `V`), Escape, Search's Edit, or pressing an Avatar button again. Nothing else on the strip leaves the mode: while walking it is the [avatar palette](#the-avatar-palette), whose only way back is the toggle at its start.
- A button hands Avatar out in **every** editor mode, and leaving Workshop while walking does not end the walk.
- Available on **every viewport**: tap-to-walk works fine on touch, it just loses the arrow keys.
- Available to **view-role** visitors: it is a pure view aid and mutates nothing.
- **Entering the mode clears the current selection** (an element left selected would keep its handles and reappear on exit).
- The mode's name is **Avatar**, deliberately the same word the user asked for. It is NOT the palette's **Avatar element tile** (a circular photo, [Canvas and palette](canvas-and-palette.md) Components); the two never appear on the same surface, and telemetry keeps them apart via a distinct type token (below).

## The character

- Drawn in **canvas coordinates** inside the canvas's transformed wrapper, so the avatar pans and zooms with the content. Standing next to a shape therefore means something.
- **Habbo style**: a chunky, flat-coloured pixel figure with hard edges, no gradients and no anti-aliased curves: inline SVG on a coarse pixel grid, ~40x56 canvas px, big head, small body, two-tone shading for depth.
- Its **position is its feet**, not its centre, so it stands _on_ the point you clicked. A soft elliptical contact shadow sits under the feet.
- **Four facings** (down / up / left / right; right mirrors left), picked from the direction of travel and held when it stops.
- **Customisable** via the [avatar palette](#the-avatar-palette) (below): gender, clothing, hair and hair colour (no size in livehuddle: see Size below), all costumes on the SAME skeleton so the walk / hop / flag animations are shared across every combination. **Right-clicking the character toggles gender**: the one choice reachable without the palette (a right-click anywhere else on the canvas does nothing; the context menu stays shut in this mode). None of it carries meaning beyond which sprite is drawn.
- **The shirt is the participant's presence colour**: the same colour as your cursor, your name chip, and your tab-bar dot, so on a shared document you can tell at a glance which character is whose. Falls back to the brand cyan when there is no participant colour. **The shirt colour is deliberately not customisable**: it is the one thing on the character that carries information. Hair colour is a look like any other ([Hair Colour](#the-avatar-palette)) and says nothing about who is who.
- **Walk animation**: a two-frame leg swing plus a one-pixel body bob, advanced by **distance travelled** rather than wall-clock, so the step cadence matches the speed at any zoom.
- Renders **above the element layer** (it is standing in front of what's on the canvas, not behind it) and below the palette / chrome, which stay clickable so you can leave the mode.
- **Where it appears on entry**: on the tab's [Avatar Pad](../009-elements/avatar-pad.md) when it has one (the nearest to the view's centre when it has several), arriving in a beam of light; otherwise just below the button that was pressed ([Entering from a button](#entering-from-a-button)), or, opening walking, below the tab's first Avatar button ([Opening walking](#opening-walking)); otherwise where it was left, while that is still on screen (a quick detour to another tool, the canvas staying mounted); otherwise the **centre of the current viewport**. It resets on the next entry after a tab change: it is transient view state that belongs to nobody.

## The Edit | Walk toggle

Every role walks ([Share roles](../013-workspace/share-roles.md)). An Editor switches between building the board and
walking it with one control, the **Edit | Walk** toggle (owner, 2026-11-06: "change the selection mode dropdown so it
just lets me toggle between Editor and ... whatever using the board is without too long a name"); a Participant and a
Viewer are always walking ([Always walking](../013-workspace/share-roles.md#always-walking)), so they have none. It
replaced both the Selection Mode picker and the bottom-right cluster's Walk button.

```
 [ ↖ Edit │ 👣 Walk ]      building: Edit on       walking: Walk on
```

- **Where.** The very start of the strip, whichever strip shows: the [building strip](../007-editor/toolbar-layout.md)
  (Edit on) and the [avatar palette](#the-avatar-palette) (Walk on), a divider after it, so it stays put under the
  pointer as one strip gives way to the other. On a phone it is one of the strip's fixed items: it stays put while the
  rail swipes.
- **What it does.** **Walk** enters Avatar mode exactly as Search's Walk does (the selection cleared, the tool before
  it remembered, `Canvas·Used·AvatarMode` counted), the character appearing wherever a fresh entry puts it (a pad, else
  where it was left, else the view's centre). **Edit** leaves it for the tool before it (Select on a desktop; on a
  touch screen a drag on empty canvas pans, as it always has). Pressing the side already on does nothing.
- **There are no other modes.** Edit is plain selecting. Hand, Eraser and Format left as modes with the picker:
  panning is Space-drag, the trackpad, the middle button or (touch) a drag on empty canvas; Delete or Backspace
  removes what the Eraser rubbed out; the Format Painter is a button on the selection toolbar
  ([Format panel](format-panel.md)).
- **How it reads.** Two segments on the segmented track (`SEGMENT_TRACK`), the side that is on carrying the solid
  brand pill (`ACTIVE_SEGMENT`) that slides between them (`SegmentSlider`). Edit is the pointer glyph, Walk the
  footprints glyph of Avatar mode, each named beside its glyph on a desktop and glyphs alone on a phone (44px wide
  each, for the thumb). 36px tall like the strip's buttons, with a 44px tap area. Each side has a tooltip: **Edit**
  ("Select and build the board. Shortcut: E.") and **Walk** ("Walk round the board as your character. Shortcut:
  W."), the shortcut left out on a phone. A radio group named **Edit or Walk**, each side a radio.
- **Who.** An Editor alone. Not a Participant or a Viewer, nor an Editor previewing either through the role pill:
  they are always walking, so a switch that could only read Walk and do nothing is left out.
- **Where not.** Not in an embed, which never walks ([Opening walking](#opening-walking)), and not while the welcome
  flow is open (the strip is away).
- **Greyed over a start.** While Start a Space is open, **Walk** stays in place but greyed (`aria-disabled`, so its
  tooltip still shows), its tooltip reading **Walk** ("Pick a template or close Start a Space to walk."), and a press
  does nothing ([Not over a start](#not-over-a-start)). **Edit** is never greyed: leaving the walk always works.
- **Switching morphs the strip.** Pressing the other side swaps the strips as one bar resizing: its width eases from
  one strip's to the other's while the contents crossfade inside it, the incoming ones from that side of the toggle
  (the avatar palette's from the right on Walk, the building strip's from the left on Edit), the toggle riding the
  bar's edge and its pill gliding, as [Toolbar layout](../007-editor/toolbar-layout.md#switching-morphs-the-strip)
  gives it. A board that opens walking or building simply appears.
- **Edit frames the whole tab.** Switching from Walk to Edit (the toggle, `E`, `V`, Escape, Search's Edit, a mode
  button: any way out) glides the view out to the whole tab, the same fit as the Fit command, in the strip's 240 ms
  beside its morph (owner, 2026-11-06: "when I switch to Edit, auto fit to the whole map"): the walk was close up on
  the character, and building starts from the whole board. Walk keeps centring the character
  ([The camera](#the-camera)). Not on a load, a reload or a board opening in Edit (only a walk ending fits), not on a
  change of tab, and not on an empty tab or one holding only its Avatar Pad, whose view stays as it is. Reduced
  motion lands on the fit at once. `useAvatarCamera`'s `fitOnEdit`, gliding through `useEditorViewport`'s
  `glideToFit`.
- **Keyboard.** `W` walks and `E` edits, an Editor's, from the canvas with nothing else holding the keyboard (not
  while typing, in a menu or under a dialog). `V` and Escape still edit too. `W` is free while editing (no tool
  took it), and walking it stays the Wave ([Keyboard actions](#keyboard-actions)), so it only ever walks from Edit; `E`
  is no action key, so it edits from either side. One key for both ways was turned down: it would have to be a key
  the walk does not use, and no letter reads as both.

## The avatar palette

While you walk, **the palette strip dresses and moves your character** instead of building the board (owner,
2026-11-06: "when I switch to avatar mode ... the palette now adjusts their avatar instead ... categories for the
clothes etc, and then the actions like behaviours and reactions on the right"). It is the same strip in the same
place, top centre, built from the same parts as the [category bar](../007-editor/toolbar-layout.md#the-category-bar)
(the buttons, hover intent, pinning on a press, the keyboard, the flyout header, picture tiles and cards), so the mode
reads as one surface rather than a widget on top of the editor. It replaced the Avatar panel, a popover over an Avatar
button in the bottom-right cluster; that button and panel are gone.

```
 [Edit|Walk] │ Gender Clothes Hair Status │ Actions React │ [Say]         (top centre)
                 the look                      the actions     speak

                  [Mic] [Camera] [Share]                               (bottom centre: the Call dock)
```

- **When.** The moment the mode starts, for every role, and only while it lasts: leaving the mode brings the building
  palette back exactly as it was (it is hidden, not unmounted, so a Stickers group it was left on is kept). A
  Participant is always walking, so the avatar palette is the only palette it ever has; a Viewer, who has no building
  palette, gets one only while it walks. Like the building strip it hides with the rest of the chrome (an embed, the
  welcome flow), and it never shows while **Start a Space** is open, since the mode cannot start there
  ([Not over a start](#not-over-a-start)).
- **An Editor's starts with the [Edit | Walk toggle](#the-edit--walk-toggle)**, Walk on, a divider after it, ahead
  of the look: the way back to building. A Participant's and a Viewer's has no toggle: they never leave. Who gets which palette is one pure rule
  read from the session's `can` (`stripPaletteFor` in `apps/editor/lib/avatar-palette.ts`).
- **The look**, one category per choice, each opening a flyout of picture tiles drawn by the same sprite the
  canvas uses, each tile wearing that choice on **your** character in **your** colour, so you pick by sight:
  - **Gender** (owner, 2026-11-06: "Character -> Gender"; the category id stays `character`): your portrait, large,
    with **Randomise** beside it (rolls gender, clothes, hair and a natural hair colour, keeping the size), then
    **Gender** (Male, Female) as two portraits. Its tagline: "Your portrait, male or female, or a new look at
    random." Where a product offers Size (livediagram), its three tiles follow; livehuddle has none (below).
  - **Clothes**: the sixteen outfits, four to a row.
  - **Hair**: the fourteen styles, each tile cropped to the head so the hair is the picture, drawn in your hair
    colour. At the bottom (owner, 2026-11-06: "Let me change hair color in the hair menu - at the bottom"), a titled
    **Hair Colour** group, as Status's Sound: one wrapping row of round swatches, one per [hair colour](#hair-colour),
    each a button named by its colour (its `aria-label` and its tooltip), pressed while it is yours, with the pointer
    cursor. A press applies at once like a tile; pointing at one or focusing it tries it on in the preview card.
  - **Status**: cards three to a row (two on a phone), **None** then the statuses in three named groups, **Availability**,
    **Activity** and **Mood**, each card its dot, its name and its short line ([Status](#status)). Under
    them, **Sound** holds the **Jukebox Music** switch (your own switch for every jukebox,
    [Social pieces](../009-elements/social-pieces.md)), the panel's last row, which has no other home.
- **Picking applies at once.** A tile is a choice, not an action: it shows pressed while it is what you wear, the
  character on the canvas changes as you press, and the flyout stays open so you can try the next. It is saved and
  sent to peers exactly as before ([Persistence](#persistence), [Realtime](#realtime)).
- **Then, on the right, the actions**, after a divider: **Actions** and **React** (owner, 2026-11-06: "Reactions -> React, Behaviour -> Actions"; the
  ids stay `behaviour` and `reactions`), cards two to a row. An Actions card shows your character mid-move (arms up for Cheer, splayed for Jumping Jacks) and a Reaction card its
  emoji, each with its key cap on a desktop ([Keyboard actions](#keyboard-actions)). Using one plays it and keeps the
  flyout open, as a pick of the look does, so you can play the next; a press outside or Escape closes it.
- **The preview, beside the flyout (desktop only).** Owner, 2026-11-06: "have a panel to the right, not attached
  ... that shows a preview of your character, but larger, and when I hover an option ... the preview shows me what
  it would look like before I click it". While any of the six flyouts is open, a second card floats to its right,
  8 px clear of it and level with its top: the flyout's own surface (radius, border, shadow, dark fill), your
  character standing large in your colour, drawn by the canvas's sprite with hard pixel edges, and a caption under
  it.
  - **Pointing at an option tries it on** without applying it, and so does focusing it from the keyboard: an outfit,
    a hairstyle, a hair colour or a gender shows the character wearing it; a status shows its dot and name under the character
    and its signature on it, moving as it does on the canvas (Focusing with the headphones on, Angry with the steam
    puffing from the ears); a Behaviour plays that move on a loop; a Reaction throws its burst round the
    preview, again and again. Leaving the option (or blurring it) brings back your current look. Randomise has
    nothing to preview: it is a roll.
  - **The caption** names what is shown: **Your Character** ("Point at an option to try it on.") at rest, else the
    option's Title Case name over what a press does ("Click to wear it.", "Click to set it.", "Click to play it.
    Everyone sees it.", "Click to throw it.").
  - **A press still applies** exactly as before, and the flyout stays open.
  - **It is decoration for the eye**: hidden from a screen reader (each option already says what it is), it holds
    nothing to press, and a press on it does not count as outside the flyout. Crossing the gap from the flyout onto
    it is part of the flyout's hover intent, so a flyout opened by resting the pointer stays open while the pointer
    is on either.
  - **Only where it fits**: on a phone, or where the window has no room for it right of the flyout (8 px clear of
    the edge), it is not shown, rather than covering the flyout or running off the screen.
  - **Light**: it exists only while a flyout is open; it animates only while a Behaviour or a Reaction is being
    previewed (one animation frame loop, or the burst's own), and under reduced motion a Behaviour shows its still
    pose and a Reaction one still frame of its burst.
- **Far right, where Search sits on the building strip: Say**, for someone who may [speak](#who-may-speak). A press
  opens the [message popover](#the-message-popover) hanging from it. It is the way to speak on a device with no Enter
  key; on a desktop its tooltip names Enter. A Viewer has no Say button.
- **Labels** are Title Case on the strip and the tiles (Jumping Jacks, Lab Coat, Top Knot), whatever the shared
  catalogue spells.
- **On a phone** the strip takes the top row beside the menu card, as the building strip does, 44 px apart, and the
  look and action buttons swipe sideways together while Say stays put. Its categories (the look's and the actions')
  and Say are **always named** there, since the rail scrolls and they need not all fit on screen (owner, 2026-11-07:
  "On mobile, in the palette, always include labels for the buttons and categories, it scrolls so its not an issue
  that they don't all fit on screen"); the Edit | Walk toggle stays glyphs alone. A flyout spans the screen between
  the gutters.
- **Hover cards**: none on the category buttons (the flyout names itself, as on the building strip); Randomise,
  Say and every [Call dock](#the-call-dock) button have one.

The choices themselves:

- **Gender**: Male / Female. **Right-clicking your character** on the canvas still toggles it.
- **Clothes**: T-shirt / Stripes / Jumper / Hoodie / Vest / Suit / Dress / Skirt / Polo / Flannel / Overalls / Lab coat / Hawaiian / Varsity / Turtleneck / Apron. Each is a change on the same body, told apart by shape and detail rather than colour, since the shirt is always the participant's colour: every outfit has a signature that reads at palette-tile size in the front, back and profile views, walking and in every pose, in any shirt colour and both builds. The **T-shirt** is the plain baseline with short sleeves. **Stripes**: three bold horizontal bands across the body and two on each long sleeve. **Jumper**: a crew collar, ribbed cuffs and a deep ribbed hem that hangs over the trousers. **Hoodie**: a hood lying around the neck (and hanging to a point down the back), white drawstrings, a kangaroo pocket. **Vest**: a sleeveless waistcoat over a white shirt (white sleeves and a white V, buttons and hem points at the front, a darker satin back with a strap). **Suit**: a dark jacket, sleeves and trousers cut from one deep shade of the shirt colour, lapels, a white shirt V and cuffs, a red tie. **Dress**: one colour from a scoop neck to a flared hem past the knees, with short sleeves and bare legs. **Skirt**: a top in a second tone (paler than a dark shirt, deeper than a light one) over a short pleated skirt with a waistband, bare legs. **Polo**: a spread collar with points, a buttoned placket, tipped short sleeves. **Flannel**: a check (crossing lines over the body, a line on each sleeve) and a pointed collar. **Overalls**: a denim bib on light-denim straps with brass buckles over a short-sleeved shirt, the straps crossing on the back, denim legs. **Lab coat**: a long white coat with white sleeves, worn open over the shirt colour, tails past the hips, a pocket with a pen; closed with a half belt and a vent at the back. **Hawaiian**: an open neck, short sleeves and a bold print of blooms with leaves (white on a dark shirt, pink on a light one). **Varsity**: contrasting white sleeves, a block letter on the chest and lettering across the back, a striped collar, cuffs and hem. **Turtleneck**: a tall ribbed collar rolled up to the jaw (drawn over the chin, the mouth left clear), long sleeves. **Apron**: a long apron on a neck strap, with a pocket and its waist ties showing at the sides, a bow at the back, standing proud of the chest in profile. Secondary tones are derived from the shirt (darker and lighter shades, and trims that go darker on a light shirt and lighter on a dark one, so they keep contrast in light and dark themes) or are fixed neutrals (white, denim, the coat, the apron, brass). Bare legs under the dress and skirt travel as one set (`BARE_LEG_CLOTHING`); the sleeves (short, long, white) and the cloth of the body and legs are one per-outfit look in the sprite, so the front, back, and profile views can't disagree about what an outfit implies.
- **Hair**: Short / Buzz / Curly / Long / Ponytail / Bun / Mohawk / Bald / Pigtails / Afro / Spiky / Bob / Braid / Top knot, each drawn per view (the bun, the plait, and the tail read from behind; the mohawk shaves the sides to stubble; the afro sits proud of the head on every side).
- <a id="hair-colour"></a>**Hair Colour**: nine natural colours, Black / Dark Brown / Brown / Auburn / Ginger / Blonde / Platinum / Grey / White, then four bold ones, Blue / Pink / Purple / Green (`AVATAR_HAIR_COLOURS` in `packages/avatar/src/config.ts`, each a token and a hex). **Brown** is today's hair, `AVATAR_PALETTE.hair` and its own `hairDark`, and the default; every other colour's shaded side is the colour darkened by the bound colour maths (`shade`, 32%), so a hairstyle keeps its two-tone volume in any colour. A config without the field (stored by an older build, or a packet from one) draws Brown, exactly as before; an older build reading a newer config or packet ignores the field and draws Brown. Randomise and the first-use roll pick one of the nine natural colours, never a bold one.
- **Size is not offered in livehuddle.** Everyone's character, yours and every peer's (whatever an older build
  stored), draws and collides at **Regular**, so a room's seats, doorways and calls read the same for everybody
  (`sizes: false` in the editor's `bindAvatar`, read by `avatarScale` and the palette; livediagram keeps the choice).
  For the shared code: Small / Regular / Tall, a scale on the whole sprite (**1.15 / 1.5 / 1.95**).
- **Actions** (the `behaviour` category) holds five short one-shot performances, each a Behaviour:
  - **Jumping Jacks**: five hops, arms out and legs splayed at the top of each.
  - **Wave**: a raised hand crossing back and forth for about a second and a half.
  - **Spin**: two full turns on the spot through all four facings.
  - **Cheer**: both arms up and two bounces.
  - **Dance**: a side-to-side sway with the arms alternating.

  A Behaviour performance plays **on the spot**: starting one drops any walk in progress (sliding through a routine reads as a bug) and pressing again restarts it rather than queueing. Peers see it: the presence packet carries the **kind plus how far into it the sender is**, and each receiver derives the pose with the same pure `reactionPose` function: a kind and a clock on the wire rather than a pose.

- **React** (the `reactions` category) holds five bursts (Confetti, Sparkles, Hearts, Applause, Fireworks), played around the character instead of around a pad. Unlike a Behaviour performance, a Reactions burst plays **on your own screen only**: the room's `reaction` op is keyed to a pad's element id (the character has none), and the avatar presence packet carries no burst. Showing it to peers would mean a burst field on `AvatarPresence` and a peer-side burst layer; it is not built.

**No colour picker** for the shirt, deliberately; see above. Hair colour is the Hair menu's fixed swatches.

### The Call dock

The call's buttons are not on the strip: they sit on a card of their own, the **Call dock**, at the **bottom centre**
of the canvas (owner, 2026-11-06: "Put the camera / audio / share buttons on the left of the palette items, rather
than at the bottom"; then, 2026-11-07: "Audio, Camera and Share buttons should be moved from the palette and put as
buttons in the bottom, but for livehuddle, center them"). The controls of [Proximity audio](../012-collaboration/proximity-audio.md)
and [Video and screen bubbles](../012-collaboration/video-and-screen-bubbles.md) are the same, in the same order; only
their home moved (`components/calls/CallDock.tsx`).

- **When.** Exactly while the avatar palette shows: Avatar mode, the chrome up, never over **Start a Space**. It
  hides with the rest of the chrome, and a building Editor has no call to control, so the building strip has none.
  The card **draws nothing when nothing is in it** (no call to offer and no preview, for someone who may not speak):
  no empty frame.
- **Where.** Centred along the bottom edge, 16 px up. On a phone (owner, 2026-11-07: "on mobile the audio, camera,
  share buttons are not in line with the zoom buttons ... fix that"), **in the bottom-right cluster's row**, its
  bottom on the zoom buttons' bottom line, not a row above them: the row is three columns (`clusterRowLayout`,
  `components/calls/call-dock-row.ts`), the dock in the middle one, centred on the screen while there is room, and the
  cluster's buttons, unwrapped, in the right one. The buttons take the room they need first, so on a narrow phone, or
  with Collaborate beside Fit, the dock moves left rather than covering them. In the row it is drawn at the corner
  buttons' UI scale, as the rest of the row is. A desktop window keeps it floating at the bottom centre.
- **What.** There is **no Join and no Leave** (owner, 2026-11-07: "Currently we have this concept of Joining audio and
  leaving audio, which is friction I don't like"): walking where there is a call joins it, so the dock holds the
  microphone (Live, Nobody Near, Muted, Mic Blocked, Mic Off, Listening; it starts muted), **Do Not Disturb** while
  that is your status, the stage's **Raise Hand** or count, and the **Camera** and **Share Screen** (or one **Video
  Paused**). While the call connects, a greyed **Connecting…**; on a failure a warn **Retry** (a press tries again);
  **Calls Paused** under the kill switch (likewise). With no call to offer (a space kept in This Browser, a server
  without calls, calls paused or failed), the microphone shows **Muted** as a local preview that opens on a press and
  sends nothing (title Mic: Only You, a one-line card; see [No call
  here](../012-collaboration/proximity-audio.md#no-call-here)), then the camera and Share Screen as local previews. Each keeps its hover card, its states and its role gates
  exactly as the calls specs give them. They are drawn as **Say** is (owner, 2026-11-06: "the same background as
  Say, rather than palette categories"): the brand tint at rest, 36 px, rounded. On is the solid brand (a live
  microphone, a camera on, a share), so it reads at a glance against the tint; a warning is amber and Muted rose,
  each on its own soft fill.
- **Short labels, on a desktop** (owner, 2026-11-07: "On desktop add short labels to each, on mobile do not"). Every
  button is named beside its glyph: the microphone's **Mic** / **Muted** / **Blocked** / **Mic Off** /
  **Listening**, **Connecting…**, **Retry**, **Camera**, **Share**, **Calls Paused**, **Video Paused**, **Raise Hand**. On a phone, glyphs alone, 44 px. The hover cards stay as they were and carry the full name and
  state ("Mic: Live", "Camera: Off", "Share Screen"). This replaces the 2026-11-06 rule that the
  microphone, the Camera and Share Screen were glyphs alone whatever the bar showed.
- **The stage line** ([meeting-rooms-and-stage.md](../012-collaboration/meeting-rooms-and-stage.md#the-stage-line-part-3-built))
  hangs **over** the group, centred on it, since the dock sits on the bottom edge.
- **While you share your screen** the **Screen Share** group (Sharing, Stop Sharing) joins the dock after the call
  group, behind a divider ([The screen share](../012-collaboration/video-and-screen-bubbles.md#the-screen-share-318)).
  The avatar palette keeps its look: Gender, Clothes and Hair no longer leave the strip while you share.
- The dock is the call group's, not the building strip's: a call rides Avatar mode
  ([Who is in a call](../012-collaboration/proximity-audio.md#who-is-in-a-call)).

## Not over a start

No walking while **Start a Space** ([Template start](../007-editor/start-diagramming.md)) is open: it stands in front
of the canvas, and a character moving behind it, or a template list whose arrow keys also steered someone, reads as
broken. While a start is on screen (`start-panel-open.ts`, the flag the tours wait on), even stepped aside for a
palette popover:

- **No way in.** The toggle's Walk ([The Edit | Walk toggle](#the-edit--walk-toggle)) is greyed with a tooltip
  saying why, and every other pick of Avatar (`W`, Search's Walk, a board's button) is refused (`pickCanvasTool`). Picking a
  template or closing the start brings them back.
- **No walking input.** The arrows and Space, the [action keys](#keyboard-actions), Enter to speak, and a click or
  tap on the canvas beside the start's card do nothing, should the mode already be on (a peer emptying the tab while
  you walk). One check holds them all, `walkInputBlocked` (`packages/avatar/src/walk-guard.ts`): an open modal
  dialog (`modal-guard.ts`) or an open start. Every walking input reads it, so a new screen in front of the canvas
  joins by counting itself in one of the two.
- **Typing never walked.** The start's search box was already the keyboard's (`isTypingTarget`); the guard covers its
  rail and cards, which are buttons, where Up and Down choose a group or a card.
- **Opening walking is untouched.** A tab with no elements is never judged, so the start is gone before a Spaces
  template's walk opens ([Opening walking](#opening-walking)).

## Keyboard actions

Every Behaviour and every Reaction on the avatar palette is also **one key**, so a presenter mid-walk can wave or throw confetti without opening a flyout:

- **Behaviour on its initial**: `J` Jumping jacks, `W` Wave, `S` Spin, `C` Cheer, `D` Dance.
- **Reactions on `1` to `5`**, in the palette's order: Confetti, Sparkles, Hearts, Applause, Fireworks.
- A key plays exactly what its palette card plays (the same `playReaction` and burst handlers), the flyout open or not. Pressing it again restarts the performance or replays the burst, as a second click does.
- **Plain presses only**: any modifier (Cmd+C copies) and an autorepeat from a held key do nothing, so holding a key never machine-guns a burst.
- **Never while typing**: a focused text field (the message composer, a rename, a comment), an open dialog or a focused menu keeps the key, as it does for the arrows and Space.
- While walking these keys are the character's, so the editor's own meanings stand aside (`S` does not open Search, `1` does not pick Select). `E`, `V` and `Escape` remain the ways out.
- The palette shows each key on its card (desktop only), and the Settings Keyboard reference lists them under **While walking (Avatar mode)**. The key map lives in `@livehuddle/avatar/action-keys` (pure, unit-tested); `@livehuddle/avatar/hooks/useAvatarActionKeys` plays it.
- Viewers have the keys too, as they have the palette's actions: nothing they do is a document write.

## Persistence

**First use rolls a random character.** A browser with nothing stored gets a random gender, clothing, hair and natural hair colour rather than the same default figure everyone else starts as: two people walking onto a canvas shouldn't arrive as twins. **Size is not rolled**: it changes how much of the canvas the character covers, so it starts Regular and stays a deliberate choice. The roll is **pinned to storage the first time the mode is actually entered** (not on editor mount), so it becomes _your_ character rather than re-rolling every time, and a user who never opens Avatar mode never has one written for them. `Reset position`'s sibling behaviour follows: resetting the character rolls a new random one rather than returning the plain default.

The choices (hair colour as the optional `hairColour` token) are then **remembered per browser** under `livehuddle:v2:avatar-config`, so the character you built is the one waiting next time you enter the mode. Device-local by design, like the panel placements ([Panel corner docking](../007-editor/panel-docking.md)): which character you walk around as is a personal / ergonomic choice, not document data, so it never reaches the api, its storage, or the synced preferences blob, and guests get it for free.

Parsing is **field by field with per-field fallbacks**: a value this build doesn't recognise (an option retired in a later release, a hand-edited key) costs only that one choice rather than resetting the whole character, and a config written by an older build loads with the new fields defaulted. Position of the avatar itself is still never persisted; only the costume.

## No editing chrome while walking

While walking you are in the room, not editing it (Work Tracker #561), so the controls that change the tab step aside
for as long as the mode is on, for every role, and come back the moment it ends:

- **Undo and Redo** leave the bottom-right cluster, and their shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y) do
  nothing, so a stray key never changes the Space behind you. The browser's own undo is held back too. The command
  palette leaves out Undo and Redo while walking.
- **Tab Style** (the cluster's Theme & Canvas brush, [Canvas and theme dialog](../011-theme/canvas-and-theme-dialog.md))
  leaves the cluster, and so do its other ways in, the command palette's **Open Theme** and **Open Canvas Options**.
  It has no shortcut.
- What stays in the cluster is Collaborate (while the tab has a thread) and the zoom controls; the way back to
  building is the toggle at the strip's start. The call buttons are on the [Call dock](#the-call-dock). On a phone the cluster is shorter,
  still one row.
- A Participant and a Viewer are always walking ([Always walking](../013-workspace/share-roles.md#always-walking)),
  so they never see any of them. Only an Editor sees the change, as it walks.

## Walking

- **Click / tap anywhere** on the canvas: the avatar walks there, standing up first when it is seated ([Chair](../009-elements/chair.md) "Any movement stands you up") at a constant **260 canvas px/s**, in a straight line or round the walls in the way ([Finding the way](#finding-the-way)), facing its direction of travel. A click mid-walk retargets immediately. It arrives and stops; there is no easing, deliberately: a constant-speed walk reads as a character, an eased glide reads as a camera.
- **Arrow keys**: while held, the avatar walks that way, mirroring the direction pressed. Two held keys compose a diagonal (normalised, so diagonal walking isn't faster). Any arrow press cancels a click-walk in progress; releasing every arrow stops the avatar where it stands.
- **No collision with ordinary elements**: they are scenery, so the avatar walks over anything except a [Fence](../009-elements/fence.md), a [Room](../009-elements/office.md#room)'s walls (it enters by the doorway) and the footprint of a plant or bookshelf ([Office](../009-elements/office.md)), none of which it can cross (it stops, or slides along them). Walking onto a water cooler or coffee machine gives it a drink, carried in its presence as `holding`. The element it is standing on gets a soft brand-tinted "you are here" ring, which is what makes the mode useful for narration: the audience can see what the character has arrived at.
- **Space hops**, and the character waves a small flag through the hop plus a short tail so it reads as a celebration rather than stopping dead on landing. The hop peaks around 70 canvas px and lands in a bit over half a second; the contact shadow shrinks as it rises, which is what sells leaving the floor. Autorepeat is ignored (one press, one hop) and a second press mid-flight does nothing. Space is the hold-to-pan modifier everywhere else, which this mode can afford to reclaim: it is read-only, so there is no selection to tap-edit, and panning stays on middle-mouse drag, the trackpad, and the zoom controls.
- **The camera is centred on you** ([The camera](#the-camera) below): your character stays in the middle of the screen and the view moves as it walks.
- Right-click never walks, and the canvas / element context menus stay suppressed while the mode is active (a menu opening mid-walk would interrupt the tour).

### Finding the way

A click-walk goes **round** walls rather than into them: clicking inside a room from outside walks you to its doorway,
through it, and on to the point you clicked.

- **What it routes round** is exactly what blocks a step: every Fence and Garden Fence, every room's walls (a box
  room's and a Room Builder room's, broken at its doorway and at each **open** Door; a closed Door is wall), an Office
  Pod's walls, and each piece of scenery's footprint. Seats, peers and ordinary elements are walked over, as before.
- **The route** keeps the character's own reach clear of every wall (its Size's, the same reach a step keeps), so it
  never asks for a gap the character cannot fit through. It is drawn as straight legs between corners, never a
  staircase, and a walk with nothing in the way is the plain straight line it always was.
- **A place it cannot reach.** A click inside a room whose Doors are all shut walks you to the **outside of the
  nearest shut Door** of that room (nearest you), within a click's reach of it, so your next click opens it
  ([Room Builder and Door](../009-elements/room-builder.md) "Opening and closing"). Where
  the place has no door to open (a doorless room, a pond, inside a piece of scenery), the walk goes to the nearest
  point it can reach, just outside the walls nearest the click. Either way it stops there; it never freezes, jitters
  or walks into the wall. Whatever was waiting on the arrival (a push) happens only when that point is within two
  reaches of where you clicked. (`shutDoorLines` in collision.ts; `shutDoorCell` in pathing.ts.)
- **Every walk to a point routes**: a click or a tap, Walk There's legs ([Directory](../009-elements/directory.md)
  "Walk There"), and a call's walk to someone. Arrow-key steering and a push stay direct (collision only, no route):
  steering is you choosing the way.
- **Chrome drawn over the canvas never walks you.** A press on the talking bars walks to the talker (their own
  rule), but a press on a camera or screen bubble (anyone's, your own too), its Stop Sharing control or the maximised
  panel does not walk you to the spot behind it: it only maximises (or stops the share) (owner, 2026-11-07: "when
  sharing camera or screen, anybody including me who clicks the bubble over my head walks to that spot, don't do
  that"). `CHROME_OVER_CANVAS` in `useCanvasSurfaceGestures.ts` lists the talking bars, `[data-call-bubbles]` and
  `[data-call-maximised]`.
- **Sitting** still asks where the walk is going, not where its legs turn: walking through a chair on the way to
  another never sits you in it ([Chair](../009-elements/chair.md) "Only the chair you are going to").
- **Peers** see the walk as it happens: the packet carries the feet as they move, and every point on a route is clear
  of the walls, so nobody is seen walking through one. Nothing new goes on the wire.
- **Cost**: the route is found on a coarse grid (16 canvas px, coarser on a vast board so it stays under
  `NAV_MAX_CELLS`) built once per change to the walls, in idle time while someone walks (or on the click, if it has
  not been yet), never per frame; a query is A* on it with an expansion cap, then smoothed to straight legs, each
  checked exactly against the walls beside it. Past the cap, or with no grid, the walk is the old straight
  line. (`buildNavGrid`, `findWalkPath` in `@livehuddle/avatar`.)
- Panning by hand still works (middle-mouse drag, two-finger trackpad, a finger's drag on touch), and walking then brings the view back to you ([The camera](#the-camera)).

### Clicking a piece

A click **walks only when arriving is the point**: sitting, a drink, standing on a pad or a stage, going into a room,
being near something (the Arcade's Insert Coin), or the floor. Anything else under the click acts **in place** and the
character stays put. Each element kind has one of three click intents, decided in one place (`avatarClickIntent` in
`apps/editor/lib/avatar-click-intent.ts`, a constant-time table lookup typed over every element type and shape kind,
whose test enumerates both lists, so a new kind cannot ship unclassified):

- **Walk**: the character walks there, and arriving does what it does (sits, drinks, travels through a portal's or an
  elevator's walk-in, says Insert Coin). Scenery with a footprint (a fountain, a bar, a pond's water) stops the walk
  beside it, on its rim at most, never in it; flat pieces (a rug, grass, a path) are walked onto. Whether passing or arriving seats you is the [Chair](../009-elements/chair.md)'s rule,
  not this one. A Podium walks you to its speaker spot wherever on it you click, and arriving stands you at it
  ([Venue pieces](../009-elements/venue-pieces.md#speaking-from-the-podium)).
- **Use**: the click does the piece's **main action**, from **anywhere on its footprint**, not only its buttons, with
  no walk, no selection and no drag. The main action is the face control marked `data-piece-main` (the Directory's
  stand, the Notice Board's whole face, the Jukebox's Play). A piece with no main action right now (an idle Screen, a
  Jukebox with no music set, a Room Sign nobody may knock on) opens in the [reader](#the-reader) instead.
- **Read**: the click opens the element large in the [reader](#the-reader), read-only, with no walk.

**Which piece is under the click.** While walking the canvas layer is pointer-inert, so a press on a piece's face
outside its own buttons used to fall through to the floor and walk (an idle Screen, which has no button at all,
always walked). Now the gesture finds the topmost element whose box (turned by its rotation) holds the click's canvas
point (`elementAt` in `apps/editor/lib/avatar-press-target.ts`: one pass over the tab's elements per click, never per
frame) and acts on its intent. A text box is often far wider than its words (a template's subtitle runs the
board's width with a short line at its left), so a text counts as hit only on its painted lines, read from the
rendered text (`onPaintedText`, within 6 screen px); a click on the empty run past the words goes to what is under
it, usually the floor. A press that lands on a face's own pressable part is that part's, as before. Peers'
characters are hit first (a click on one walks over and pushes), then a Door (below), then the element.

A piece's own controls (the Notice Board's Notes, the Jukebox's Play: `pieceControlProps`) act in place on every
kind.

| Kind                                                                                                                                                               | Click                          | Why                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Directory                                                                                                                                                          | Use                            | Opens the room list; its Walk There and Go rows do the moving, so walking to the stand is a detour     |
| Elevator                                                                                                                                                           | Use                            | Opens the floor panel; a ride is a teleport (walking in still opens it)                                |
| Stairs                                                                                                                                                             | Use                            | Opens the Up / Down panel; taking them climbs the flight and changes floor (walking on still opens it) |
| Portal                                                                                                                                                             | Use                            | Pressing it travels at once; a walk as well would race the travel                                      |
| Selection Mode button (`mode-button`), Bring Focus button (`focus-button`)                                                                                         | Use                            | Buttons: the press is the point (Leave Avatar is the way out)                                          |
| Notice Board, World Clock                                                                                                                                          | Use                            | Open large in the reader                                                                               |
| Calendar Wall, Suggestion Box (team-pieces.md)                                                                                                                     | Use                            | Open large in the reader                                                                               |
| Signpost (team-pieces.md)                                                                                                                                          | Use                            | Walk to its top arrow's place; nothing with no places yet                                              |
| Screen                                                                                                                                                             | Use                            | A live Screen opens large; an idle one opens the reader, which says how a Screen fills                 |
| Room Sign                                                                                                                                                          | Use                            | Knock, from anywhere on the plaque, while you may knock; otherwise the sign opens in the reader        |
| Timer, Stopwatch                                                                                                                                                   | Use                            | Start or Pause from anywhere on the face; its own buttons keep their own presses                       |
| Jukebox                                                                                                                                                            | Use                            | Play or Mute; you hear it by being near anyway, so walking to it adds nothing                          |
| Link card (`link-card`), Video (`video`)                                                                                                                           | Use                            | Follow the link; play the video where it is                                                            |
| Door                                                                                                                                                               | Walk, or swing when next to it | Next to it a click opens or shuts it; farther away it walks you to its near side (below)               |
| Avatar Pad, Stage                                                                                                                                                  | Walk                           | Standing on it is the point                                                                            |
| Room, Office Pod, Rug, Grass, Garden Path                                                                                                                          | Walk                           | Floor and places you go into                                                                           |
| Chair, Desk, Sofa, Meeting Table, Bar Stool, Bench, Picnic Table, Hammock, Ping-Pong Table, Bean Bag, Reading Nook                                                 | Walk                           | Seats: arriving sits you                                                                               |
| Water Cooler, Coffee Machine, Drinks Cabinet, Drinks Fridge                                                                                                        | Walk                           | Arriving gives you a drink                                                                             |
| Arcade Machine                                                                                                                                                     | Walk                           | Proximity is the point: walking up to it says Insert Coin                                              |
| Dartboard                                                                                                                                                          | Walk                           | A wall piece: a click walks you to the floor in front of it, and standing there rings nothing          |
| Team Photo Wall (team-pieces.md)                                                                                                                                   | Walk                           | Walk up to it                                                                                          |
| Plant, Bookshelf, Outdoor Plant, Tree, Fence, Garden Fence, Bar, Fireplace, Campfire, Fountain, Pond, Garden Umbrella, Pool Table, Foosball Table, Vending Machine | Walk                           | Scenery: you go and stand by it (beside a solid one, on a flat one), the way you go to a fire          |
| Lane, Boundary                                                                                                                                                     | Walk                           | Areas drawn round other things: a click inside one is a click on the floor it covers                   |
| Arrow, freehand drawing (`freehand`), path, Sticker, Icon                                                                                                          | Walk                           | Lines and marks with nothing to read: a click on one is a click on the floor beside it                 |
| Sticky, Text, Image                                                                                                                                                | Read                           | Their own reader bodies: the words at reading size, the picture as large as the screen allows          |
| Table, Checklist, Code Block, the charts, Callout, Speech Bubble, Card, Banner, Page, every other shape and web component, Annotation                              | Read                           | The element's own drawing, scaled up in the reader (below)                                             |

- **A control that is not yours to press does nothing.** A Bring Focus button, a Selection Mode button, a Timer,
  a Stopwatch and a Signpost with no places yet are only controls: with no press of yours right now (a Participant or a Viewer, who always walk; an
  Editor while someone else holds the baton; a Viewer's Timer) a click on one neither walks nor opens the reader,
  whose still copy would show the same face larger and still not pressable (owner, 2026-11-06; `avatarPressOutcome`
  and `NO_READER_KINDS` in `apps/editor/lib/avatar-click-intent.ts`). Every other Use piece with no main action right
  now opens in the reader, as below.
- **Door**: when your character's feet are next to a Door (within `DOOR_REACH`, `isNextToDoor`), a click on it opens
  or shuts it in place (`toggleDoor`), with no walk and no selection. Farther away the click walks you to its **near
  side** (just outside the opening, on the side you stand) and does not swing it. A Viewer, who may not swing doors
  (`can.swingDoor`), always walks. A door is drawn pointer-inert while walking, so the door under a click is found
  from the click's canvas point, by what it **paints** rather than its thin wall box: the opening across the wall, padded to at least 32 screen px
  across (16 either side, scaled by the camera's zoom), and while it stands open the quarter circle its leaf sweeps
  from the hinge (the leaf and its dashed arc). Shut, the leaf lies along the wall and the opening alone is the door.
  That shape wins over the room's floor under it, so a click on the arc inside the room swings the door rather than
  walking in, and a click just past the arc walks (`onDoor`, `avatarDoorPress` in
  `apps/editor/lib/avatar-door-press.ts`). `avatarClickIntent` keeps `door` as Walk and the gesture adds the
  adjacency check. The open and closed state is [Room Builder](../009-elements/room-builder.md)'s.

### The reader

Clicking a **Notice Board**, a **World Clock**, an idle **Screen**, a **Room Sign** you may not knock on, or any
**Read** kind while walking opens it in the **reader**: a dialog centred on the
screen (up to 720 px wide on a desktop, the full width less a small margin on a phone, its height capped to the
viewport and scrolling inside) over a dimmed backdrop. Its type is the screen's, not the canvas's, so it reads at any
walking zoom. It looks like every dialog in the app: the same card (radius, border, shadow, dark fill), the same
dimmed, blurred backdrop, and the dialog header, the piece's name in the dialog's title type with the close (x) button
(tooltip **Close**) at its right; the Screen's player keeps its dark bar over the video. Escape, Close or a click on the
backdrop dismisses it, and focus stays inside it while it is open. Nothing walks.

- **Notice Board**: every note newest first at full size (title, body, author and date), with the add box and Unpin
  buttons by the same [share roles](../013-workspace/share-roles.md) as the board's popover
  ([Social pieces](../009-elements/social-pieces.md#notice-board)). A press anywhere on the board, or on its Notes
  button, opens the reader while walking; outside Avatar mode the Notes button keeps its small popover.
- **World Clock**: one row per city (every zone, not only the three the face has room for): its name, its time
  large, and the day against yours (`+1`, `-1`).
- **Sticky** and **Text**: the words, read-only, at 20 px (a sticky on its paper colour), wrapping at the reader's
  width. **Image**: the picture as large as the reader allows, its own aspect kept.
- **Screen, idle**: an empty state saying what fills a Screen (a share from someone in its room, else its video
  link), and the two ways to fill it for whoever may. **Share Your Screen** is the call control's own Share action,
  shown and routed exactly as that button is: in a live call an Editor shares to the room; with no call, or as a
  Participant, it starts the local preview only you see ([Local preview](../012-collaboration/video-and-screen-bubbles.md#local-preview)).
  It reads Stop Sharing while you share. **Set Link** (an Editor's) is the element menu's
  Video Link, judged the same way (a link that is not a YouTube, Vimeo or Loom video says so and is not saved) and
  saved to this Screen through the same patch (`setScreenUrlOf`). Someone who may do neither sees the empty state
  alone. (`components/canvas/collab/ScreenReaderBody.tsx`)
- **Jukebox, no music set**: an empty state saying an Editor sets what it plays in its menu.
- **Room Sign**: a door panel: the room's name with a status chip, how many are inside and for how long, who is
  inside, and Knock and Walk In in the footer, each with a reason when it is not available
  ([The sign's reader](../009-elements/screen-and-room-sign.md#the-signs-reader)).
- **Every other Read kind**: the element's own drawing, a read-only copy of its face scaled to fit the reader (up to
  3x), so a table, a checklist, a chart or a callout reads at the size it was drawn to be read at. It is a still copy,
  taken as the reader opens: nothing in it is pressable, and it carries no element ids.
- **Pinned open or dismissed by a click outside.** The reader is modal: it is big, centred and holds the add box
  you type into, so its backdrop takes a click outside and closes it, and nothing walks behind it. Reading pieces
  that are a list you keep beside you while walking are **pinned**: the [Directory](../009-elements/directory.md)
  popover stays open through walking clicks until its stand is pressed again (or Close, or Escape), and is never
  modal. The Elevator's floor panel keeps its click-outside close: it is a one-press choice, and walking off the lift
  closes a walk-in panel anyway.
- The shell (`components/canvas/collab/ReaderShell.tsx`: portal, backdrop, title bar, Close, focus trap, Escape) is
  the one the Screen's large player uses.

## The camera

In Avatar mode the camera belongs to your character, so a walk reads as moving through the space rather than across a
picture of it. Select and Hand keep the camera as it is everywhere else (Fit frames the whole tab, the zoom anchors on
the pointer).

- **Leaving frames the tab.** Switching to Edit glides out to the whole tab
  ([Edit frames the whole tab](#the-edit--walk-toggle)).
- **Entering centres you at 100%.** However the mode is entered (the toggle, `W`, Search, a mode button, a pad, opening walking), once the
  character is placed the view goes to 100% with the character in the middle of the screen. Switching to Walk on the
  same tab glides there beside the strip's morph, as Edit glides out (owner, 2026-11-06); a load, opening walking and
  travel to another tab land at once, and reduced motion always does.
- **Walking keeps you in the middle.** While the view is centred on the character, every step moves the view with it:
  the character holds still on screen and the canvas moves under it.
- **You can look away, and walking brings you back.** A hand pan moves the view off the character as usual. The view
  then gravitates back as the character walks, never while it stands still: walking towards the middle of the view
  leaves the camera where it is (you are walking to what you looked at), and walking any other way pulls the view
  back towards the character a little with every step, closing about half the gap per 400 canvas px walked. Once it
  is back within a screen pixel it is centred again and moves with every step. A step never leaves the character
  further off the middle than it was, so a character on screen stays on screen.
- **Zoom holds.** Zooming in or out (the zoom menu, the keyboard, a wheel or a pinch) keeps that zoom until you change
  it again, and in this mode the wheel and pinch zoom about the character rather than the pointer, so a centred
  character stays centred.
- **Fit centres you at 100%.** Fit (clicking the zoom percentage, the zoom menu's Fit to screen, the command palette's
  Fit) goes back to 100% with the character in the middle, instead of framing the whole tab.
- **Leaving the mode leaves the view where it is.**
- Implementation: the shared walk hook takes `camera: 'centred'` (livehuddle) or keeps the edge follow
  (`'edge'`, the default, used by livediagram); `centredCamera` in `@livehuddle/avatar/walk` is the pure step
  rule. The editor reads the character's position through `avatarAtRef` for Fit, the entry and the wheel / pinch
  anchor.
- **On touch, a finger's drag pans and its tap walks.** A finger has no middle button and no Space to hold, so a one-finger drag pans the canvas, as the Hand tool does, and only a press that lifts without moving (a tap) walks the character there, or to a peer it lands on. Pinching zooms as usual and never walks. A mouse click still walks the moment it is pressed. (`useCanvasSurfaceGestures` starts a pan whose tap is the walk; `useCanvasPanAndMarquee` runs a pan's tap on a release that never moved and counts a pinch as moved.)

## Read-only while active

"Read-only for me" is enforced by making the canvas layer pointer-inert, plus a keyboard gate:

- The whole canvas layer goes **pointer-inert** (`pointer-events: none`), so no click can select, drag, resize, or double-click-edit any element kind. A per-element guard cannot cover every path (boxed elements, arrow hit-bands, labels), which is why the layer-level switch is the mechanism.
- The **arrow keys belong to the avatar**, so they never nudge a selection.
- The **mutating plain-key shortcuts are suppressed** (element adds). `E` and `V` keep working so you can always leave, and `Escape` exits the mode to editing (Select; on touch a drag on empty canvas pans).
- Nothing is persisted. The one thing that leaves the browser is the ephemeral presence snapshot peers need to draw the character (below).
- **The palette does not leave the mode any more.** While walking the strip is the
  [avatar palette](#the-avatar-palette), which only dresses and moves the character, so nothing on it needs to end
  the walk; the building tiles come back when the walk ends. (Before, any press on the strip left the mode.) A tile
  dragged onto the canvas, from a surface that still offers one, leaves the mode as before.

## Changing tab

**Travel keeps the mode.** A Portal paired to another tab, an Elevator ([elevator.md](../009-elements/elevator.md)), Stairs ([stairs.md](../009-elements/stairs.md)) and the Directory's Go ([directory.md](../009-elements/directory.md)) take you to a chosen point on the next tab, so they carry the character there: the switch is marked as travel (`useCanvasTool`'s `keepWalkingTo(tabId)`, called with the switch itself), the character is placed at the destination in the same update (`teleportTo`), and the centred camera lands on it at the walk's zoom once the new tab shows. The place it arrives at is chosen for that tab (beside an Elevator, clear of its footprint, its Avatar Pad, a room's doorway), so the fence problem below does not arise. Peers see the character leave one tab and appear on the next: a packet left on the tab you left is dropped once your tab-focus moves (`buildRemoteAvatarRows`).

**Any other change of tab ends the mode** (the tab bar, the Explorer, a tab link, following a presenter): the tool goes back to the one that was active before the mode was entered (editing), exactly as reaching for the palette does. The character is a point on the tab you left; on the next tab it could stand inside a fence it was meant to be kept out of, so it never carries over. The exit happens in the same render as the tab change (`useCanvasTool({ tabId })`), so the new tab never draws or publishes the character even for one frame. Leaving the mode [publishes `avatar: null`](#realtime), which deletes the entry on every peer, so the character is gone from the tab you left as well. Entering again on the new tab places it as any fresh entry does.

## Realtime

**Everyone sees everyone.** The character rides the presence channel as an `avatar` `RoomOp` (alongside `cursor` / `select` / `laser` / `tab-focus` in `@livehuddle/api-schema`), so a whole room can walk around one canvas at once.

- The packet is deliberately tiny: feet position (to a hundredth of a canvas px), facing, walking flag and step frame, the hop height, wave frame, seat, drink, status and reaction only while they are set, and the costume tokens (with the optional `hairColour`) only when a peer may not have them yet ([A busy room](#a-busy-room), "The costume rides only when it is needed"). It goes out at the **same ~30 Hz throttle as the cursor**, stepped down in a room of more than 10 ([A busy room](#a-busy-room)) (a packet a window holds back is sent as the window ends, so the last one said, a status picked or the step a walk ends on, is never the one dropped), from the same gates (hydrated, a document id, and either a share link or a team document). The costume is **optional on the wire**: a receiver keeps the last costume it saw for each peer, runs it through the same field-by-field parser as storage, and falls back to the default character only for a peer whose costume it has never been sent.
- It is **ephemeral presence, not a mutation**: `avatar` is in the room's `PRESENCE_OP_KINDS`, so it relays unordered, from any role (**including view-role**: an audience member walking around a canvas someone linked them to is as harmless as their cursor), is never persisted, and is never replayed to a reconnecting client.
- **Leaving the mode publishes `avatar: null`**, which deletes the entry on every peer, and a peer who disconnects is pruned with the rest of their presence, so nobody is left standing on a canvas after they've gone.
- **A character standing still repeats itself, but only to someone who can see it.** A walk is published as it goes; a character standing still republishes an idle snapshot every three seconds (`AVATAR_HEARTBEAT_MS`), so whoever arrives after it stopped still sees it, the worst case being a presenter standing still while they talk. The heartbeat is skipped while you are alone in the room (the roster holds nobody else) and while the tab is hidden, because each beat wakes the room's Durable Object: a lone walker left in Avatar mode cost about 480 requests and 3,600 GB-s of room time every 8 hours, and kept the room from ever hibernating. One beat goes out at once when someone joins (the roster grows, whether or not the tab is visible) and when the tab comes back into view with someone in the room, so a newcomer still sees a character that is standing still, even after the room hibernated and forgot it. A socket that reconnects (a new presence id the room knows nothing of) says the character's latest place again at once, at rest, hidden tab or not, so a walker who stepped away from the tab neither vanishes for everyone nor drops out of the call's hearing check. `useAvatarWalk` takes the roster's size as `peers`; an editor that does not know it leaves it unset and keeps the plain heartbeat.
- Peers' characters are **scoped to the tab** they were published on and are drawn with **their own presence colour on the shirt plus a small name chip** above the head, so a room of walkers stays legible. Your own character has no chip (you know who you are).
- **Seated neighbours' chips never cover each other** (Work Tracker #597). People sitting side by side (a sofa, a
  bench, a pod, two chairs pulled together) have heads closer than their name chips are wide, so the chips of seated
  characters whose chips would overlap spread apart sideways, as a row, in the order their seats run, each as close
  over its own head as the row allows, with a small gap between chips (`spreadNameChips`, chair-sitters.ts). Your own
  status chip, when you wear one, takes its place in the row. A walking character's chip stays over its head: it
  moves on at once, so nothing is spread for it. The spread is in canvas px, so it holds at any zoom, on a phone as on
  a desktop.
- Peer characters render **whether or not you are in Avatar mode yourself**: someone else walking you through their canvas is worth seeing from the Select tool.
- **You can push each other.** Clicking a peer's character (in Avatar mode) walks yours over to them and, on arrival, sends an `avatar-push` op naming them plus a unit direction. Only that participant acts on it, by sliding their own character a short way (70 canvas px) along the direction, so a push is a **request to the owner**, never a remote write, and someone who has already left the mode simply ignores it. **A seated character cannot be pushed** ([Chair](../009-elements/chair.md) "Sitting"): clicking one walks you up beside them and sends nothing, and the owner ignores any push that reaches them while they sit. Same presence trust level as `avatar`: unordered, any role, never logged, never replayed. It is not throttled, because it is an event rather than a sample. A push whose ids are not short strings, or whose direction is not two finite numbers (not both zero), reaches nobody: the room drops it and addresses only the checked copy, its direction made a unit vector, and a receiver ignores any direction that is not finite, so a hand-made push can never send a character off the canvas.
- A presenter still sees nobody else's character ([Presentation mode](../012-collaboration/presentation-mode.md)).

### A busy room

Every walker's packets go to every other socket, so a room's relayed sends grow with the square of its walkers.
Measured on one local workerd with the real room (`apps/api/scripts/avatar-fanout-probe` in livehuddle), everyone
walking on one tab:

| Walkers | Before: frames a second (all of them ops) | Before: room CPU | After: frames a second | After: ops in them | After: room CPU |
| ------- | ----------------------------------------- | ---------------- | ---------------------- | ------------------ | --------------- |
| 10      | 2,608                                     | 20%              | 2,608                  | 2,608              | 14%             |
| 32      | 29,056                                    | 57%              | 536                    | 16,462             | 17%             |
| 100     | 14,210 of the 300,000 owed                | 99%, saturated   | 1,199                  | 118,711            | 40%             |

CPU is the room's workerd process as a share of one core (2026-11-03, an M-series Mac). Before the bound, 100 walkers
saturated the room: it relayed under 5% of what it owed and everyone's characters froze. Stepping the rate down alone
still saturates it (99% at 100); the coalescing is what brings it back. Spread over four tabs, 100 walkers cost 29%.

The room keeps a crowd affordable with four rules ([API](../015-api/api.md), "A busy room bounds its presence
fan-out"), shared by every product with Avatar mode:

- **The send rate steps down with the room**: every 33 ms in a room of up to 10, 50 ms up to 32, 66 ms above that
  (`presenceStepMs` in `@liveworkspace/api-schema/presence-fanout`, read through `avatarSendIntervalMs` in
  `@livehuddle/avatar/relay`). A room of up to 10, every room most people are in, walks exactly as before.
- **A peer's slower steps still glide**: above 10, a peer's character slides to each new position over one step
  (`avatarGlideMs`) while it walks, instead of hopping 13 to 17 canvas px at a time; standing, sitting and a portal's
  jump still land at once.
- **The room relays a character only to the sockets on its tab, and coalesces each socket's samples per step** into
  one frame.
- **The costume rides only when it is needed** (`createAvatarPacker` in `@livehuddle/avatar/relay`, with
  `leanAvatarPacket` and `expandAvatarPacket` in `@livehuddle/avatar/wire`). A character's packet carries
  its four costume tokens on the first packet a socket sends, on its first packet on a tab, when the costume changes,
  when someone new joins the roster, and every two seconds (`AVATAR_COSTUME_REFRESH_MS`) as the net for anything
  missed; every other packet leaves the costume out, and leaves out each field at its resting value (no hop, no
  wave, no seat, no drink, step frame 0), with the position rounded to a hundredth of a canvas px. A receiver keeps
  the last costume it saw for each peer and fills the resting values back in, so a lean packet draws the same
  character a full one does. A standing character's heartbeat (every three seconds) is always due one. Measured
  with the probe (2026-11-06, everyone walking on one tab), what the room sends a second drops from 788 to 428 KB at
  10 walkers, 5,270 to 2,900 KB at 32 and 32,814 to 19,673 KB at 100: 307 to 168 bytes a relayed packet, 45% less.
- **Mixed versions keep working.** An editor asks for lean packets with `leanAvatars: true` in its `hello`, and
  sends them only once the room's `format` frame says `leanAvatars: true`, so against a room from before it keeps
  sending full ones. The room remembers each walker's last costume: a socket that did not ask (an editor from
  before) is sent each lean packet filled back out, costume and resting values, so it draws the right character,
  and the catch-up a tab switch sends always carries the costume. The one gap is a room that hibernated, which
  forgets the costumes: until a walker's next full packet (two seconds at most while walking, the next heartbeat
  while standing), an older editor draws that walker in the default costume.

A test in each product's api (`document-room-fanout.test.ts`) walks 10, 32 and 100 characters through the room and
holds the bound: the frames each socket is sent per second, and the room's CPU time.

## Status

Your character can say **how you are** without a word: a status set from the avatar palette's **Status** flyout, shown to everyone on
the tab while you are in the mode. It is what makes a virtual office read at a glance:
who is free to talk, who is heads-down, who has stepped away.

Every status has a dot, a short line (shown under its name in the flyout) and a **signature on the character**,
drawn in the sprite's own pixels in the spirit of Focusing's headphones (owner, 2026-11-06: "Add more statuses like
Angry, which causes steam to come out of the avatars ears, I love the headphones while focusing, maybe we can do more
of that for other statuses"). They come in three groups, **Availability** (can people come over?), **Activity**
(what you are busy with) and **Mood** (how you feel), purely cosmetic apart from Do Not Disturb.

| Group        | Status             | Token         | Dot    | Signature on the character                                                 |
| ------------ | ------------------ | ------------- | ------ | -------------------------------------------------------------------------- |
| Availability | **Available**      | `available`   | green  | A green sparkle by the head, twinkling                                     |
| Availability | **Need Help**      | `help`        | amber  | A pixel "?" over the head, bobbing                                         |
| Availability | **Away**           | `away`        | slate  | The character fades to half and a slow "Zz" rises above it                 |
| Availability | **Busy**           | `busy`        | brown  | A phone held to the ear; still                                             |
| Availability | **Do Not Disturb** | `dnd`         | rose   | A red no-entry sign beside the head (the dot has the white bar too); still |
| Activity     | **Focusing**       | `focus`       | violet | Headphones (violet ear cups); still                                        |
| Activity     | **In a Meeting**   | `meeting`     | red    | A slim headset with a mic boom and a red live tip; still                   |
| Activity     | **Out to Lunch**   | `lunch`       | teal   | A sandwich in the hand, lifted for a bite every few seconds                |
| Activity     | **On a Break**     | `break`       | blue   | A water bottle in the hand; still                                          |
| Mood         | **Angry**          | `angry`       | orange | Steam puffing from both ears, a flushed face and furrowed brows            |
| Mood         | **Celebrating**    | `celebrating` | pink   | A striped party hat, confetti falling round the head                       |
| Mood         | **Thinking**       | `thinking`    | sky    | A thought bubble over the head, its three dots lighting in turn            |
| Mood         | **Feeling Sick**   | `sick`        | lime   | A green-tinged face, an ice pack on the head and a bead of sweat; still    |

- **Every view**: each signature is drawn front on, from behind and in profile (mirrored for the right), wherever it
  would be seen: the face's parts (the flush, the brows, the tint) only where the face is, the headset's cups and band
  from behind, the steam from the one ear in profile. A signature rides the
  figure: it bobs with the walk, rises with a hop and drops with a sitter. Over the head, the hat, the ice pack, the "?" and the
  bubble sit on the hair (taller styles lift them), and the name chip rises clear of them.
- **Hands**: the sandwich (and the water bottle) is in the hand only while nothing else is: a drink, a Behaviour or the flag takes the hand
  and the sandwich waits. Everything else stays on through a Behaviour.
- **Motion**, flat however busy the room ([A busy room](#a-busy-room)): each loop is a CSS keyframe on a few SVG rects, stepped so the pixels move
  whole (`packages/avatar/src/status-effects.css`, imported by each editor's stylesheet), never a timer per
  character; a status with no loop draws still and costs nothing. Under reduced motion (the system's or the
  in-app preference) every loop holds its resting frame: the puffs, the sparkle, the "?", the confetti, the three
  dots and the sandwich stay where they are drawn.
- **Set from the palette**: the **Status** flyout is a wide one (36rem), its statuses as cards three to a row in the
  three named groups (**Availability**, **Activity**, **Mood**; owner, 2026-11-06: "The status
  menu is long, why not a wider menu like other categories, with subcategories"), **None** leading the first, each
  card its dot, its name and its short line, the current one pressed; **Sound** stays the last group. The whole of it
  fits without scrolling on a desktop, with the preview card beside it. On a phone the flyout spans the screen and
  its cards go two to a row. Every role may set it: it is presence, like the character.
- **Set by where you sit**: a Nap Pod shows Focusing, a Treadmill or a Weight Bench On a Break, a Phone Booth Busy,
  while you sit there, laid over your own status and never written over it; a status picked while sitting wins
  ([Workday pieces](../009-elements/workday-pieces.md#statuses-a-piece-sets)).
- **Do Not Disturb** is the calls' status ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md#do-not-disturb-part-3-built)):
  while it is on, no voice, bubble or other person's equaliser reaches you, and you are still heard if you speak.
  Every other status is cosmetic. The status list is shared with livediagram (`@livehuddle/avatar`), which has no
  calls and keeps offering its four (Available, Focusing, In a Meeting, Away); the palette takes the list it offers
  from the product, and every product parses and draws them all.
- **Peers see it**: the status rides the avatar presence (`status`), one of the wire's tokens
  (`AVATAR_STATUS_IDS`, `@livehuddle/avatar/wire`), parsed field by field; anything else is no status, so an
  older client that does not know a newer token shows that person with no status rather than failing. The room
  Worker relays the packet as it is and reads no status. Every dot is **labelled**: a dot alone left people guessing
  which colour meant what. A peer's chip reads
  the dot, their name, then the status ("Sam · Focusing"); the name gives way to an ellipsis first, so the status is
  always whole. Yours sits above your head, where your chip would be, as the dot and the status ("Focusing") on a
  quiet chip. The visible words are the status's own label, so the chip and the palette never disagree.
- **For the session only**: it is never stored, so an "In a Meeting" set yesterday does not greet anyone today.
  Leaving the mode clears it, like the character itself.
- A screen reader hears a peer's status with their name ("Sam, Focusing"), and your own as yours ("Your status:
  Focusing"), as visually hidden text beside the character, which is itself hidden from assistive tech. A long name
  in the chip ends in an ellipsis, and the chip and the Zz always draw over the character, faded or not.
- Telemetry: `UI · Changed · AvatarStatus` on a change, never which.

## Speech bubbles

A character can **say something**: a short message appears in a speech bubble above its head, then floats up and away for everyone on the tab to see. It is the lightest possible way to talk on the canvas: a "hello!", a "follow me", a "nice one" while somebody presents, without a chat panel or anything left behind.

### Who may speak

- An **Editor** and a **Participant** may speak. A **Viewer** may not: the Enter key does nothing for them and their palette has no Say button, but they **see** everyone else's bubbles, as they see everyone's characters. Gated on the session's `can`, never on `isReadOnly` (Avatar mode makes the canvas read-only for everyone in it).
- The room enforces it too: it drops an `avatar-say` from a view-role sender, as it drops a Viewer's reaction or poll answer.
- Speaking needs the mode: there is no bubble without a character to say it.

### Typing a message (the composer)

- **Enter**, in Avatar mode and with nothing else holding the keyboard, opens the **composer**. A focused control Enter acts on itself keeps it: a button or link, a menu row, a tab, a switch, anything in a popover or the tour's card. The composer is a speech bubble above your own character's head with a text box in it, focused, its tail pointing at the head. It pops open with a small bounce. Its code is fetched when someone who may speak enters the mode, so the words typed straight after the first Enter land in it rather than on the editor's shortcuts.
- The composer **follows your character**: walking by click keeps it above the head. While you type, the keyboard is the composer's: arrow keys move the caret and Space types a space, so neither walks nor hops.
- **Up to 50 words**, and at most 300 characters. A word counter appears once you pass 40 words (`43 / 50`) and turns amber at 50; typing past either limit is refused rather than cut, so nothing you wrote vanishes. Text put in at once (a paste, a drop, an autocorrection, an input method's composed text) is trimmed to the limit instead, never between the halves of an emoji. Newlines become spaces: a bubble is one thought.
- **Enter sends.** So does the small send button (a paper plane) at the bubble's right edge, a round icon button with a **Send** tooltip and the pointer cursor while it can send. Sending an empty or all-space message just closes the composer.
- **Escape cancels**: the composer closes and the text is dropped. Pressing outside it on the canvas walks as usual and leaves the composer open with your text; the composer only closes on its own when it loses focus while empty.
- The composer is drawn at **reading size whatever the zoom**: it sits at a canvas point (above the head) but does not shrink as you zoom out, so it is always typeable.

### The message popover

The avatar palette's **Say** opens a popover hanging from it with a text area, the same 50-word and 300-character limits and counter, and **Cancel** and **Send**. **Send** (or Enter in the text area, Shift+Enter being the same as Enter) sends exactly as the composer does and closes the popover, so you see your bubble rise. Cancel or Escape closes it. This is the phone's way to speak; a desktop has both.

It is built like the palette's flyouts beside it, from the same parts, so it reads as one of the app's popovers
rather than a form of its own (owner, 2026-11-06: "it isn't consistent looking with other modals in our apps"):

- **The flyout header**: the speech glyph on its soft plate, **Say Something**, and its line ("Words that float up
  above your head.").
- **The message in the app's standard text field** (`TextArea`, the compact size: its border, its brand focus ring,
  its fill in dark mode), growing with the text from three lines to six.
- Under it, quietly, **Up to 50 words.** (or **One moment…** while the cooldown holds) and the word counter.
- **A footer bar** with the actions right-aligned in a dialog's order, **Cancel** (secondary) then **Send**
  (primary, with the paper plane). Send is greyed while the message is blank or the cooldown holds.
- The popover is a named dialog (**Say Something**) for a screen reader, as a flyout is.

### Sending: the bubble floats away

- On send the bubble **detaches**: its tail fades, and it floats **straight up from where your character's head was** when you sent it, swaying gently from side to side, so it reads as drifting rather than sliding. Your character is free to walk away from it at once.
- It **fades out over the last third** of its flight and is gone. How long it flies **scales with its length**: 7 seconds for up to two words, 0.25 seconds more for each further word, and never more than 16 seconds (reached at 38 words), so a long message stays up long enough to read. It rises at a steady 12 screen pixels a second, so it lingers near the speaker and a longer message floats only a little higher.
- Like the composer, a floating bubble is drawn at reading size whatever the zoom, anchored to its canvas point, so it pans with the canvas.
- **Kept inside the view**: the composer and every floating bubble are shifted sideways just enough to stay whole inside the canvas's visible area, with an 8px margin, however close to a left or right edge the character stands (on a phone, a character at the edge no longer runs its words off screen). Only the card moves: its tail keeps pointing at the head's canvas point, and nothing changes while the bubble is clear of the edges. Where the view is narrower than the card, the left edge wins. The top edge holds a floating bubble too, below the palette strip floating there (the walk's follow margin, 120px): one that would rise into it stops there and fades, and one over a character standing under it starts there, over the head, rather than out of sight. The composer keeps the same line (#501): typing with your character just under the top edge, it sits 120px down, over your character, and comes down further as it grows a line or its hint. Moved down like this it sits below your head, so it shows no tail.
- **Several at once**: you may send again as soon as your last bubble has left your head, after a **1.5 second cooldown**; until then Enter and Send are held (the composer shows "One moment…"). Each bubble flies on its own clock, so a quick second message rises beneath the first.
- **Peers see the same flight**, starting when their copy arrives. Every bubble, yours included, has its border and tail in the speaker's **avatar colour** (their presence colour, the shirt's) and the speaker's **name** in small type **under the message**, in the same colour, so a message is still attributable once its sender has walked away. The composer wears your colour too, its send button included.
- **Bounded on every screen**: at most **three** bubbles per person are on screen; a fourth from the same person makes their oldest fade out at once. A client that ignores the cooldown therefore cannot fill anyone's canvas.

### The wire

- An `avatar-say` presence op: `{ kind: 'avatar-say', tabId, id, text, x, y }`, where `id` is the bubble's random id, `text` the message and `x, y` the canvas point the bubble starts from (the speaker's head). It is **presence**: unordered, never logged, never replayed to a late joiner (a message is about the moment), never written to the document or D1.
- The room relays it from an Editor or a Participant only, and drops one whose `text` is not a string of at most 300 characters. It relays its own checked copy (trimmed and clamped, with only the fields above), never the op as sent, so a field the shape lacks reaches nobody. A receiver parses it field by field, re-applies the 50-word and 300-character limits, ignores one for another tab, ignores repeats of an id it has seen, and draws the text as **plain text**, never markup.
- A screen reader hears a peer's message through a polite live region ("Sam says: hello!"); your own is not repeated back to you.

### Motion

The pop on opening, the sway and the rise are decoration. Under **reduced motion** a bubble neither pops nor sways nor rises: it appears above where it was sent, holds for its flight time and fades.

## Opening walking

A tab **offers the walk** when it holds an [Avatar Pad](../009-elements/avatar-pad.md) or a
Selection Mode button set to Avatar, **and something besides its pads**. Every Spaces template's tab does (its Avatar
Pad in the middle of the action), so a space made from a Spaces template opens walking ([v1 scope](../002-project-scope/v1-scope.md)
feature 1). A tab holding **nothing but its pad** does not: that is a blank tab ([Every Space and blank tab has
one](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)), there is nothing to walk round yet, and the
Editor who made it is about to build, so it opens on the tool it always did (a Participant and a Viewer walk anyway,
and start on the pad). It is read from what the tab holds rather than stored, so a Space made by an agent from a
Spaces template, a copy of one, or one made before this rule opens walking too, and a board somebody gives a pad or
an Avatar button becomes one that does (`walkEntrance` in `apps/editor/lib/walk-entrance.ts`, `holdsOnlyPads`).

- **When.** The first time a tab that offers the walk is shown with its elements in a visit (opening the space,
  changing to that tab, or a Spaces template landing on an empty tab from the start screen), the editor enters Avatar
  mode. Once per tab per visit: leaving the mode, then coming back to the tab, does not put you back in it; a reload
  is a new visit.
- **Where.** On the tab's pad when it has one ([Entering on a pad](#entering-on-a-pad)); otherwise just below its
  first Avatar button in the tab's element order, as a press of it would ([Entering from a button](#entering-from-a-button)),
  the view centring on that spot when it is off screen, and, when it is on screen but within the walk's follow
  margin of an edge (behind the bottom-right cluster, say), moving just far enough to bring it in, as the walk's
  camera follow does.
- **Who.** Every role: Editor, Participant and Viewer alike, because walking writes nothing
  ([Share roles](../013-workspace/share-roles.md)). Speaking still follows [Who may speak](#who-may-speak).
- **A Participant and a Viewer walk on every tab**, whether or not it offers the walk, and stay walking ([Always walking](../013-workspace/share-roles.md#always-walking)): the mode is
  held for it, not opened once. A tab that offers the walk still puts its character on the pad (or below the Avatar
  button of a board made before the pads), as for anyone; any other tab starts it where a fresh entry would (else the view's centre).
- **Not in an embed.** The read-only embed view ([Embeds](../013-workspace/embeds.md)) opens on Hand as before: it
  has no palette to leave the mode by.
- **Not counted as a use.** Opening walking fires no `Canvas·Used·AvatarMode`: the event counts people who chose the
  walk, from the toggle, `W`, Search or a button on the board.
- **The tab is not the gate.** A tab with no elements yet (still loading, or the start screen showing) is not judged;
  it is judged once, when its elements first arrive, so an edit later never re-checks it.

## Entering from a button

A [Selection Mode button](../009-elements/mode-button.md) set to Avatar drops the character **just below that button** rather than at the viewport centre: you pressed a thing on the canvas, so the character should appear where you pressed it. The whole figure stands below the button, its head a small gap under the button's bottom edge at whatever Size you chose, so it never hides the button's label (`avatarSpawnBelow`). A pad on the tab beats it ([Entering on a pad](#entering-on-a-pad)). When that spot is within the walk's follow margin of an edge, or just past it (a low button, behind the bottom-right cluster or the tab bar), the view moves just far enough to bring it in, as the walk's camera follow does, so a press never leaves the character behind the chrome. The spawn point is one-shot: a quick detour to Select still returns you to where you left the character. Only a press that enters the mode sets it: pressing the button while already in Avatar mode leaves the mode and leaves no spawn point behind (`avatarSpawnFromButton`).

## Entering on a pad

An [Avatar Pad](../009-elements/avatar-pad.md) is the board's entrance, and every Space has one: each Spaces template places one in the middle of the action, where the people are (it replaced the Walk In button, [Where a Space's pad stands](../009-elements/avatar-pad.md#where-a-spaces-pad-stands)) and every blank tab gets one when it is started blank ([Every Space and blank tab has one](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)). A Space made from a template therefore opens walking with you arriving on its pad in a beam of light, rather than standing below a Walk In button. While the tab has one, every entry into the mode puts the character on it (the pad nearest the view's centre, if there are several), centres the view on it when it is off screen, and plays the arrival beam in the person's colour. Placing or moving a pad never moves a character already walking. The pure choice (`pickSpawnPad`, `padEntry`) lives in `packages/avatar/src/pad.ts`; the arrivals (yours and peers', derived from presence) in `packages/avatar/src/hooks/useAvatarPadArrivals.ts`, drawn by `AvatarPadArrivals.tsx`.

## Where the code lives

Avatar mode is livehuddle's alone (livediagram retired it with Work Tracker #650), so everything of it that reads no
element union lives in this product's **`@livehuddle/avatar`** (`packages/avatar`), and this editor imports it. It was
`@liveworkspace/avatar`, in the monorepo's `packages/`, while livediagram had Avatar mode too; #650's second part
moved it here with the parts of other shared packages only it used (the wire shapes, furniture turning, the room's
walker rules), and livehuddle behaves exactly as it did before; only the imports changed.

- **What the package holds**: the sprite and head, the walker, the walk and its hooks, the speech
  bubbles and composer, the action keys, the Avatar Pad's spawn and arrivals, the costume config and its parser, the
  statuses, the reactions, chair occupancy, and the office pieces' pure parts (a room's walls and doorway, the fence
  and footprint collision, which kinds are floor, seat or give a drink, the Avatar Pad's drawing and the avatar
  palette), and the seat geometry (`@livehuddle/avatar/seats`: each
  seating kind's drawing grid and seat points per facing, the default facing, `seatPoints`, `nearestSeat` and
  `seatFor`, which also says which way the sitter faces), so a character sits in a chair, desk, sofa or meeting table
  without the package importing this product's document package. The five bursts a pad or a walker throws are
  `@liveworkspace/model-core/reaction-bursts`, shared with livediagram's Reaction Pad.
- **Furniture turning**: the Rotate Left and Rotate Right buttons (`@livehuddle/avatar/components/TurnButtons`), the
  placing facing (`/placing-facing`) and its Space key (`/hooks/usePlacingTurnKeys`), each bound by this editor
  ([Furniture facing](../009-elements/furniture-facing.md)).
- **The wire shapes** (`AvatarPresence`, the statuses, the costume vocabulary, and the `avatar`, `avatar-push` and
  `avatar-say` ops with `parseAvatarSay`) are `@livehuddle/avatar/wire` and `@livehuddle/avatar/wire-say`.
  `@livehuddle/api-schema` re-exports them and keeps the ops in its own `RoomOp` union and `PRESENCE_OP_KINDS`.
- **What the package reads of a board**: never this product's `Element` union. It reads an element's id and type, and
  for a shape its kind and box (`@livehuddle/avatar/scene`); an element "has a box" when its place and size are
  numbers, which is exactly `isBoxed` for every kind here. Generic hooks hand this product's own `ShapeElement` back to
  its callbacks (a portal, a chair, a pad, a drink).
- **What stays in livehuddle**: the element kinds themselves (their union members, views, drawings and
  validation; each furniture drawing takes its grid and seats from the package's seat geometry, so a seat and the
  cushion it is drawn on cannot drift apart), the [avatar palette](#the-avatar-palette) (`components/palette/AvatarPalette.tsx` and its flyouts), the canvas wiring (`useCanvasAvatar`), portal travel, the tour and the room connection.
- **The bindings**: the package takes this product's facts once, before any of it renders, the way the workbench is
  bound. `lib/avatar-bindings.ts` calls `configureAvatar` with the telemetry `track`, the storage prefix
  (`livehuddle:v2:`, so the costume stays under `livehuddle:v2:avatar-config` and nobody's saved character resets),
  and the colour maths it already uses (`shade`, `tint` and the identity fill). The canvas's avatar wiring calls it at
  module scope, so the root chunk carries none of it.
- **Tests**: each module's own tests moved with it. A test that builds this product's elements (`createShape`) or
  renders its views stays in this editor as a test of its elements meeting the package, with only its imports changed.

## Implementation shape

Per the no-god-files rule (`../packages/…` paths are the monorepo's shared packages; the rest, `packages/avatar`
among them, are this product's):

- **`packages/avatar/src/walk.ts`**: the pure geometry: one frame's step toward a target, the arrow-key direction vector, the facing from a delta, the camera-follow correction, the view centring (`viewportOffsetCentredOn`, which portal travel re-exports), and the element-under-the-feet lookup. Unit-tested (`walk.test.ts`; this product's kinds under the feet in `apps/editor/lib/avatar-walk.test.ts`); no React, no DOM.
- **`packages/avatar/src/walk.ts`** also holds the jump integration (`jumpStep`), the flag-wave frame clock (`waveFrame`), and the sprite hit-test (`hitTestAvatar`) the right-click look toggle uses.
- **`packages/avatar/src/wire.ts`** (`@livehuddle/avatar/wire`): the costume vocabulary itself: the choices as closed sets of preset tokens (`hairColour` optional, so an older packet or store still parses), the statuses, the presence packet with its lean form (`leanAvatarPacket`, `expandAvatarPacket`) and the `avatar` / `avatar-push` ops. One module the editor and the room both read (the room through `@livehuddle/api-schema`'s re-export), because the presence packet carries a costume to peers, so both ends must agree on the tokens; it was written out twice (named types in the editor, inline in the presence message) until they were unified.
- **`packages/avatar/src/config.ts`**: everything the editor does with that vocabulary: the option catalogues (one source for the panel's rows AND the parser's validation, with their ids typed against the shared unions), the silhouette sets, the size scale, the random first-use roll, the field-by-field parser, and the localStorage read / write under the bound prefix. Re-exports the types so its importers keep one path. Unit-tested (including that every rolled value parses back, so the catalogues and the roll can't drift); no React.
- **`../packages/workbench/src/components/primitives/AccordionSection.tsx`**: the shared single-open accordion row (header + chevron + grid-rows body), now used by the Avatar Panel and the Settings dialog (including its Keyboard category's shortcut groups).
- **`packages/avatar/src/reactions.ts`**: the five reactions, their durations, and `reactionPose(kind, elapsedMs)`: a pure timeline that turns "this reaction, this far in" into the pose inputs the sprite already draws (hop height, facing, arms, stance, lean). Unit-tested (five jack reps, two spin turns, no arms-up-two-ways-at-once, everything back to standing when done), and pure precisely so a peer can replay a performance from a kind + a clock.
- **`packages/avatar/src/hooks/useAvatarConfig.ts`**: the costume state slice: load on mount, persist + report telemetry on each pick, and the gender toggle the right-click uses.
- **Hair colour in the sprite**: `hairTones` in `packages/avatar/src/components/avatar-sprite-palette.ts` turns the token into its two tones (cached, as the outfit tones are), and `avatar-sprite-head.tsx` paints every hairstyle with them.
- **`apps/editor/components/palette/AvatarPalette.tsx`**: the [avatar palette](#the-avatar-palette), the strip while walking: the [Call dock](#the-call-dock) (`components/calls/CallDock.tsx`, with `CallStripGroup.tsx`), the look and action buttons (the category bar's `CategoryBarButtons` and `useCategoryBar`) and Say. **`AvatarPaletteFlyouts.tsx`** draws each category's flyout (the category bar's `FlyoutHeader`, `PictureTile` and `CardTile`), and **`apps/editor/lib/avatar-palette.ts`** holds its pure parts: the categories, `stripPaletteFor` (which strip, from `can`), Title Case labels and each Behaviour's still pose. **`AvatarPalettePreview.tsx`** is the [preview card](#the-avatar-palette) beside a flyout (its place and fit, `previewFits`, in `avatar-palette-widths.ts`), and **`apps/editor/lib/avatar-preview.ts`** the option being tried on (a module store the tiles write through `previewHandlers`) and what the card draws for it (`previewView`, pure). livediagram keeps its Avatar Panel, whose body and cluster button moved into livediagram's editor when livehuddle stopped drawing them.
- **Speech**: **`packages/avatar/src/wire-say.ts`** (the `avatar-say` op, its limits and its field-by-field parser, shared by the room and the editor); **`packages/avatar/src/speech-store.ts`** (the bubbles on screen, a module store the room connection writes to and the layer reads); **`packages/avatar/src/speech.ts`** (pure: word counting and the limits, the flight time, the bubble's rise, sway and fade at a moment, the per-person cap; unit-tested); **`packages/avatar/src/hooks/useAvatarSpeech.ts`** (the composer's open state, the cooldown, the floating bubbles, own and peers', sending and receiving); **`packages/avatar/src/components/AvatarSpeechLayer.tsx`** (the composer and the floating bubbles, drawn in canvas space at reading size, loaded the first time somebody speaks); **`packages/avatar/src/components/AvatarSpeechBubble.tsx`** (the bubble's look and the draft field, shared with the message popover); **`packages/avatar/src/components/AvatarMessagePopover.tsx`** (the message popover, hung from the palette's Say).
- **`packages/avatar/src/hooks/useAvatarWalk.ts`**: the state slice: position / target / facing / hop / wave, the `requestAnimationFrame` loop, the camera nudge, and the presence publisher. Generic over the product's element, so its arrival callbacks get this product's `ShapeElement`. The pose that changes every frame (feet, facing, walking, step, hop, wave, reaction pose) is written to its `poseStore` (**`packages/avatar/src/pose.ts`**), never to React state, so a step renders only what subscribes to it ([Canvas performance](canvas-performance.md) "Walking renders the characters, not the canvas"); the hook renders its host only for facts that change rarely (placed or not, the element under the feet, the seat, the drink), and hands out `readPos` for handlers. **`AvatarSelfWalker`** (beside `AvatarWalker`) is your character subscribed to that store, and `useAvatarPose` any other reader's by-value slice of it.
- **`packages/avatar/src/hooks/useAvatarKeys.ts`**: the keyboard slice (held arrows + the Space jump), split out so the hook above keeps to state + loop.
- **`packages/avatar/src/components/AvatarWalker.tsx`**: placement: the canvas-coords box (placed by a `translate3d` transform, which a peer's glide transitions), the standing-on ring, the peer name chip. The pixel art itself is three files beside it: **`avatar-sprite.tsx`** draws the body and assembles the whole figure (the walk cycle, the hop, the flag), **`avatar-sprite-head.tsx`** everything above the neck (where the eight-hairstyles-by-three-facings combinations live, which is most of what the sprite draws), and **`avatar-sprite-palette.ts`** the colours both halves have to agree on (the tones from `packages/avatar/src/palette.ts`, the shirt's shade through the bound colour maths).
- **Statuses**: **`packages/avatar/src/status.ts`** (the two groups, each status's label, dot colour and short line, and the wire parser) and **`packages/avatar/src/components/avatar-status-effects.tsx`** (each status's signature in the sprite's pixels, per view, and the headroom the name chip keeps over it), whose loops are **`packages/avatar/src/status-effects.css`**, imported once by each editor's `globals.css`. The sprite draws the effect with one line; the headphones stay in `avatar-sprite.tsx`.
- **`packages/avatar/src/bindings.ts`** and **`apps/editor/lib/avatar-bindings.ts`**: the product's facts (telemetry, storage prefix, colour maths) and where this editor hands them over.
- **`packages/avatar/src/scene.ts`**: what the package reads of a board's elements (`AvatarSceneElement`, `isSceneShape`, `hasSceneBox`).
- **Realtime**: `AvatarPresence` + the `avatar` `RoomOp` in `@livehuddle/avatar/wire`, re-exported by `@livehuddle/api-schema`; `'avatar'` added to `PRESENCE_OP_KINDS` in `@livehuddle/api-schema`; `broadcastAvatar` in `useEditorBroadcast`; the inbound coalescing buffer in `useRoomConnection`; the peer-motion store (`lib/peer-motion.ts`, made once in `usePresenceState`, read where drawn by `usePeerAvatarRows`); `buildRemoteAvatarRows` in `lib/presence-rows.ts` (unit-tested).
- Wiring, one small edit each: `palette-icons.tsx` (the mode's glyph), `lib/editor-commands.ts` (Search's Avatar Mode), `useOpenWalking.ts` + `lib/walk-entrance.ts` (opening walking: which tab offers the walk and where, composed into `useCanvasAvatar`), `useCanvasTool.ts`'s `openWalking` (the untracked entry), `useCanvasSurfaceGestures.ts` (the click-to-walk + right-click-gender capture intercept), `canvas-chrome.ts` (cursor), `useEditorKeyboardShortcuts.ts` (the read-only gate, the arrow-key handover), `useCanvasTool.ts` (telemetry + the remembered pre-avatar tool), `palette-tile-actions.ts` (the leave-on-add wrapper, unit-tested), `useDockPopovers.ts` + `useCanvasChromePanels.tsx` + `CanvasChrome.tsx` (the `avatar` dock popover and its button), `components/palette/EditWalkToggle.tsx` (the [Edit | Walk toggle](#the-edit--walk-toggle), at the start of `ToolbarPalette.tsx` and `AvatarPalette.tsx`, shown when `walkToggle` is on: everywhere but an embed and an always-walking session, `useCanvasWalkProps.ts`), and `components/calls/CallStripGroup.tsx` (the avatar palette's call group, `AvatarPalette.tsx`).

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): `track('Canvas', 'Used', 'AvatarMode')` on a chosen entry (the toggle, `W`, Search or a button on the board; [opening walking](#opening-walking) is not counted), emitted from `selectCanvasTool` beside the Format line. `AvatarMode` (not `Avatar`) keeps the mode distinct from the `Element·Added·Avatar` token the palette's photo tile already emits. Each customisation fires `track('UI', 'Changed', 'AvatarGender' | 'AvatarClothing' | 'AvatarHair' | 'AvatarHairColour' | 'AvatarSize')`, and the dice button fires `AvatarRandomised`: which KIND of choice was made, never the value, so the signal is "do people dress their character" without recording what they picked. Opening one of the avatar palette's flyouts counts as the building strip's does, `track('UI', 'Changed', 'ToolbarCategory')` (which category is not recorded). Sending a message fires `track('Canvas', 'Used', 'AvatarMessage')` from the composer and `track('Canvas', 'Used', 'AvatarMessagePanel')` from the palette's Say popover: that somebody spoke and by which door, **never the text** and never its length. [the Receptionist](receptionist.md) has his own events. No per-step, per-click, or per-reaction events (chatty, no signal).

A move from the Avatar palette's **Actions** (or its key) fires `track('Canvas', 'Used', 'AvatarAction')` from `useAvatarWalk`'s `playReaction`, and a burst from **React** (or its key) fires `track('Canvas', 'Used', 'AvatarReaction')` from the editor's `playAvatarBurst`: that one was played, never which. Each press counts, a restart included. Sitting down is the [Chair](../009-elements/chair.md#telemetry)'s.

## Out of scope (v1)

- Collision with ordinary elements, or routing round them (walk-around-the-box, walkable frames): a route goes round only what blocks ([Finding the way](#finding-the-way)). Only a [Fence](../009-elements/fence.md), a room's walls and the office's scenery block ([Office](../009-elements/office.md)).
- Avatar customisation beyond the choices above and the presence-coloured shirt (hats, accessories, skin tones, a picked photo, a free colour picker: the shirt colour is load-bearing, and hair colour is a fixed set of swatches).
- Emotes beyond the five Behaviour performances, the flag wave and [speech bubbles](#speech-bubbles): a reaction someone else can trigger on your character. (Sitting is the [Chair](../009-elements/chair.md)'s.)
- A message history, replies, mentions, private messages, or anything typed reaching the document or the server's storage: speech is ephemeral.
- A mobile on-screen direction pad (touch gets tap-to-walk only; no arrow keys, no Space).
- Any persistence of where the avatar was left (only the costume persists), or syncing the costume to an account across devices.
