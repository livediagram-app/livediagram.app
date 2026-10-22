// What each telemetry event means, in plain words, for the public dashboard
// (docs/specs/017-telemetry/telemetry.md). Pure data behind `eventExplanation` (event-explanation.ts):
//
//  - EXACT: one sentence per `Category|Action|Type` (Type empty for an event
//    sent with no type). Checked first.
//  - BY_ACTION: one sentence per `Category|Action` that fits any type, for a
//    type with no exact entry and no pattern (a new one, or a computed one).
//  - API_OPERATIONS: the plain phrase for each operation an `Error·Api` type
//    names (`Http403.SaveTab` is "saving a tab's contents").
//
// Written for a curious reader, not an engineer: what the person did, in the
// words the product shows them, plus the counting rule when it is not simply
// once per action. `event-explanation.test.ts` checks every event the code
// can send gets a real sentence, free of code names and jargon.

export const EXACT: Readonly<Record<string, string>> = {
  'Editor|Changed|LeavePagesConfirmed':
    'Someone confirmed leaving Pages on a tab with pages, after the warning that its pages do not show in Diagram or Draw.',
  'Editor|Changed|ModeDiagram':
    'Someone switched a tab to Diagram mode, for shapes, arrows and the palette.',
  'Editor|Changed|ModeDraw': 'Someone switched a tab to Draw mode, to draw freehand with pens.',
  'Editor|Changed|ModePages':
    'Someone switched a tab to Pages mode, to lay out a page of icons, stickers, components and media.',
  'Editor|Changed|ModePlan':
    'Someone switched a tab to Plan mode, to work on boards of items: drag cards through columns, add and open items.',
  'Editor|Changed|ModeWorkshop':
    'Someone switched a tab to Workshop mode, to run a session with their team: timers, votes, polls and reveals.',
  'Draw|Created|Template':
    'Someone started a new project as a whiteboard, a plain board drawn on with pens, from the New Project wizard.',
  'Draw|Created|NewTab':
    'Someone added a whiteboard tab, a plain board drawn on with pens, to a project from Quick Start.',
  'AI|Toggled|AiOff': 'Someone turned off the AI Assistant panel, in Settings under AI Tools.',
  'AI|Toggled|AiOn': 'Someone turned on the AI Assistant panel, in Settings under AI Tools.',
  'AI|Toggled|AiSuggestedPromptsOff': 'Someone turned off Suggested Prompts for the AI Assistant.',
  'AI|Toggled|AiSuggestedPromptsOn':
    "Someone turned on Suggested Prompts, the row of one-click starter prompts under the AI Assistant's mode buttons.",
  'AI|Used|Ask':
    'Someone asked the AI Assistant a question about the active tab and got an answer.',
  'AI|Used|Clean':
    "Someone used the AI Assistant's Clean mode to tidy up a tab's labels, sizes, and styles.",
  'Action|Changed|Edited':
    "Someone edited the details of an action assigned to an element, without changing who it's assigned to.",
  'Action|Changed|Reassigned':
    'Someone changed who an action assigned to an element is assigned to.',
  'Action|Created|EmailOff':
    'Someone assigned an action to a teammate, or to themselves, on an element, without sending an email.',
  'Action|Created|EmailOn':
    'Someone assigned an action to a teammate on an element and chose to email them about it.',
  'Action|Deleted|': 'Someone removed an assigned action from an element.',
  'Action|Moved|ProjectToTeam':
    "While assigning an action to someone, the project was moved into that person's team so they'd have access to it.",
  'Action|Linked|Board':
    "Someone added a project's first action, which made its Actions board: a board tab where every action in the project has a card, kept in step with the canvas.",
  'Action|Opened|': 'Someone opened the popover for an action already assigned to an element.',
  'Action|Opened|Board':
    "Someone went from an action on the canvas to the project's Actions board, from the action's popover or an Action panel's Board chip.",
  'Action|Opened|Canvas':
    "Someone went from a card on the Actions board to its action on the canvas, with the card's Show on Canvas.",
  'Action|Resolved|': 'Someone marked an assigned action as done.',
  'Action|Resolved|WontDo':
    "Someone closed an assigned action as Won't Do: decided against, closed without being done.",
  'Action|Unresolved|': 'Someone reopened an assigned action that had been marked done.',
  'Activity|Loaded|Retry':
    'Someone clicked "Try again" after the Explorer\'s Inbox failed to load, retrying the read.',
  'Activity|Opened|':
    "Someone opened the Explorer's Inbox, which lists open actions and Plan cards assigned to them, actions they assigned to others, and comment threads they're in. Counted once per visit, not on every re-fetch.",
  'Activity|Selected|Action':
    "Someone clicked an action row in the Explorer's Inbox, jumping to the element it's assigned on.",
  'Activity|Selected|Card':
    "Someone clicked a Plan card row in the Explorer's Inbox, jumping to the card on its board.",
  'Activity|Selected|FormResponses':
    "Someone clicked a form's row in the Explorer's Inbox (its new responses), jumping to the board they land on.",
  'Activity|Selected|Thread':
    "Someone clicked a comment-thread row in the Explorer's Inbox, jumping to the element it's on.",
  'Canvas|Used|WaterCooler':
    'Someone walked their Avatar-mode character up to a water cooler and took a cup of water.',
  'Canvas|Used|CoffeeMachine':
    'Someone walked their Avatar-mode character up to a coffee machine and took a coffee.',
  'Canvas|Used|AvatarMessage':
    'Someone said something in Avatar mode, typing a message in the bubble above their character (Enter). Never the words.',
  'Canvas|Used|AvatarMessagePanel':
    "Someone said something in Avatar mode from the Avatar panel's Send a Message. Never the words.",
  'Canvas|Used|AvatarPadArrival':
    'Someone went into Avatar mode on a board with an Avatar Pad, so their character beamed in on the pad.',
  'Canvas|Used|AvatarMode':
    'Someone switched to Avatar mode, steering a small walking character around the canvas instead of the usual pointer.',
  'Canvas|Used|FollowMe':
    "Someone pinned their canvas to a peer's viewport, following their pan, zoom, and tab until they take it back.",
  'Canvas|Used|FormatPainter':
    "Someone picked up the Format tool, ready to copy one element's style onto others by tapping them.",
  'Canvas|Used|Highlighter':
    'Someone picked up the Highlighter mode, a see-through marker pen for annotating the canvas. No longer recorded: the Highlighter is a Draw tile now, counted when a stroke is added.',
  'Canvas|Used|Isometric':
    'Someone switched the canvas into Isometric view, which renders the canvas at an angle for a 3D-style look.',
  'Canvas|Used|Laser':
    "Someone switched on the Laser pointer, a trail visible to everyone that shows where they're pointing without leaving a mark.",
  'Canvas|Used|Spotlight':
    "Someone switched on Spotlight, which dims the rest of the canvas around wherever they're pointing.",
  'Canvas|Zoomed|DoubleTap':
    'Someone double-tapped the canvas with a finger to zoom in on that spot.',
  'Canvas|Zoomed|Fit': 'Someone tapped "Fit to screen".',
  'Canvas|Zoomed|In': 'Someone tapped the zoom-in button.',
  'Canvas|Zoomed|Out': 'Someone tapped the zoom-out button.',
  'Canvas|Zoomed|Preset':
    'Someone jumped straight to a preset zoom level from the zoom-percentage popover.',
  'Comment|Added|': 'A comment was added to an element thread.',
  'Comment|Deleted|': 'A comment was removed from a thread.',
  'Comment|Opened|': 'Someone opened the comment popover on an element.',
  'Comment|Mentioned|': 'A comment was sent that @-mentioned at least one teammate.',
  'Comment|Resolved|': 'A comment thread was marked resolved.',
  'Comment|Unresolved|': 'A resolved comment thread was reopened.',
  'Project|Created|Cloud': 'A brand-new project was created.',
  'Project|Created|Offline': 'A brand-new project was created.',
  'Project|Deleted|': 'A project was deleted.',
  'Project|Duplicated|': 'A project was duplicated into a new one.',
  'Project|Duplicated|Copy': 'A project was duplicated into a new one.',
  'Project|Joined|Edit':
    'Someone came into a project through an edit-role share link. Counted once per person per project, not on every revisit.',
  'Project|Joined|Participate':
    'Someone came into a project through a Participant share link. Counted once per person per project, not on every revisit.',
  'Project|Loaded|':
    'A project was opened, counted on every open (including a page refresh and the first open of a project just created).',
  'Project|Moved|': 'A project was moved into (or out of) a folder.',
  'Project|Moved|SavedToCloud':
    'Someone synced a project in This Browser to their account, turning it into a cloud project kept on the server.',
  'Project|Moved|TakenOffline':
    'Someone took a project offline, moving it out of their account into this browser only.',
  'Project|Redone|': 'Someone hit Redo on a project edit.',
  'Project|Removed|ShareLink':
    "Someone revoked a share link from a project's Share dialog, so it stops working.",
  'Project|Renamed|': 'A project was renamed.',
  'Project|Reverted|':
    "Someone reverted a single change from a tab's activity log, in the since-removed Activity panel.",
  'Project|Shared|Edit': 'Someone generated an edit-role share link for a project.',
  'Project|Shared|ExpiryWeek':
    'Someone set a share link to expire after a week, when creating it.',
  'Project|Shared|Extended':
    'Someone re-armed an expiring share link for another full round of its original lifetime.',
  'Project|Shared|Participate':
    'Someone generated a Participant share link: people take part and write without reshaping the board.',
  'Project|Shared|PasswordCleared': "Someone removed the password from a project's share link.",
  'Project|Shared|PasswordSet': "Someone set a password on a project's share link.",
  'Project|Shared|View': 'Someone generated a view-role share link for a project.',
  'Project|Undone|': 'Someone hit Undo on a project edit.',
  'Project|Used|Multiplayer':
    'A project was open with at least one other person live in the room, counted once per project per visit. The one event that counts collaboration happening rather than being offered.',
  'Element|Changed|Agenda':
    'Someone pressed a segment on an Agenda element, starting its timer and marking it as the current item.',
  'Element|Changed|IconSwapped': 'Someone dropped an icon onto another icon, swapping its glyph.',
  'Element|Changed|ArrowEnds': 'Someone changed which ends of a selected arrow carry an arrowhead.',
  'Element|Changed|ArrowFlow':
    'Someone gave a selected arrow a flowing animation, such as marching dashes or a travelling dot, or turned it off.',
  'Element|Changed|ArrowLineStyle':
    "Someone changed a selected arrow's line pattern: solid, dashed, or dotted.",
  'Element|Changed|ArrowPreset':
    'Someone applied a one-click arrow style, setting its line pattern, thickness, and flow together.',
  'Element|Changed|ArrowRouteBehind':
    'Someone toggled whether a selected arrow routes behind the boxes it passes.',
  'Element|Changed|ArrowExactStart':
    'Someone set an arrow to start exactly at the anchor it is connected to, or back to fanning out.',
  'Element|Changed|LaneUprightTitle':
    'Someone turned a lane title upright in its side strip, or back to reading across.',
  'Element|Changed|ArrowStyle':
    "Someone changed a selected arrow's shape, such as straight, curved, or elbowed.",
  'Element|Changed|ArrowThickness': "Someone changed a selected arrow's line thickness.",
  'Element|Changed|ArrowheadColor': "Someone changed a selected arrow's arrowhead colour.",
  'Element|Changed|ArrowheadShape': "Someone changed a selected arrow's arrowhead shape.",
  'Element|Changed|ArrowheadSize': "Someone changed a selected arrow's arrowhead size.",
  'Element|Changed|AspectRatioReset':
    'Someone reset a selected shape back to its default proportions.',
  'Element|Changed|AccentEdge':
    'Someone set, moved, recoloured or removed the coloured accent edge along one side of a selected shape.',
  'Element|Changed|CardSlots':
    "Someone switched a card's header band, title, meta line or icon on or off, or changed how its icon is shown.",
  'Element|Changed|Card':
    'Someone added, removed or reordered the tags along the bottom of a card.',
  'Element|Changed|ChipLook':
    'Someone changed how a badge or step number looks (solid, ink, outline, tinted or quiet).',
  'Element|Changed|ChipDetach':
    'Someone let a badge or step number go from the element it was attached to.',
  'Element|Changed|BoundaryStyle':
    "Someone changed where a boundary shows its title: in a tab on its edge, inside its corner, or C4's bottom-left.",
  'Element|Changed|TabWindowTab':
    'Someone chose which tab a Tab Window shows, so a slide or page shows that tab live.',
  'UI|Used|TabWindowOpen':
    'Someone opened the tab a Tab Window shows, from the window or its menu.',
  'Element|Changed|BoundaryMeta':
    "Someone added or removed the second line under a boundary's title, such as a network range.",
  'Element|Changed|ConceptRows':
    'Someone added, removed, reordered or renamed the layers, tiers or steps of a layer stack, pyramid or cycle.',
  'Element|Changed|PointerTip':
    'Someone moved the tip of a pointer note to a free spot on the board.',
  'Element|Changed|PointerAttach':
    'Someone pinned the tip of a pointer note to a corner or edge of a shape.',
  'Element|Changed|PointerDetach':
    'Someone let a pointer note go from the shape its tip was pinned to.',
  'Element|Changed|TagColour':
    'Someone gave a card tag a colour for the whole tab, so every card with that tag shows it.',
  'Element|Changed|TagColourCleared': 'Someone removed the colour a card tag had across the tab.',
  'Element|Changed|StackDirection':
    'Someone switched a stack between laying things out in a row, a column and a grid.',
  'Element|Changed|StackColumns': 'Someone changed how many columns a grid stack has.',
  'Element|Changed|StackGap': 'Someone changed the gap between the things in a stack.',
  'Element|Changed|StackPadding': 'Someone changed the space inside the edge of a stack.',
  'Element|Changed|StackAlign':
    'Someone changed whether the things in a stack line up at the start, the centre or the end.',
  'Element|Changed|SequenceParticipants':
    'Someone added, renamed, reordered or removed a participant in a sequence diagram.',
  'Element|Changed|SequenceMessages':
    'Someone added, edited, reordered or removed a message in a sequence diagram.',
  'Element|Changed|SequenceText':
    'Someone rewrote a sequence diagram as text in its dialog, one message per line.',
  'Element|Changed|SequenceNumbered':
    'Someone switched the message numbers of a sequence diagram on or off.',
  'Element|Changed|SequenceAnim':
    'Someone changed how a sequence diagram plays in, or its speed or repeat.',
  'Element|Changed|HubSpokes': 'Someone switched the spokes of a hub and spoke graphic on or off.',
  'Element|Changed|PyramidVariant':
    'Someone switched a pyramid between pointing up, pointing down and a funnel.',
  'Element|Changed|ConceptAnim':
    "Someone set or cleared a layer stack's, pyramid's or cycle's animation (Build, Pulse or Flow), or its speed or repeat.",
  'Element|Changed|RenumberSteps':
    'Someone renumbered every step number on a tab in reading order.',
  'Element|Changed|BorderRadius': "Someone changed a selected element's corner rounding.",
  'Element|Changed|BorderStroke': "Someone changed a selected element's border weight.",
  'Element|Changed|BorderStyle':
    "Someone changed a selected element's border pattern: solid, dashed, or dotted.",
  'Element|Changed|Chair':
    'Someone changed which way a Chair element faces, on a meeting-room layout board.',
  'Element|Changed|Room': "Someone moved a Room element's doorway to another wall, or closed it.",
  'Element|Changed|Desk':
    'Someone changed which way a Desk element faces, so whoever sits at it looks another way.',
  'Element|Changed|Sofa': 'Someone changed which way a Sofa element faces.',
  'Element|Changed|ChartAnim':
    'Someone gave a selected chart a looping reveal animation, changed its speed, or turned it off.',
  'Element|Changed|ChartData': "Someone edited a chart element's underlying data.",
  'Element|Changed|ChartLegend':
    "Someone turned a chart's legend on or off, or moved it to a different side.",
  'Element|Changed|ChartPalette': 'Someone applied a colour palette to a selected chart.',
  'Element|Changed|ChartType':
    'Someone changed how a selected chart draws its data: Column, Bar, Line, Area, Scatter, Pie or Doughnut.',
  'Element|Changed|Checklist': "Someone edited a checklist element's items.",
  'Element|Changed|CodeBlock':
    "Someone edited a code block element's snippet or its programming language.",
  'Element|Changed|CodeTheme': 'Someone applied a colour scheme to a selected code block.',
  'Element|Changed|CodeWrap': 'Someone toggled long-line wrapping on a selected code block.',
  'Element|Changed|Decision':
    'Someone edited a Decision element: its status, its date, or the factors driving it.',
  'Element|Changed|DoneCheck':
    'Someone pressed a done-check element to mark it done, or cleared it.',
  'Element|Changed|Entity':
    "Someone edited an Entity element's fields, on an entity-relationship diagram.",
  'Element|Changed|Estimate':
    'Someone submitted, revealed, or cleared a response on an Estimate card during a planning-poker round.',
  'Element|Changed|FillColor': "Someone changed a selected element's fill colour.",
  'Element|Changed|FlowRepeat': "Someone turned a selected arrow's flow animation loop on or off.",
  'Element|Changed|FlowSpeed': "Someone changed how fast a selected arrow's flow animation plays.",
  'Element|Changed|Font': "Someone changed the font used on a selected element's text.",
  'Element|Changed|FormatPainter':
    'Someone used the format painter to copy a style from one element onto another.',
  'Element|Changed|Header':
    "Someone edited a Header web component's lines, such as adding, removing, or retitling one.",
  'Element|Changed|HeaderFill':
    "Someone changed a table's header row colour, or a lane's title band colour.",
  'Element|Changed|Hero': "Someone turned a hero image's caption card on or off.",
  'Element|Changed|Icon': 'Someone placed or repositioned an inline icon on a selected element.',
  'Element|Changed|IconAnimation':
    'Someone gave a selected icon shape a looping animation, or turned it off.',
  'Element|Changed|IconSize': "Someone changed a selected Technology icon's tile size.",
  'Element|Changed|Idea-box':
    'Someone added an idea to an Idea Box element, revealed its cards, or cleared it for the next round.',
  'Element|Changed|LabelFill': "Someone changed the background colour of an arrow's label.",
  'Element|Changed|Legend': "Someone edited a Legend element's items.",
  'Element|Changed|LineData': "Someone edited a line chart element's categories and series data.",
  'Element|Changed|LinkUnfurled':
    'A link-card element automatically fetched a preview (title, image, and favicon) after someone gave it a web address.',
  'Element|Changed|Marker': "Someone added or removed a status marker next to a shape's label.",
  'Element|Changed|MarkerSize': "Someone changed the size of a shape's status marker.",
  'Element|Changed|MindFlow': "Someone changed a mind map's flow direction.",
  'Element|Changed|MindOutline':
    'Someone saved an edited outline onto a mind map, re-shaping the map from its text.',
  'Element|Changed|MindSpacing':
    "Someone changed how far apart a mind map's nodes sit (Tight, Compact, Comfortable or Wide).",
  'Element|Changed|ModeButton':
    "Someone changed which selection mode a Mode Button element switches everyone into when it's pressed.",
  'Element|Changed|Nudge':
    'Someone nudged a selected element with the arrow keys. Counted once per burst of presses, not once per key press.',
  'Element|Changed|Padding': "Someone changed a selected element's internal padding.",
  'Element|Changed|Picker':
    'Someone rolled a Picker element, landing on a participant or option from its list, shared with everyone in the room.',
  'Element|Changed|Portal':
    'Someone linked a Portal element to another portal, on this tab or another, so stepping into one jumps to the other.',
  'Element|Changed|ProcessSteps':
    "Someone edited a Process web component's steps, such as adding, removing, or retitling one.",
  'Element|Changed|Progress': "Someone changed a progress-bar element's percentage.",
  'Element|Changed|ProgressAnim':
    'Someone gave a progress-bar element a looping fill animation, changed its speed, or turned it off.',
  'Element|Changed|QuickBackground':
    'Someone picked a background colour for the selected shapes from the quick style panel beside the selection.',
  'Element|Changed|QuickClearStyles':
    'Someone pressed Clear Styles in the quick style panel, returning the selected shapes, arrows and text to the theme default and forgetting that style for the next ones drawn.',
  'Element|Changed|QuickIconAlign':
    'Someone moved the icon before, above, or after the label of the selected shapes from the quick style panel.',
  'Element|Changed|QuickCorners':
    'Someone changed the corners of the selected rectangles on a whiteboard from the quick style panel.',
  'Element|Changed|QuickStroke':
    'Someone picked a line colour for the selected shapes or arrows from the quick style panel beside the selection.',
  'Element|Changed|QuickStrokeStyle':
    'Someone made the lines of the selected shapes or arrows solid, dashed, dotted, or flowing from the quick style panel.',
  'Element|Changed|QuickStrokeWidth':
    'Someone made the lines of the selected shapes or arrows thin, medium, or thick from the quick style panel.',
  'Element|Changed|QuickTextColour':
    'Someone picked a colour for the selected text elements from the quick style panel beside the selection.',
  'Element|Changed|QuickTextAlign':
    'Someone aligned the text of the selected shapes left, centre, or right from the quick style panel.',
  'Element|Changed|Quiz':
    'Someone ran a Quiz element: edited its question, started or locked a round, picked an answer, revealed the right one, or reset it.',
  'Element|Changed|Rating': "Someone changed a star-rating element's score.",
  'Element|Changed|RatingAnim':
    'Someone gave a star-rating element a looping animation, changed its speed, or turned it off.',
  'Element|Changed|ReactionPad':
    'Someone changed which reaction burst a Reaction Pad element throws.',
  'Element|Changed|Reveal':
    "Someone toggled a Reveal element's cover on or off for the whole room.",
  'Element|Changed|Roll-call':
    'Someone took a roll call on a Roll Call element, freezing the names of everyone currently in the room onto it.',
  'Element|Changed|Rotation': 'Someone rotated a selected element to a fixed angle.',
  'Element|Changed|SessionButton':
    'Someone configured what a Session Button element starts when pressed, such as a timer, a poll, or a vote.',
  'Element|Changed|Finish':
    "Someone set a selected element's own finish (Flexible, Professional, Sketch or Marker), or set it back to follow its tab.",
  'Element|Changed|SankeyAnim':
    'Someone set or cleared the animation on a selected Sankey diagram (Grow, Flow, Cascade, Pulse or Rise), or its speed or repeat.',
  'Element|Changed|SankeyFlows':
    "Someone edited a Sankey diagram's flows (what moves from where to where, and how much) or a node's leftover switch.",
  'Element|Changed|SankeyStyle':
    "Someone changed how a Sankey diagram draws: a node's colour, the band colouring, the column layout, the labels, the leftovers or the unit.",
  'Element|Changed|Shadow': 'Someone applied a drop shadow to a selected element, or removed it.',
  'Element|Changed|ShapeMorph':
    'Someone changed a selected shape into a different kind of shape, keeping its size, label, and colours.',
  'Element|Changed|Size': 'Someone typed an exact width or height for a selected element.',
  'Element|Changed|StackBack':
    'Someone sent a selection to the back of the stack within its own layer.',
  'Element|Changed|StackFront':
    'Someone brought a selection to the front of the stack within its own layer.',
  'Element|Changed|StatRow':
    "Someone edited a Stat Row web component's stats, such as adding, removing, or retitling one.",
  'Element|Changed|StrokeColor': "Someone changed a selected element's border colour.",
  'Element|Changed|StylePreset':
    'Someone applied a one-click colour and border style to a selected shape.',
  'Element|Changed|StyleReset':
    "Someone reset a selected element's colours and border back to the theme's defaults.",
  'Element|Changed|TableCell':
    'Someone styled one or more selected table cells, such as their fill colour, borders, or text alignment.',
  'Element|Changed|TablePreset':
    'Someone applied a one-click look to a table: its fill, borders, and row banding together.',
  'Element|Changed|Temperature':
    'Someone submitted, revealed, or cleared a response on a temperature-check element.',
  'Element|Changed|TextAlign': "Someone changed a selected element's text alignment.",
  'Element|Changed|TextColor': "Someone changed a selected element's text colour.",
  'Element|Changed|TextFormat':
    "Someone applied rich-text formatting, such as bold, a colour, a list, a heading, or a link, to part of an element's label.",
  'Element|Changed|TextSize': "Someone changed a selected element's text size.",
  'Tab|Changed|LogoPageAdded': 'Someone added a logo page to a Pages tab.',
  'Tab|Changed|PageKindLogo': "Someone chose Logo for a new Pages tab's first page.",
  'Tab|Changed|WireframePageAdded': 'Someone added a wireframe page to a Pages tab.',
  'Tab|Changed|PageAddedLikeLast':
    'Someone added another page like the last one, with the + after the pages.',
  'Tab|Changed|PageKindWireframe': "Someone chose Wireframe for a new Pages tab's first page.",
  'Tab|Changed|WireframeDeviceIphone': 'Someone framed a wireframe page as an iPhone.',
  'Tab|Changed|WireframeDeviceIphoneDuo': 'Someone framed a wireframe page as an iPhone Duo.',
  'Tab|Changed|WireframeDeviceAndroid': 'Someone framed a wireframe page as an Android phone.',
  'Tab|Changed|WireframeDeviceIpad': 'Someone framed a wireframe page as an iPad.',
  'Tab|Changed|WireframeDeviceAndroidTablet':
    'Someone framed a wireframe page as an Android tablet.',
  'Tab|Changed|WireframeDeviceLaptop': 'Someone framed a wireframe page as a laptop.',
  'Tab|Changed|WireframeDeviceDesktop': 'Someone framed a wireframe page as a desktop monitor.',
  'Tab|Changed|WireframeDeviceBrowser': 'Someone framed a wireframe page as a browser window.',
  'Tab|Changed|WireframeDeviceWatch': 'Someone framed a wireframe page as a watch.',
  'Tab|Changed|WireframeFrameTheme':
    "Someone drew a wireframe page's device in the tab theme's colours.",
  'Tab|Changed|WireframeFrameDark': "Someone drew a wireframe page's device in the Dark look.",
  'Tab|Changed|WireframeFrameLight': "Someone drew a wireframe page's device in the Light look.",
  'Tab|Changed|WireframeFrameOutline':
    "Someone drew a wireframe page's device in the Outline look.",
  'UI|Toggled|WireframeSystemBarsOn':
    "Someone turned a wireframe page's status bar and home indicator on.",
  'UI|Toggled|WireframeSystemBarsOff':
    "Someone turned a wireframe page's status bar and home indicator off.",
  'Element|Changed|ShapesUnited': 'Someone united shapes on a logo page into one.',
  'Element|Changed|StrokesTidiedUp':
    'Someone tidied up hand-drawn lines on a logo page, making them straight.',
  'Element|Changed|ShapesSubtracted':
    'Someone subtracted shapes from the bottom one on a logo page.',
  'Element|Changed|ShapesIntersected': 'Someone kept only where shapes overlap on a logo page.',
  'Element|Changed|ShapesExcluded':
    'Someone combined shapes on a logo page, leaving out where they overlap.',
  'Element|Changed|MirrorCopy':
    "Someone reflected the selection across a logo page's centre line (Mirror Copy).",
  'Element|Changed|TextTracking':
    'Someone changed the spacing between letters of a text on a logo page.',
  'Element|Changed|TextWeight': 'Someone set the weight of a text on a logo page.',
  'Element|Changed|TextCase':
    'Someone set a text on a logo page in capitals, lower case or as typed.',
  'Element|Changed|TextArc': 'Someone bent a text on a logo page along an arc.',
  'Element|Created|RelatedEntity':
    "Someone added an entity from another entity's ring, already joined to it by a foreign key.",
  'Element|Added|EntityField':
    "Someone started a new field on an entity from its ring's Add Field.",
  'Element|Changed|Cardinality': "Someone picked a relationship's cardinality from its toolbar.",
  'Element|Created|MirrorTwin':
    'Someone drew on a logo page with Mirror on, so it got a reflected twin.',
  'UI|Toggled|LogoGuidesOn': "Someone showed a logo page's construction guides.",
  'UI|Toggled|LogoGuidesOff': "Someone hid a logo page's construction guides.",
  'UI|Toggled|LogoMirrorOn': 'Someone turned on Mirror While Drawing on a logo page.',
  'UI|Toggled|LogoMirrorOff': 'Someone turned off Mirror While Drawing on a logo page.',
  'UI|Changed|LogoMirrorAxisVertical':
    'Someone set a logo page to mirror across its vertical centre line.',
  'UI|Changed|LogoMirrorAxisHorizontal':
    'Someone set a logo page to mirror across its horizontal centre line.',
  'UI|Changed|LogoMirrorAxisBoth':
    'Someone set a logo page to mirror across both centre lines (four ways).',
  'UI|Changed|LogoMirrorAxisRadial':
    'Someone set a logo page to mirror radially, turning each drawing round the centre.',
  'UI|Changed|LogoMirrorMergeOn':
    "Someone turned on Merge Into One for a logo page's mirror, joining each drawing and its copies.",
  'UI|Changed|LogoMirrorMergeOff':
    "Someone turned off Merge Into One for a logo page's mirror, keeping each copy its own element.",
  'UI|Changed|LogoMirrorCopies3': "Someone set a logo page's radial mirror to 3 copies.",
  'UI|Changed|LogoMirrorCopies4': "Someone set a logo page's radial mirror to 4 copies.",
  'UI|Changed|LogoMirrorCopies5': "Someone set a logo page's radial mirror to 5 copies.",
  'UI|Changed|LogoMirrorCopies6': "Someone set a logo page's radial mirror to 6 copies.",
  'UI|Changed|LogoMirrorCopies8': "Someone set a logo page's radial mirror to 8 copies.",
  'Project|Exported|LogoKit':
    'Someone downloaded a logo kit: an SVG, PNGs and a favicon of a logo page.',
  'UI|Toggled|LogoGuideCentreLinesOn': "Someone showed the logo guides' centre lines.",
  'UI|Toggled|LogoGuideCentreLinesOff': "Someone hid the logo guides' centre lines.",
  'UI|Toggled|LogoGuideDiagonalsOn': "Someone showed the logo guides' diagonals.",
  'UI|Toggled|LogoGuideDiagonalsOff': "Someone hid the logo guides' diagonals.",
  'UI|Toggled|LogoGuideSafeAreaOn': "Someone showed the logo guides' safe area.",
  'UI|Toggled|LogoGuideSafeAreaOff': "Someone hid the logo guides' safe area.",
  'UI|Toggled|LogoGuideCirclesOn': "Someone showed the logo guides' circles.",
  'UI|Toggled|LogoGuideCirclesOff': "Someone hid the logo guides' circles.",
  'UI|Toggled|LogoGuideSquareOn': "Someone showed the logo guides' square.",
  'UI|Toggled|LogoGuideSquareOff': "Someone hid the logo guides' square.",
  'UI|Toggled|LogoGuideGridOn': "Someone showed the logo guides' grid.",
  'UI|Toggled|LogoGuideGridOff': "Someone hid the logo guides' grid.",
  'UI|Changed|LogoGuideStrengthFaint': 'Someone set logo guides to Faint.',
  'UI|Changed|LogoGuideStrengthMedium': 'Someone set logo guides to Medium.',
  'UI|Changed|LogoGuideStrengthStrong': 'Someone set logo guides to Strong.',
  'Element|Changed|TimelineRail': "Someone changed a Timeline Rail element's number of points.",
  'Element|Copied|': 'Someone copied one or more selected elements to the clipboard.',
  'Element|Deleted|': 'An element was removed from the canvas.',
  'Element|Deleted|TableColumn': 'Someone removed a column from a table.',
  'Element|Deleted|TableRow': 'Someone removed a row from a table.',
  'Element|Duplicated|': 'An element was duplicated.',
  'Element|Grouped|': 'A multi-selection was grouped (before groups were removed).',
  'Element|Linked|ArrowPoint':
    "Someone dragged an arrow's end onto another element, pinning that end to it so the arrow follows if the element moves.",
  'Element|Linked|Project': 'Someone linked an element to another project.',
  'Element|Linked|Tab': 'Someone linked an element to another tab.',
  'Element|Linked|Url': 'Someone linked an element to a web address.',
  'Element|Locked|': "An element's lock was turned on (no edits allowed).",
  'Element|Removed|Vote':
    'Someone retracted one of their dots from a dot vote. Counted only when a dot actually came off.',
  'Element|Reordered|Back': 'Someone sent an element to the back of the stack.',
  'Element|Reordered|Front': 'Someone sent an element to the front of the stack.',
  'Element|Reordered|TableColumn': 'Someone dragged a table column to a new position.',
  'Element|Reordered|TableRow': 'Someone dragged a table row to a new position.',
  'Element|Selected|Filter':
    "Someone narrowed a multi-selection down to just one kind of element, from the right-click menu's Filter Selection.",
  'Element|Selected|Keyboard':
    'Someone moved the selection to the next element using the keyboard.',
  'Element|Selected|MindBranch':
    'Someone selected a mind map branch, or a whole map, from its menu.',
  'Element|Toggled|AspectLock':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Toggled|Strikethrough':
    'An on/off property was flipped on an element: a text style (Bold, Italic, Underline, Strikethrough), the aspect-ratio lock, or a table option (header row, header column, zebra striping).',
  'Element|Toggled|TableHeaderColumn':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Toggled|TableHeaderRow':
    'An on/off property was flipped on an element: a text style (Bold, Italic, Underline, Strikethrough), the aspect-ratio lock, or a table option (header row, header column, zebra striping).',
  'Element|Toggled|TableZebra':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Ungrouped|':
    'A group was disbanded back into individual elements (before groups were removed).',
  'Element|Unlinked|': 'Someone cleared the link off an element.',
  'Element|Unlocked|': "An element's lock was turned off (edits resume).",
  'Element|Used|BringFocus':
    "Someone asked everyone else in the room to jump to this element's spot on the canvas.",
  'Element|Used|ReactionPad':
    'Someone pressed a Reaction Pad element and played its burst for everyone.',
  'Element|Used|ImagePlaceholder':
    "Someone pressed Select Image on an empty image's placeholder to open the image picker.",
  'Element|Used|Video': 'Someone pressed play on a video element.',
  'Element|Voted|': 'Someone cast a dot in a dot vote.',
  'Email|Sent|ProjectJoined':
    "An email went out to a project's owner after someone opened it for the first time through a share link.",
  'Email|Sent|FirstShare': "An email went out marking someone's first time sharing a project.",
  'Email|Sent|Milestone':
    'An email went out congratulating someone on reaching a project-count milestone.',
  'Email|Sent|TeamInviteReminder1':
    'A reminder went out about a team invite nobody had answered, a day after it was sent.',
  'Email|Sent|TeamInviteReminder2':
    'A reminder went out about a team invite nobody had answered, a week after it was sent.',
  'Email|Sent|TeamInviteReminder3':
    'The last reminder went out about a team invite nobody had answered, three weeks after it was sent.',
  'Email|Sent|Week1': 'The one-week onboarding email went out.',
  'Email|Sent|Week2': 'The two-week onboarding email went out.',
  'Email|Sent|Welcome': 'The welcome email went out just after someone signed up.',
  'Error|Api|Internal':
    'A liveplanner server crashed while handling a request. No longer recorded in this bare form; a crash like this now also records which endpoint or tool broke.',
  'Error|Api|Network.SendEmail':
    "An email (a welcome message, an invite, a notification) couldn't be sent, because the email provider couldn't be reached at all.",
  'Error|Client|RealtimeResync':
    'The editor noticed it had missed updates during a live session and refetched the project to catch back up. This is the editor recovering on its own, not a crash.',
  'Error|Client|StaleChunkReload':
    'A tab still running an earlier build of the editor asked for a piece of code the last deploy removed, and loaded the page in full instead of crashing. The editor recovering on its own after a deploy, not a crash.',
  'Error|Client|Uncaught':
    'A part of the editor or help centre crashed with an error nothing in the code caught. No longer recorded in this bare form; a crash like this now also records which page it happened on and what kind of error it was.',
  'Error|Client|UnhandledRejection':
    'A background task failed and nothing in the code handled the failure. No longer recorded in this bare form; a failure like this now also records which page it happened on and what kind of error it was.',
  'Error|Warning|ProjectLoad.Slow':
    'A project took more than 10 seconds to load, so the opening screen offered Refresh.',
  'Error|Warning|ProjectLoad.AutoReload':
    'A project load hit its 30-second limit and the page reloaded itself once to try a fresh start.',
  'Error|Warning|ProjectLoad.Late':
    'A project finished loading after its 30-second limit had already shown the error screen; the editor replaced it.',
  'Error|Warning|OfflineStore.Unavailable':
    "The browser's local database did not open in time, so the load carried on without checking for Offline Mode projects.",
  'Error|Warning|SessionToken.TimedOut':
    "A signed-in browser's session did not hand out a token within 10 seconds, so the request gave up instead of waiting forever.",
  'Facilitator|Changed|Granted':
    'The facilitator of a live session handed the role to someone else.',
  'Facilitator|Changed|Unlocked':
    'The facilitator freed an element a peer had locked by selecting it, so someone else could work on it.',
  'Facilitator|Ended|Released':
    'The facilitator of a live session stepped down, leaving nobody in charge of its shared tools.',
  'Facilitator|Started|Claimed':
    'Someone took the facilitator role in a live session, becoming the one in charge of its shared tools: the timer, votes, and polls.',
  'Folder|Created|': 'A new folder was created in the project explorer.',
  'Folder|Created|Tab':
    'A new tab folder was created inside a project, by typing a name the project had not used before.',
  'Folder|Created|Team': 'A new folder was created in the project explorer.',
  'Folder|Deleted|': 'A folder was deleted (contained projects move to the top level).',
  'Folder|Deleted|Team': 'A folder was deleted (contained projects move to the top level).',
  'Folder|Moved|': 'A folder was re-parented under another folder (or the root).',
  'Folder|Moved|Team': 'A folder was re-parented under another folder (or the root).',
  'Folder|Renamed|': 'A folder was renamed.',
  'Folder|Renamed|Tab': 'A tab folder was renamed.',
  'Folder|Renamed|Team': 'A folder was renamed.',
  'Help|Searched|NoResults':
    'Someone searched the help centre and found no matching article: a direct list of articles worth writing. The search words are never recorded.',
  'Help|Searched|Results':
    'Someone searched the help centre and got at least one matching article. Counted once per finished search; the search words are never recorded.',
  'Home|Loaded|Retry': 'Someone pressed "Try again" after Home failed to load.',
  'Home|Opened|Group':
    "Someone expanded a summary of several people's work on one project in Home's What Happened, to see every action.",
  'Home|Opened|Landing':
    'Someone arrived at the Explorer with Home as the very section that loaded.',
  'Home|Opened|Nav': 'Someone went to Home from another section of the Explorer.',
  'UI|Selected|Sidebar.TrashDropProject':
    "Someone dragged a project onto the Trash row in the Explorer's sidebar, moving it to the Trash.",
  'UI|Selected|Sidebar.TrashDropFolder':
    "Someone dragged one of their folders onto the Trash row in the Explorer's sidebar to delete it.",
  'Home|Opened|Welcome':
    'Someone with no projects yet saw the first-run Home, with its blanks and popular templates to start from.',
  'Home|Selected|Welcome.AllTemplates':
    'Someone with no projects yet followed Browse All Templates from the first-run Home.',
  'Home|Selected|Welcome.Blank':
    'Someone with no projects yet started a blank from the first-run Home.',
  'Home|Selected|Welcome.Search':
    'Someone with no projects yet searched the templates from the field at the top of the first-run Home.',
  'Home|Selected|Welcome.SignIn':
    'Someone signed out with no projects followed Sign In from the first-run Home, to find their work.',
  'Home|Selected|Welcome.StartBlank':
    'Someone with no projects yet started a blank diagram from the field at the top of the first-run Home.',
  'Home|Selected|Welcome.Template':
    'Someone with no projects yet started a popular template from the first-run Home.',
  'Home|Selected|Hero.Projects':
    'Someone followed the projects pill at the top of Home to My Projects.',
  'Home|Selected|Hero.Inbox': 'Someone followed the Inbox pill at the top of Home to their Inbox.',
  'Home|Selected|Hero.NewProject':
    'Someone started a new project from the New project button in the search field at the top of Home.',
  'Home|Selected|JumpBackIn.MostUsed':
    "Someone opened a project from Home's Jump Back In that was among the ones they used on the most days.",
  'Home|Selected|JumpBackIn.Recent':
    "Someone opened a project from Home's Jump Back In that was among the ones they used most recently.",
  'Home|Selected|JumpBackIn.SeeMore':
    "Someone followed See More from Home's Jump Back In to the Recent page.",
  'Home|Selected|WhatHappened':
    "Someone opened a project from Home's What Happened, which lists what other people did to their projects.",
  'Layer|Added|': 'A new layer was added in the Layers panel.',
  'Layer|Changed|Opacity': "A layer's opacity was adjusted.",
  'Layer|Cleared|': 'A layer was emptied (its elements deleted, the layer kept).',
  'Layer|Deleted|': 'A layer (and everything on it) was deleted.',
  'Layer|Moved|': 'A selection was moved onto another layer.',
  'Layer|Opened|Panel': 'Someone opened the Layers panel.',
  'Layer|Removed|MergedDown': 'A layer was merged into the one below it.',
  'Layer|Removed|MergedUp': 'A layer was merged into the one above it.',
  'Layer|Renamed|Adopted': "A layer auto-named itself from an element's label (smart naming).",
  'Layer|Renamed|Manual': 'A layer was renamed by hand.',
  'Layer|Reordered|': 'Someone dragged a layer to restack it.',
  'Layer|Selected|': 'Someone switched which layer is active.',
  'Layer|Toggled|Hidden': 'A layer was hidden.',
  'Layer|Toggled|Locked': 'A layer was locked (its elements become read-only).',
  'Layer|Toggled|OthersHidden': 'Someone hid every layer except one.',
  'Layer|Toggled|Shown': 'A hidden layer was shown again.',
  'Layer|Toggled|Unlocked': 'A locked layer was unlocked.',
  'Agent|Viewed|Overview': 'An agent or a script read a project at a glance: one line per tab.',
  'Agent|Viewed|Outline': 'An agent or a script read a tab as an outline, one line per element.',
  'Agent|Viewed|Graph': 'An agent or a script read what connects to what on a tab.',
  'Agent|Viewed|Layout': 'An agent or a script read where things sit on a tab.',
  'Agent|Viewed|Comments': 'An agent or a script read the open comment threads on a tab.',
  'Agent|Viewed|Show': 'An agent or a script read one element in full.',
  'Agent|Viewed|Find': 'An agent or a script searched a tab for some text.',
  'Agent|Viewed|Lint':
    'An agent or a script checked how a tab is drawn: overlaps, crossings, hidden arrows.',
  'Agent|Opened|Toast':
    "Somebody pressed Show on the toast an agent's change raised, to see what it touched.",
  'Mcp|Used|AddTab': 'An AI tool connected over MCP added a new tab to a project.',
  'Mcp|Used|CreateProject': 'An AI tool connected over MCP created a new project.',
  'Mcp|Used|FindProjects':
    "An AI tool connected over MCP searched for one of the user's projects.",
  'Mcp|Used|ReadProject': "An AI tool connected over MCP read a project's contents.",
  'Mcp|Used|RenameProject': 'An AI tool connected over MCP renamed a project.',
  'Mcp|Used|ShareProject': 'An AI tool connected over MCP generated a share link for a project.',
  'Mcp|Used|UpdateProject': "An AI tool connected over MCP updated a tab's content in a project.",
  'Note|Added|': 'A note was added to an element (first non-empty save).',
  'Note|Changed|': "An existing note's text was edited.",
  'Note|Deleted|': 'A note was cleared from an element.',
  'Note|Opened|': 'Someone opened the note popover on an element.',
  'Page|View|/': 'Someone visited the marketing homepage.',
  'Page|View|/project':
    "Someone opened a project in the editor. Every project's page counts under this same path, with no project-specific detail recorded.",
  'Page|View|/explorer': 'Someone opened the Explorer, landing on its default section.',
  'Page|View|/explorer/home': "Someone opened the Explorer's Home, its landing section.",
  'Page|View|/explorer/activity':
    "Someone opened the Explorer's old Activity address, which now opens the Inbox. The Inbox was once called Activity; its visits count under /explorer/inbox.",
  'Page|View|/explorer/inbox': "Someone navigated to the Explorer's Inbox.",
  'Page|View|/explorer/shared': "Someone navigated to the Explorer's Shared with You section.",
  'Page|View|/explorer/timeline':
    "Someone navigated to the Explorer's Timeline. No longer recorded: the Explorer's Timeline was removed.",
  'Page|View|/features/foundations':
    "Someone visited the marketing site's Foundations features page.",
  'Page|View|/features/simple': "Someone visited the marketing site's Simple features page.",
  'Page|View|/help/canvas/links': 'Someone opened the help centre\'s "Learn about links" article.',
  'Page|View|/new': 'Someone opened the New Project wizard.',
  'Page|View|/sign-in': 'Someone opened the sign-in page.',
  'Page|View|/sso-callback':
    'Someone was redirected through the sign-in callback page after completing Google sign-in.',
  'Page|View|/telemetry': 'Someone opened the public telemetry dashboard.',
  'Participant|Created|':
    'Someone visited liveplanner for the first time in this browser, and a new anonymous guest identity was created for them. Counted once per browser, ever.',
  'Participant|Returned|Anonymous':
    'A returning guest (not signed in) reopened the app on a later day, counted once per day.',
  'Participant|Returned|Authenticated':
    'A returning signed-in user reopened the app on a later day, counted once per day.',
  'Form|Created|Blank': 'Someone started a form from Start Planning: a blank one.',
  'Form|Created|BugReport': 'Someone started a form from the Bug Report starter.',
  'Form|Created|Feedback': 'Someone started a form from the Feedback starter.',
  'Form|Created|FeatureRequest': 'Someone started a form from the Feature Request starter.',
  'Form|Created|Rsvp': 'Someone started a form from the Event RSVP starter.',
  'Form|Created|JobApplication': 'Someone started a form from the Job Application starter.',
  'Form|Created|Contact': 'Someone started a form from the Contact starter.',
  'Form|Added|ShortAnswer': 'Someone added a Short Answer question to a form.',
  'Form|Added|Paragraph': 'Someone added a Paragraph question to a form.',
  'Form|Added|Number': 'Someone added a Number question to a form.',
  'Form|Added|Email': 'Someone added an Email question to a form.',
  'Form|Added|Link': 'Someone added a Link question to a form.',
  'Form|Added|Date': 'Someone added a Date question to a form.',
  'Form|Added|SingleChoice': 'Someone added a Single Choice question to a form.',
  'Form|Added|MultipleChoice': 'Someone added a Multiple Choice question to a form.',
  'Form|Added|Rating': 'Someone added a Rating question to a form.',
  'Form|Added|Checkbox': 'Someone added a Checkbox question to a form.',
  'Form|Linked|ConnectNewBoard':
    'Someone connected a form that sent its responses nowhere to a new board, from the box above its title.',
  'Form|Linked|ConnectNewSheet':
    'Someone connected a form that sent its responses nowhere to a new sheet, from the box above its title.',
  'Form|Linked|ConnectChoose':
    "Someone opened Responses Go To from the box above a form's title, to choose an existing board or sheet.",
  'Form|Shared|Link':
    'Someone published a form, making the public link anyone can fill it in from.',
  'Form|Toggled|Open': 'Someone switched Accepting Responses on for a published form.',
  'Form|Toggled|Closed':
    'Someone switched Accepting Responses off: the link stays, showing the closed message.',
  'Form|Opened|NotTakingSuspended':
    "Someone pressed a form's Not Taking Responses warning: its link was suspended after reports.",
  'Form|Opened|NotTakingPaused':
    "Someone pressed a form's Not Taking Responses warning: its responses had nowhere to go.",
  'Form|Opened|NotTakingSwitchedOff':
    "Someone pressed a form's Not Taking Responses warning: Accepting Responses was off.",
  'Form|Opened|NotTakingClosesAt':
    "Someone pressed a form's Not Taking Responses warning: its Close On time had passed.",
  'Form|Opened|NotTakingLimit':
    "Someone pressed a form's Not Taking Responses warning: it had reached its Response Limit.",
  'Form|Opened|NotTakingFull':
    "Someone pressed a form's Not Taking Responses warning: its project held as many cards as it can.",
  'Form|Moved|SyncedToShare':
    'Someone synced a project in This Browser from Share Form, so its form could be published.',
  'Form|Sent|Response':
    'Someone filled in a form through its link, and the response became a card on its board.',
  'Form|Sent|Dropped':
    "A response that filled a form's hidden field was dropped: a bot, answered as if it were kept.",
  'Form|Reported|Spam': 'Someone reported a form as spam.',
  'Form|Reported|Phishing': 'Someone reported a form as phishing or asking for passwords.',
  'Form|Reported|Offensive': 'Someone reported a form as offensive.',
  'Form|Reported|Other': 'Someone reported a form for another reason.',
  'Sheet|Opened|Find': 'Someone opened Find on a Sheet, to search its cells.',
  'Sheet|Searched|Function':
    'Someone searched the functions a Sheet formula can use, from the toolbar’s function picker.',
  'Plan|Created|BoardTab':
    'Someone started a Board tab from Start Planning: one board filling the tab.',
  'Plan|Created|SheetTab':
    'Someone started a Sheet tab from Start Planning: one Sheet filling the tab.',
  'Plan|Created|DashboardTab':
    'Someone started a Dashboard tab from Start Planning, from one of its layouts.',
  'Plan|Created|VisualisationTab':
    'Someone started a Visualisation tab from Start Planning: one chart of the cards filling the tab.',
  'Plan|Created|SuggestedDashboard':
    'Someone started a dashboard Start Planning suggested for their cards, under For You.',
  'Plan|Changed|DashboardRow': 'Someone added, removed or resized a row on a Dashboard tab.',
  'Plan|Changed|DashboardSlot':
    'Someone added, removed, moved or resized a slot on a Dashboard tab.',
  'Plan|Changed|DashboardContent': 'Someone put something in a Dashboard slot, or cleared one.',
  'Plan|Changed|DashboardLook':
    "Someone changed a Dashboard tab's background from its Dashboard Settings (plain or tinted).",
  'Plan|Changed|DashboardCardStyle':
    "Someone styled a card on a Dashboard tab (a Note, Title, Status, Checklist, Key Date or Links) from its Slot Options' Style: a preset, a colour, its border or its shadow.",
  'Plan|Opened|DashboardSettings':
    "Someone opened a Dashboard tab's settings from the cog at its top right.",
  'Plan|Changed|CalendarDue':
    "Someone moved a card's due date on a Due Calendar, by dragging it to another day or with Alt and the arrow keys.",
  'Plan|Changed|CalendarStart':
    "Someone moved a card's start date on a Start Calendar, by dragging it to another day or with Alt and the arrow keys.",
  'Sheet|Opened|Hyperlink':
    "Someone opened a HYPERLINK cell's link in a new tab, with Ctrl/⌘ and a click or the cell menu's Open Link.",
  'Sheet|Opened|Settings':
    "Someone opened a Sheet's settings cog (title, data, view, cell sizes, freeze and totals).",
  'Sheet|Created|Blank': 'Someone set up a new Sheet from Setup Sheet as a blank grid.',
  'Sheet|Created|Budget': 'Someone set up a new Sheet from the Budget template.',
  'Sheet|Created|Tracker': 'Someone set up a new Sheet from the Tracker template.',
  'Sheet|Created|Timesheet': 'Someone set up a new Sheet from the Timesheet template.',
  'Sheet|Created|Contacts': 'Someone set up a new Sheet from the Contacts template.',
  'Sheet|Created|Invoice': 'Someone set up a new Sheet from the Invoice template.',
  'Sheet|Created|ExpenseReport': 'Someone set up a new Sheet from the Expense Report template.',
  'Sheet|Created|SalesPipeline': 'Someone set up a new Sheet from the Sales Pipeline template.',
  'Sheet|Created|Inventory': 'Someone set up a new Sheet from the Inventory template.',
  'Sheet|Created|ThreatRegister': 'Someone set up a new Sheet from the Threat Register template.',
  'Sheet|Created|DriverModel': 'Someone set up a new Sheet from the Driver Model template.',
  'Sheet|Created|ValueStream': 'Someone set up a new Sheet from the Value Stream template.',
  'Sheet|Created|GuestList': 'Someone set up a new Sheet from the Guest List template.',
  'Sheet|Created|GradeBook': 'Someone set up a new Sheet from the Grade Book template.',
  'Sheet|Created|HabitTracker': 'Someone set up a new Sheet from the Habit Tracker template.',
  'Sheet|Created|LoanCalculator': 'Someone set up a new Sheet from the Loan Calculator template.',
  'Sheet|Created|Cards': 'Someone set up a new Sheet with their Plan cards as rows.',
  'Sheet|Created|Csv':
    'Someone chose Import CSV in Setup Sheet (Imported · Csv counts the file actually read; the picker can be cancelled).',
  'Sheet|Created|Chart':
    "Someone made a chart from a Sheet's cells (a bar, line or pie chart, live from the range).",
  'Sheet|Imported|Csv':
    'Someone filled a Sheet from a CSV file: Import CSV, or a CSV file dropped on the canvas in Plan mode.',
  'Plan|Imported|Csv':
    "Someone read a CSV file into a board's cards from a Board tab's menu (each row a new card).",
  'Plan|Exported|Csv': "Someone downloaded a board's cards as a CSV file from a Board tab's menu.",
  'Plan|Changed|ViewStatuses':
    'Someone chose which statuses a chart of their Plan cards counts (Cards by Field or Priority by Status), from its settings cog.',
  'Sheet|Exported|Csv': "Someone downloaded a Sheet's cells as a CSV file.",
  'Sheet|Deleted|Confirmed':
    'Someone deleted a Sheet whose cells nothing else used, and confirmed deleting the cells with it.',
  'Sheet|Deleted|Cancelled':
    'Someone started deleting a Sheet whose cells nothing else used, then cancelled, keeping both.',
  'Plan|Toggled|SheetFillTabOn':
    'Someone set a Sheet to fill its tab for everyone, deleting the rest of that canvas (undo brings it back).',
  'Plan|Toggled|SheetFillTabOff': 'Someone put a Sheet that filled its tab back on the canvas.',
  'Plan|Toggled|SheetMaximised': 'Someone maximised a Sheet to fill the canvas.',
  'Plan|Toggled|BoardFocused':
    "Someone pressed a board's Focus, gliding the view to fit it (or out to the whole tab when already fitted).",
  'Plan|Toggled|SheetFocused':
    "Someone pressed a Sheet's Focus, gliding the view to fit it (or out to the whole tab when already fitted).",
  'Plan|Toggled|SheetRestored': 'Someone put a maximised Sheet back in its place on the canvas.',
  'Search|Opened|': 'The global search panel was opened.',
  'Search|Searched|':
    'A query was typed into search. Counted once per session, not on every keystroke.',
  'Search|Selected|Element': 'Someone picked an element match from the global search results.',
  'Session|Deleted|Account':
    'Someone permanently deleted their account and its data, after typing their email address to confirm.',
  'Session|Opened|Embed':
    'A read-only embedded copy of a project was loaded on an outside page (for example an iframe in a wiki or a doc). Counted once per rendered embed.',
  'Session|Opened|Workbench': 'A project opened inside a developer tool’s frame, signed in.',
  'Session|Opened|WorkbenchWorkspace':
    'The Explorer opened inside a developer tool’s frame, signed in.',
  'Session|SignedIn|': 'A visitor just signed in to their account.',
  'Session|SignedOut|': 'A visitor just signed out.',
  'Session|SignedUp|': 'A visitor just created an account.',
  'Tab|Aligned|': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|FlowchartDown': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|FlowchartRight': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|Mindmap': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|PageTidyUp':
    'Someone pressed Tidy on an infographic or slide page, lining up and spacing what is on it.',
  'Tab|Aligned|Tree': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Changed|OpensInDiagram':
    "Someone set a tab to open in Diagram mode for everyone, from the tab menu's former Opens in (retired: the tab menu's Mode now counts as a mode switch).",
  'Tab|Changed|OpensInDraw':
    "Someone set a tab to open in Draw mode for everyone, from the tab menu's former Opens in (retired: the tab menu's Mode now counts as a mode switch).",
  'Tab|Changed|PageAdded': 'Someone added an infographic page to a Pages tab.',
  'Tab|Changed|ArticleAdded': 'Someone added a new article to a Pages tab.',
  'Tab|Changed|SlidePageAdded': 'Someone added a slide page to a Pages tab.',
  'Tab|Changed|PageKindInfographic': "Someone chose Infographic for a new Pages tab's first page.",
  'Tab|Changed|PageKindArticle': "Someone chose Article for a new Pages tab's first page.",
  'Tab|Changed|PageKindSlide': "Someone chose Slide for a new Pages tab's first page.",
  'Tab|Changed|ArticlesToPages':
    "Someone left Pages mode and turned a tab's articles into Page elements.",
  'Tab|Changed|ArticleLookClean': 'Someone gave an article the Clean look.',
  'Tab|Changed|ArticleLookClassic': 'Someone gave an article the Classic look.',
  'Tab|Changed|ArticleLookReport': 'Someone gave an article the Report look.',
  'Tab|Changed|ArticleLookNotebook': 'Someone gave an article the Notebook look, on ruled pages.',
  'Tab|Changed|ArticleLookBold': 'Someone gave an article the Bold look.',
  'Tab|Changed|ArticleStyle':
    "Someone changed one part of an article's style: a font, the accent, spacing, rules, margins or page numbers.",
  'Element|Added|ArticleImage': "Someone inserted an image at the caret in an article's writing.",
  'Element|Added|ArticleTable': "Someone inserted a table at the caret in an article's writing.",
  'Element|Added|ArticleChart': "Someone inserted a chart at the caret in an article's writing.",
  'Element|Added|ArticleCallout':
    "Someone inserted a callout at the caret in an article's writing.",
  'Element|Added|ArticleSticky':
    "Someone inserted a sticky note at the caret in an article's writing.",
  'Element|Added|ArticleDrawing':
    "Someone started a drawing in an article's writing: from Insert, or by putting shapes onto the page.",
  'Element|Added|ArticleObject':
    'Someone put an object (a chart, an image, a component) onto an article page, and the writing took it in.',
  'Element|Added|ArticleDivider': "Someone inserted a divider into an article's writing.",
  'Element|Added|ArticlePageBreak': "Someone inserted a page break into an article's writing.",
  'Element|Added|ArticleQuote': "Someone inserted a quote into an article's writing.",
  'Element|Added|ArticleCode': "Someone inserted a code block into an article's writing.",
  'Element|Added|ArticleComment':
    "Someone commented on a stretch of an article's writing, a marker in the margin beside it.",
  'Element|Added|ArticleAction':
    "Someone assigned an action on a stretch of an article's writing, a marker in the margin beside it.",
  'Element|Changed|ArticleFormat':
    'Someone formatted text in an article from the page toolbar: bold, italic, underline, strikethrough, a colour or a highlight.',
  'Element|Changed|ArticleBlockStyle':
    "Someone changed a block of an article's writing to another style or a list, from the page toolbar.",
  'Element|Changed|ArticleLink': 'Someone added a link to text in an article.',
  'Element|Changed|ArticlePaste':
    'Someone pasted Markdown into an article, and it became headings, lists and formatting.',
  'Element|Changed|ArticleZoneWrap':
    "Someone changed how a picture or drawing sits in an article's writing: in line, or wrapped.",
  'Element|Changed|ArticleZoneResized':
    "Someone made a drawing in an article's writing bigger or smaller.",
  'Element|Changed|ArticleZoneFloat':
    'Someone set a picture or drawing in an article to float in front of the text.',
  'Element|Changed|ArticleZoneMoved':
    "Someone dragged a picture or drawing to a new place in an article's writing.",
  'Element|Changed|ArticleZoneRemoved':
    "Someone deleted a picture or drawing from an article's writing.",
  'Tab|Changed|PageRemoved': 'Someone deleted a page from a Pages tab.',
  'Tab|Changed|PagePortrait': 'Someone turned a page to portrait.',
  'Tab|Changed|PageLandscape': 'Someone turned a page to landscape.',
  'Tab|Changed|PageSize': 'Someone changed a page to another size.',
  'Tab|Changed|PageBackground': "Someone changed a page's background colour.",
  'Tab|Changed|PageBackgroundAnimated':
    'Someone gave a slide an animated background (aurora, starfield, waves and the like).',
  'Tab|Changed|PageBackgroundAnimatedSpeed':
    "Someone changed how fast a slide's animated background moves.",
  'Tab|Changed|PageBackgroundImage':
    'Someone put a picture behind a page, searched or uploaded, under an overlay.',
  'Tab|Changed|PagePattern': "Someone changed a page's background pattern.",
  'Tab|Changed|PageBackgroundAppliedToAll':
    "Someone gave every other page of a kind (every slide, say) one page's background at once.",
  'Tab|Changed|PageBackgroundPainted':
    "Someone painted one page's background onto another with the Format tool.",
  'Tab|Changed|PageLocked': 'Someone locked a page, so it and what is on it stay as they are.',
  'Tab|Changed|PageUnlocked': 'Someone unlocked a page.',
  'Tab|Changed|PageRenamed': 'Someone renamed a page.',
  'Tab|Changed|PageDuplicated': 'Someone duplicated a page with its content.',
  'Tab|Changed|PageMoved': 'Someone moved a page left or right in its row.',
  'Tab|Changed|PagesLaidOut':
    'Someone split a Fit to Content page into one page per group of its content.',
  'Tab|Changed|PageFitToContent':
    "A tab's board was put onto a page made around it, nothing moved, as it entered Pages mode.",
  'Tab|Changed|PageLayout': 'Someone put a ready-made layout onto a page.',
  'Tab|Changed|PageLayoutSurprise':
    "Someone pressed Surprise Me in a page's layout gallery, putting a random layout onto the page.",
  'Tab|Changed|OpensInPages':
    "Someone set a tab to open in Pages mode for everyone, from the tab menu's former Opens in (retired: the tab menu's Mode now counts as a mode switch).",
  'Tab|Changed|OpensInPlan':
    "Someone set a tab to open in Plan mode for everyone, from the tab menu's former Opens in (retired: the tab menu's Mode now counts as a mode switch).",
  'Tab|Changed|Look':
    "Someone picked a look in Tab Look & Feel, setting the tab's theme, finish, font and canvas pattern at once.",
  'Tab|Changed|SeasonalLook':
    "Someone picked a seasonal look (New Year, Easter, Halloween or Christmas) behind the Seasonal toggle in Tab Style, setting the tab's theme, finish, font and canvas pattern at once.",
  'Tab|Changed|Finish':
    "Someone changed a tab's finish (Flexible, Professional, Sketch or Marker) from Tab Look & Feel.",
  'Tab|Changed|DefaultTextSize':
    "Someone changed a tab's default text size, used for new elements added to it.",
  'Tab|Changed|Font':
    "Someone changed a tab's default font, or applied the tab's font and size to every element on it.",
  'Tab|Changed|TimerExtended':
    "Someone gave a tab's running or paused countdown timer more time, from the timer element's menu.",
  'Tab|Changed|TimerReset': "Someone reset a tab's timer back to its starting length.",
  'Tab|Cleared|': "A tab's content was wiped.",
  'Tab|Cleared|Vote': "A tab's content was wiped.",
  'Tab|Created|': 'A new tab was added to a project.',
  'Tab|Deleted|': 'A tab was removed from a project.',
  'Tab|Duplicated|': 'A tab was duplicated.',
  'Tab|Ended|CountdownTimer':
    "Someone cleared a tab's countdown timer, whether it had run out or was dismissed early.",
  'Tab|Ended|Poll': 'Someone ended a live poll on a tab.',
  'Tab|Ended|StopwatchTimer': 'Someone cleared a running stopwatch on a tab.',
  'Tab|Ended|Vote': 'Someone ended a dot vote on a tab.',
  'Tab|Ended|VoteReview':
    "Someone finished reviewing a dot vote's ranked results, closing out the vote for everyone.",
  'Tab|Linked|': 'A tab was linked into another project.',
  'Tab|Loaded|':
    "A tab's content was fetched for viewing (the first tab when a project opens, then each tab switched to).",
  'Tab|Locked|': 'A tab was locked (read-only).',
  'Tab|Moved|Folder': 'A tab was filed into a tab folder.',
  'Tab|Removed|Folder':
    "Someone took a tab out of its tab folder, making it a loose tab again, whether by dragging it out or from the tab's menu.",
  'Tab|Renamed|': 'A tab was renamed.',
  'Tab|Reordered|': 'Someone dragged a tab to a new position.',
  'Tab|Opened|SideBySideDrag':
    'Someone dragged a tab to the right edge of the screen to open it beside the tab they were editing.',
  'Tab|Opened|SideBySideMenu': "Someone opened a tab side by side from the tab's menu.",
  'Tab|Selected|SideBySideClick':
    'Someone clicked into the other side by side pane, moving the editor (its toolbars and panels) there.',
  'Tab|Selected|SideBySideHover':
    'Someone rested the pointer on the other side by side pane, and the editor followed it there.',
  'Tab|Closed|SideBySide': 'Someone closed the side by side pane, going back to one tab.',
  'Tab|Revealed|Vote': "Someone revealed a dot vote's results to everyone in the room.",
  'Tab|Started|CountdownTimer': 'Someone started a countdown timer on a tab.',
  'Tab|Started|Poll': 'Someone started a live poll on a tab.',
  'Tab|Started|PrivateVote':
    'Someone started a dot vote with cursors or counts hidden from other participants.',
  'Tab|Started|StopwatchTimer': 'Someone started a stopwatch on a tab.',
  'Tab|Started|Vote': 'Someone started a dot vote on a tab.',
  'Tab|Toggled|TimerPaused': 'Someone paused a running timer on a tab.',
  'Tab|Toggled|TimerResumed': 'Someone resumed a paused timer on a tab.',
  'Tab|Unlocked|': 'A tab was unlocked (edits resume).',
  'Tab|Voted|Poll':
    'Someone answered a live poll. Counted once per person per poll, even if they change their answer.',
  'Team|Added|Project': "A project was added to a team's shared library.",
  'Team|Added|Member':
    'An admin invited someone to a team by email. This counts invitations sent, not accepted: that is Joined.',
  'Team|Changed|': "Someone updated a team's name or organisation in its settings.",
  'Team|Changed|Role': "An admin changed a team member's role between Admin and Member.",
  'Team|Created|': 'Someone created a new team.',
  'Team|Declined|Invite':
    'Someone turned down a team invite. Read against Joined: the two are the accept rate on an invitation.',
  'Team|Declined|Email':
    "Someone turned down a team invite from the email's Decline link, without signing in.",
  'Team|Deleted|': 'An admin deleted a team.',
  'Team|Joined|': 'Someone accepted a team invite, by email or by invite link.',
  'Team|Moved|Project':
    "A project already in a team's shared library was moved: re-foldered within the team, moved to a different team, or taken back to the owner's personal space.",
  'Team|Removed|Project': 'An admin removed a member who had joined the team.',
  'Team|Removed|Link': "A team's shareable invite link was turned off.",
  'Team|Removed|Rejected':
    'An admin cleared a declined or expired team invite from the member list.',
  'Team|Removed|Self': 'Someone left a team they had joined.',
  'Team|Shared|Link':
    "An admin turned on a team's shareable invite link, so anyone who has it can ask to join.",
  'Theme|Created|Custom': 'Someone created a custom theme with their own colours.',
  'Theme|Deleted|Custom': 'Someone deleted a custom theme they had created.',
  'Timeline|Changed|Calendar':
    "Someone switched a project's History or a team's Activity from list view to calendar view.",
  'Timeline|Changed|List':
    "Someone switched a project's History or a team's Activity from calendar view to list view.",
  'Timeline|Loaded|More':
    'Someone clicked "Show More" at the bottom of a project\'s History or a team\'s Activity, loading the next page.',
  'Timeline|Loaded|Retry':
    'Someone clicked "Try again" after a project\'s History or a team\'s Activity failed to load, retrying the read.',
  'Timeline|Opened|Landing':
    "Someone arrived at the Explorer with the Timeline as the very section that loaded. No longer recorded: the Explorer's Timeline was removed.",
  'Timeline|Opened|Menu':
    "Someone opened the ⋯ menu on a Timeline card or on a collapsed run of cards. No longer recorded: the Explorer's Timeline was removed.",
  'Timeline|Opened|Nav':
    "Someone went to the Timeline from elsewhere in the Explorer: its sidebar row, or Home's See Timeline link. No longer recorded: the Explorer's Timeline was removed.",
  'Timeline|Opened|Stack':
    'Someone expanded a collapsed run of similar entries (like "12 projects renamed") in a project\'s History or a team\'s Activity into its individual cards.',
  'Timeline|Removed|Entry':
    "Someone removed a single entry from their Timeline feed. No longer recorded: the Explorer's Timeline was removed.",
  'Timeline|Removed|Stack':
    "Someone removed every entry in a collapsed run from their Timeline feed at once, from its ⋯ menu. No longer recorded: the Explorer's Timeline was removed.",
  'Timeline|Selected|Everyone':
    "Someone switched a project's History or a team's Activity to show everyone's activity, not just their own.",
  'Timeline|Selected|Others':
    "Someone switched a project's History or a team's Activity to show only other people's activity, hiding their own.",
  'Trash|Opened|Settings': 'Someone opened the Trash from Settings, under Account.',
  'Explorer|Selected|Text':
    'Someone typed words into the Explorer search to narrow a list of projects.',
  'Explorer|Selected|OpensIn':
    'Someone filtered an Explorer list by the editor mode projects open in (Diagram or Draw).',
  'Explorer|Selected|Template':
    'Someone filtered an Explorer list by the template family projects were made from (Retrospective, Kanban).',
  'Explorer|Selected|MadeBy': 'Someone filtered an Explorer list to the projects an AI made.',
  'Explorer|Selected|Edited':
    'Someone filtered an Explorer list by when projects were last edited.',
  'Explorer|Selected|People':
    'Someone filtered an Explorer list by who owns the projects (Me or Others).',
  'Explorer|Created|Tag':
    'Someone made a tag, a coloured label for grouping their projects, from the tag picker or the Tags page.',
  'Explorer|Added|Tag': 'Someone put one of their tags on a project.',
  'Explorer|Removed|Tag': 'Someone took one of their tags off a project.',
  'Explorer|Renamed|Tag': 'Someone renamed one of their tags.',
  'Explorer|Changed|TagColour': 'Someone changed the colour of one of their tags.',
  'Explorer|Deleted|Tag':
    'Someone deleted one of their tags, which takes it off every project it was on.',
  'Explorer|Selected|Space':
    'Someone filtered an aggregate Explorer list by where projects live (My Projects, Shared With Me, a team).',
  'Token|Created|MCP':
    'An AI tool was connected to the account over MCP, which creates an API token for it to use.',
  'Token|Created|Manual':
    'Someone created a new personal API token by hand, from the API Tokens category in Settings.',
  'Token|Linked|Workbench': 'A token’s owner allowed a developer tool to open their projects.',
  'Token|Removed|': 'Someone revoked an API token.',
  'UI|Added|PaletteFavourite':
    'Someone added a tile to their Favourites in the shape palette. No longer recorded: the palette opens on Popular, a fixed pick.',
  'UI|Added|Slide':
    'Someone added a slide to the Slide Deck: either a fresh slide built from the current selection, or a duplicate of an existing one.',
  'UI|Changed|AvatarClothing':
    "Someone changed the Avatar-mode character's clothing, in the Avatar panel.",
  'UI|Changed|AvatarGender':
    "Someone changed the Avatar-mode character's gender, in the Avatar panel.",
  'UI|Changed|AvatarHair': "Someone changed the Avatar-mode character's hair, in the Avatar panel.",
  'UI|Changed|AvatarStatus':
    'Someone set or cleared their status in Avatar mode (Available, Focusing, In a Meeting or Away). Never which.',
  'UI|Changed|AvatarRandomised':
    'Someone clicked the dice button in the Avatar panel to roll a new random character, keeping their chosen size.',
  'UI|Changed|AvatarSize': "Someone changed the Avatar-mode character's size, in the Avatar panel.",
  'UI|Changed|FormatCopies':
    'Someone toggled which style properties the format painter copies (fill, border, text, effects, or size), in the Format panel.',
  'UI|Changed|FormatMode':
    'Someone changed whether the format painter keeps applying after each use or turns off after one copy, in the Format panel.',
  'UI|Changed|LaserColour': "Someone changed the laser pointer's colour, in the Laser panel.",
  'UI|Changed|LaserEffect': "Someone changed the laser pointer's trail effect, in the Laser panel.",
  'UI|Changed|LaserTrail':
    "Someone changed how long the laser pointer's trail lingers, in the Laser panel.",
  'UI|Changed|LaserWidth': "Someone changed the laser pointer's width, in the Laser panel.",
  'UI|Changed|ElementIndicatorsTop':
    'Someone set element indicators (link, note, action, comments) to quiet icons along the top of each element, in Settings > Editor.',
  'UI|Changed|ElementIndicatorsOff':
    'Someone turned element indicators (link, note, action, comments) off, in Settings > Editor.',
  'UI|Changed|ElementIndicatorsFooter':
    'Someone set element indicators (link, note, action, comments) to a labelled row along the bottom of each element, in Settings > Editor.',
  'UI|Changed|MapSize':
    'Someone resized the minimap, in Settings > Editor. An earlier version of this event, before it recorded which size was chosen. No longer recorded.',
  'UI|Changed|MapSizeMedium': 'Someone set the minimap to its medium size, in Settings > Editor.',
  'UI|Changed|MapSizeShort': 'Someone set the minimap to its short size, in Settings > Editor.',
  'UI|Changed|MapSizeTall': 'Someone set the minimap to its tall size, in Settings > Editor.',
  'UI|Changed|PaletteFavourite':
    'Someone reordered their palette Favourites by dragging, or reset the list back to its default tiles. No longer recorded: Favourites is gone.',
  'UI|Changed|PanelLayout':
    "Someone changed the editor's panel layout, in Settings > Editor. An earlier version of this event, before it recorded which layout was chosen. No longer recorded.",
  'UI|Changed|PanelLayoutFloating':
    "Someone switched the editor's panel layout to Floating, in Settings > Editor. No longer recorded: Toolbar became the only layout.",
  'UI|Changed|PanelLayoutMinimal':
    "Someone switched the editor's panel layout to Minimal, in Settings > Editor. No longer recorded: the Minimal layout was removed.",
  'UI|Changed|PanelLayoutToolbar':
    "Someone switched the editor's panel layout to Toolbar, in Settings > Editor. No longer recorded: Toolbar became the only layout.",
  'UI|Changed|PanelOpacity':
    'Someone adjusted how see-through the panels are, on the Panel Opacity slider in Settings > Editor.',
  'UI|Changed|UiScale':
    'Someone made the panels, the toolbar and the bottom-right buttons bigger or smaller together, on the UI Scale slider in Settings > Appearance.',
  'UI|Changed|UiScalePanels':
    'Someone made just the panels bigger or smaller, on the Panel Scale slider under UI Scale in Settings > Appearance.',
  'UI|Changed|UiScaleToolbar':
    'Someone made just the toolbar bigger or smaller, on the Toolbar Scale slider under UI Scale in Settings > Appearance.',
  'UI|Changed|UiScaleCornerButtons':
    'Someone made just the bottom-right buttons (undo, layers, theme, zoom) bigger or smaller, on the Corner Buttons Scale slider under UI Scale in Settings > Appearance.',
  'UI|Changed|QuickSwatchCustom':
    "Someone replaced one of the quick style panel's theme colours with a colour of their own, by right-clicking the swatch.",
  'UI|Changed|QuickSwatchReset':
    'Someone put a quick style panel swatch back to its theme colour, with Clear override.',
  'UI|Changed|LooksFinishFilter':
    "Someone narrowed the Tab Style popover's Looks to one finish with its Finish filter.",
  'UI|Changed|LooksSeasonal':
    "Someone switched the Tab Style popover's Looks to the seasonal looks, with the Seasonal toggle beside the Finish filter.",
  'UI|Changed|SlideNotes':
    'Someone typed presenter notes for a slide, in the Slide Deck panel. Counted once per slide edited, not per keystroke.',
  'UI|Changed|SpotlightDim':
    'Someone changed how dark the area outside the Spotlight is, in the Spotlight panel.',
  'UI|Changed|SpotlightEdge':
    "Someone changed the Spotlight's edge softness, in the Spotlight panel.",
  'UI|Changed|SpotlightShape': "Someone changed the Spotlight's shape, in the Spotlight panel.",
  'UI|Changed|SpotlightSize': "Someone changed the Spotlight's size, in the Spotlight panel.",
  'UI|Changed|ToolbarCategory':
    "Someone opened a category in the palette strip across the top of the canvas: a category on the category bar (Diagram, Workshop, Pages), or a switch in Plan's category picker.",
  'UI|Changed|ContentsPlacementButton':
    "Someone minimised Pages mode's Contents sidebar to its button, from the sidebar or in Settings > Editor.",
  'UI|Changed|ContentsSideLeft':
    "Someone dragged Pages mode's Contents sidebar to the canvas's left edge.",
  'UI|Changed|ContentsSideRight':
    "Someone dragged Pages mode's Contents sidebar to the canvas's right edge.",
  'UI|Changed|ContentsPlacementSidebar':
    "Someone docked Pages mode's Contents as a sidebar down the canvas's left, from its popover or in Settings > Editor.",
  'UI|Opened|EmptyPageInvite':
    'Someone pressed Choose a Layout on an empty page too small on screen for its layout card (a phone, or zoomed out).',
  'UI|Closed|EmptyPageLayouts': 'Someone hid the Start From a Layout card on an empty page.',
  'UI|Closed|EmptyPageLayoutsBlank':
    'Someone chose Start From Scratch on an empty logo page, so its Start From a Layout card stays away on that page.',
  'UI|Closed|NewProject':
    'Someone pressed Escape or the X in the New Project wizard and went back to where they came from, creating nothing.',
  'UI|Closed|Presentation': 'Someone exited presentation mode.',
  'UI|Closed|SignInBanner':
    'Someone dismissed the guest sign-in banner. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Closed|SignInBannerEditor': 'Someone dismissed the guest sign-in banner shown in the editor.',
  'UI|Closed|SignInBannerExplorer':
    'Someone dismissed the guest sign-in banner shown in the Explorer.',
  'UI|Closed|TourOffer':
    "Someone dismissed the Diagram tour's offer card (the welcome tour's, until October 2026) without starting it.",
  'UI|Closed|PagesTourOffer': 'Someone turned the Pages tour down with No on its own card.',
  'UI|Closed|AvatarTourOffer': 'Someone turned the Avatar tour down with No on its own card.',
  'UI|Closed|WorkshopTourOffer':
    'Someone turned the Workshop tour down with No thanks on its own card (until October 2026, also by finishing the welcome tour without pressing Show me Workshop).',
  'UI|Closed|FormTourOffer': 'Someone turned the Forms tour down with No on its own card.',
  'UI|Closed|PlanTourOffer': "Someone dismissed the Plan tour's offer card without starting it.",
  'UI|Closed|Welcome': 'Someone dismissed the first-run welcome modal.',
  'UI|Cleared|BrowserRepair':
    "Someone used Repair This Browser on a failed project load: liveplanner's settings and caches in that browser were cleared and the page reloaded.",
  'UI|Cleared|BrowserRepair.Help':
    "Someone used Repair This Browser from the help centre's Repair page, clearing liveplanner's settings and caches in that browser.",
  'UI|Copied|Diagnostics':
    'Someone copied the diagnostics report from a failed project load, to send to support.',
  'UI|Copied|Diagnostics.Help':
    "Someone copied the browser diagnostics report from the help centre's Repair page.",
  'UI|Copied|EmbedCode':
    "Someone copied an embed URL or an iframe snippet from the Share dialog's Embed menu.",
  'UI|Copied|LiveImage':
    "Someone copied a live-updating image URL from the Share dialog's Live Image menu.",
  'UI|Copied|ShareLink': 'Someone copied a share link to the clipboard.',
  'UI|Copied|TeamInviteLink': "Someone copied a team's shareable invite link to their clipboard.",
  'UI|Ended|TourCompleted':
    "Someone reached the end of the Diagram tour (the welcome tour until October 2026), or a step's target never appeared on screen and the tour finished early.",
  'UI|Ended|TourDeclined':
    'This exact combination is never actually sent: declining the welcome tour on its very first card is recorded as the tour offer closing, not as an ended tour.',
  'UI|Ended|TourSkipped':
    'Someone skipped out of the Diagram tour (the welcome tour until October 2026) after it had already started (not on the very first card), or it ended because the tab left Diagram mode.',
  'UI|Ended|CardTypeTourCompleted':
    "Someone reached the end of the card type editor's Show Me tour.",
  'UI|Ended|CardTypeTourSkipped':
    "Someone left the card type editor's Show Me tour before its end.",
  'UI|Ended|ShareTourCompleted': "Someone reached the end of the Share dialog's Show Me tour.",
  'UI|Ended|ShareTourSkipped': "Someone left the Share dialog's Show Me tour before its end.",
  'UI|Ended|DashboardTourCompleted':
    "Someone reached the end of the dashboard's tour: Dashboard Settings' Show Me, or the Dashboards tour it offers.",
  'UI|Ended|DashboardTourSkipped': "Someone left Dashboard Settings' Show Me tour before its end.",
  'UI|Ended|LogoTourCompleted': "Someone reached the end of a logo page's Show Me tour.",
  'UI|Ended|LogoTourSkipped': "Someone left a logo page's Show Me tour before its end.",
  'UI|Ended|SlideTourCompleted': "Someone reached the end of a slide page's Show Me tour.",
  'UI|Ended|SlideTourSkipped': "Someone left a slide page's Show Me tour before its end.",
  'UI|Ended|InfographicTourCompleted':
    "Someone reached the end of an infographic page's Show Me tour.",
  'UI|Ended|InfographicTourSkipped':
    "Someone left an infographic page's Show Me tour before its end.",
  'UI|Ended|ArticleTourCompleted': "Someone reached the end of an article page's Show Me tour.",
  'UI|Ended|ArticleTourSkipped': "Someone left an article page's Show Me tour before its end.",
  'UI|Ended|TabStyleTourCompleted':
    "Someone reached the end of the Tab Style dialog's Show Me tour.",
  'UI|Ended|TabStyleTourSkipped':
    "Someone left the Tab Style dialog's Show Me tour before its end.",
  'UI|Ended|LayerStackTourCompleted':
    'Someone reached the end of the Layer Stack tour, offered beside a selected layer stack.',
  'UI|Ended|LayerStackTourSkipped':
    'Someone left the Layer Stack tour before its end, or the stack it was on went away.',
  'UI|Ended|PyramidTourCompleted':
    'Someone reached the end of the Pyramid tour, offered beside a selected pyramid.',
  'UI|Ended|PyramidTourSkipped':
    'Someone left the Pyramid tour before its end, or the pyramid it was on went away.',
  'UI|Ended|FunnelTourCompleted':
    'Someone reached the end of the Funnel tour, offered beside a selected funnel.',
  'UI|Ended|FunnelTourSkipped':
    'Someone left the Funnel tour before its end, or the funnel it was on went away.',
  'UI|Ended|CycleTourCompleted':
    'Someone reached the end of the Cycle tour, offered beside a selected cycle.',
  'UI|Ended|CycleTourSkipped':
    'Someone left the Cycle tour before its end, or the cycle it was on went away.',
  'UI|Ended|HubTourCompleted':
    'Someone reached the end of the Hub and Spoke tour, offered beside a selected hub and spoke.',
  'UI|Ended|HubTourSkipped':
    'Someone left the Hub and Spoke tour before its end, or the hub and spoke it was on went away.',
  'UI|Ended|OnionTourCompleted':
    'Someone reached the end of the Onion tour, offered beside a selected onion.',
  'UI|Ended|OnionTourSkipped':
    'Someone left the Onion tour before its end, or the onion it was on went away.',
  'UI|Ended|TimelineTourCompleted':
    'Someone reached the end of the Timeline tour, offered beside a selected timeline.',
  'UI|Ended|TimelineTourSkipped':
    'Someone left the Timeline tour before its end, or the timeline it was on went away.',
  'UI|Ended|ChevronsTourCompleted':
    'Someone reached the end of the Chevrons tour, offered beside a selected chevron process.',
  'UI|Ended|ChevronsTourSkipped':
    'Someone left the Chevrons tour before its end, or the chevron process it was on went away.',
  'UI|Ended|MindMapTourCompleted':
    'Someone reached the end of the Mind Map tour, offered beside a selected mind map node.',
  'UI|Ended|MindMapTourSkipped':
    'Someone left the Mind Map tour before its end, or the mind map node it was on went away.',
  'UI|Ended|FlowchartTourCompleted':
    'Someone reached the end of the Flowchart tour, offered beside a selected flowchart step.',
  'UI|Ended|FlowchartTourSkipped':
    'Someone left the Flowchart tour before its end, or the flowchart step it was on went away.',
  'UI|Ended|OrgChartTourCompleted':
    'Someone reached the end of the Org Chart tour, offered beside a selected person in an org chart.',
  'UI|Ended|OrgChartTourSkipped':
    'Someone left the Org Chart tour before its end, or the person in an org chart it was on went away.',
  'UI|Ended|SequenceTourCompleted':
    'Someone reached the end of the Sequence tour, offered beside a selected sequence diagram.',
  'UI|Ended|SequenceTourSkipped':
    'Someone left the Sequence tour before its end, or the sequence diagram it was on went away.',
  'UI|Ended|ChartTourCompleted':
    'Someone reached the end of the Chart tour, offered beside a selected chart.',
  'UI|Ended|ChartTourSkipped':
    'Someone left the Chart tour before its end, or the chart it was on went away.',
  'UI|Ended|StackTourCompleted':
    'Someone reached the end of the Stack tour, offered beside a selected stack.',
  'UI|Ended|StackTourSkipped':
    'Someone left the Stack tour before its end, or the stack it was on went away.',
  'UI|Ended|EntityTourCompleted':
    'Someone reached the end of the Entity tour, offered beside a selected entity.',
  'UI|Ended|EntityTourSkipped':
    'Someone left the Entity tour before its end, or the entity it was on went away.',
  'UI|Ended|TabWindowTourCompleted':
    'Someone reached the end of the Tab Window tour, offered beside a selected tab window.',
  'UI|Ended|TabWindowTourSkipped':
    'Someone left the Tab Window tour before its end, or the tab window it was on went away.',
  'UI|Ended|LaneTourCompleted':
    'Someone reached the end of the Lane tour, offered beside a selected lane.',
  'UI|Ended|LaneTourSkipped':
    'Someone left the Lane tour before its end, or the lane it was on went away.',
  'UI|Ended|BoundaryTourCompleted':
    'Someone reached the end of the Boundary tour, offered beside a selected boundary.',
  'UI|Ended|BoundaryTourSkipped':
    'Someone left the Boundary tour before its end, or the boundary it was on went away.',
  'UI|Ended|DiagramKeyTourCompleted':
    'Someone reached the end of the Diagram Key tour, offered beside a selected diagram key.',
  'UI|Ended|DiagramKeyTourSkipped':
    'Someone left the Diagram Key tour before its end, or the diagram key it was on went away.',
  'UI|Ended|PortalTourCompleted':
    'Someone reached the end of the Portal tour, offered beside a selected portal.',
  'UI|Ended|PortalTourSkipped':
    'Someone left the Portal tour before its end, or the portal it was on went away.',
  'UI|Ended|SankeyTourCompleted':
    'Someone reached the end of the Sankey tour, offered beside a selected Sankey diagram.',
  'UI|Ended|SankeyTourSkipped':
    'Someone left the Sankey tour before its end, or the diagram it was on went away.',
  'UI|Ended|SankeyFlowsTourCompleted':
    "Someone reached the end of a Sankey Flows dialog's Show Me tour.",
  'UI|Ended|SankeyFlowsTourSkipped':
    "Someone left a Sankey Flows dialog's Show Me tour before its end.",
  'UI|Ended|PagesTourCompleted':
    "Someone reached the end of the Pages tour, or a step's target never appeared and the tour finished early.",
  'UI|Ended|PagesTourSkipped': 'Someone closed the Pages tour before its end.',
  'UI|Ended|AvatarTourCompleted':
    "Someone reached the end of the Avatar tour, or a step's target never appeared and the tour finished early.",
  'UI|Ended|AvatarTourSkipped': 'Someone closed the Avatar tour before its end.',
  'UI|Ended|FormTourCompleted':
    "Someone reached the end of the Forms tour, or a step's target never appeared and the tour finished early.",
  'UI|Ended|FormTourSkipped':
    'Someone closed the Forms tour before its end, or left the form for a tab other than where its responses go.',
  'UI|Ended|WorkshopTourCompleted':
    "Someone reached the end of the Workshop tour, or a step's target never appeared and the tour finished early.",
  'UI|Ended|WorkshopTourSkipped': 'Someone closed the Workshop tour before its end.',
  'UI|Ended|PlanTourCompleted':
    "Someone reached the end of the Plan tour, or a step's target never appeared and the tour finished early.",
  'UI|Ended|PlanTourSkipped':
    'Someone left the Plan tour after it had started, or it ended because they left Plan mode, the tab or their edit rights, or the board or sheet it was showing was deleted.',
  'UI|Moved|PanelDock':
    'Someone dragged a panel, such as the Map or the AI panel, to a different corner of the screen, or let it go free.',
  'UI|Moved|Slide':
    'Someone dragged a slide to a new position in the Slide Deck. Counted once per completed drag, not per position crossed.',
  'UI|Opened|ActionSignInNudge':
    'A signed-out visitor opened the "Assign action" dialog and saw the sign-in nudge, since a guest can only assign work to themself. Counted once per dialog open.',
  'UI|Opened|Activity': 'Someone expanded the since-removed Activity panel.',
  'UI|Opened|Collaborate': 'Someone opened the Collaborate panel from its bottom-bar button.',
  'UI|Opened|SessionTimer':
    'Someone opened the Timer button in the bottom bar: the set-up while no timer runs, the live timer while one does. A timer shared by countdowns and stopwatches, so it appears under both.',
  'UI|Opened|SessionVote':
    'Someone opened the Vote button in the bottom bar: the vote set-up while none runs, the Vote panel while one does.',
  'UI|Opened|SessionPoll':
    'Someone opened the Poll button in the bottom bar: the poll composer while none runs, the answers while one does.',
  'UI|Opened|TidyUp':
    "Someone opened Diagram mode's Tidy Up button in the bottom bar, the panel of layout styles and Auto-align. What they then picked counts as a tab being auto-arranged.",
  'UI|Opened|BehaviourGroup':
    "Someone opened one of Session's groups (Tools, Record, React, Selection Mode or Navigate) on Workshop mode's palette strip. Earlier, a category inside the palette's Collaborate tab (formerly Behaviours), before Workshop offered those categories one by one and then gathered them into Session.",
  'UI|Opened|CanvasStyle':
    "Someone opened the tab's look-and-feel dialog on its Canvas tab, to change the background.",
  'UI|Opened|CollabGroup':
    "Someone opened a category inside the palette's old Collaborate tab (session tools like polls and votes). That tab was merged into Behaviours (since renamed Collaborate). No longer recorded.",
  'UI|Opened|Collaborators':
    "Someone opened the Collaborators dialog, either from a tab's presence stack or from a command.",
  'UI|Opened|IconGroup': "Someone opened a category inside the palette's Icons tab.",
  'UI|Opened|MindOutline': "Someone opened a mind map's outline to edit it as text.",
  'UI|Opened|PresentationSettings':
    "Someone opened the settings popover on the presentation's on-screen controls, while presenting.",
  'UI|Opened|PresenterNotes': 'Someone opened the speaker-notes card while presenting.',
  'UI|Opened|Settings': 'Someone opened the Settings dialog.',
  'UI|Opened|SettingsAccessibility':
    'Someone opened the Accessibility category in the Settings dialog.',
  'UI|Opened|SettingsAccount': 'Someone opened the Account category in the Settings dialog.',
  'UI|Opened|SettingsAi': 'Someone opened the AI Tools category in the Settings dialog.',
  'UI|Opened|SettingsAppearance': 'Someone opened the Appearance category in the Settings dialog.',
  'UI|Opened|SettingsControls': 'Someone opened the Controls category in the Settings dialog.',
  'UI|Opened|SettingsEditor': 'Someone opened the Editor category in the Settings dialog.',
  'UI|Opened|SettingsExperimental':
    'Someone opened the Experimental category in the Settings dialog. No longer recorded: the category is gone.',
  'UI|Opened|SettingsKeyboard': 'Someone opened the Keyboard category in the Settings dialog.',
  'UI|Opened|SettingsNotifications':
    'Someone opened the Notifications category in the Settings dialog.',
  'UI|Opened|SettingsPanels': 'Someone opened the Panels category in the Settings dialog.',
  'UI|Opened|SettingsPrivacy': 'Someone opened the Privacy category in the Settings dialog.',
  'UI|Opened|SettingsTours': 'Someone opened the Tours category in the Settings dialog.',
  'UI|Opened|SettingsTokens': 'Someone opened the API Tokens category in the Settings dialog.',
  'UI|Opened|Share': 'Someone opened the Share dialog.',
  'UI|Opened|Shortcuts': 'Someone opened the keyboard-shortcuts dialog.',
  'UI|Opened|SignInReasons':
    'Someone clicked "Learn more" on the guest sign-in banner to read why they should sign in. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Opened|SignInReasonsEditor':
    'Someone clicked "Learn more" on the guest sign-in banner shown in the editor, opening the reasons-to-sign-in card.',
  'UI|Opened|SignInReasonsExplorer':
    'Someone clicked "Learn more" on the guest sign-in banner shown in the Explorer, opening the reasons-to-sign-in card.',
  'UI|Opened|PageContents':
    "Someone opened Pages mode's Contents: every page of the tab in a list.",
  'UI|Used|PageContentsJump': "Someone went to a page from Pages mode's Contents list.",
  'UI|Used|PageSwipe':
    'Someone turned to the next or previous page in Pages mode with a short pan or a flick, the view gliding onto it.',
  'UI|Used|PageContentsReorder':
    "Someone dragged a page to a new place in Pages mode's Contents list.",
  'UI|Added|AllPageSlides':
    "Someone added every slide page of a tab to the deck at once, from the Slide Deck's Add All Slide Pages.",
  'UI|Opened|SlideDeck':
    "Someone opened the deck-building panel: the Slide Deck tool, or a Pages tab's Slides button.",
  'UI|Opened|SlideElementDetail':
    'While presenting, someone clicked an element on the slide to read its detail, such as a note or comment, without leaving presentation mode.',
  'UI|Opened|TechGroup': "Someone opened a category inside the palette's Technology tab.",
  'UI|Opened|ThemePicker': "Someone opened the tab's look-and-feel dialog on its Theme tab.",
  'UI|Opened|ToolbarExplorer':
    'In the Toolbar panel layout, someone clicked the top-left menu button to open the Explorer as a popover.',
  'UI|Opened|ToolbarMore':
    'In the Toolbar panel layout, someone clicked "More" to see every tile in the current palette category.',
  'UI|Opened|ToolbarSearch':
    'In the Toolbar panel layout, someone opened the Search at the far right of the palette strip to find an element by name.',
  'UI|Opened|ToolbarSearchOtherModes':
    "In the Toolbar strip's Search, someone expanded the elements that other editor modes offer.",
  'UI|Opened|ToolbarSearchUnavailable':
    "In the Toolbar strip's Search, someone expanded the elements bound to another mode's own tools, which this mode cannot add.",
  'UI|Opened|PowerUserOffer':
    'The one-time offer of power user mode appeared, after 20 editing days or 50 keyboard shortcuts on one device.',
  'UI|Used|PowerUserOffer': 'Someone accepted the power user mode offer, switching the mode on.',
  'UI|Declined|PowerUserOffer':
    'Someone said no thanks to the power user mode offer, or closed it.',
  'UI|Opened|NewVersionPrompt':
    'An open editor learned the server now serves a newer project format and offered "A new version of liveplanner is ready".',
  'UI|Used|NewVersionPrompt':
    'Someone pressed Reload on the new version prompt; the editor reloads once their changes are saved.',
  'UI|Opened|TourOffer':
    'The Diagram tour\'s offer card was shown on a Diagram tab, either automatically on a first project or replayed from Settings\' Tours › "Diagram Tour" ("Welcome", when it was the welcome tour, until October 2026).',
  'UI|Opened|PagesTourOffer':
    'The Pages tour was offered: as its own card the first time someone worked in Pages mode, or replayed from Settings\' Tours › "Pages Tour".',
  'UI|Opened|AvatarTourOffer':
    'The Avatar tour was offered: as its own card the first time someone walked as an avatar, or replayed from Settings\' Tours › "Avatar Tour".',
  'UI|Opened|AvatarPanel':
    'Someone opened the Avatar panel from its button beside Undo and Redo, in Avatar mode.',
  'UI|Opened|LayerStackTourOffer':
    'The Layer Stack tour was offered, as a small Tour toolbar beside a selected layer stack (counted once per visit).',
  'UI|Opened|PyramidTourOffer':
    'The Pyramid tour was offered, as a small Tour toolbar beside a selected pyramid (counted once per visit).',
  'UI|Opened|FunnelTourOffer':
    'The Funnel tour was offered, as a small Tour toolbar beside a selected funnel (counted once per visit).',
  'UI|Opened|CycleTourOffer':
    'The Cycle tour was offered, as a small Tour toolbar beside a selected cycle (counted once per visit).',
  'UI|Opened|HubTourOffer':
    'The Hub and Spoke tour was offered, as a small Tour toolbar beside a selected hub and spoke (counted once per visit).',
  'UI|Opened|OnionTourOffer':
    'The Onion tour was offered, as a small Tour toolbar beside a selected onion (counted once per visit).',
  'UI|Opened|TimelineTourOffer':
    'The Timeline tour was offered, as a small Tour toolbar beside a selected timeline (counted once per visit).',
  'UI|Opened|ChevronsTourOffer':
    'The Chevrons tour was offered, as a small Tour toolbar beside a selected chevron process (counted once per visit).',
  'UI|Opened|MindMapTourOffer':
    'The Mind Map tour was offered, as a small Tour toolbar beside a selected mind map node (counted once per visit).',
  'UI|Opened|FlowchartTourOffer':
    'The Flowchart tour was offered, as a small Tour toolbar beside a selected flowchart step (counted once per visit).',
  'UI|Opened|OrgChartTourOffer':
    'The Org Chart tour was offered, as a small Tour toolbar beside a selected person in an org chart (counted once per visit).',
  'UI|Opened|SequenceTourOffer':
    'The Sequence tour was offered, as a small Tour toolbar beside a selected sequence diagram (counted once per visit).',
  'UI|Opened|ChartTourOffer':
    'The Chart tour was offered, as a small Tour toolbar beside a selected chart (counted once per visit).',
  'UI|Opened|StackTourOffer':
    'The Stack tour was offered, as a small Tour toolbar beside a selected stack (counted once per visit).',
  'UI|Opened|EntityTourOffer':
    'The Entity tour was offered, as a small Tour toolbar beside a selected entity (counted once per visit).',
  'UI|Opened|TabWindowTourOffer':
    'The Tab Window tour was offered, as a small Tour toolbar beside a selected tab window (counted once per visit).',
  'UI|Opened|LaneTourOffer':
    'The Lane tour was offered, as a small Tour toolbar beside a selected lane (counted once per visit).',
  'UI|Opened|BoundaryTourOffer':
    'The Boundary tour was offered, as a small Tour toolbar beside a selected boundary (counted once per visit).',
  'UI|Opened|DiagramKeyTourOffer':
    'The Diagram Key tour was offered, as a small Tour toolbar beside a selected diagram key (counted once per visit).',
  'UI|Opened|PortalTourOffer':
    'The Portal tour was offered, as a small Tour toolbar beside a selected portal (counted once per visit).',
  'UI|Opened|SankeyTourOffer':
    'The Sankey tour was offered, as a small Tour toolbar beside a selected Sankey diagram (counted once per visit).',
  'UI|Opened|FormTourOffer':
    'The Forms tour was offered: as its own card the first time an Editor opened a Form tab, or replayed from Show Me Around in the form cog or Settings\' Tours › "Forms Tour".',
  'UI|Opened|WorkshopTourOffer':
    'The Workshop tour was offered: as its own card the first time someone worked in Workshop mode, or replayed from Settings\' Tours › "Workshop Tour". Until October 2026 it was also offered on the welcome tour\'s closing card ("Show me Workshop").',
  'UI|Opened|PlanTourOffer':
    'The Plan tour\'s offer card was shown, the first time someone worked in Plan mode with a board or sheet open, or replayed from Settings\' Tours › "Plan Tour".',
  'UI|Opened|activity':
    "Someone opened the help article about the Explorer's Inbox, from a help link or a search result.",
  'UI|Opened|api-tokens':
    'Someone opened the help article about API tokens, from a help link or a search result.',
  'UI|Opened|changing-theme':
    "Someone opened the help article about changing a tab's theme, from the Theme tab of the look-and-feel dialog or a search result.",
  'UI|Opened|choosing-fonts':
    'Someone opened the help article about choosing fonts, from the Font tab of the look-and-feel dialog or a search result.',
  'UI|Opened|connect-ai-mcp':
    'Someone opened the help article about connecting AI tools to the editor, from the AI panel or a search result.',
  'UI|Opened|image-gallery':
    'Someone opened the help article about the Image Gallery, from a help link or a search result.',
  'UI|Opened|import-tabs':
    'Someone opened the help article about importing tabs, from the Import Tab dialog or a search result.',
  'UI|Opened|minimap':
    'Someone opened the help article about the minimap, from a help link or a search result.',
  'UI|Opened|palette':
    'Someone opened the help article about the Palette, from a help link or a search result.',
  'UI|Opened|recent':
    "Someone opened the help article about the Explorer's Recent section, from a help link or a search result.",
  'UI|Opened|what-it-is':
    "Someone opened the help article explaining the editor's since-removed Activity panel (the change-log panel, not the Explorer section), from a help link or a search result.",
  'UI|Opened|your-first-diagram':
    'Someone opened the help article about building their first diagram, from the empty-canvas banner or a search result.',
  'UI|Removed|PaletteFavourite':
    'Someone removed a tile from their Favourites in the shape palette. No longer recorded: Favourites is gone.',
  'UI|Removed|Slide': 'Someone deleted a slide from the Slide Deck.',
  'UI|Searched|BehaviourSearch':
    "Someone searched within Session on Workshop mode's palette strip, across its groups of session tools. Earlier, a search within the palette's Collaborate tab (formerly Behaviours).",
  'UI|Searched|IconSearch': "Someone searched within the palette's Icons tab.",
  'UI|Searched|PaletteSearch':
    'Someone searched within their Favourites in the palette. No longer recorded: Favourites is gone.',
  'UI|Selected|WorkshopTourFromWelcome':
    "Someone pressed Show me Workshop on the welcome tour's closing card, going straight into the Workshop tour. Retired in October 2026, when the welcome tour became the Diagram tour and stopped running in Workshop.",
  'UI|Selected|PlanTourBoards':
    "Someone picked Boards on the Plan tour's first card, on a tab with both a board and a sheet (until October 2026, on every offer, touring an example board).",
  'UI|Selected|PlanTourSheets':
    "Someone picked Spreadsheets on the Plan tour's first card, on a tab with both a board and a sheet (until October 2026, on every offer, touring an example sheet).",
  // The Inbox was once the Activity row (docs/specs/013-workspace/explorer-structure.md#telemetry).
  'UI|Selected|Sidebar.Activity':
    "Someone picked the Activity row in the Explorer's sidebar, the row since renamed Inbox. No longer recorded: the row now counts as Inbox.",
  'UI|Selected|ExplorerPanel.Activity':
    "Someone picked the Activity row in the editor's Explorer panel, the row since renamed Inbox. No longer recorded: the row now counts as Inbox.",
  'UI|Selected|LiveImageTab':
    "Someone picked a specific tab from the dropdown in the Share dialog's Live Image menu, pointing the live-updating image at that tab instead of the default.",
  'UI|Selected|SignInBanner':
    'Someone clicked "Sign in" on the guest sign-in banner. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Selected|SignInBannerEditor':
    'Someone clicked "Sign in" on the guest sign-in banner shown in the editor.',
  'UI|Selected|SignInBannerExplorer':
    'Someone clicked "Sign in" on the guest sign-in banner shown in the Explorer.',
  'UI|Started|Presentation': 'Someone started presenting: entering full-screen slideshow mode.',
  'UI|Started|Tour':
    "Someone clicked past the Diagram tour's first card (the welcome tour's, until October 2026), beginning the step-by-step walkthrough.",
  'UI|Started|CardTypeTour':
    'Someone pressed Show Me in the card type editor, starting its tour of making a card type.',
  'UI|Started|DashboardTour':
    'Someone pressed Show Me in Dashboard Settings, starting its tour of arranging and filling a dashboard.',
  'UI|Started|SlideTour':
    "Someone pressed Show Me in a slide page's panel, starting its tour of layouts, backgrounds, the deck and presenting.",
  'UI|Started|InfographicTour':
    "Someone pressed Show Me in an infographic page's panel, starting its tour of layouts, backgrounds and page size.",
  'UI|Started|ArticleTour':
    "Someone pressed Show Me in an article page's panel, starting its tour of writing and article style.",
  'UI|Started|LogoTour':
    "Someone pressed Show Me in a logo page's panel, starting its tour of the logo tools.",
  'UI|Started|TabStyleTour':
    'Someone pressed Show Me in the Tab Style dialog, starting its tour of looks and fine-tuning.',
  'UI|Started|LayerStackTour':
    'Someone pressed Play on the Tour toolbar beside a selected layer stack, starting its tour.',
  'UI|Started|PyramidTour':
    'Someone pressed Play on the Tour toolbar beside a selected pyramid, starting its tour.',
  'UI|Started|FunnelTour':
    'Someone pressed Play on the Tour toolbar beside a selected funnel, starting its tour.',
  'UI|Started|CycleTour':
    'Someone pressed Play on the Tour toolbar beside a selected cycle, starting its tour.',
  'UI|Started|HubTour':
    'Someone pressed Play on the Tour toolbar beside a selected hub and spoke, starting its tour.',
  'UI|Started|OnionTour':
    'Someone pressed Play on the Tour toolbar beside a selected onion, starting its tour.',
  'UI|Started|TimelineTour':
    'Someone pressed Play on the Tour toolbar beside a selected timeline, starting its tour.',
  'UI|Started|ChevronsTour':
    'Someone pressed Play on the Tour toolbar beside a selected chevron process, starting its tour.',
  'UI|Started|MindMapTour':
    'Someone pressed Play on the Tour toolbar beside a selected mind map node, starting its tour.',
  'UI|Started|FlowchartTour':
    'Someone pressed Play on the Tour toolbar beside a selected flowchart step, starting its tour.',
  'UI|Started|OrgChartTour':
    'Someone pressed Play on the Tour toolbar beside a selected person in an org chart, starting its tour.',
  'UI|Started|SequenceTour':
    'Someone pressed Play on the Tour toolbar beside a selected sequence diagram, starting its tour.',
  'UI|Started|ChartTour':
    'Someone pressed Play on the Tour toolbar beside a selected chart, starting its tour.',
  'UI|Started|StackTour':
    'Someone pressed Play on the Tour toolbar beside a selected stack, starting its tour.',
  'UI|Started|EntityTour':
    'Someone pressed Play on the Tour toolbar beside a selected entity, starting its tour.',
  'UI|Started|TabWindowTour':
    'Someone pressed Play on the Tour toolbar beside a selected tab window, starting its tour.',
  'UI|Started|LaneTour':
    'Someone pressed Play on the Tour toolbar beside a selected lane, starting its tour.',
  'UI|Started|BoundaryTour':
    'Someone pressed Play on the Tour toolbar beside a selected boundary, starting its tour.',
  'UI|Started|DiagramKeyTour':
    'Someone pressed Play on the Tour toolbar beside a selected diagram key, starting its tour.',
  'UI|Started|PortalTour':
    'Someone pressed Play on the Tour toolbar beside a selected portal, starting its tour.',
  'UI|Started|SankeyTour':
    'Someone pressed Play on the Tour toolbar beside a selected Sankey diagram, starting its tour.',
  'UI|Started|SankeyFlowsTour':
    "Someone pressed Show Me in a Sankey's Flows dialog, starting its tour of writing flows.",
  'UI|Started|ShareTour':
    'Someone pressed Show Me in the Share dialog, starting its tour of issuing and managing passes.',
  'UI|Started|PagesTour':
    "Someone pressed Yes on the Pages tour's first card, beginning its walkthrough of the pages.",
  'UI|Started|AvatarTour':
    "Someone pressed Yes on the Avatar tour's first card, beginning its walkthrough of Avatar mode.",
  'UI|Started|FormTour':
    "Someone pressed Yes on the Forms tour's first card, beginning its walkthrough of the form builder.",
  'UI|Started|WorkshopTour':
    "Someone pressed Show me around on the Workshop tour's first card, beginning its walkthrough of the session kit.",
  'UI|Started|PlanTour':
    'Someone started the Plan tour from its first card, beginning its walkthrough of their own board or sheet (an example one until October 2026).',
  'UI|Toggled|ActivityRevertPreviewOff':
    'Someone turned off the hover preview that showed what a change would look like before reverting it, in the since-removed Activity panel settings.',
  'UI|Toggled|ActivityRevertPreviewOn':
    'Someone turned on the hover preview that showed what a change would look like before reverting it, in the since-removed Activity panel settings.',
  'UI|Toggled|AlignmentGuidesOff':
    'Someone turned off the alignment guides that appear while dragging elements, in Settings > Editor.',
  'UI|Toggled|AlignmentGuidesOn':
    'Someone turned on the alignment guides that appear while dragging elements, in Settings > Editor.',
  'UI|Toggled|AutoRebindOff': 'Someone turned off auto-attach for arrows, in Settings > Editor.',
  'UI|Toggled|AutoRebindOn': 'Someone turned on auto-attach for arrows, in Settings > Editor.',
  'UI|Toggled|Dark': "Someone set the editor's appearance to Dark.",
  'UI|Toggled|ExplorerViewCard':
    'Someone switched the Explorer to Card view, showing a large preview of each project.',
  'UI|Toggled|ExplorerViewDetails':
    'Someone switched the Explorer to Details view, a sortable table of type, comments, access, size and dates.',
  'UI|Toggled|ExplorerViewList':
    'Someone switched the Explorer to List view, showing projects as compact rows.',
  'UI|Toggled|HiddenLayersExport':
    'Someone turned on including hidden layers when exporting an image.',
  'UI|Toggled|IsometricExport':
    'Someone turned on tilting an exported image into the isometric projection.',
  'UI|Toggled|LayerCountOff':
    'Someone turned off the element-count badge on each layer, in Settings > Panels.',
  'UI|Toggled|LayerCountOn':
    'Someone turned on the element-count badge on each layer, in Settings > Panels.',
  'UI|Toggled|LayerHoverPreviewOff':
    "Someone turned off previewing a layer's contents on hover, in Settings > Panels.",
  'UI|Toggled|LayerHoverPreviewOn':
    "Someone turned on previewing a layer's contents on hover, in Settings > Panels.",
  'UI|Toggled|LayerPreviewOff':
    'Someone turned off layer thumbnails in the Layers panel, in Settings > Panels.',
  'UI|Toggled|LayerPreviewOn':
    'Someone turned on layer thumbnails in the Layers panel, in Settings > Panels.',
  'UI|Toggled|Light': "Someone set the editor's appearance to Light.",
  'UI|Toggled|MapDimOff':
    'Someone turned off dimming the part of the minimap outside the current view.',
  'UI|Toggled|MapDimOn':
    'Someone turned on dimming the part of the minimap outside the current view.',
  'UI|Toggled|MiddleMousePanOff':
    'Someone turned off panning the canvas by holding the middle mouse button, in Settings > Controls.',
  'UI|Toggled|MiddleMousePanOn':
    'Someone turned on panning the canvas by holding the middle mouse button, in Settings > Controls.',
  'UI|Toggled|MinimalPanelsOff':
    'Someone switched the panel layout back to Floating, from the quick toggle rather than the Settings dialog. No longer recorded: the Minimal layout was removed.',
  'UI|Toggled|MinimalPanelsOn':
    'Someone switched the panel layout to Minimal, from the quick toggle rather than the Settings dialog. No longer recorded: the Minimal layout was removed.',
  'UI|Toggled|MinimapOff': 'Someone turned off the minimap, in Settings > Editor.',
  'UI|Toggled|DockButtonNamesOff':
    'Someone turned off Button Labels in Settings > Appearance, so the bottom-right buttons show icons alone on a wide desktop.',
  'UI|Toggled|DockButtonNamesOn':
    'Someone turned Button Labels back on in Settings > Appearance, naming the bottom-right buttons beside their icons on a wide desktop.',
  'UI|Toggled|MinimapOn': 'Someone turned on the minimap, in Settings > Editor.',
  'UI|Toggled|HomeBannerOff':
    "Someone hid Explorer Home's banner, from its close button or Settings > Projects. Home then opens on its page header.",
  'UI|Toggled|HomeBannerOn':
    "Someone turned Explorer Home's banner back on, in Settings > Projects.",
  'UI|Toggled|NotificationsOff':
    'Someone turned off in-editor toast notifications, in Settings > Notifications.',
  'UI|Toggled|NotificationsOn':
    'Someone turned on in-editor toast notifications, in Settings > Notifications.',
  'UI|Toggled|NotifyActionAssignedOff':
    'Someone turned off the email that arrives when a teammate assigns them an action, in Settings > Notifications.',
  'UI|Toggled|NotifyActionAssignedOn':
    'Someone turned on the email that arrives when a teammate assigns them an action, in Settings > Notifications.',
  'UI|Toggled|ShowProfilePictureOff':
    'Someone stopped showing their profile picture to collaborators, in Settings > Account.',
  'UI|Toggled|ShowProfilePictureOn':
    'Someone started showing their profile picture to collaborators again, in Settings > Account.',
  'UI|Toggled|NotifyFormResponsesOff':
    'Someone turned off the email they get when somebody fills in one of their forms.',
  'UI|Toggled|NotifyFormResponsesOn':
    'Someone turned back on the email they get when somebody fills in one of their forms.',
  'UI|Toggled|NotifyMentionsOff':
    'Someone turned off the email that arrives when a teammate @-mentions them in a comment, in Settings > Notifications.',
  'UI|Toggled|NotifyMentionsOn':
    'Someone turned on the email that arrives when a teammate @-mentions them in a comment, in Settings > Notifications.',
  'UI|Toggled|NotifyCommentsOff':
    'Someone turned off the email that arrives when someone comments on a project they own, in Settings > Notifications.',
  'UI|Toggled|NotifyCommentsOn':
    'Someone turned on the email that arrives when someone comments on a project they own, in Settings > Notifications.',
  'UI|Toggled|NotifyProjectJoinOff':
    'Someone turned off the email that arrives when a new person opens one of their shared projects, in Settings > Notifications.',
  'UI|Toggled|NotifyProjectJoinOn':
    'Someone turned on the email that arrives when a new person opens one of their shared projects, in Settings > Notifications.',
  'UI|Toggled|NotifyInviteResponseOff':
    'Someone turned off the email that arrives when a team invite they sent is accepted or declined, in Settings > Notifications.',
  'UI|Toggled|NotifyInviteResponseOn':
    'Someone turned on the email that arrives when a team invite they sent is accepted or declined, in Settings > Notifications.',
  'UI|Toggled|NotifyMilestonesOff':
    'Someone turned off milestone emails, in Settings > Notifications.',
  'UI|Toggled|NotifyMilestonesOn':
    'Someone turned on milestone emails, in Settings > Notifications.',
  'UI|Toggled|NotifyTipsOff':
    'Someone turned off the occasional tips-and-check-in emails, in Settings > Notifications.',
  'UI|Toggled|NotifyTipsOn':
    'Someone turned on the occasional tips-and-check-in emails, in Settings > Notifications.',
  'UI|Toggled|PaletteFavouritesEdit':
    'Someone entered reordering or editing mode for their palette Favourites. No longer recorded: Favourites is gone.',
  'UI|Toggled|PatternExport':
    "Someone turned on painting the tab's background pattern into an exported image.",
  'UI|Toggled|QuickAddHoverOff':
    'Someone turned off quick-add on hover in the palette, in Settings > Editor.',
  'UI|Toggled|QuickAddHoverOn':
    'Someone turned on quick-add on hover in the palette, in Settings > Editor.',
  'UI|Toggled|PagesModeOff':
    'Someone turned off Pages mode, in Settings > Experimental. No longer recorded: Pages mode is always offered.',
  'UI|Toggled|PagesModeOn':
    'Someone turned on Pages mode, in Settings > Experimental. No longer recorded: Pages mode is always offered.',
  'UI|Toggled|PlanModeOff':
    'Someone turned off Plan mode, in Settings > Experimental. No longer recorded: Plan mode is always offered.',
  'UI|Toggled|PlanModeOn':
    'Someone turned on Plan mode, in Settings > Experimental. No longer recorded: Plan mode is always offered.',
  'UI|Toggled|ReduceMotionOff': 'Someone turned off reduced motion, in Settings > Accessibility.',
  'UI|Toggled|ReduceMotionOn': 'Someone turned on reduced motion, in Settings > Accessibility.',
  'UI|Toggled|ShortcutsOff': 'Someone turned off keyboard shortcuts, in Settings > Keyboard.',
  'UI|Toggled|ShortcutsOn': 'Someone turned on keyboard shortcuts, in Settings > Keyboard.',
  'UI|Toggled|SkipLocationStepOff':
    'Someone turned off skipping the Location step, in Settings > Projects, so the New Project wizard asks where each project goes again.',
  'UI|Toggled|SkipLocationStepOn':
    'Someone ticked "Always save new projects in <place> and skip this step" on the New Project wizard\'s Location step.',
  'UI|Toggled|SlideHidden':
    'Someone hid a slide from the presentation run, without deleting it, in the Slide Deck panel.',
  'UI|Toggled|SlideShown':
    'Someone unhid a slide, putting it back into the presentation run, in the Slide Deck panel.',
  'UI|Toggled|System': "Someone set the editor's appearance to follow the system.",
  'UI|Toggled|TemplateModeAll':
    'Someone set the New Project template filter back to Everything, showing templates for every mode.',
  'UI|Toggled|TemplateModeDiagram':
    'Someone narrowed the New Project templates to the ones that open in Diagram mode.',
  'UI|Toggled|TemplateModeDraw':
    'Someone narrowed the New Project templates to the ones that open in Draw mode.',
  'UI|Toggled|TemplateModePages':
    'Someone narrowed the New Project templates to the ones that open in Pages mode.',
  'UI|Toggled|TemplateModePlan':
    'Someone narrowed the New Project templates to the ones that open in Plan mode.',
  'UI|Toggled|TemplateModeWorkshop':
    'Someone narrowed the New Project templates to the ones that open in Workshop mode.',
  'UI|Toggled|TemplateShelfCollapsed':
    'Someone put the New Project template shelf back to a carousel, with the other categories as a grid.',
  'UI|Toggled|TemplateShelfExpanded':
    'Someone expanded the New Project template shelf to show every template in the category, with the other categories as a carousel.',
  'UI|Toggled|TelemetryOff':
    'Someone opted out of sending anonymous usage events, in Settings > Privacy.',
  'UI|Toggled|TelemetryOn':
    'Someone opted in to sending anonymous usage events, in Settings > Privacy.',
  'UI|Toggled|TourSeenOff':
    'Someone switched on Tours › "Diagram Tour" ("Welcome" until October 2026) in Settings, marking the Diagram tour as not yet seen and relaunching it on a Diagram tab.',
  'UI|Toggled|TourSeenOn':
    'Someone switched off Tours › "Diagram Tour" ("Welcome" until October 2026) in Settings, or the tour resolved on its own, marking it as seen so it won\'t be offered again.',
  'UI|Toggled|PagesTourSeenOff':
    'Someone switched on Tours › "Pages Tours" in Settings (the switch over every kind of page; "Pages Tour" until October 2026), so every kind\'s Pages tour is offered again.',
  'UI|Toggled|PagesTourSeenOn':
    'Someone switched off Tours › "Pages Tours" in Settings (the switch over every kind of page; "Pages Tour" until October 2026), answering every kind\'s Pages tour.',
  'UI|Toggled|SlidesTourSeenOff':
    'Someone switched on Tours › "Slides Tour" in Settings, so the Pages tour\'s slides track is offered again.',
  'UI|Toggled|SlidesTourSeenOn':
    'Someone switched off Tours › "Slides Tour" in Settings, marking the Pages tour\'s slides track as answered.',
  'UI|Toggled|InfographicTourSeenOff':
    'Someone switched on Tours › "Infographic Tour" in Settings, so the Pages tour\'s infographic track is offered again.',
  'UI|Toggled|InfographicTourSeenOn':
    'Someone switched off Tours › "Infographic Tour" in Settings, marking the Pages tour\'s infographic track as answered.',
  'UI|Toggled|ArticleTourSeenOff':
    'Someone switched on Tours › "Article Tour" in Settings, so the Pages tour\'s article track is offered again.',
  'UI|Toggled|ArticleTourSeenOn':
    'Someone switched off Tours › "Article Tour" in Settings, marking the Pages tour\'s article track as answered.',
  'UI|Toggled|LogoTourSeenOff':
    'Someone switched on Tours › "Logo Tour" in Settings, so the Pages tour\'s logo track is offered again.',
  'UI|Toggled|LogoTourSeenOn':
    'Someone switched off Tours › "Logo Tour" in Settings, marking the Pages tour\'s logo track as answered.',
  'UI|Toggled|AvatarTourSeenOff':
    'Someone switched on Tours › "Avatar Tour" in Settings, marking the Avatar tour as not yet seen.',
  'UI|Toggled|AvatarTourSeenOn':
    'Someone switched off Tours › "Avatar Tour" in Settings, marking the Avatar tour as seen.',
  'UI|Toggled|ElementToursSeenOff':
    'Someone switched on Tours › Element Tours in Settings, so every element tour is offered again.',
  'UI|Toggled|ElementToursSeenOn':
    'Someone switched off Tours › Element Tours in Settings, so no element tour is offered.',
  'UI|Toggled|LayerStackTourSeenOff':
    'Someone switched on Tours › Element Tours › "Layer Stack Tour" in Settings, so it is offered again.',
  'UI|Toggled|LayerStackTourSeenOn':
    'Someone switched off Tours › Element Tours › "Layer Stack Tour" in Settings, so it is not offered.',
  'UI|Toggled|PyramidTourSeenOff':
    'Someone switched on Tours › Element Tours › "Pyramid Tour" in Settings, so it is offered again.',
  'UI|Toggled|PyramidTourSeenOn':
    'Someone switched off Tours › Element Tours › "Pyramid Tour" in Settings, so it is not offered.',
  'UI|Toggled|FunnelTourSeenOff':
    'Someone switched on Tours › Element Tours › "Funnel Tour" in Settings, so it is offered again.',
  'UI|Toggled|FunnelTourSeenOn':
    'Someone switched off Tours › Element Tours › "Funnel Tour" in Settings, so it is not offered.',
  'UI|Toggled|CycleTourSeenOff':
    'Someone switched on Tours › Element Tours › "Cycle Tour" in Settings, so it is offered again.',
  'UI|Toggled|CycleTourSeenOn':
    'Someone switched off Tours › Element Tours › "Cycle Tour" in Settings, so it is not offered.',
  'UI|Toggled|HubTourSeenOff':
    'Someone switched on Tours › Element Tours › "Hub and Spoke Tour" in Settings, so it is offered again.',
  'UI|Toggled|HubTourSeenOn':
    'Someone switched off Tours › Element Tours › "Hub and Spoke Tour" in Settings, so it is not offered.',
  'UI|Toggled|OnionTourSeenOff':
    'Someone switched on Tours › Element Tours › "Onion Tour" in Settings, so it is offered again.',
  'UI|Toggled|OnionTourSeenOn':
    'Someone switched off Tours › Element Tours › "Onion Tour" in Settings, so it is not offered.',
  'UI|Toggled|TimelineTourSeenOff':
    'Someone switched on Tours › Element Tours › "Timeline Tour" in Settings, so it is offered again.',
  'UI|Toggled|TimelineTourSeenOn':
    'Someone switched off Tours › Element Tours › "Timeline Tour" in Settings, so it is not offered.',
  'UI|Toggled|ChevronsTourSeenOff':
    'Someone switched on Tours › Element Tours › "Chevrons Tour" in Settings, so it is offered again.',
  'UI|Toggled|ChevronsTourSeenOn':
    'Someone switched off Tours › Element Tours › "Chevrons Tour" in Settings, so it is not offered.',
  'UI|Toggled|MindMapTourSeenOff':
    'Someone switched on Tours › Element Tours › "Mind Map Tour" in Settings, so it is offered again.',
  'UI|Toggled|MindMapTourSeenOn':
    'Someone switched off Tours › Element Tours › "Mind Map Tour" in Settings, so it is not offered.',
  'UI|Toggled|FlowchartTourSeenOff':
    'Someone switched on Tours › Element Tours › "Flowchart Tour" in Settings, so it is offered again.',
  'UI|Toggled|FlowchartTourSeenOn':
    'Someone switched off Tours › Element Tours › "Flowchart Tour" in Settings, so it is not offered.',
  'UI|Toggled|OrgChartTourSeenOff':
    'Someone switched on Tours › Element Tours › "Org Chart Tour" in Settings, so it is offered again.',
  'UI|Toggled|OrgChartTourSeenOn':
    'Someone switched off Tours › Element Tours › "Org Chart Tour" in Settings, so it is not offered.',
  'UI|Toggled|SequenceTourSeenOff':
    'Someone switched on Tours › Element Tours › "Sequence Tour" in Settings, so it is offered again.',
  'UI|Toggled|SequenceTourSeenOn':
    'Someone switched off Tours › Element Tours › "Sequence Tour" in Settings, so it is not offered.',
  'UI|Toggled|ChartTourSeenOff':
    'Someone switched on Tours › Element Tours › "Chart Tour" in Settings, so it is offered again.',
  'UI|Toggled|ChartTourSeenOn':
    'Someone switched off Tours › Element Tours › "Chart Tour" in Settings, so it is not offered.',
  'UI|Toggled|StackTourSeenOff':
    'Someone switched on Tours › Element Tours › "Stack Tour" in Settings, so it is offered again.',
  'UI|Toggled|StackTourSeenOn':
    'Someone switched off Tours › Element Tours › "Stack Tour" in Settings, so it is not offered.',
  'UI|Toggled|EntityTourSeenOff':
    'Someone switched on Tours › Element Tours › "Entity Tour" in Settings, so it is offered again.',
  'UI|Toggled|EntityTourSeenOn':
    'Someone switched off Tours › Element Tours › "Entity Tour" in Settings, so it is not offered.',
  'UI|Toggled|TabWindowTourSeenOff':
    'Someone switched on Tours › Element Tours › "Tab Window Tour" in Settings, so it is offered again.',
  'UI|Toggled|TabWindowTourSeenOn':
    'Someone switched off Tours › Element Tours › "Tab Window Tour" in Settings, so it is not offered.',
  'UI|Toggled|LaneTourSeenOff':
    'Someone switched on Tours › Element Tours › "Lane Tour" in Settings, so it is offered again.',
  'UI|Toggled|LaneTourSeenOn':
    'Someone switched off Tours › Element Tours › "Lane Tour" in Settings, so it is not offered.',
  'UI|Toggled|BoundaryTourSeenOff':
    'Someone switched on Tours › Element Tours › "Boundary Tour" in Settings, so it is offered again.',
  'UI|Toggled|BoundaryTourSeenOn':
    'Someone switched off Tours › Element Tours › "Boundary Tour" in Settings, so it is not offered.',
  'UI|Toggled|DiagramKeyTourSeenOff':
    'Someone switched on Tours › Element Tours › "Diagram Key Tour" in Settings, so it is offered again.',
  'UI|Toggled|DiagramKeyTourSeenOn':
    'Someone switched off Tours › Element Tours › "Diagram Key Tour" in Settings, so it is not offered.',
  'UI|Toggled|PortalTourSeenOff':
    'Someone switched on Tours › Element Tours › "Portal Tour" in Settings, so it is offered again.',
  'UI|Toggled|PortalTourSeenOn':
    'Someone switched off Tours › Element Tours › "Portal Tour" in Settings, so it is not offered.',
  'UI|Toggled|SankeyTourSeenOff':
    'Someone switched on Tours › Element Tours › "Sankey Diagram Tour" in Settings, so it is offered again.',
  'UI|Toggled|SankeyTourSeenOn':
    'Someone switched off Tours › Element Tours › "Sankey Diagram Tour" in Settings, so it is not offered.',
  'UI|Toggled|FormTourSeenOff':
    'Someone switched on Tours › "Forms Tour" in Settings, marking the Forms tour as not yet seen.',
  'UI|Toggled|FormTourSeenOn':
    'Someone switched off Tours › "Forms Tour" in Settings, marking the Forms tour as seen.',
  'UI|Toggled|WorkshopTourSeenOff':
    'Someone switched on Tours › "Workshop Tour" in Settings, marking the Workshop tour as not yet seen.',
  'UI|Toggled|WorkshopTourSeenOn':
    'Someone switched off Tours › "Workshop Tour" in Settings, marking the Workshop tour as seen.',
  'UI|Toggled|PlanTourSeenOff':
    'Someone switched on Tours › "Plan Tours" in Settings (the switch over Boards Tour, Sheets Tour and Dashboards Tour; "Plan Tour" until October 2026), so each is offered again.',
  'UI|Toggled|PlanTourSeenOn':
    'Someone switched off Tours › "Plan Tours" in Settings (the switch over Boards Tour, Sheets Tour and Dashboards Tour; "Plan Tour" until October 2026), answering each.',
  'UI|Toggled|BoardsTourSeenOff':
    'Someone switched on Tours › "Boards Tour" in Settings, so the Plan tour\'s boards track is offered again.',
  'UI|Toggled|BoardsTourSeenOn':
    'Someone switched off Tours › "Boards Tour" in Settings, marking the Plan tour\'s boards track as answered.',
  'UI|Toggled|SheetsTourSeenOff':
    'Someone switched on Tours › "Sheets Tour" in Settings, so the Plan tour\'s sheets track is offered again.',
  'UI|Toggled|SheetsTourSeenOn':
    'Someone switched off Tours › "Sheets Tour" in Settings, marking the Plan tour\'s sheets track as answered.',
  'UI|Toggled|DashboardsTourSeenOff':
    'Someone switched on Tours › "Dashboards Tour" in Settings, so the Dashboards tour is offered again on a dashboard.',
  'UI|Toggled|DashboardsTourSeenOn':
    'Someone switched off Tours › "Dashboards Tour" in Settings, marking the Dashboards tour as answered.',
  'UI|Opened|DashboardTourOffer':
    'The Dashboards tour offered itself, the first time an Editor had a dashboard open in Plan.',
  'UI|Closed|DashboardTourOffer': 'Someone declined the Dashboards tour from its welcome card.',
  'UI|Toggled|LandscapeBarsOff':
    'Someone folded the header and the tab bar away again from the handle on a phone held sideways, giving the canvas the whole screen.',
  'UI|Toggled|LandscapeBarsOn':
    'Someone showed the header and the tab bar from the handle on a phone held sideways, where they fold away so the canvas fills the screen.',
  'UI|Toggled|ZenModeOff': "Someone turned off zen mode, restoring the editor's chrome.",
  'UI|Toggled|ZenModeOn':
    "Someone turned on zen mode, hiding the editor's chrome for a distraction-free canvas.",
  'UI|Used|JustDraw':
    'Someone landed on the New Project page through a link that skips the wizard and goes straight into a blank project.',
  'UI|Used|StartOtherMode':
    "Someone searching an empty tab's start chose a template the search found in another mode, which switched the tab to that mode.",
  'UI|Used|TemplateLink':
    'Someone landed on the New Project page through a link that skips the wizard and goes straight into a specific template.',
  'UI|View|PagesTourStepPageName':
    'The Pages tour reached its "Your Pages" step, on the first page\'s name.',
  'UI|View|PagesTourStepPageSettings':
    'The Pages tour reached its "Page Settings" step, on the first page\'s cog.',
  'UI|View|PagesTourStepAddPage':
    'The Pages tour reached its "Add a Page" step, on the + after the last page.',
  'UI|View|PagesTourStepSlides':
    'The Pages tour reached its "Slides" step, on the Slides button in the bottom-right cluster.',
  'UI|View|PagesTourStepOutro':
    'The Pages tour reached its closing "You\'re ready to make pages" card.',
  'UI|View|PagesTourStepSlideLayouts':
    'The Pages tour\'s slides track reached its "Choose a Layout" step, with the slide\'s Layout popover open.',
  'UI|View|PagesTourStepSlideBackground':
    'The Pages tour\'s slides track reached its "Change the Background" step, with the slide\'s Background popover open.',
  'UI|View|PagesTourStepSlideDeck':
    'The Pages tour\'s slides track reached its "Add It to the Deck" step, on the slide\'s deck button (retired in October 2026 for the speaker notes step: every slide of a deck is in it already).',
  'UI|View|PagesTourStepSlideNotes':
    'The Pages tour\'s slides track reached its "Write Your Speaker Notes" step, with the slide\'s notes popover open.',
  'UI|View|PagesTourStepSlideAddPage':
    'The Pages tour\'s slides track reached its "Add Another Slide" step, on the + after the last page.',
  'UI|View|PagesTourStepSlidePresent':
    'The Pages tour\'s slides track reached its "Present" step, with the Slide Deck open.',
  'UI|View|PagesTourStepSlideOutro':
    'The Pages tour\'s slides track reached its closing "You\'re ready to present" card.',
  'UI|View|PagesTourStepInfographicPageName':
    'The Pages tour\'s infographic track reached its "Your Page" step, on the page\'s name.',
  'UI|View|PagesTourStepInfographicLayouts':
    'The Pages tour\'s infographic track reached its "Start From a Layout" step, with the page\'s Layout popover open.',
  'UI|View|PagesTourStepInfographicBackground':
    'The Pages tour\'s infographic track reached its "Change the Background" step, with the page\'s Background popover open.',
  'UI|View|PagesTourStepInfographicPageSize':
    'The Pages tour\'s infographic track reached its "Page Size" step, with the page\'s settings open.',
  'UI|View|PagesTourStepInfographicAddPage':
    'The Pages tour\'s infographic track reached its "Add a Page" step, on the + after the last page.',
  'UI|View|PagesTourStepInfographicPresent':
    'The Pages tour\'s infographic track reached its "Present It" step, with the Slide Deck open.',
  'UI|View|PagesTourStepInfographicOutro':
    'The Pages tour\'s infographic track reached its closing "You\'re ready to make pages" card.',
  'UI|View|PagesTourStepArticleWrite':
    'The Pages tour\'s article track reached its "Write on the Page" step, on the article page.',
  'UI|View|PagesTourStepArticleToolbar':
    'The Pages tour\'s article track reached its "The Page Toolbar" step.',
  'UI|View|PagesTourStepArticleStyle':
    'The Pages tour\'s article track reached its "Article Style" step, with the page\'s Style settings open.',
  'UI|View|PagesTourStepArticleText':
    'The Pages tour\'s article track reached its "Fonts and Spacing" step, with the page\'s Text settings open.',
  'UI|View|PagesTourStepArticleOutro':
    'The Pages tour\'s article track reached its closing "You\'re ready to write" card.',
  'UI|View|PagesTourStepLogoLayouts':
    'The Pages tour\'s logo track reached its "Start From a Logo Layout" step, with the page\'s Layouts open.',
  'UI|View|PagesTourStepLogoGuides':
    'The Pages tour\'s logo track reached its "Draw on Guides" step, on the Guides button.',
  'UI|View|PagesTourStepLogoMirror':
    'The Pages tour\'s logo track reached its "Mirror As You Draw" step, on the Mirror button.',
  'UI|View|PagesTourStepLogoCombine':
    'The Pages tour\'s logo track reached its "Combine Shapes" step.',
  'UI|View|PagesTourStepLogoOutro':
    'The Pages tour\'s logo track reached its closing "That Is a Logo Page" card.',
  'UI|View|AvatarTourStepAvatarButton':
    'The Avatar tour reached its "Your Avatar" step, on the Avatar button.',
  'UI|View|AvatarTourStepCharacter':
    'The Avatar tour reached its "Make It Yours" step, on the character sheet.',
  'UI|View|AvatarTourStepActions': 'The Avatar tour reached its "Behaviour and Reactions" step.',
  'UI|View|AvatarTourStepMessage':
    'The Avatar tour reached its "Say Something" step, on Send a Message.',
  'UI|View|AvatarTourStepPush':
    'The Avatar tour reached its "Give Someone a Push" step, on the person\'s own character.',
  'UI|View|AvatarTourStepOutro':
    'The Avatar tour reached its closing "You\'re Ready to Roam" card.',
  'UI|View|LayerStackTourStepLayers':
    'The Layer Stack tour reached its "One Element, Many Layers" step, on the whole stack.',
  'UI|View|LayerStackTourStepEdit':
    'The Layer Stack tour reached its "Type Over a Layer" step, on the top layer\'s name.',
  'UI|View|LayerStackTourStepNotes':
    'The Layer Stack tour reached its "Side Notes" step, on a layer\'s side note.',
  'UI|View|LayerStackTourStepAdd':
    'The Layer Stack tour reached its "Add a Layer" step, with the "+" ring open on Add Layer.',
  'UI|View|LayerStackTourStepRows':
    'The Layer Stack tour reached its "Reorder in the Menu" step, on the selection toolbar\'s More button.',
  'UI|View|LayerStackTourStepColours':
    'The Layer Stack tour reached its "One Colour, a Whole Ramp" step, on the bottom layer.',
  'UI|View|LayerStackTourStepAnimate':
    'The Layer Stack tour reached its "Build It Up" step, playing the Build animation on the stack.',
  'UI|View|LayerStackTourStepOutro':
    'The Layer Stack tour reached its closing "That Is a Layer Stack" card.',
  'UI|View|PyramidTourStepTiers':
    'The Pyramid tour reached its "Tiers Cut From One Triangle" step, on the whole pyramid.',
  'UI|View|PyramidTourStepEdit':
    'The Pyramid tour reached its "Type Over a Tier" step, on the first tier\'s name.',
  'UI|View|PyramidTourStepAdd':
    'The Pyramid tour reached its "Add a Tier" step, with the "+" ring open on Add Tier.',
  'UI|View|PyramidTourStepShape':
    'The Pyramid tour reached its "Pyramid, Inverted or Funnel" step, on the selection toolbar\'s More button.',
  'UI|View|PyramidTourStepColours':
    'The Pyramid tour reached its "From the Accent Down" step, on the last tier.',
  'UI|View|PyramidTourStepAnimate':
    'The Pyramid tour reached its Build step, playing the Build animation on the pyramid.',
  'UI|View|PyramidTourStepOutro': 'The Pyramid tour reached its closing card.',
  'UI|View|FunnelTourStepStages':
    'The Funnel tour reached its "Narrowing Stage by Stage" step, on the whole funnel.',
  'UI|View|FunnelTourStepEdit':
    'The Funnel tour reached its "Type Over a Stage" step, on the first band\'s name.',
  'UI|View|FunnelTourStepValues':
    'The Funnel tour reached its "A Number on Each Band" step, on a band\'s value.',
  'UI|View|FunnelTourStepAdd':
    'The Funnel tour reached its "Add a Stage" step, with the "+" ring open on Add Tier.',
  'UI|View|FunnelTourStepShape':
    'The Funnel tour reached its "Funnel, Pyramid or Inverted" step, on the selection toolbar\'s More button.',
  'UI|View|FunnelTourStepColours':
    'The Funnel tour reached its "From the Accent Down" step, on the last band.',
  'UI|View|FunnelTourStepAnimate':
    'The Funnel tour reached its "Pour It In" step, playing the Build animation on the funnel.',
  'UI|View|FunnelTourStepOutro': 'The Funnel tour reached its closing "That Is a Funnel" card.',
  'UI|View|CycleTourStepLoop':
    'The Cycle tour reached its "A Loop, Clockwise" step, on the whole cycle.',
  'UI|View|CycleTourStepFirst':
    'The Cycle tour reached its "Where It Starts" step, on the first step.',
  'UI|View|CycleTourStepCentre':
    'The Cycle tour reached its "Name the Loop" step, on the words in the middle.',
  'UI|View|CycleTourStepAdd':
    'The Cycle tour reached its "Add a Step" step, with the "+" ring open on Add Step.',
  'UI|View|CycleTourStepRows':
    'The Cycle tour reached its "Reorder in the Menu" step, on the selection toolbar\'s More button.',
  'UI|View|CycleTourStepAnimate':
    'The Cycle tour reached its "Set It Turning" step, playing the Flow animation on the cycle.',
  'UI|View|CycleTourStepOutro': 'The Cycle tour reached its closing "That Is a Cycle" card.',
  'UI|View|HubTourStepHub':
    'The Hub and Spoke tour reached its "One Thing in the Middle" step, on the hub.',
  'UI|View|HubTourStepSatellites':
    'The Hub and Spoke tour reached its "Round It, Clockwise" step, on the whole hub and spoke.',
  'UI|View|HubTourStepEdit':
    'The Hub and Spoke tour reached its "Type Over a Satellite" step, on the first satellite.',
  'UI|View|HubTourStepAdd':
    'The Hub and Spoke tour reached its "Add a Satellite" step, with the "+" ring open on Add Satellite.',
  'UI|View|HubTourStepSpokes':
    'The Hub and Spoke tour reached its "Spokes or None" step, on the selection toolbar\'s More button.',
  'UI|View|HubTourStepAnimate':
    'The Hub and Spoke tour reached its "Light Them Up" step, playing the Pulse animation on the hub.',
  'UI|View|HubTourStepOutro':
    'The Hub and Spoke tour reached its closing "That Is a Hub and Spoke" card.',
  'UI|View|OnionTourStepRings':
    'The Onion tour reached its "Nested, Not Overlapping" step, on the whole onion.',
  'UI|View|OnionTourStepCore': 'The Onion tour reached its "The Core" step, on the core\'s name.',
  'UI|View|OnionTourStepOuter':
    'The Onion tour reached its "Outward From There" step, on the outermost ring\'s name.',
  'UI|View|OnionTourStepAdd':
    'The Onion tour reached its "Add a Ring" step, with the "+" ring open on Add Ring.',
  'UI|View|OnionTourStepRows':
    'The Onion tour reached its "Reorder in the Menu" step, on the selection toolbar\'s More button.',
  'UI|View|OnionTourStepAnimate':
    'The Onion tour reached its "Ripple Outward" step, playing the Pulse animation on the onion.',
  'UI|View|OnionTourStepOutro': 'The Onion tour reached its closing "That Is an Onion" card.',
  'UI|View|TimelineTourStepLine':
    'The Timeline tour reached its "Along One Line" step, on the whole timeline.',
  'UI|View|TimelineTourStepName':
    'The Timeline tour reached its "What Happens" step, on the first milestone\'s name.',
  'UI|View|TimelineTourStepWhen':
    'The Timeline tour reached its "And When" step, on the first milestone\'s when.',
  'UI|View|TimelineTourStepAdd':
    'The Timeline tour reached its "Add a Milestone" step, the "+" ring open on Add Milestone.',
  'UI|View|TimelineTourStepRows':
    'The Timeline tour reached its "Reorder in the Menu" step, on More.',
  'UI|View|TimelineTourStepAnimate':
    'The Timeline tour reached its "Play It in Order" step, previewing Build.',
  'UI|View|TimelineTourStepOutro':
    'The Timeline tour reached its closing "That Is a Timeline" card.',
  'UI|View|ChevronsTourStepStages':
    'The Chevrons tour reached its "Stages, Left to Right" step, on the whole process.',
  'UI|View|ChevronsTourStepEdit':
    'The Chevrons tour reached its "Type Over a Stage" step, on the first stage\'s name.',
  'UI|View|ChevronsTourStepBar':
    'The Chevrons tour reached its "Each Stage\'s Own Bar" step, with a stage\'s bar held open.',
  'UI|View|ChevronsTourStepNotes':
    'The Chevrons tour reached its "A Note Under Each" step, on a stage\'s note.',
  'UI|View|ChevronsTourStepAdd':
    'The Chevrons tour reached its "Add a Stage" step, with the "+" ring open on Add Stage.',
  'UI|View|ChevronsTourStepAnimate':
    'The Chevrons tour reached its "Run the Pipeline" step, playing the Pulse animation on the process.',
  'UI|View|ChevronsTourStepOutro':
    'The Chevrons tour reached its closing "That Is a Chevron Process" card.',
  'UI|View|MindMapTourStepNode':
    'The Mind Map tour reached its "A Node That Knows Its Parent" step, on the selected node.',
  'UI|View|MindMapTourStepChild':
    'The Mind Map tour reached its "Grow a Child" step, on the toolbar\'s Add Child.',
  'UI|View|MindMapTourStepSibling':
    'The Mind Map tour reached its "Add a Sibling" step, on the toolbar\'s Add Sibling.',
  'UI|View|MindMapTourStepBranch':
    'The Mind Map tour reached its branch-moving step, on the selected node.',
  'UI|View|MindMapTourStepMenu':
    'The Mind Map tour reached its "The Mind Map Menu" step, on the selection toolbar\'s More button.',
  'UI|View|MindMapTourStepOutro':
    'The Mind Map tour reached its closing "That Is a Mind Map" card.',
  'UI|View|FlowchartTourStepStep':
    'The Flowchart tour reached its "A Step in a Flowchart" step, on the selected step.',
  'UI|View|FlowchartTourStepNext':
    'The Flowchart tour reached its "The Next Step" step, on the toolbar\'s Add Step.',
  'UI|View|FlowchartTourStepBranch':
    'The Flowchart tour reached its "Add a Branch" step, on the toolbar\'s Add Branch.',
  'UI|View|FlowchartTourStepType':
    'The Flowchart tour reached its "Change Its Type" step, on the toolbar\'s Step Type.',
  'UI|View|FlowchartTourStepLane':
    'The Flowchart tour reached its "Its Lane" step, on the toolbar\'s Lane.',
  'UI|View|FlowchartTourStepMenu':
    'The Flowchart tour reached its "The Flowchart Menu" step, on the selection toolbar\'s More button.',
  'UI|View|FlowchartTourStepOutro':
    'The Flowchart tour reached its closing "That Is a Flowchart" card.',
  'UI|View|OrgChartTourStepPerson':
    'The Org Chart tour reached its "A Person in the Chart" step, on the selected person.',
  'UI|View|OrgChartTourStepRole':
    'The Org Chart tour reached its "Their Role" step, on the role line.',
  'UI|View|OrgChartTourStepInitials':
    'The Org Chart tour reached its "Initials, Made for You" step, on the initials disc.',
  'UI|View|OrgChartTourStepReport':
    'The Org Chart tour reached its "Add a Report" step, on the toolbar\'s Add Child.',
  'UI|View|OrgChartTourStepPeer':
    'The Org Chart tour reached its "Add a Peer" step, on the toolbar\'s Add Sibling.',
  'UI|View|OrgChartTourStepTeam':
    'The Org Chart tour reached its team-moving step, on the selected person.',
  'UI|View|OrgChartTourStepMenu':
    'The Org Chart tour reached its "The Mind Map Menu" step, on the selection toolbar\'s More button.',
  'UI|View|OrgChartTourStepOutro':
    'The Org Chart tour reached its closing "That Is an Org Chart" card.',
  'UI|View|SequenceTourStepDiagram':
    'The Sequence tour reached its "Who Calls Whom" step, on the whole diagram.',
  'UI|View|SequenceTourStepMenu':
    'The Sequence tour reached its "The Sequence Menu" step, on the selection toolbar\'s More button.',
  'UI|View|SequenceTourStepWrite':
    'The Sequence tour reached its "Write It as a List" step, on the whole diagram.',
  'UI|View|SequenceTourStepParticipants':
    'The Sequence tour reached its "The Participants" step, inside the Sequence dialog it opened.',
  'UI|View|SequenceTourStepMessages':
    'The Sequence tour reached its "A Row a Message" step, inside the Sequence dialog.',
  'UI|View|SequenceTourStepKind':
    'The Sequence tour reached its "Call, Async or Reply" step, on a message\'s kind.',
  'UI|View|SequenceTourStepAdd':
    'The Sequence tour reached its "Add a Message" step, inside the Sequence dialog.',
  'UI|View|SequenceTourStepText':
    'The Sequence tour reached its "Or Type It" step, on the Sequence dialog\'s Text tab.',
  'UI|View|SequenceTourStepPreview':
    'The Sequence tour reached its "Live Preview" step, inside the Sequence dialog.',
  'UI|View|SequenceTourStepNumbered':
    'The Sequence tour reached its "Number Them" step, on Numbered.',
  'UI|View|SequenceTourStepOutro':
    'The Sequence tour reached its closing "That Is a Sequence Diagram" card.',
  'UI|View|ChartTourStepChart':
    'The Chart tour reached its first step, how a chart is sized by value.',
  'UI|View|ChartTourStepReadout':
    "The Chart tour reached its step on reading a mark's label and value.",
  'UI|View|ChartTourStepAnimate': 'The Chart tour reached its step previewing Grow on the chart.',
  'UI|View|ChartTourStepMenu':
    "The Chart tour reached its step on the chart's menu (Chart Type, Data, Chart).",
  'UI|View|ChartTourStepData': 'The Chart tour reached its step on the Chart Data grid.',
  'UI|View|ChartTourStepSeries':
    'The Chart tour reached its step on the series across the top of Chart Data.',
  'UI|View|ChartTourStepAddRow': 'The Chart tour reached its step on Add Row in Chart Data.',
  'UI|View|ChartTourStepImport': 'The Chart tour reached its step on Import CSV in Chart Data.',
  'UI|View|ChartTourStepOutro': 'The Chart tour reached its closing card.',
  'UI|View|StackTourStepStack':
    'The Stack tour reached its first step, how a stack lays itself out.',
  'UI|View|StackTourStepChild':
    'The Stack tour reached its step on dragging a child to a new slot.',
  'UI|View|StackTourStepDrop':
    'The Stack tour reached its step on dropping things into an empty stack.',
  'UI|View|StackTourStepCarry':
    'The Stack tour reached its step on a stack carrying what it holds.',
  'UI|View|StackTourStepMenu': 'The Stack tour reached its step on the Stack menu.',
  'UI|View|StackTourStepOutro': 'The Stack tour reached its closing card.',
  'UI|View|EntityTourStepEntity':
    'The Entity tour reached its first step, a title over its fields.',
  'UI|View|EntityTourStepTitle': 'The Entity tour reached its step on renaming it.',
  'UI|View|EntityTourStepRows': 'The Entity tour reached its step on its name and type rows.',
  'UI|View|EntityTourStepMenu': 'The Entity tour reached its step on the Fields menu.',
  'UI|View|EntityTourStepRelate':
    'The Entity tour reached its step on joining entities with ER ends.',
  'UI|View|EntityTourStepOutro': 'The Entity tour reached its closing card.',
  'UI|View|TabWindowTourStepWindow':
    'The Tab Window tour reached its first step, another tab drawn live.',
  'UI|View|TabWindowTourStepOpen': 'The Tab Window tour reached its step on its Open button.',
  'UI|View|TabWindowTourStepChoose':
    'The Tab Window tour reached its step on its Choose a Tab button.',
  'UI|View|TabWindowTourStepMenu': 'The Tab Window tour reached its step on the Tab Window menu.',
  'UI|View|TabWindowTourStepSize': 'The Tab Window tour reached its step on resizing it.',
  'UI|View|TabWindowTourStepOutro': 'The Tab Window tour reached its closing card.',
  'UI|View|LaneTourStepLane': 'The Lane tour reached its first step, a band for each role.',
  'UI|View|LaneTourStepGutter': 'The Lane tour reached its step on its title gutter.',
  'UI|View|LaneTourStepSeam': 'The Lane tour reached its step on dragging its seam.',
  'UI|View|LaneTourStepCarry': 'The Lane tour reached its step on a lane carrying its steps.',
  'UI|View|LaneTourStepMenu': 'The Lane tour reached its step on turning it into a column.',
  'UI|View|LaneTourStepOutro': 'The Lane tour reached its closing card.',
  'UI|View|BoundaryTourStepZone':
    'The Boundary tour reached its first step, a zone that holds things.',
  'UI|View|BoundaryTourStepTitle': 'The Boundary tour reached its step on its title and icon.',
  'UI|View|BoundaryTourStepMeta': 'The Boundary tour reached its step on its meta line.',
  'UI|View|BoundaryTourStepMenu': 'The Boundary tour reached its step on its three styles.',
  'UI|View|BoundaryTourStepOutro': 'The Boundary tour reached its closing card.',
  'UI|View|DiagramKeyTourStepKey':
    'The Diagram Key tour reached its first step, a key that builds itself.',
  'UI|View|DiagramKeyTourStepMeaning':
    "The Diagram Key tour reached its step on writing a row's meaning.",
  'UI|View|DiagramKeyTourStepEmpty':
    'The Diagram Key tour reached its step on a key with nothing to list yet.',
  'UI|View|DiagramKeyTourStepTitle': 'The Diagram Key tour reached its step on its title.',
  'UI|View|DiagramKeyTourStepOutro': 'The Diagram Key tour reached its closing card.',
  'UI|View|PortalTourStepPortal': 'The Portal tour reached its first step, a way through.',
  'UI|View|PortalTourStepTravel': 'The Portal tour reached its step on stepping through it.',
  'UI|View|PortalTourStepUnlinked': 'The Portal tour reached its step on an unlinked portal.',
  'UI|View|PortalTourStepMenu': 'The Portal tour reached its step on linking it from its menu.',
  'UI|View|PortalTourStepWalk':
    'The Portal tour reached its step on walking an Avatar-mode character in.',
  'UI|View|PortalTourStepOutro': 'The Portal tour reached its closing card.',
  'UI|View|SankeyTourStepBands':
    'The Sankey tour reached its "Bands Carry Amounts" step, lifting the widest band of the diagram.',
  'UI|View|SankeyTourStepLeftover':
    'The Sankey tour reached its "What Is Left Over" step, lifting a leftover band.',
  'UI|View|SankeyTourStepStyle':
    'The Sankey tour reached its "Style It" step, on the selection toolbar\'s More button.',
  'UI|View|SankeyTourStepFlows':
    'The Sankey tour reached its "Write the Flows" step, on the whole diagram.',
  'UI|View|SankeyTourStepFlowsNodes':
    'The Sankey tour reached its "Your Nodes" step, inside the Flows dialog it opened.',
  'UI|View|SankeyTourStepFlowsRows':
    'The Sankey tour reached its "Flows, Step by Step" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsAdd':
    'The Sankey tour reached its "Add a Flow" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsBalance':
    'The Sankey tour reached its "In and Out Differ" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsText':
    'The Sankey tour reached its "Or Type Them" step, on the Flows dialog\'s Text tab.',
  'UI|View|SankeyTourStepFlowsImport':
    'The Sankey tour reached its "Import a File" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsPreview':
    'The Sankey tour reached its "Live Preview" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepOutro': 'The Sankey tour reached its closing "That Is a Sankey" card.',
  'UI|View|WorkshopTourStepCollaborate':
    'The Workshop tour reached its "Collaborate" step, ringing the Collaborate band of the palette\'s category picker.',
  'UI|View|FormTourStepAdd':
    'The Forms tour reached its "Add Questions" step, ringing the add bar.',
  'UI|View|FormTourStepDestination':
    'The Forms tour reached its "Responses Arrive Here" step, opening the board or sheet the form sends its responses to.',
  'UI|View|FormTourStepForm':
    'The Forms tour reached its "Build It Here" step, ringing the questions in the form builder.',
  'UI|View|FormTourStepOutro': 'The Forms tour reached its closing "That Is a Form" card.',
  'UI|View|FormTourStepSettings':
    'The Forms tour reached its "Where Responses Go" step, ringing the form cog.',
  'UI|View|FormTourStepShare':
    'The Forms tour reached its "Share Form" step, ringing Share Form in the header.',
  'UI|View|FormTourStepStatus':
    'The Forms tour reached its "Responses and Preview" step, ringing the form status bar.',
  'UI|View|WorkshopTourStepSessionStrip':
    'The Workshop tour reached its "Run the Room" step, on the Session strip.',
  'UI|View|WorkshopTourStepShare':
    'The Workshop tour reached its "Bring People In" step, on Share.',
  'UI|View|WorkshopTourStepOutro':
    'The Workshop tour reached its closing "You\'re ready to run a workshop" card.',
  'UI|View|PlanTourStepBoard':
    'The Plan tour reached its "Your Board" step, highlighting the person\'s board (placing an example board until October 2026).',
  'UI|View|PlanTourStepAddCards':
    'The Plan tour reached its "Add Cards" step, pointing at a column\'s Add card (adding example cards until October 2026).',
  'UI|View|PlanTourStepMoveCard':
    'The Plan tour reached its "Move Work Along" step, pointing at a card on the board (moving an example card until October 2026).',
  'UI|View|PlanTourStepCardPanel':
    'The Plan tour reached its "The Card Panel" step, opening a card\'s panel.',
  'UI|View|PlanTourStepBoardHeader': 'The Plan tour reached its "The Board Header" step.',
  'UI|View|PlanTourStepCardTypes': 'The Plan tour reached its "Card Types" step.',
  'UI|View|PlanTourStepPalette':
    'The Plan tour reached its "The Plan palette" step, opening the palette\'s categories.',
  'UI|View|PlanTourStepOutro': 'The Plan tour reached its closing "You\'re ready to plan" card.',
  'UI|View|PlanTourStepSheet':
    'The Plan tour\'s Spreadsheets track reached its "Your Sheet" step, highlighting the person\'s sheet (placing an example sheet until October 2026).',
  'UI|View|PlanTourStepCells':
    'The Plan tour\'s Spreadsheets track reached its "Type Into Cells" step.',
  'UI|View|PlanTourStepFormulas':
    'The Plan tour\'s Spreadsheets track reached its "Formulas" step, pointing at the formula bar (selecting an example sheet\'s total until October 2026).',
  'UI|View|PlanTourStepSheetToolbar':
    'The Plan tour\'s Spreadsheets track reached its "The Toolbar" step.',
  'UI|View|PlanTourStepSheetSettings':
    'The Plan tour\'s Spreadsheets track reached its "Sheet Settings" step.',
  'UI|View|PlanTourStepSheetPalette':
    'The Plan tour\'s Spreadsheets track reached its "The Plan palette" step, opening the palette\'s categories.',
  'UI|View|TourStepCategories':
    'The Diagram tour (the welcome tour until October 2026) reached its "Palette Categories" step, pointing out the palette\'s category tabs.',
  'UI|View|TourStepContextMenu':
    'The Diagram tour (the welcome tour until October 2026) reached its "The Element Menu" step, showing the right-click menu on an element.',
  'UI|View|TourStepEditorMode':
    'The Diagram tour (the welcome tour until October 2026) reached its "Tab Mode" step ("Change Tab Mode" before), pointing out the switch for the tab\'s editor mode (step removed October 2026).',
  'UI|View|TourStepExplorer':
    'The welcome tour reached its "The Explorer" step (retired in October 2026, when the welcome tour became the Diagram tour).',
  'UI|View|TourStepOutro':
    'The Diagram tour reached its closing "You\'re ready to diagram" card ("You\'re ready to go" when it was the welcome tour).',
  'UI|View|TourStepPalette':
    'The Diagram tour (the welcome tour until October 2026) reached its "The Palette" step.',
  'UI|View|TourStepSearch':
    'The welcome tour reached its "Search everything" step, showing the search panel.',
  'UI|View|TourStepSelectionModes':
    'The Diagram tour (the welcome tour until October 2026) reached its "Selection Modes" step, showing the pointer-tool dropdown.',
  'UI|View|TourStepTabs':
    'The Diagram tour (the welcome tour until October 2026) reached its "Tabs" step.',
  'UI|View|TourStepThemeCanvas':
    'The Diagram tour (the welcome tour until October 2026) reached its "Theme & Canvas" step, showing the paintbrush that restyles a tab.',
};

