// What each template tells the person who opened it (docs/specs/008-canvas/canvas-and-palette.md "What a template
// shows"): a note on its title, written for the job, and, for a Workshop template whose board does not already hold
// them, the timer and vote its session runs on. A Workshop template's note is a facilitator's run sheet, a presented
// template's a talk track in the order it is told, a diagram's how to read it and grow it. Pure data: a Record over
// every kind, so a new template does not compile until it says something.
import type { TemplateKind } from './templates';

/** The session tools a Workshop template's kit adds, each with the line saying when to press it. */
export type TemplateKit = {
  minutes: number;
  timer: string;
  dots?: number;
  vote?: string;
};

export type TemplateNote = { note: string; kit?: TemplateKit };

const NOTES: Readonly<Record<TemplateKind, TemplateNote | null>> = {
  // The blanks start from nothing, so they say nothing.
  blank: null,
  whiteboard: null,
  'blank-session': null,

  // Brainstorming.
  mindmap: {
    note: 'How to grow it: select a branch and press Tab for a child or Enter for a sibling. Drag a branch to move it with everything under it. Recolour a branch from its menu and its children follow.',
  },
  'mindmap-tree': {
    note: 'Read it left to right: the topic, its four branches, then their sub-topics. Select a node and press Tab to add under it or Enter to add beside it; the tree keeps itself tidy as it grows.',
  },
  'mindmap-bubble': {
    note: 'Six adjectives round one idea, each with the line that proves it. Swap the centre for your own topic, then press Tab on it to add another bubble.',
  },
  brainstorm: {
    note: 'Run sheet (30 min)\n1. Read the question out and check everyone understands it (2 min).\n2. Start the timer: everyone writes ideas into Unsorted, one per sticky, no talking (8 min).\n3. Read them out and drag each into a theme; rename themes as they form (10 min).\n4. Start the vote: three dots each on the ideas worth trying (5 min).\n5. Turn the top three into next steps with an owner (5 min).',
  },
  'affinity-map': {
    note: 'Run sheet (40 min)\n1. Everyone reads the unsorted notes on their own (5 min).\n2. Start the timer and sort in silence: move notes that belong together, no debating (10 min).\n3. Name each group with a header that says what it means, not what it is about (10 min).\n4. Start the vote: three dots on the insight that matters most (5 min).\n5. Write the top insight as a sentence the team can act on (10 min).',
    kit: {
      minutes: 10,
      timer: 'Silent sorting: move notes that belong together, no debating.',
    },
  },
  'crazy-eights': {
    note: 'Run sheet (20 min)\n1. Agree the problem to sketch, in one line (2 min).\n2. Start the 8-minute timer: one idea per frame, one minute each. Rough is right (8 min).\n3. Each person shows their sheet in 1 minute (6 min).\n4. Start the vote: two dots on the ideas to take forward (4 min).',
  },
  'idea-garden': {
    note: 'Write the question at the roots, a theme on each branch and an idea on each leaf. When the group agrees on the best ideas, draw them as fruit and say why under the legend.',
  },

  // Decisions.
  'prioritization-matrix': {
    note: 'Run sheet (25 min)\n1. Read the items out so everyone knows what each one means (5 min).\n2. Start the timer and place each item by impact and effort; talk only about the ones you disagree on (10 min).\n3. Start the vote: three dots on what to do first, Quick wins before Big bets (5 min).\n4. Write the commitments on the rail with an owner each (5 min).',
    kit: { minutes: 10, timer: 'Place every item; discuss only the ones you disagree on.' },
  },
  'eisenhower-matrix': {
    note: 'How to use it: drop each task into a box by asking two questions, is it urgent and is it important. Do the top left today, book the top right, hand off the bottom left and drop the bottom right. Then pick today’s three.',
  },
  'decision-tree': {
    note: 'Read it top to bottom: answer each question yes or no and follow the branch to go, wait or stop. To add a question, select a decision and drag from its edge to a new box.',
  },
  'comparison-table': {
    note: 'Talk track: say what we are choosing between and for whom, read the rows that differ (skip the ones that don’t), then land on the highlighted plan and the sticky that says why.',
  },
  'risk-matrix': {
    note: 'Run sheet (40 min)\n1. Read each risk in the register (5 min).\n2. Start the timer and score each one: likelihood across, impact up (15 min).\n3. Start the vote: three dots on the risks to act on now (5 min).\n4. Give each voted risk an owner, a response and a residual score (15 min).',
    kit: { minutes: 15, timer: 'Score every risk: likelihood across, impact up.' },
  },
  'pre-mortem': {
    note: 'Run sheet (30 min)\n1. Say it out loud: it is a year from now and the project failed (1 min).\n2. Everyone writes why on stickies, one reason each, no talking (7 min).\n3. Group the reasons round the wreck by theme (10 min).\n4. Agree what to do now and tick it into the list with an owner (12 min).',
  },
  fishbone: {
    note: 'How to use it: write the problem at the head, then ask why along each bone (people, process, tools, materials, measurement, environment). Keep asking why on a cause until you reach one you can act on.',
  },

  // Goals and metrics.
  'okr-tree': {
    note: 'Talk track: start with the objective and why it matters this quarter, then each key result with its ring (where we are against where we aim), then the initiatives moving it and their status.',
  },
  'objectives-planner': {
    note: 'Run sheet (45 min, alone or with your manager)\n1. Start with why: what would make this year a good one (10 min).\n2. Write each objective with the sentence formula, then test it against SMART (15 min).\n3. Give each objective two or three key results you can measure (15 min).\n4. Book the check-ins (5 min).',
    kit: { minutes: 15, timer: 'Write each objective, then test it against SMART.' },
  },
  'metric-tree': {
    note: 'Read it top down: the north star, the inputs that move it and who owns each one. To add an input, select a metric and drag from its bottom edge; badges mark which team owns it.',
  },
  funnel: {
    note: 'Talk track: walk down the stages with their counts, stop at the biggest drop-off (the callout), then go through the experiments that would fix it.',
  },
  flywheel: {
    note: 'Read it clockwise: each stage feeds the next, and the number beside it is how we know it is turning. The stickies outside say what pushes the wheel and what slows it.',
  },
  sankey: {
    note: 'How to read it: the width of every band is the number of visitors who took that path, left to right from channel to page to plan. Select the Sankey and edit its flows to put your own numbers in.',
  },

  // Meetings and workshops.
  'meeting-agenda': {
    note: 'Run sheet\n1. Open with the purpose and who is doing what (2 min).\n2. Start the timer for each agenda item and move on when it ends.\n3. Park anything off topic in the parking lot instead of discussing it.\n4. Close by reading back the decisions and actions with their owners (5 min).',
    kit: { minutes: 10, timer: 'Timebox the current item; when it rings, decide or park it.' },
  },
  'workshop-board': {
    note: 'Run sheet\n1. Check-in and icebreaker while people arrive (10 min).\n2. Read the goals and ground rules out, and ask if anything is missing (5 min).\n3. Run the agenda item by item with the timer.\n4. Close with a vote on what to take forward.',
  },
  'lean-coffee': {
    note: 'Run sheet (60 min)\n1. Everyone adds topics to the board (5 min).\n2. Upvote the topics you want to talk about (3 min).\n3. Take the top topic and start the timer (8 min).\n4. When it rings, run the poll: keep going or move on. Repeat from step 3.\n5. Write takeaways as you go.',
  },
  'town-hall': {
    note: 'Run sheet (45 min)\n1. Open the Q&A board and ask the room to post and upvote questions (throughout).\n2. Run the agenda; the facilitator kit starts each timer.\n3. Answer the most upvoted questions first.\n4. Close with the poll and note follow-ups on the checklist.',
  },
  'sprint-planning': {
    note: 'Run sheet (90 min)\n1. Read the sprint goal and agree it in one sentence (10 min).\n2. Check capacity: who is in, for how many days (5 min).\n3. Pull stories from Ready backlog into Committed until the points match capacity, ten minutes a story at most (45 min).\n4. Read the risks and give each an owner (10 min).\n5. Run the confidence check: below three, cut scope and check again (10 min).\n6. Vote on the stretch story (10 min).',
  },

  // People and teams.
  orgchart: {
    note: 'How to read it: solid lines are reporting lines, the dotted one a second manager, and the dashed card a role still to hire. Select a person to change their name, role and photo; drag from a card’s bottom edge to add a report.',
  },
  'raci-matrix': {
    note: 'Run sheet (30 min)\n1. Read each task out (5 min).\n2. Start the timer and fill a letter per role: Responsible, Accountable, Consulted, Informed (15 min).\n3. Check every row against the checks: exactly one A, at least one R (10 min).',
    kit: { minutes: 15, timer: 'Fill the grid: one letter per role, one A per task.' },
  },
  'onboarding-plan': {
    note: 'How to use it: in the first 30 days learn, by 60 contribute, by 90 lead. Agree each goal with your manager in week one, then tick the check-ins off as you hold them.',
  },
  'family-tree': {
    note: 'Read it top down, a generation a row: a dot between a couple leads to their children. To add someone, duplicate a card, retype it and draw a line from their parents’ dot.',
  },

  // Planning.
  gantt: {
    note: 'Talk track: start with the launch milestone and the Today line, then go workstream by workstream: what is done (the progress bars), what is next and what it waits on (the dependency arrows).',
  },
  roadmap: {
    note: 'Talk track (10 min)\n1. The goal at the top: what all of this is for.\n2. Now: what we are building, with confidence and status.\n3. Next: what we will pick up when Now lands.\n4. Later: the bets we are watching, not promising.\nIn a planning session, start the timer and vote on which Next card moves into Now.',
    kit: {
      minutes: 15,
      timer: 'Review the board lane by lane.',
      dots: 3,
      vote: 'Which Next card moves into Now?',
    },
  },
  timeline: {
    note: 'Read it left to right: each milestone’s colour says where it stands, and the Today marker shows where we are. Drag Today along as the year moves; drag a milestone to reschedule it.',
  },
  'milestone-timeline': {
    note: 'Talk track: start at the left with where the year began, walk the milestones in order above and below the ribbon, and land on launch day, the hero card.',
  },
  'milestone-timeline-vertical': {
    note: 'Talk track: read it top to bottom as a story, a big year at a time, pause on the highlight, and end on the next chapter.',
  },

  // Processes and workflows.
  flowchart: {
    note: 'How to read it: rounded ends start and stop the flow, diamonds ask a question, parallelograms are input or output, and the document shape is something produced. The key spells each symbol out. Drag from any box’s edge to add the next step.',
  },
  swimlane: {
    note: 'Read it lane by lane: each lane is who does the step, and an arrow crossing a lane is a hand-off. Drag a step into another lane to change who owns it.',
  },
  'approval-workflow': {
    note: 'Read it left to right: the request, the manager’s sign-off, then finance. The rework and decline paths loop back; the chips under each step say how long it usually takes.',
  },
  'value-stream-map': {
    note: 'How to read it: process boxes carry their process time (PT) and the share done right first time (%C&A); the triangles between them are the waits. The totals add it up, and the kaizen bursts mark what to fix first.',
  },

  // Product and UX.
  journey: {
    note: 'Run sheet (45 min)\n1. Walk the stages left to right (5 min).\n2. Start the timer: fill doing, thinking and feeling for each stage from research, not guesses (15 min).\n3. Mark the pains (10 min).\n4. Vote on the pain to fix first, then write ideas under it (15 min).',
    kit: {
      minutes: 15,
      timer: 'Fill each stage from what research says.',
      dots: 3,
      vote: 'Which pain do we fix first?',
    },
  },
  'user-persona': {
    note: 'Run sheet (30 min)\n1. Read the research summary together (5 min).\n2. Start the timer and fill goals, frustrations and behaviours from real quotes (15 min).\n3. Agree how we help, in one line per goal (10 min).',
    kit: { minutes: 15, timer: 'Fill each section from real quotes, not guesses.' },
  },
  'empathy-map': {
    note: 'Run sheet (30 min)\n1. Introduce the persona in the middle (2 min).\n2. Start the timer: everyone adds what they say, think, do and feel (10 min).\n3. Read each quadrant out (8 min).\n4. Vote on the pain worth designing for and note it in Pains (10 min).',
    kit: {
      minutes: 10,
      timer: 'Everyone adds to all four quadrants.',
      dots: 2,
      vote: 'Which pain is worth designing for?',
    },
  },
  'user-story-map': {
    note: 'Run sheet (60 min)\n1. Read the backbone of activities left to right (5 min).\n2. Start the timer and add stories under each task (20 min).\n3. Vote on what goes in the first release (10 min).\n4. Drag the voted stories above the first release line (25 min).',
    kit: {
      minutes: 20,
      timer: 'Add stories under each task.',
      dots: 3,
      vote: 'What must be in the first release?',
    },
  },
  'service-blueprint': {
    note: 'Read it top down: what the customer does, then what staff do in front of them, then behind the line of visibility, then the systems. F marks a likely failure point and W a long wait.',
  },
  sitemap: {
    note: 'Read it top down: the home page, the sections in the navigation, then their pages with their routes. Select a page and press Tab to add one under it.',
  },
  'opportunity-solution-tree': {
    note: 'Run sheet (45 min)\n1. Agree the outcome at the top (5 min).\n2. Start the timer: add opportunities in the customer’s words (15 min).\n3. Vote on the target opportunity (5 min).\n4. Add three solutions under it and a test for each (20 min).',
    kit: {
      minutes: 15,
      timer: 'Add opportunities in the customer’s own words.',
      dots: 3,
      vote: 'Which opportunity do we target?',
    },
  },
  'paper-prototype': {
    note: 'How to test it: print or share the three screens, ask someone to complete the task on the stickies, and tap through the arrows as they would. Write what surprised you beside each screen.',
  },
  'journey-doodle': {
    note: 'Draw it as a road: one stop per moment, a face for how it felt and a ring round where it went wrong. Put the opportunities on stickies beside the dip.',
  },
  'comic-strip': {
    note: 'Tell the story panel by panel: who, what they want, what gets in the way, and how it ends. Keep each caption to one line and let the drawing do the rest.',
  },
  venn: {
    note: 'Talk track: introduce each circle, then each overlap and what it means, and finish in the middle, the sweet spot where all three hold.',
  },
  'interview-synthesis': {
    note: 'Run sheet (60 min)\n1. Read the research question and who we spoke to (5 min).\n2. Each interviewer adds their quotes, tinted by participant (10 min).\n3. Start the timer and cluster the quotes into themes (15 min).\n4. Write the insight each theme adds up to, and a How might we question (15 min).\n5. Vote on the question to chase first (5 min).\n6. Agree who takes it into discovery (10 min).',
  },

  // Quizzes and games.
  'pub-quiz': {
    note: 'Run sheet (45 min)\n1. Split into teams and name them on the scoreboard (5 min).\n2. Open each round’s quiz cards one at a time; each has its own clock.\n3. Add up the round on the scoreboard before the next.\n4. Reveal the tie-breaker only if you need it.',
  },
  'icebreaker-questions': {
    note: 'Run sheet (15 min)\n1. Spin the person picker, then the question picker.\n2. Start the two-minute timer for their answer.\n3. Once everyone has gone, everyone says hello on the wall.',
  },
  'two-truths-and-a-lie': {
    note: 'Run sheet (20 min)\n1. Each player writes three statements on their row, one of them false (5 min).\n2. Pick who goes next with the picker.\n3. Open their poll and let the room vote on the lie, then reveal it.',
  },
  'would-you-rather': {
    note: 'Run sheet (15 min)\n1. Open a dilemma’s poll and give the room 30 seconds.\n2. Ask one person from each side to argue their case.\n3. Fire the reaction pad for the best argument and move on.',
  },
  'people-bingo': {
    note: 'Run sheet (15 min)\n1. Start the ten-minute timer.\n2. Everyone finds a teammate for each square and writes their name in it.\n3. First to a full line presses Bingo!',
  },
  'doodle-warmup': {
    note: 'Run sheet (10 min)\n1. Everyone takes the frame with a teammate’s name.\n2. Sixty seconds to draw them, then pens down.\n3. Put a star sticker on the best likeness.',
  },

  // Retrospectives.
  retrospective: {
    note: 'Run sheet (45 min)\n1. Mood check: everyone taps the face that fits (3 min).\n2. Start the timer: write into Went well, To improve and Ideas, one note each (5 min).\n3. Read the notes out column by column (10 min).\n4. Start the vote: three dots on what to act on (5 min).\n5. Turn the top three into action items with an owner and a day (15 min).\n6. Check last sprint’s actions (5 min).',
  },
  'start-stop-continue': {
    note: 'Run sheet (40 min)\n1. Mood check (3 min).\n2. Start the timer: write what to start, stop and continue (5 min).\n3. Read them out (10 min).\n4. Vote three dots (5 min).\n5. Give each top note an owner and a day (15 min).',
  },
  'mad-sad-glad': {
    note: 'Run sheet (40 min)\n1. Mood check (3 min).\n2. Start the timer: write how the sprint felt, mad, sad or glad, and post anything private in the idea box (5 min).\n3. Read them out without debate (10 min).\n4. Vote on what to change (5 min).\n5. Ask what would help and write actions (15 min).',
  },
  'four-ls': {
    note: 'Run sheet (45 min)\n1. Mood check and the numbers (5 min).\n2. Start the timer: write what you liked, learned, lacked and longed for (8 min).\n3. Read each quadrant out (12 min).\n4. Vote three dots (5 min).\n5. Turn the top notes into actions (15 min).',
  },
  sailboat: {
    note: 'Run sheet (45 min)\n1. Name the island: where are we sailing (2 min).\n2. Start the timer: add wind (what pushes us), anchors (what holds us back) and rocks (risks ahead) (8 min).\n3. Read each area out (15 min).\n4. Vote on the anchors and rocks to deal with (5 min).\n5. Write actions with owners (15 min).',
  },

  // Software and IT.
  'system-architecture': {
    note: 'How to read it: requests fall through the four tiers top to bottom. Solid lines wait for a reply; dashed lines are events nobody waits for, and the moving dots trace one order’s path from customer to courier. Drag from a card’s edge to wire a new dependency.',
  },
  'cloud-architecture': {
    note: 'How to read it: boxes nest by where each service runs, edge outside the region, private services inside the VPC. The request path runs left to right along the middle row. Search the palette’s Technology icons to swap in your own services.',
  },
  'network-diagram': {
    note: 'How to read it: traffic comes in at the top and falls through the tiers. Solid lines are cables, dashed lines Wi-Fi and the dotted line the VPN; the IP plan lists each VLAN’s subnet.',
  },
  'er-diagram': {
    note: 'How to read it: each table lists its columns, PK the primary key and FK a foreign key. The ends of each line give the multiplicity: one, or many. Add a column by editing a table’s rows.',
  },
  'sequence-diagram': {
    note: 'How to read it: time runs down the page. Solid arrows with filled heads are calls that wait, open heads are async, and dashed arrows are replies. The alt frame shows the two ways checkout can go.',
  },
  'uml-class': {
    note: 'How to read it: a hollow triangle is inheritance, a filled diamond composition (the part dies with the whole), a hollow diamond aggregation, and a plain line an association. + is public, - private, # protected.',
  },
  'state-machine': {
    note: 'How to read it: start at the filled dot and follow the transitions, each labelled event [guard] / action. The rounded box around the kitchen states is a composite state; the ringed dots are the ways an order can end.',
  },
  'data-flow': {
    note: 'How to read it: circles are processes, open-ended boxes data stores, squares the people and systems outside. Every arrow names the data it carries, and the moving dots show which way it flows.',
  },
  'event-storming': {
    note: 'Run sheet\n1. Big picture: everyone writes domain events in orange, past tense, and places them on the timeline.\n2. Walk the timeline left to right and fix the order.\n3. Add commands, actors, policies and hotspots as the conversation needs them.',
  },
  'threat-model': {
    note: 'How to read it: the dashed boxes are trust boundaries, and every flow that crosses one is where to look. The letters on each element are its STRIDE threats: spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege.',
  },
  'incident-postmortem': {
    note: 'Run sheet (60 min, blameless)\n1. Read the impact and the timeline together (10 min).\n2. Start the timer and work the five whys from the trigger down (15 min).\n3. Add what helped and what hurt (10 min).\n4. Vote on the follow-ups that would have prevented it (5 min).\n5. Give each voted follow-up an owner and a date (20 min).',
    kit: {
      minutes: 15,
      timer: 'Work the five whys from the trigger down.',
      dots: 3,
      vote: 'Which follow-ups would have prevented it?',
    },
  },
  'c4-context': {
    note: 'How to read it: the platform is the one system in focus; the people use it and the grey systems are what it depends on. Every arrow says what flows and how. Zoom in a level with the C4 Container Diagram template.',
  },
  'c4-container': {
    note: 'How to read it: the boundary is the platform from the context diagram, opened up. Each card is something that runs on its own, with its technology under its name. The moving dots trace an order from the app to the courier.',
  },
  'architecture-decision-record': {
    note: 'How to write one: one decision per record. Say what forced it (Context), what mattered (Decision drivers), what else you weighed and how it scored, then the decision and its consequences, good and bad. Change the status chip when it is superseded; never rewrite an accepted record.',
  },

  // Strategy.
  swot: {
    note: 'Run sheet (45 min)\n1. Start the timer: everyone adds strengths, weaknesses, opportunities and threats (10 min).\n2. Read each quadrant out and merge duplicates (15 min).\n3. Vote on the three points that matter most (5 min).\n4. Turn them into moves in the strip below (15 min).',
    kit: {
      minutes: 10,
      timer: 'Everyone adds to all four quadrants.',
      dots: 3,
      vote: 'Which three points matter most?',
    },
  },
  'pestle-analysis': {
    note: 'Run sheet (40 min)\n1. Start the timer: add what is changing outside the business under each lens (10 min).\n2. Read each lens out (15 min).\n3. Vote on what matters most (5 min).\n4. Carry the top notes into the SWOT as opportunities and threats (10 min).',
  },
  'business-model-canvas': {
    note: 'Talk track and run sheet: fill the blocks in their numbered order, customers first, then the value we offer them, how we reach them and what it earns, then what it takes to deliver and what it costs. In a session, start the timer per block and vote on the riskiest assumption.',
    kit: {
      minutes: 20,
      timer: 'Fill the blocks in their numbered order.',
      dots: 3,
      vote: 'Which assumption is riskiest?',
    },
  },
  'value-proposition-canvas': {
    note: 'Run sheet (40 min)\n1. Profile the customer on the right: jobs, then pains, then gains (15 min).\n2. Map the value on the left: products, pain relievers, gain creators (15 min).\n3. Vote on the strongest fit (10 min).',
  },
  'wardley-map': {
    note: 'How to read it: up the side is how visible a component is to the user, across the bottom how evolved it is, from genesis to commodity. Arrows show where a component is heading; the plays say what to build, buy or rent.',
  },
  'rich-picture': {
    note: 'Draw the problem as people see it: a stick figure per stakeholder with what they say, crossed swords where interests clash, and an eye on who is watching. The legend teaches the symbols to anyone joining.',
  },
  'stakeholder-map': {
    note: 'Run sheet (30 min)\n1. List everyone with a stake (5 min).\n2. Start the timer and place each one by power and interest (10 min).\n3. Mark each stance and agree how to engage the top right first (15 min).',
    kit: { minutes: 10, timer: 'Place everyone by power and interest.' },
  },
  pyramid: {
    note: 'Talk track: read it top down, purpose first, then each tier as how the one above it gets done, ending with the initiatives running this quarter.',
  },

  // Teaching and learning.
  'concept-map': {
    note: 'How to read it: every arrow has linking words, so concept, arrow, concept reads as a sentence. Add a concept, then draw an arrow to it and say how it connects. Cross-links between branches show real understanding.',
  },
  'kwl-chart': {
    note: 'Run sheet (a lesson)\n1. Before: the class adds what they already know (5 min).\n2. Then what they want to know, as questions (5 min).\n3. Vote on the questions to answer first.\n4. After the lesson: add what we learned, answering the questions.',
  },
  sketchnote: {
    note: 'Draw as you listen: the title and speaker in the banner, the big idea in the cloud, then key points, quotes and questions in their frames. End with one takeaway along the bottom.',
  },
};

/** What a template says on its title, and the session tools its kit adds; null for the blanks. */
export function templateNote(kind: TemplateKind): TemplateNote | null {
  return NOTES[kind];
}
