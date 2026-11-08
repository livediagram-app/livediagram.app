# The Receptionist

Status: **approved** (owner, 2026-11-08, Work Tracker #58 "New & Improved Page Tours": direction C, The Receptionist,
with more topics, one shared the Receptionist, and the Receptionist going about his day between arrivals). Replaces the
[Avatar tour](avatar-tour.md) in livehuddle.

The Receptionist is the host of a Space: a pixel character, drawn like everyone else's, who lives by the Avatar Pad. While nobody
is talking to him he goes about his day round the floor: a coffee from the machine, a look at the plants, a pat for
the office dog, a little dance. When somebody appears on the pad he walks back over to welcome them. Anyone can ask him
how the Space works: he answers in a speech bubble, one line at a time, and points at the real control.

## Why

The Avatar tour named the palette's controls and stopped there. It never got anyone walking, talking or into a room,
and it was a stepped wizard of cards, the look the owner wants gone (#58). A Space is a place, so its help should be
someone in it: a host people meet as they arrive, who answers what they ask, in the order they ask it.

## Domain language

| Term                       | Means                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| **The Receptionist**       | The receptionist: the host character of a tab with an Avatar Pad                                    |
| **The Receptionist's pad** | The Avatar Pad he belongs to: the first pad in the tab's elements                                   |
| **His day**                | What he does while nobody is talking to him: a walk to a stop, then the stop's thing, leg after leg |
| **A greeting**             | the Receptionist walking to his pad and waving when somebody appears on it                          |
| **The welcome**            | Your first greeting: his bubble with the topics, on your screen only                                |
| **A topic**                | One thing the Receptionist can explain: a reply in his bubble, then his one-line answer             |
| **Ask Receptionist**       | The footer's Start Tour button while you walk on a tab with the Receptionist; it calls him over     |

## Where he is

- **On every tab with an Avatar Pad**, one Receptionist per tab, belonging to the first pad in the tab's elements (unless he was asked to leave it,
  below). A tab with no
  pad has no the Receptionist. A hidden layer's pad is not there, so neither is its the Receptionist.
- **Seen while you walk.** The Receptionist is drawn on the canvas while you are in Avatar mode, inside the transformed layer
  with the characters, so he pans and zooms with them. In Edit he is not drawn: building the space is not a time to be
  walked past.
- **Never stored, never sent, never exported.** He is not an element, rides no presence, and an export has no the Receptionist.
  He never blocks a walk and is never a destination: people walk through him, as through the dog.
- **His look is fixed**: a man in a waistcoat with curly dark brown hair and an amber shirt, with a name chip reading
  **The Receptionist** in amber, so nobody mistakes him for a person in the meeting.

## His day

