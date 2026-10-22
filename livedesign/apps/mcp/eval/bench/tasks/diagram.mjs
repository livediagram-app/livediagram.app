// The diagram tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import {
  allLinked,
  arrows,
  atLeast,
  boxes,
  elementsFor,
  find,
  flows,
  inside,
  linked,
  mentionsAll,
  shapes,
} from '../checks.mjs';

export default [
  {
    id: 'D1',
    level: 'easy',
    prompt:
      'Make me a flowchart of an online checkout: cart, check if signed in (sign in if not), payment, if payment fails show an error and retry, otherwise the order is placed and a receipt emailed.',
    checks: [
      [
        'every step has a box',
        ({ snap }) =>
          elementsFor(snap, [
            /cart/i,
            /signed in|logged in/i,
            /payment|pay\b/i,
            /error|fail/i,
            /order/i,
            /receipt/i,
          ]),
      ],
      [
        'a sign-in step for the not-signed-in path',
        ({ snap }) => boxes(snap).some((b) => /sign|log/i.test(b.label) && !/\?/.test(b.label)),
      ],
      [
        'the signed-in check is a decision with two ways out',
        ({ snap }) =>
          find(snap, /signed in|logged in/i).some(
            (d) => arrows(snap).filter((a) => a.from?.elementId === d.id).length >= 2,
          ),
      ],
      [
        'a failed payment loops back to retry',
        ({ snap }) => flows(snap, /error|fail/i, /payment|pay\b|retry/i),
      ],
      [
        'the order is placed, then the receipt emailed',
        ({ snap }) => flows(snap, /order/i, /receipt|email/i),
      ],
      [
        'the steps are joined',
        ({ snap }) => atLeast(Math.max(7, boxes(snap).length - 1), arrows(snap).length, 'arrows'),
      ],
    ],
  },
  {
    id: 'D2',
    level: 'medium',
    prompt:
      'Diagram our architecture: a web app and a mobile app talk to an API gateway, which routes to auth, orders, catalogue, payments and notifications services. Orders and catalogue each have a Postgres DB, payments uses Stripe, and services publish events to a Kafka bus that notifications consumes. Redis caches the catalogue.',
    checks: [
      [
        'every part has a box',
        ({ snap }) =>
          elementsFor(snap, [
            /web/i,
            /mobile/i,
            /gateway/i,
            /auth/i,
            /orders?/i,
            /catalog/i,
            /payment/i,
            /notification/i,
            /postgres/i,
            /stripe/i,
            /kafka/i,
            /redis/i,
          ]),
      ],
      [
        'the apps talk to the gateway',
        ({ snap }) =>
          allLinked(snap, [
            [/web/i, /gateway/i],
            [/mobile/i, /gateway/i],
          ]),
      ],
      [
        'the gateway routes to every service',
        ({ snap }) =>
          allLinked(snap, [
            [/gateway/i, /auth/i],
            [/gateway/i, /orders?\b/i],
            [/gateway/i, /catalog/i],
            [/gateway/i, /payment/i],
            [/gateway/i, /notification/i],
          ]),
      ],
      [
        'orders and catalogue each have a Postgres',
        ({ snap }) => ({
          pass:
            find(snap, /postgres/i).length >= 2 &&
            linked(snap, /orders?\b/i, /postgres|db/i) &&
            linked(snap, /catalog/i, /postgres|db/i),
          detail: `${find(snap, /postgres/i).length} Postgres`,
        }),
      ],
      ['payments uses Stripe', ({ snap }) => linked(snap, /payment/i, /stripe/i)],
      ['notifications consumes Kafka', ({ snap }) => linked(snap, /kafka/i, /notification/i)],
      [
        'services publish to Kafka',
        ({ snap }) =>
          atLeast(
            2,
            arrows(snap).filter((a) =>
              find(snap, /kafka/i).some(
                (k) => a.to?.elementId === k.id || a.from?.elementId === k.id,
              ),
            ).length,
            'arrows at Kafka',
          ),
      ],
      ['Redis caches the catalogue', ({ snap }) => linked(snap, /redis/i, /catalog/i)],
    ],
  },
  {
    id: 'D3',
    level: 'hard',
    prompt:
      'Draw our CI/CD pipeline: on push we lint, unit test and build in parallel; then integration tests; build a Docker image, push to registry; deploy to staging; run e2e and a security scan in parallel; manual approval; canary deploy to 10% in prod; watch metrics for 30 min; if healthy roll out to 100%, otherwise roll back and page on-call.',
    checks: [
      [
        'every stage has a box',
        ({ snap }) =>
          elementsFor(snap, [
            /lint/i,
            /unit/i,
            /build/i,
            /integration/i,
            /docker|image/i,
            /registry|push/i,
            /staging/i,
            /e2e|end.to.end/i,
            /security/i,
            /approv/i,
            /canary/i,
            /metric|watch|monitor/i,
            /100|full|roll ?out/i,
            /roll ?back/i,
            /page|on.call/i,
          ]),
      ],
      [
        'lint, unit tests and build run side by side, then integration',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/lint/i, /integration/i],
              [/unit/i, /integration/i],
              [/^(?!.*docker).*build/i, /integration/i],
            ],
            { directed: true },
          ),
      ],
      [
        'e2e and the security scan run side by side before approval',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/e2e|end.to.end/i, /approv/i],
              [/security/i, /approv/i],
            ],
            { directed: true },
          ),
      ],
      [
        'approval, then canary, then watching metrics',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/approv/i, /canary/i],
              [/canary/i, /metric|watch|monitor|healthy/i],
            ],
            { directed: true },
          ),
      ],
      [
        'healthy rolls out to 100%, else roll back and page on-call',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/healthy|metric|watch/i, /100|full|roll ?out/i],
              [/healthy|metric|watch/i, /roll ?back/i],
            ],
            { directed: true },
          ),
      ],
      ['30 minutes is said', ({ snap }) => mentionsAll(snap, [/30 ?min/i])],
    ],
  },
  {
    id: 'D4',
    level: 'medium',
    prompt:
      'Org chart for my startup: CEO Maya; CTO Ben (eng managers Ali and Priya, each with 3 engineers: make up names), CPO Sara (2 PMs, 1 designer), COO Tom (finance lead, people lead).',
    checks: [
      [
        'every named person has a box',
        ({ snap }) => elementsFor(snap, ['Maya', 'Ben', 'Ali', 'Priya', 'Sara', 'Tom']),
      ],
      [
        'the C-suite reports to Maya',
        ({ snap }) =>
          allLinked(snap, [
            ['Maya', 'Ben'],
            ['Maya', 'Sara'],
            ['Maya', 'Tom'],
          ]),
      ],
      [
        'Ali and Priya report to Ben',
        ({ snap }) =>
          allLinked(snap, [
            ['Ben', 'Ali'],
            ['Ben', 'Priya'],
          ]),
      ],
      [
        '17 people in all',
        ({ snap }) =>
          atLeast(
            17,
            boxes(snap).filter((b) => !/^(engineering|product|operations|team)$/i.test(b.label))
              .length,
            'boxes',
          ),
      ],
      [
        'the finance and people leads sit under Tom',
        ({ snap }) =>
          allLinked(snap, [
            ['Tom', /finance/i],
            ['Tom', /people/i],
          ]),
      ],
    ],
  },
  {
    id: 'D5',
    level: 'easy',
    prompt:
      'Mind map brainstorming a product launch for a new coffee subscription: marketing, pricing, logistics, partnerships, launch event, each with 3 or 4 ideas.',
    checks: [
      [
        'the centre is the coffee subscription launch',
        ({ snap }) => elementsFor(snap, [/coffee|subscription|launch/i]),
      ],
      [
        'every branch has a node',
        ({ snap }) =>
          elementsFor(snap, [/marketing/i, /pricing/i, /logistic/i, /partner/i, /event/i]),
      ],
      ['3 or 4 ideas per branch', ({ snap }) => atLeast(21, boxes(snap).length, 'nodes')],
      ['the branches join the centre', ({ snap }) => atLeast(20, arrows(snap).length, 'lines')],
    ],
  },
  {
    id: 'D6',
    level: 'medium',
    prompt:
      'Sequence diagram of an OAuth 2 authorization code login with PKCE between the browser, our SPA, the auth server and our API.',
    checks: [
      [
        'the four parties are there',
        ({ snap }) =>
          elementsFor(snap, [/browser|user/i, /spa|app|client/i, /auth/i, /\bapi\b|resource/i]),
      ],
      [
        'PKCE is shown (a verifier or a challenge)',
        ({ snap }) => mentionsAll(snap, [/verifier|challenge/i]),
      ],
      ['the code is swapped for a token', ({ snap }) => mentionsAll(snap, [/code/i, /token/i])],
      ['enough messages for the flow', ({ snap }) => atLeast(8, arrows(snap).length, 'messages')],
    ],
  },
  {
    id: 'D7',
    level: 'medium',
    prompt:
      'ER diagram for a bookstore: books, authors (many to many), publishers, customers, orders, order lines, reviews.',
    checks: [
      [
        'every entity is there',
        ({ snap }) =>
          elementsFor(snap, [
            /book/i,
            /author/i,
            /publisher/i,
            /customer/i,
            /order/i,
            /line|item/i,
            /review/i,
          ]),
      ],
      [
        'books and authors are many to many (a join entity or a relationship)',
        ({ snap }) =>
          find(snap, /book.?author|author.?book|written/i).length > 0 ||
          linked(snap, /author/i, /book/i),
      ],
      [
        'entities carry fields',
        ({ snap }) =>
          atLeast(
            6,
            shapes(snap, 'entity').filter((e) => (e.entityFields ?? []).length >= 2).length,
            'entities with fields',
          ),
      ],
      ['relationships join them', ({ snap }) => atLeast(7, arrows(snap).length, 'relationships')],
    ],
  },
  {
    id: 'D8',
    level: 'medium',
    prompt:
      'State machine for an order: created, paid, packed, shipped, delivered, plus cancelled (from created or paid) and returned (from delivered), refunded after returned.',
    checks: [
      [
        'every state is there',
        ({ snap }) =>
          elementsFor(snap, [
            /created/i,
            /paid/i,
            /packed/i,
            /shipped/i,
            /delivered/i,
            /cancel/i,
            /return/i,
            /refund/i,
          ]),
      ],
      [
        'the happy path runs in order',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/created/i, /paid/i],
              [/paid/i, /packed/i],
              [/packed/i, /shipped/i],
              [/shipped/i, /delivered/i],
            ],
            { directed: true },
          ),
      ],
      [
        'cancelled from created or paid',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/created/i, /cancel/i],
              [/^paid$|paid\b/i, /cancel/i],
            ],
            { directed: true },
          ),
      ],
      [
        'returned from delivered, then refunded',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/delivered/i, /return/i],
              [/return/i, /refund/i],
            ],
            { directed: true },
          ),
      ],
    ],
  },
  {
    id: 'D9',
    level: 'hard',
    prompt:
      'Swimlane diagram of our hiring process across Candidate, Recruiter, Hiring manager and Panel: application, screen, phone interview, onsite with the panel, debrief, offer, accept or decline.',
    checks: [
      [
        'a lane per party',
        ({ snap }) => ({
          pass: ['Candidate', 'Recruiter', /hiring manager/i, 'Panel'].every((w) =>
            find(snap, w).some(
              (e) => e.shape === 'lane' || e.shape === 'frame' || e.shape === 'pool',
            ),
          ),
          detail: `lanes: ${shapes(snap, 'lane')
            .map((l) => l.label)
            .join(', ')}`,
        }),
      ],
      [
        'every step is there',
        ({ snap }) =>
          elementsFor(snap, [
            /appl/i,
            /screen/i,
            /phone/i,
            /onsite/i,
            /debrief/i,
            /offer/i,
            /accept/i,
          ]),
      ],
      ['the onsite sits with the panel', ({ snap }) => inside(snap, /onsite/i, /panel/i)],
      ['accept or decline branches', ({ snap }) => mentionsAll(snap, [/accept/i, /decline/i])],
      ['the steps are joined', ({ snap }) => atLeast(7, arrows(snap).length, 'arrows')],
    ],
  },
  {
    id: 'D10',
    level: 'edit',
    after: 'D2',
    prompt:
      'Add a search service backed by Elasticsearch that the gateway routes to, and rename catalogue to Products.',
    checks: [
      ['a search service the gateway routes to', ({ snap }) => linked(snap, /gateway/i, /search/i)],
      ['search is backed by Elasticsearch', ({ snap }) => linked(snap, /search/i, /elastic/i)],
      [
        'catalogue is renamed Products',
        ({ snap }) => ({
          pass: find(snap, /products?/i).length > 0 && find(snap, /catalog/i).length === 0,
          detail: `catalogue labels left: ${find(snap, /catalog/i)
            .map((e) => e.label)
            .join(', ')}`,
        }),
      ],
      [
        'Products keeps its Postgres and Redis',
        ({ snap }) =>
          allLinked(snap, [
            [/products?/i, /postgres|db/i],
            [/redis/i, /products?/i],
          ]),
      ],
      [
        'the rest is kept',
        ({ snap }) =>
          elementsFor(snap, [/auth/i, /payment/i, /notification/i, /stripe/i, /kafka/i]),
      ],
    ],
  },
  {
    id: 'D11',
    level: 'medium',
    prompt:
      'Show the product development lifecycle as a cycle: discover, define, design, build, launch, measure, learn, back to discover.',
    checks: [
      [
        'every stage is there',
        ({ snap }) =>
          elementsFor(snap, [
            /discover/i,
            /define/i,
            /design/i,
            /build/i,
            /launch/i,
            /measure/i,
            /learn/i,
          ]),
      ],
      [
        'the stages run in order',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/discover/i, /define/i],
              [/define/i, /design/i],
              [/design/i, /build/i],
              [/build/i, /launch/i],
              [/launch/i, /measure/i],
              [/measure/i, /learn/i],
            ],
            { directed: true },
          ),
      ],
      ['learn leads back to discover', ({ snap }) => flows(snap, /learn/i, /discover/i)],
    ],
  },
  {
    id: 'D13',
    level: 'medium',
    prompt:
      'A dashboard tab for Q3 sales: revenue by month (Jul 120k, Aug 135k, Sep 160k), revenue by region (UK 40%, EU 35%, US 25%), and a funnel trend of signups vs paid over 6 weeks.',
    checks: [
      [
        'revenue by month as a chart with Jul 120k, Aug 135k, Sep 160k',
        ({ snap }) =>
          shapes(snap, 'bar-chart')
            .concat(shapes(snap, 'line-chart'), shapes(snap, 'column-chart'))
            .some(
              (c) =>
                JSON.stringify(c).match(/120/) &&
                JSON.stringify(c).match(/135/) &&
                JSON.stringify(c).match(/160/),
            ),
      ],
      [
        'revenue by region as a share chart (UK 40, EU 35, US 25)',
        ({ snap }) =>
          [...shapes(snap, 'pie-chart'), ...shapes(snap, 'bar-chart')].some(
            (c) =>
              /UK/.test(JSON.stringify(c)) &&
              /40/.test(JSON.stringify(c)) &&
              /35/.test(JSON.stringify(c)) &&
              /25/.test(JSON.stringify(c)),
          ),
      ],
      [
        'signups vs paid over 6 weeks as two series',
        ({ snap }) =>
          shapes(snap, 'line-chart')
            .concat(shapes(snap, 'bar-chart'))
            .some((c) => (c.lineSeries ?? []).length >= 2 && (c.lineCategories ?? []).length >= 6),
      ],
    ],
  },
  {
    id: 'D14',
    level: 'hard',
    prompt:
      'AWS architecture: Route 53 and CloudFront in front of an ALB in a VPC with public and private subnets across 2 AZs, ECS Fargate services in the private subnets, RDS Postgres multi-AZ, ElastiCache, S3 for assets, SQS feeding a Lambda worker.',
    checks: [
      [
        'every AWS part is there',
        ({ snap }) =>
          elementsFor(snap, [
            /route ?53/i,
            /cloudfront/i,
            /alb|load balancer/i,
            /vpc/i,
            /public/i,
            /private/i,
            /fargate|ecs/i,
            /rds|postgres/i,
            /elasticache|redis/i,
            /\bs3\b/i,
            /sqs/i,
            /lambda/i,
          ]),
      ],
      [
        'two availability zones',
        ({ snap }) =>
          mentionsAll(snap, [
            /(az|availability zone)\s*-?\s*(1|a)\b/i,
            /(az|availability zone)\s*-?\s*(2|b)\b/i,
          ]),
      ],
      [
        'Route 53 → CloudFront → ALB',
        ({ snap }) =>
          allLinked(snap, [
            [/route ?53/i, /cloudfront/i],
            [/cloudfront/i, /alb|load balancer/i],
          ]),
      ],
      [
        'the ALB reaches the services',
        ({ snap }) => linked(snap, /alb|load balancer/i, /fargate|ecs|service/i),
      ],
      ['SQS feeds the Lambda', ({ snap }) => linked(snap, /sqs/i, /lambda/i)],
      ['RDS is multi-AZ', ({ snap }) => mentionsAll(snap, [/multi-?az|standby|replica/i])],
      [
        'the services sit in private subnets',
        ({ snap }) => inside(snap, /fargate|ecs|service/i, /private/i),
      ],
    ],
  },
  {
    id: 'D15',
    level: 'hard',
    prompt:
      'Diagram our whole platform: 3 client apps (web, iOS, Android), a CDN, an API gateway, 12 microservices (users, auth, catalogue, search, cart, checkout, payments, orders, inventory, shipping, notifications, analytics), each with its own datastore, a Kafka bus most of them publish to, a data warehouse fed by analytics, and 4 third parties (Stripe, SendGrid, Twilio, Algolia). Group it into edge, services, data and external.',
    checks: [
      ['the three clients', ({ snap }) => elementsFor(snap, [/web/i, /ios/i, /android/i])],
      [
        'all 12 services',
        ({ snap }) =>
          elementsFor(snap, [
            /users?\b/i,
            /auth/i,
            /catalog/i,
            /search/i,
            /cart/i,
            /checkout/i,
            /payment/i,
            /orders?\b/i,
            /inventory/i,
            /shipping/i,
            /notification/i,
            /analytics/i,
          ]),
      ],
      [
        'CDN, gateway, Kafka and warehouse',
        ({ snap }) => elementsFor(snap, [/cdn/i, /gateway/i, /kafka/i, /warehouse/i]),
      ],
      [
        'the four third parties',
        ({ snap }) => elementsFor(snap, [/stripe/i, /sendgrid/i, /twilio/i, /algolia/i]),
      ],
      [
        'a datastore per service',
        ({ snap }) => atLeast(24, boxes(snap).length, 'boxes (12 services + 12 stores)'),
      ],
      [
        'grouped into edge, services, data and external',
        ({ snap }) => {
          const groups = [...shapes(snap, 'frame'), ...shapes(snap, 'lane')];
          const missing = [/edge/i, /service/i, /data/i, /external|third/i].filter(
            (w) => !groups.some((g) => w.test(g.label ?? '')),
          );
          return {
            pass: missing.length === 0,
            detail: missing.length ? `no group: ${missing.map((m) => m.source).join(', ')}` : null,
          };
        },
      ],
      ['analytics feeds the warehouse', ({ snap }) => linked(snap, /analytics/i, /warehouse/i)],
    ],
  },
  {
    id: 'D16',
    level: 'edit',
    after: 'D1',
    prompt:
      "Split payment into 'enter card' and 'authorise payment', add a fraud check between them that can reject the order, and move the receipt email into its own 'Notifications' group.",
    checks: [
      [
        'payment split into enter card and authorise payment',
        ({ snap }) => elementsFor(snap, [/card/i, /authori[sz]/i]),
      ],
      [
        'a fraud check between them',
        ({ snap }) =>
          allLinked(
            snap,
            [
              [/card/i, /fraud/i],
              [/fraud/i, /authori[sz]/i],
            ],
            { directed: true },
          ),
      ],
      [
        'the fraud check can reject the order',
        ({ snap }) =>
          find(snap, /fraud/i).some(
            (f) => arrows(snap).filter((a) => a.from?.elementId === f.id).length >= 2,
          ) && mentionsAll(snap, [/reject|declin|block|cancel/i]).pass,
      ],
      [
        'the receipt email sits in a Notifications group',
        ({ snap }) => inside(snap, /receipt|email/i, /notification/i),
      ],
      [
        'the rest of the checkout is kept',
        ({ snap }) => elementsFor(snap, [/cart/i, /signed in|logged in/i, /order/i]),
      ],
    ],
  },
];
