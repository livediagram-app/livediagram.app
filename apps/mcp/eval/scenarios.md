# Scenario bank

Each prompt is what a user would type to Claude with the livediagram connector. Ids are stable across runs.

## Diagram + Event Storming

- D1 (easy) "Make me a flowchart of an online checkout: cart, check if signed in (sign in if not), payment, if payment fails show an error and retry, otherwise the order is placed and a receipt emailed."
- D2 (medium) "Diagram our architecture: a web app and a mobile app talk to an API gateway, which routes to auth, orders, catalogue, payments and notifications services. Orders and catalogue each have a Postgres DB, payments uses Stripe, and services publish events to a Kafka bus that notifications consumes. Redis caches the catalogue."
- D3 (hard) "Draw our CI/CD pipeline: on push we lint, unit test and build in parallel; then integration tests; build a Docker image, push to registry; deploy to staging; run e2e and a security scan in parallel; manual approval; canary deploy to 10% in prod; watch metrics for 30 min; if healthy roll out to 100%, otherwise roll back and page on-call."
- D4 (medium) "Org chart for my startup: CEO Maya; CTO Ben (eng managers Ali and Priya, each with 3 engineers: make up names), CPO Sara (2 PMs, 1 designer), COO Tom (finance lead, people lead)."
- D5 (easy) "Mind map brainstorming a product launch for a new coffee subscription: marketing, pricing, logistics, partnerships, launch event, each with 3 or 4 ideas."
- D6 (medium) "Sequence diagram of an OAuth 2 authorization code login with PKCE between the browser, our SPA, the auth server and our API."
- D7 (medium) "ER diagram for a bookstore: books, authors (many to many), publishers, customers, orders, order lines, reviews."
- D8 (medium) "State machine for an order: created, paid, packed, shipped, delivered, plus cancelled (from created or paid) and returned (from delivered), refunded after returned."
- D9 (hard) "Swimlane diagram of our hiring process across Candidate, Recruiter, Hiring manager and Panel: application, screen, phone interview, onsite with the panel, debrief, offer, accept or decline."
- D10 (edit) After D2: "Add a search service backed by Elasticsearch that the gateway routes to, and rename catalogue to Products."
- D11 (medium) "Show the product development lifecycle as a cycle: discover, define, design, build, launch, measure, learn, back to discover."
- D12 (medium) "Run an event storming session board for an online food delivery business: domain events from order placed to delivered, with commands, actors, policies and a couple of hotspots."
- D13 (medium) "A dashboard tab for Q3 sales: revenue by month (Jul 120k, Aug 135k, Sep 160k), revenue by region (UK 40%, EU 35%, US 25%), and a funnel trend of signups vs paid over 6 weeks."
- D14 (hard) "AWS architecture: Route 53 and CloudFront in front of an ALB in a VPC with public and private subnets across 2 AZs, ECS Fargate services in the private subnets, RDS Postgres multi-AZ, ElastiCache, S3 for assets, SQS feeding a Lambda worker."
- D15 (hard) "Diagram our whole platform: 3 client apps (web, iOS, Android), a CDN, an API gateway, 12 microservices (users, auth, catalogue, search, cart, checkout, payments, orders, inventory, shipping, notifications, analytics), each with its own datastore, a Kafka bus most of them publish to, a data warehouse fed by analytics, and 4 third parties (Stripe, SendGrid, Twilio, Algolia). Group it into edge, services, data and external."
- D16 (edit) After D1: "Split payment into 'enter card' and 'authorise payment', add a fraud check between them that can reject the order, and move the receipt email into its own 'Notifications' group."

## Plan + card types

- P1 (easy) "Set up a kanban board for our website redesign with 10 realistic cards spread over the columns, assigned to Ana, Raj and Lee."
- P2 (medium) "Bug tracker board: bugs need severity (critical to low), component, browser, steps to reproduce, and a link to the Sentry issue. Add 8 realistic bugs."
- P3 (medium) "Hiring pipeline for 3 roles: candidates with role, source, salary expectation, CV link, interview date and a 1 to 5 rating; columns from applied to hired/rejected. Add 9 candidates."
- P4 (medium) "Content calendar: posts with channel (LinkedIn, X, Blog, Newsletter), publish date, draft copy, asset link and owner. Columns idea, drafting, review, scheduled, published. 10 posts."
- P5 (hard) "CRM: a deal pipeline (lead, qualified, proposal, negotiation, won, lost) with Deal cards (value in GBP, close date, company, contact email, probability %), plus Company cards linked from deals. Add 6 companies and 10 deals."
- P6 (edit) After P2: "Severity should also have 'blocker', drop the browser field, add a 'customer reported' checkbox, and move the critical bugs to In Progress."

## Sheets

- S1 (easy) "Monthly household budget sheet: income and expense categories, planned vs actual, differences and totals."
- S2 (medium) "Sales tracker: 20 rows of deals with rep, region dropdown, amount, stage dropdown, close date; totals by region; highlight deals over 50k."
- S3 (medium) "Loan calculator: amount, rate, term inputs, monthly payment formula and an amortisation schedule for the first 12 months."
- S4 (hard) "Grade book for 12 students over 5 assignments with weights, weighted average, letter grade by formula, class average and a fail highlight."
- S5 (edit) After S2: "Sort by amount descending, freeze the header, and add a commission column at 8%."

## Illustrate

- I1 (medium) "A 6-slide pitch deck for a coffee subscription startup: problem, solution, market, business model, traction, ask."
- I2 (medium) "An infographic explaining how coffee goes from farm to cup in 6 steps."
- I3 (easy) "Write a one-page Q3 engineering report: highlights, metrics, risks, next quarter."
- I4 (medium) "Design a logo for a bakery called Crumb & Co."
- I5 (hard) "A 5-panel LinkedIn carousel on 5 tips for better code review."

## Facilitate + Draw

- F1 (easy) "Set up a retro for sprint 14 with a few seeded notes in each column."
- F2 (medium) "A workshop kickoff board for a 2-hour product discovery session with agenda, goals, ground rules and an icebreaker."
- F3 (medium) "A brainstorm board on 'how to reduce churn' with 15 sticky ideas clustered into themes."
- F4 (easy) "A town hall Q&A board for our all-hands with 5 seeded questions."
- W1 (medium, Draw) "Sketch a hand-drawn whiteboard of our customer onboarding flow, like someone drew it in a meeting."
- W2 (medium, Draw) "A sketchnote summarising a talk on remote work: the big idea, three key points and a couple of quotes."

## Forms

- Q1 (easy) "Make an RSVP form for our office holiday party on 18 December: name, whether they're coming, plus-one, and dietary needs. Send me the link."
- Q2 (medium) "We need a bug report form customers can fill in. Reports should land on our Bugs board as Bug cards, with severity and the browser they used as card fields, and the summary as the card title."
- Q3 (medium) "Create a post-workshop feedback survey: overall rating out of 10, what worked, what didn't, would they recommend us, and an optional email. Responses should go into a spreadsheet."
- Q4 (hard) "Build a job application form for a senior engineer role in three pages: about you (name, email, LinkedIn), experience (years, current stack as multiple choice, a short paragraph on a project they're proud of), and logistics (notice period, salary expectation, right to work). Only show a visa question if they say they don't have the right to work. Candidates should land in a hiring pipeline board. Make it look branded with a cover."
- Q5 (edit) After Q1: "Close the RSVP at 5pm on 15 December, cap it at 80 people, add a question asking which session they'll attend (afternoon or evening), and make dietary needs required."