The Receptionist's day is the same on every screen with nothing sent, built like the
[office dog](../009-elements/workday-pieces.md#pet-bed-and-its-dog): time is cut into **legs** of 16 seconds, and
each leg's stop comes from the pad's id and the leg's number through the same seeded generator, so any two clocks
that agree to a second agree on the Receptionist.

- **His area** is the innermost Room whose floor holds his pad's middle, or a circle 480 px round the pad when the
  pad stands in no room.
- **His stops** are the pieces in his area that he has something to do at, and a few spots on the open floor:

  | Stop                                                        | What he does there                                     |
  | ----------------------------------------------------------- | ------------------------------------------------------ |
  | Coffee Machine, Water Cooler, Drinks Cabinet, Drinks Fridge | Gets a drink, and holds it until he next sets off      |
  | Plant                                                       | Stands and admires it                                  |
  | Bookshelf                                                   | Browses it, facing the shelves                         |
  | Pet Bed                                                     | Pats the dog: a wave over the bed                      |
  | Reception Desk                                              | Stands behind the counter                              |
  | The open floor                                              | A flourish: a dance, a spin, a cheer or jumping jacks  |
  | His pad                                                     | Waits beside it (every fourth leg, and when none fits) |

- **Each leg** he sets off from where the last one ended, walks the way round the walls
  ([Finding the way](avatar-mode.md#finding-the-way), the same route for everyone) at a stroll, 120 px a second, then
  does the stop's thing for the rest of the leg. A stop he cannot reach from his pad, or more than 480 px of walking
  from it, is passed over for the generator's next one, the same on every screen.
- **Nothing runs while he stands.** One timer wakes him at the next leg; frames are drawn only while he walks.

## A greeting

- **Somebody appears on his pad**: whenever an arrival beam starts on the Receptionist's pad
  ([The arrival](../009-elements/avatar-pad.md#the-arrival)), anyone's, yours included, the Receptionist stops what he is doing,
  walks from where he is to beside the pad (on the side nearest him), turns to the newcomer and waves.
- **He stays 10 seconds**, then picks his day up again at the next leg, setting off from beside the pad.
- **Another arrival while he greets** restarts the greeting from where he stands.
- **Each screen greets the arrivals it sees.** Arrivals are seen from presence, so two screens can start the same
  greeting a moment apart; a screen that opens after an arrival never sees that greeting. That is the price of sending
  nothing, as with the arrival beam.

## The welcome (yours only)

- **The first time you arrive on a pad with the Receptionist**, once he reaches you, his bubble opens over his head on your
  screen: "Welcome in! I'm the receptionist. What should I show you?", with every topic as replies, then **I'll
  Explore**. Nobody else sees your bubble; they see the Receptionist wave.
- **Welcomed once, on every device**: the synced `avatarTourSeen` preference records it as the bubble opens (the
  Avatar tour's record, kept so nobody who took that tour is welcomed again). After that an arrival gets a short
  "Welcome back, <your first name>!" bubble for four seconds instead (the first word of your display
  name; plain "Welcome back!" when you have none), and the topics wait for **Ask Receptionist**.
- **Rerun from Settings**: Tours › **Receptionist's Welcome**, built like the other tour switches (on means not welcomed
  yet). Turning it on and closing Settings opens the welcome straight away when you are walking on a tab with the Receptionist.

## Asking the Receptionist

- **A press on the Receptionist or his bubble is never a walk**: like a call bubble, it is chrome over the canvas, so tapping a
  reply on a phone does not walk you to the spot behind it.
- **An open bubble keeps him where he is**: the welcome holds him by the pad until it closes, as a conversation does.
- **Two ways**: press the Receptionist (his label for a screen reader is **Ask Receptionist**), or the footer's Start Tour button, which
  reads **Ask Receptionist** while you walk on a tab with the Receptionist (`TOUR_OFFER_RANK.tool`, where the Avatar tour sat). Unlike
  a tour it stays on the button: the Receptionist answers as often as he is asked.
- **He comes to you.** On your screen only, the Receptionist walks from wherever he is to stand beside you, then opens his bubble.
  On everyone else's screen he carries on with his day.
- **His bubble** sits over his head, in the speech-bubble look with an amber edge (no name under it: his name tag is over his head), and
  holds replies. Each topic is a full-width row (a tick on one you have heard, a chevron on its right), in a list that
  shows seven rows and scrolls past that: every topic he has for you, in their groups, whose headings stay pinned as you
  scroll (no second screen for more topics). Under the list sits **I'll Explore**, which closes it, and for an Editor
  **Ask Receptionist to Leave** (below); they never scroll away. Escape closes it, and so does
  walking away (your feet more than 400 px from him). It takes no focus, so the person carries on where they were.
- **He types his lines**: each line he says (the welcome, a hello, an answer, his farewell) appears a letter at a
  time, about 90 letters a second, so even the longest answer is out in under two seconds. The bubble takes the whole
  line's size from the start, so nothing moves as he types, and the replies are there at once. A screen reader hears
  the whole line in one go. With reduced motion the line shows whole.
- **An answer** is one line, the control named as it is labelled, and rings the real control for as long as the
  answer shows (the tour ring, on the control's `data-tour-id`). Under it: **Another Topic** and **I'll Explore**.
- **Rooms and meetings** walks: the Receptionist (on your screen) strolls just inside the front of the nearest room and says his line there.
- **Topics you have heard carry a tick**, kept in the synced `receptionistTopicsSeen` preference, so you can see what
  is left.
- **After the conversation** the Receptionist walks back to where his day has got to, on your screen, and joins
  everyone's.

## The reception bell

- **Somebody rings a Reception Desk's bell** on his tab ([Reception Desk](../009-elements/workday-pieces.md)): the
  Receptionist walks over to that desk to help, from wherever he is, and on every screen that is told of the ring (the
  ring reaches everyone on the tab, in earshot or not). He goes round behind the desk (a quarter in from its left, clear of its Welcome bubble) when he can get there, facing
  whoever rang, else beside its front; a desk he cannot reach at all is left ringing. He waves on arrival and stays
  for the greeting's few seconds, then carries on with his day.
- **When it was you who rang**, any bubble he had open for you closes as he sets off, and once he reaches the desk his
  bubble opens there: "You rang, <your first name>? What can I help with?" over the whole topic list, as Ask
  Receptionist's does, and it holds him until it closes.
- **Talking to you already** when somebody else rings: on your screen he finishes with you first.
- **Reduced motion**: he does not walk; a ring of yours opens his bubble where he stands.

## Asking him to leave

- **Ask Receptionist to Leave**, under his list, is an Editor's: he leaves this Space's pad for good, for everyone.
  It is stored on his Avatar Pad (`receptionistLeft: true`), so it syncs to everyone at once and is one undo step.
- **His farewell**: his bubble says "Of course. Bring me back any time from the Avatar Pad's menu.", and
  after two seconds he is gone. The footer's Ask Receptionist goes with him.
- **Bringing him back**: in Edit mode, the Avatar Pad's element menu has a **Receptionist** section with one switch,
  **Receptionist** ("Greets everyone who arrives on this pad and shows them around"), on unless he was asked to leave.
  Only the tab's first pad, his pad, shows it.
- A Participant or a Viewer never sees the option: he is the Space's, and the Space is the Editors' to change.

## The topics

Fifteen, in five groups, all of them in one list. The words live
in `apps/editor/lib/receptionist/receptionist-topics.ts`.

| Group | Topic                     | Rings                         | Only for             |
| ----- | ------------------------- | ----------------------------- | -------------------- |
| Talk  | Talking to People         | The call dock's mic           |                      |
| Talk  | Camera and Screen         | The call dock                 |                      |
| Talk  | Say, Actions and React    | The palette's Say             | Anyone who may speak |
| Meet  | Rooms and Meetings        | Walks into a room             |                      |
| Meet  | Knocking on a Room        | Nothing (a room's sign)       |                      |
| Meet  | The Stage                 | Nothing                       |                      |
| Move  | Getting Around            | The minimap                   |                      |
| Move  | Floors, Lifts and Portals | The tab bar                   |                      |
| Move  | Following Someone         | The presence stack            |                      |
| You   | Looking Like Me           | The palette's look            |                      |
| You   | Status and Do Not Disturb | The palette's Status          |                      |
| You   | Seats and the Kitchen     | Nothing                       |                      |
| Space | Inviting My Team          | The header's Share            |                      |
| Space | Building the Space        | The Edit / Walk toggle        | An Editor            |
| Space | Tours and Help            | The footer's Ask Receptionist |                      |

A topic whose control is not on screen (a phone's narrower palette, a closed minimap) answers without a ring.

## Phone

The same the Receptionist, day and topics. His bubble is never wider than the screen less 32 px and stays on it, its rows are as
wide as the bubble, and on a screen too short even for seven rows the whole bubble scrolls, clear of the call dock. Ask Receptionist is the footer's glyph, as every tour's is on a phone.

## Reduced motion

The Receptionist keeps still: he stands beside his pad all day, holds nothing, does no flourish and does not walk to greet or
to answer or to a rung bell. The welcome, Ask Receptionist and a bell you ring still open his bubble where he stands,
and his lines show whole rather than typed.

## Share roles

| Role            | Sees the Receptionist | Asks the Receptionist | Topics                                                |
| --------------- | --------------------- | --------------------- | ----------------------------------------------------- |
| **Editor**      | Yes                   | Yes                   | All fifteen; may ask him to leave, and bring him back |
| **Participant** | Yes                   | Yes                   | All but Building the Space                            |
| **Viewer**      | Yes                   | Yes                   | All but Building the Space and Say, Actions and React |

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `UI` · `Opened` · `ReceptionistWelcome`: the welcome opens.
- `UI` · `Opened` · `AskReceptionist`: the Receptionist's bubble opens from a press on him or the footer.
- `UI` · `View` · `ReceptionistTopic<Id>`: a topic's answer shows, `ReceptionistTopicRooms` for instance.
- `UI` · `Opened` · `ReceptionistBell`: his bubble opens at a bell you rang (the ring itself is the desk's
  `Canvas` · `Used` · `ReceptionBell`).
- `Element` · `Changed` · `AvatarPad`: asked to leave, or brought back from the pad's menu (the element change every
  pad setting reports).

Never who, never where, never what was typed (nothing is).

## Performance

- His day is a pure function of the time and the pad: nothing is sent, stored or replayed.
- Drawn only while you walk, only on the tab you are on. One timer per leg while he stands; one animation frame loop
  only while he walks, stopped when he arrives.
- Typing re-renders his line once per new letter (about 90 a second, for under two seconds), never per frame, and
  only the line's paragraph.
- A rung bell costs one route, worked out once when it rings; nothing is sent beyond the ring the desk already sends.
- The route grid is built once per change to the walls, in idle time, never per frame, and only while you walk.

## Out of scope

- The Receptionist on more than one pad of a tab, or a Receptionist per room.
- Typing a question to the Receptionist; naming or dressing him; a Receptionist everyone sees talking.
- The Receptionist in livediagram, liveplanner, livedocuments or livedesign (their tours stay as they are).
