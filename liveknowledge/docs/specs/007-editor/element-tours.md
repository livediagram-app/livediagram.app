# Element tours (retired)

Retired on 2026-11-22 (Work Tracker 1348) for the [Get Started tours](knowledge-tours.md). Owner, 2026-11-21: "In the
settings under get started I see show me for every element showing livediagram elements, not relevant to
liveknowledgebase".

The fork brought livediagram's element tours: a tour of one complex element (the Sankey diagram, the concept graphics,
the data charts and the stack), offered on the footer's Get Started button while one was selected, and listed in
Settings › Getting Started › **Show Me**, one switch per element. A knowledgebase is writing; those elements live only
inside a drawing zone, and the tours taught a free canvas's gestures. They are gone with their Settings section.

What went with them: `ElementTourHost.tsx`, `element-tour-defs.ts`, every `<kind>-tour-steps.ts` of an element
(`sankey-element-`, `layer-stack-`, `pyramid-`, `funnel-`, `cycle-`, `hub-`, `onion-`, `timeline-`, `chevrons-`,
`chart-`, `stack-`, `concept-element-`), `menu-tour-step.ts`, `lib/element-tours.ts` and their tests. Their
preferences, `elementTourKinds` and `elementToursSeen`, are read by nothing and kept as stored. Their events
(`<Kind>Tour*`, `<Kind>TourSeen*`, `ElementToursSeen*`) are retired on the dashboard
([Telemetry](../017-telemetry/telemetry.md) "Retired features").

Kept: the Sankey **Flows** dialog's own Show Me ([Show Me](show-me.md)), a tour of that dialog started from its title
row, which a Sankey in a drawing still opens.