export const BY_ACTION: Readonly<Record<string, string>> = {
  'Timing|Measured':
    'A key moment was timed: a project opening, a tab switch, a save, the live room connecting, or a page loading. Only the range it fell in is recorded, never the exact time.',
  'Editor|Changed': 'Someone switched a tab between Diagram mode and Draw mode.',
  'Element|Created': 'Someone made an element in a way other than placing it from the palette.',
  'Draw|Created': 'Someone made a whiteboard tab, a plain board drawn on with pens.',
  'Cta|Opened':
    'Someone followed a call to action on a public page (the landing page, a feature or comparison page, the help centre) and reached the New Project page.',
  'Cta|Created':
    'Someone who arrived from a call to action on a public page went on to create a project. Counted once per arrival.',
  'AI|Toggled': 'Someone turned an AI setting on or off in Settings under AI Tools.',
  'AI|Used':
    'Someone used a feature of the AI Assistant panel, or another AI-powered tool in the editor.',
  'Action|Changed': 'Someone changed something about an action assigned to an element.',
  'Action|Created': 'Someone assigned an action to a teammate, or to themselves, on an element.',
  'Action|Deleted': 'Someone removed an assigned action from an element.',
  'Action|Linked': "Someone added a project's first action, which made its Actions board.",
  'Action|Moved': "A project was moved into a teammate's team while assigning them an action.",
  'Action|Opened': 'Someone opened the popover for an action already assigned to an element.',
  'Action|Resolved': 'Someone marked an assigned action as done.',
  'Action|Unresolved': 'Someone reopened an assigned action that had been marked done.',
  'Activity|Loaded':
    "Something happened while loading the Explorer's Inbox (the list of outstanding actions and comment threads).",
  'Activity|Opened': "Someone opened or interacted with the Explorer's Inbox.",
  'Form|Created': 'Someone started a form from Start Planning.',
  'Form|Added': 'Someone added a question to a form.',
  'Form|Linked':
    'Someone connected a form to where its responses go, from the box above its title.',
  'Form|Shared': 'Someone published a form, making its public link.',
  'Form|Toggled': 'Someone switched Accepting Responses on or off for a published form.',
  'Form|Opened': "Someone pressed a form's Not Taking Responses warning, to see why and fix it.",
  'Form|Moved':
    'Someone synced a project in This Browser from Share Form, so its form could be published.',
  'Form|Sent': 'A response came in through a form link.',
  'Form|Reported': 'Someone reported a form they were sent.',
  'Activity|Selected': "Someone clicked a row in the Explorer's Inbox, jumping to what it's about.",
  'Canvas|Used': 'Someone picked up one of the canvas tools or modes, or used a canvas feature.',
  'Canvas|Zoomed': 'Someone changed the zoom from the zoom controls.',
  'Comment|Added': 'A comment was added to an element thread.',
  'Comment|Deleted': 'A comment was removed from a thread.',
  'Comment|Opened': 'Someone opened the comment popover on an element.',
  'Comment|Mentioned': 'A comment was sent that @-mentioned at least one teammate.',
  'Comment|Resolved': 'A comment thread was marked resolved.',
  'Comment|Unresolved': 'A resolved comment thread was reopened.',
  'Project|Created': 'A brand-new project was created.',
  'Project|Deleted': 'A project was deleted.',
  'Project|Exported': 'Someone exported a tab, a selection or a page to a file or the clipboard.',
  'Project|Duplicated': 'A project was duplicated into a new one.',
  'Project|Joined':
    'Someone came into a project through a share link. Counted once per person per project, not on every revisit.',
  'Project|Loaded':
    'A project was opened, counted on every open (including a page refresh and the first open of a project just created).',
  'Project|Moved': 'A project was moved into (or out of) a folder.',
  'Project|Redone': 'Someone hit Redo on a project edit.',
  'Project|Removed':
    "Someone removed something from a project's sharing, such as revoking a share link.",
  'Project|Renamed': 'A project was renamed.',
  'Project|Reverted':
    "Someone reverted a single change from a tab's activity log, in the since-removed Activity panel.",
  'Project|Shared':
    "Someone created or changed a project's share link: its role, how long it lasts, or its password.",
  'Project|Undone': 'Someone hit Undo on a project edit.',
  'Project|Used': 'A project was used in a particular way, such as with other people live in it.',
  'Element|Changed':
    "Someone changed a property of one or more selected elements, from a style panel, the right-click menu, or an element's own controls.",
  'Element|Copied': 'Someone copied one or more selected elements to the clipboard.',
  'Element|Deleted': 'An element was removed from the canvas.',
  'Element|Duplicated': 'Someone duplicated one or more elements on the canvas.',
  'Element|Grouped': 'A multi-selection was grouped (before groups were removed).',
  'Element|Linked':
    'Someone linked an element to something: another element, a web address, a project or a tab.',
  'Element|Locked': "An element's lock was turned on (no edits allowed).",
  'Element|Removed':
    'Someone took something off an element, such as one of their dots in a dot vote.',
  'Element|Reordered':
    'Someone changed the order of something on the canvas, such as the stacking of elements or a table row or column.',
  'Element|Selected':
    'Someone changed what is selected on the canvas in a particular way, such as with the keyboard or a filter.',
  'Element|Toggled':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Ungrouped':
    'A group was disbanded back into individual elements (before groups were removed).',
  'Element|Unlinked': 'Someone cleared the link off an element.',
  'Element|Unlocked': "An element's lock was turned off (edits resume).",
  'Element|Searched': 'Someone searched for something to put in an element, such as a picture.',
  'Element|Used': 'Someone used an interactive element on the canvas, such as a Reaction Pad.',
  'Element|Added': 'Someone added an element to a canvas, or put something into a project.',
  'Element|Voted': 'Someone cast a dot in a dot vote.',
  'Email|Sent':
    'An automatic email went out: a welcome message, an onboarding nudge, a team invite, or a notification about activity on a project. The type names which one; it never says who received it.',
  'Error|Api':
    "A request to liveplanner's servers failed, or a server itself hit an error while handling one. The type says what kind of failure it was and which operation was being attempted; see the accompanying pattern for how to read it.",
  'Error|Client':
    "Something failed in a visitor's browser: a part of the editor or help centre crashed, or recovered on its own from a hiccup in live sync. The type says what happened and where; see the accompanying pattern for how to read it.",
  'Error|Warning':
    'A feature hit a soft limit and quietly fell back to a slower or more limited way of working, rather than failing outright.',
  'Facilitator|Changed':
    'Something changed about who is facilitating a live session, or an element lock the facilitator freed.',
  'Facilitator|Ended': 'The facilitator role in a live session ended.',
  'Facilitator|Started': 'Someone became the facilitator of a live session.',
  'Folder|Created': 'A new folder was created in the project explorer.',
  'Folder|Deleted': 'A folder was deleted (contained projects move to the top level).',
  'Folder|Moved': 'A folder was re-parented under another folder (or the root).',
  'Folder|Renamed': 'A folder was renamed.',
  'Help|Helpful':
    'Someone said a help-centre article was helpful, using the "Was this helpful?" control at the end of the article. The type is the article. Counted once per article per visit, using whichever answer the reader leaves the page on.',
  'Help|Searched':
    'Someone searched the help centre. Counted once per finished search; the search words are never recorded.',
  'Help|Unhelpful':
    'Someone said a help-centre article was not helpful, using the "Was this helpful?" control at the end of the article. Counted once per article per visit, using whichever answer the reader leaves the page on.',
  'Layer|Added': 'A new layer was added in the Layers panel.',
  'Layer|Changed': 'Someone adjusted a setting on a layer, such as its opacity.',
  'Layer|Cleared': 'A layer was emptied (its elements deleted, the layer kept).',
  'Layer|Deleted': 'A layer (and everything on it) was deleted.',
  'Layer|Moved': 'A selection was moved onto another layer.',
  'Layer|Opened': 'Someone opened the Layers panel.',
  'Layer|Removed': 'A layer was merged into a neighbouring layer.',
  'Layer|Renamed': 'A layer was renamed.',
  'Layer|Reordered': 'Someone dragged a layer to restack it.',
  'Layer|Selected': 'Someone switched which layer is active.',
  'Layer|Toggled': 'Someone switched something on a layer on or off, such as hiding or locking it.',
  'Agent|Opened': "Somebody opened something an agent's change pointed them to.",
  'Agent|Viewed': 'An agent or a script read a project as text.',
  'Agent|Applied':
    'An agent changed a tab with a changeset: through the MCP server, the CLI or the API.',
  'Agent|Conflicted':
    "An agent's changeset was refused because something it touched changed since the agent read it.",
  'Agent|Held':
    "An agent's changeset was refused because a person had one of its elements selected.",
  'Agent|Present':
    'An agent showed itself on a tab, with what it is doing, through the MCP server, the CLI or the API.',
  'Agent|Reverted':
    "An agent's changeset was undone, from the editor's toast or another front door.",
  'Mcp|Used': 'An AI tool connected to liveplanner over MCP used one of its actions on a project.',
  'Note|Added': 'A note was added to an element (first non-empty save).',
  'Cli|Used': 'Someone ran a liveplanner command from the command line, and it succeeded.',
  'Note|Changed': "An existing note's text was edited.",
  'Note|Deleted': 'A note was cleared from an element.',
  'Note|Opened': 'Someone opened the note popover on an element.',
  'Note|Used':
    "Someone applied rich-text formatting, such as bold, a colour, a bullet or numbered list, a heading, or a link, to part of a note's text.",
  'Page|View':
    'Someone loaded or navigated to a page on the site. Counted once per distinct page, not on every scroll or in-page action.',
  'Participant|Created':
    'Someone visited liveplanner for the first time in this browser, and a new anonymous guest identity was created for them. Counted once per browser, ever.',
  'Participant|Returned':
    'A returning visitor reopened the app on a later day than their first visit, counted once per day.',
  'Search|Opened': 'The global search panel was opened.',
  'Search|Searched':
    'A query was typed into search. Counted once per session, not on every keystroke.',
  'Search|Selected': "Someone picked a result from the editor's search.",
  'Session|Deleted': "Someone permanently deleted part of their account's data.",
  'Session|Opened': 'Someone opened a session-related surface in liveplanner.',
  'Session|SignedIn': 'A visitor just signed in to their account.',
  'Session|SignedOut': 'A visitor just signed out.',
  'Session|SignedUp': 'A visitor just created an account.',
  'Tab|Aligned':
    "Someone tidied a tab's layout with Auto Layout, arranging its elements automatically.",
  'Tab|Changed': "Someone changed a tab-wide setting, such as the tab's default font or text size.",
  'Tab|Cleared': "A tab's content was wiped.",
  'Tab|Created': 'A new tab was added to a project.',
  'Tab|Deleted': 'A tab was removed from a project.',
  'Tab|Duplicated': 'A tab was duplicated.',
  'Tab|Ended': 'Someone ended a live activity on a tab, such as a poll or a timer.',
  'Tab|Imported': 'Someone imported a tab from a file.',
  'Tab|Linked': 'A tab was linked into another project.',
  'Tab|Loaded':
    "A tab's content was fetched for viewing (the first tab when a project opens, then each tab switched to).",
  'Tab|Locked': 'A tab was locked (read-only).',
  'Tab|Moved': 'A tab was filed into a tab folder.',
  'Tab|Removed': 'Someone took a tab out of its tab folder, making it a loose tab again.',
  'Tab|Renamed': 'A tab was renamed.',
  'Tab|Reordered': 'Someone dragged a tab to a new position.',
  'Tab|Opened': 'Someone opened a tab beside the one they were editing (side by side).',
  'Tab|Selected':
    'Someone moved the editor to the other side by side pane, by a click or by resting the pointer there.',
  'Tab|Closed': 'Someone closed the side by side pane.',
  'Tab|Revealed':
    "Someone revealed a tab's hidden results to everyone in the room, such as a dot vote's.",
  'Tab|Started': 'Someone started a live activity on a tab, such as a poll or a timer.',
  'Tab|Toggled':
    'Someone switched something on a tab on or off, such as pausing or resuming its timer.',
  'Tab|Unlocked': 'A tab was unlocked (edits resume).',
  'Tab|Voted': 'Someone answered a live vote or poll on a tab. Counted once per person per poll.',
  'Team|Added':
    'Something was added to a team: an invitation sent, or a project added to its shared library.',
  'Team|Changed': "Something about a team's settings, or a member's role, was changed.",
  'Team|Created': 'Someone created a new team.',
  'Team|Declined': 'Someone turned down a team invite.',
  'Team|Deleted': 'An admin deleted a team.',
  'Team|Joined': 'Someone accepted a team invite, by email or by invite link.',
  'Team|Moved': "A project already in a team's shared library was moved somewhere else.",
  'Team|Removed':
    'Someone was taken off a team, left one, or had a pending invite or the invite link withdrawn.',
  'Team|Shared': 'A team turned on a way for people to ask to join it.',
  'Theme|Created': 'Someone created a custom theme with their own colours.',
  'Theme|Deleted': 'Someone deleted a custom theme they had created.',
  'Home|Loaded': "More of Home's Timeline column loaded, or Home was read again after failing.",
  'Home|Opened': "Someone opened the Explorer's Home, or expanded a summary within it.",
  'Home|Selected': "Someone opened a project from one part of the Explorer's Home.",
  'Timeline|Changed': "Someone switched how the Explorer's Timeline displays its history.",
  'Timeline|Loaded':
    'The Timeline loaded more of its history, either the next page or a retry after a failed read.',
  'Timeline|Opened': 'Someone opened the Timeline, or a menu or collapsed group within it.',
  'Timeline|Removed': 'Someone removed one or more entries from their Timeline feed.',
  'Timeline|Selected':
    "Someone changed a Timeline filter: turned a category chip (such as Comments, Renames, or Sharing) off, or switched between seeing everyone's activity and just their own.",
  'Folder|Changed':
    'Someone chose a default folder: where new projects of one kind (diagrams, whiteboards, retrospectives or Kanban boards) land when they pick no place.',
  'Folder|Cleared':
    'Someone cleared a default folder, so new projects of that kind land in My Projects again.',
  'Trash|Opened': 'Someone opened the Trash, where deleted projects wait for 30 days.',
  'Explorer|Created': 'Someone made something in the Explorer (a tag).',
  'Explorer|Added': 'Someone put one of their tags on a project.',
  'Explorer|Removed': 'Someone took one of their tags off a project.',
  'Explorer|Renamed': 'Someone renamed one of their tags.',
  'Explorer|Changed': 'Someone changed one of their tags (its colour).',
  'Explorer|Deleted': 'Someone deleted one of their tags.',
  'Explorer|Selected':
    'Someone narrowed an Explorer list with a filter: a chip, a suggestion or a typed token. The type names which kind of filter, never what was picked.',
  'Plan|Added':
    'Someone made an item on a Plan board (its type is the value), or placed a Plan card (Card).',
  'Plan|Moved':
    'Someone moved a card on a Plan board to another column, row or place, or archived it (Archive).',
  'Plan|Restored': 'Someone brought an archived card back onto the boards.',
  'Plan|Removed': 'Someone took a filter off a Card Search view.',
  'Plan|Toggled':
    'Someone flagged a card for attention or took its flag off, or maximised a board, view or sheet or restored it (the value says which).',
  'Sheet|Changed':
    'Someone changed a Sheet (a spreadsheet tab on a Plan tab): the value says what kind of change (a cell, a formula, formatting, rows, a sort, a paste, ...), never what was typed.',
  'Sheet|Opened': 'Someone opened a panel on a Sheet (the value says which: Find or Settings).',
  'Sheet|Created':
    'Someone set up a new Sheet (the value says how it started) or made a chart from its cells (Chart).',
  'Sheet|Imported': 'Someone filled a Sheet from a file (the value says which kind: Csv).',
  'Sheet|Exported':
    "Someone downloaded a Sheet's cells as a file (the value says which kind: Csv).",
  'Sheet|Deleted':
    'Someone was asked before deleting a Sheet with its cells (the value says Confirmed or Cancelled).',
  'Sheet|Used':
    'Someone saved a Sheet formula using a function for the first time in that formula (the value is the function name, from the fixed list).',
  'Plan|Created':
    'Someone started a Plan tab from Start Planning (the value says which: a Board, Sheet, Dashboard or Visualisation tab, or a suggested dashboard).',
  'Sheet|Searched': 'Someone searched a list on a Sheet (the value says which: the functions).',
  'Plan|Imported': "Someone read a file into a board's cards (the value says which kind: Csv).",
  'Plan|Exported': "Someone downloaded a board's cards as a file (the value says which kind: Csv).",
  'Plan|Duplicated': 'Someone made a new card type by duplicating an existing one.',
  'Plan|Opened':
    'Someone opened an item in the item panel, or a Plan panel (Card Types, the Trash, Cards).',
  'Plan|Deleted': 'Someone deleted an item (its type is the value).',
  'Plan|Changed':
    "Someone changed a Plan board's set-up, a card type, a project's colour or a timeline view: the value names the part (columns, WIP limits, rows, scope, card fields, voting, hide writing, or a timeline's dates, scale, rows or types).",
  'Plan|Revealed': 'Someone pressed Reveal on a board hiding writing, turning every card face up.',
  'Trash|Cleared':
    'Someone emptied one group of their Trash (their own projects, a team, or this browser), deleting everything in it for good.',
  'Trash|Deleted': 'Someone deleted a project in the Trash for good, before its 30 days were up.',
  'Trash|Restored':
    'Someone brought a deleted project back from the Trash, putting it back where it was.',
  'Token|Created':
    'A new API token was created, either by hand or for an AI tool connected over MCP.',
  'Token|Linked': 'A token’s owner allowed a developer tool to open their projects.',
  'Token|Removed': 'Someone revoked an API token.',
  'UI|Added': 'Someone added something in the editor, such as a slide.',
  'UI|Changed':
    "Someone changed a setting or a control's value somewhere in the editor: a tool panel's option (Avatar, Eraser, Laser, Spotlight, Format Painter), a Settings dialog row, or a palette/toolbar choice.",
  'UI|Cleared':
    "Someone cleared liveplanner's saved settings and caches in their browser (Repair This Browser); the value says where from.",
  'UI|Closed':
    'Someone closed or dismissed a banner, card, or presentation somewhere in the editor.',
  'UI|Copied':
    'Someone copied something to their clipboard from a Share or invite control, such as a share link, an embed snippet, a live image URL, or a team invite link.',
  'UI|Ended': 'The welcome tour finished, either completed in full or skipped partway through.',
  'UI|Moved': "Someone dragged something to a new position in the editor's interface.",
  'UI|Opened':
    "Someone opened a dialog, panel, popover, or menu somewhere in the editor. A lowercase, hyphenated type is a help-centre article's address: someone clicked a help link, or a Help result in search, to read it.",
  'UI|Removed': 'Someone removed something in the editor, such as a slide.',
  'UI|Searched':
    'Someone typed into a search box inside a palette tab (Collaborate, Icons, or Technology), narrowing it to matching tiles. Counted once per tab visit, on the first keystroke.',
  'UI|Selected':
    'Someone picked an option from a dropdown, or clicked through on a banner, somewhere in the editor.',
  'UI|Started': 'Someone started a presentation or the welcome tour.',
  'UI|Toggled': 'Someone turned an editor setting on or off.',
  'UI|Used':
    'Someone used a wizard-skipping entry point into a new project, or accepted an offer.',
  'UI|Declined': 'Someone turned down an offer the editor made them.',
  'UI|View': 'The welcome tour advanced to (or back to) a particular stage.',
};

export const API_OPERATIONS: Readonly<Record<string, string>> = {
  AcceptTeamInvite: 'accepting a team invite',
  AddTab: 'adding a tab to a project, from an AI tool connected over MCP',
  AppendChangeLog: "recording an entry in a project's since-removed change history",
  CopyProject: 'duplicating a project',
  CreateCustomTheme: 'saving a new custom theme',
  CreateProject: 'creating a new project',
  CreateFolder: 'creating a folder',
  CreateShareLink: 'generating a share link',
  CreateTeam: 'creating a team',
  CreateToken: 'creating an API token',
  DeclineTeamInvite: "declining a team invite from the email's Decline link",
  DeleteChangeLog: "clearing a project's since-removed change history",
  DeleteChangeLogEntry: "removing one entry from a project's since-removed change history",
  DeleteComment: 'deleting a comment',
  DeleteCustomTheme: 'deleting a saved custom theme',
  DeleteProject: 'deleting a project',
  DeleteFolder: 'deleting a folder',
  DeleteImage: 'deleting a saved image',
  DeleteShareLink: 'deleting a share link',
  DeleteTab: 'deleting a tab',
  DeleteTeam: 'deleting a team',
  DismissShared: "removing a shared project from a visitor's shared list",
  DismissTimelineEvent: 'clearing one entry from the activity timeline',
  DismissTimelineEvents: 'clearing entries from the activity timeline',
  ExtendShareLink: "extending a share link's expiry",
  FindProjects: 'searching for a project, from an AI tool connected over MCP',
  InviteTeamMember: 'inviting someone to a team',
  JoinTeamByInviteLink: 'joining a team through its invite link',
  LinkTab: 'linking a tab into another project',
  List: "listing a visitor's projects",
  ListChangeLog: "listing a project's since-removed change history",
  ListCustomThemes: "listing an account's saved custom themes",
  ListFolders: "listing an account's folders",
  ListShareLinks: "listing a project's share links",
  ListShared: 'listing projects shared with a visitor',
  ListTeamInvites: "listing an account's pending team invites",
  ListTeams: "listing an account's teams",
  ListTemplates: 'listing available templates, from an AI tool connected over MCP',
  ListTokens: "listing an account's API tokens",
  LoadSelf: "loading a visitor's own profile details",
  LoadShared: 'opening a project through a share link',
  LoadTab: "loading a tab's contents",
  LoadTeam: "loading a team's details",
  LoadTeamLibrary: "loading a team's shared project library",
  NotifyAssignedAction: 'emailing someone about an action assigned to them',
  OauthExchange: 'connecting an AI tool over MCP',
  ReadProject: 'reading a project, from an AI tool connected over MCP',
  ReadTeamInviteDecline: "opening a team invite email's Decline link",
  RenameProject: 'renaming a project, from an AI tool connected over MCP',
  ResolveTeamInviteLink: "opening a team's invite link",
  RevokeTeamInviteLink: "turning off a team's invite link",
  RevokeToken: 'revoking an API token',
  SaveProjectMeta: "saving a project's name or other details",
  SaveSelf: "saving a visitor's own profile details",
  SaveTab: "saving a tab's contents",
  SearchIcons: 'searching the icon catalogue by name, from an AI tool connected over MCP',
  SendEmail: 'sending a transactional or lifecycle email',
  SetFolder: 'moving a project into, or out of, a folder',
  SetSharePassword: 'setting a password on a share link',
  ShareProject: 'generating a share link, from an AI tool connected over MCP',
  UpdateCustomTheme: 'updating a saved custom theme',
  UpdateProject: 'updating a project, from an AI tool connected over MCP',
  UpdateFolder: 'renaming or updating a folder',
  UpdateTeam: "updating a team's name or organisation",
  UploadImage: 'uploading an image',
};
