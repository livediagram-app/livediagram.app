// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-openapi-schemas.mjs from @liveknowledge/api-schema.
// Regenerate with: pnpm --filter @liveknowledge/api gen:openapi
// Served as the `components.schemas` of GET /api/openapi.json (docs/specs/015-api/api-documentation.md).
import type { ComponentSchemas } from '@liveworkspace/api-kit/openapi-types';

export const COMPONENT_SCHEMAS: ComponentSchemas = {
  AccentEdge: {
    enum: ['left', 'top', 'bottom'],
    type: 'string',
  },
  AcceptSuggestionResponse: {
    additionalProperties: false,
    description: "`POST .../suggestions/<id>/accept`: the page's new revision.",
    properties: {
      tab: {
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
          },
          rev: {
            type: 'number',
          },
        },
        required: ['id', 'rev'],
        type: 'object',
      },
    },
    required: ['tab'],
    type: 'object',
  },
  AccessLevel: {
    enum: ['view', 'participate', 'edit'],
    type: 'string',
  },
  AgentPresenceResult: {
    additionalProperties: false,
    properties: {
      expiresAt: {
        type: 'number',
      },
      focus: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      status: {
        type: ['string', 'null'],
      },
      tabId: {
        type: 'string',
      },
    },
    required: ['tabId', 'status', 'focus', 'expiresAt'],
    type: 'object',
  },
  AgentScope: {
    description: 'What an agent may do in a knowledgebase (knowledgebase-for-agents.md "Scopes").',
    enum: ['read', 'suggest', 'write'],
    type: 'string',
  },
  AgentScopesRequest: {
    additionalProperties: false,
    description:
      '`PUT .../agents/<tokenId>/scopes`: what one API token may do in this knowledgebase.',
    properties: {
      scopes: {
        items: {
          $ref: '#/components/schemas/AgentScope',
        },
        type: 'array',
      },
    },
    required: ['scopes'],
    type: 'object',
  },
  AgentScopesResponse: {
    additionalProperties: false,
    properties: {
      scopes: {
        items: {
          $ref: '#/components/schemas/AgentScope',
        },
        type: 'array',
      },
      tokenId: {
        type: 'string',
      },
    },
    required: ['tokenId', 'scopes'],
    type: 'object',
  },
  Anchor: {
    enum: [
      'n',
      'nne',
      'ne',
      'ene',
      'e',
      'ese',
      'se',
      'sse',
      's',
      'ssw',
      'sw',
      'wsw',
      'w',
      'wnw',
      'nw',
      'nnw',
    ],
    type: 'string',
  },
  AnimationSpeed: {
    enum: ['slowest', 'slow', 'normal', 'fast'],
    type: 'string',
  },
  ArrowElement: {
    additionalProperties: false,
    properties: {
      arrowEnds: {
        $ref: '#/components/schemas/ArrowEnds',
      },
      arrowStyle: {
        $ref: '#/components/schemas/ArrowStyle',
      },
      arrowheadColor: {
        type: 'string',
      },
      arrowheadShape: {
        $ref: '#/components/schemas/ArrowheadShape',
      },
      arrowheadSize: {
        $ref: '#/components/schemas/ArrowheadSize',
      },
      arrowheadStartShape: {
        $ref: '#/components/schemas/ArrowheadShape',
      },
      curveOffset: {
        additionalProperties: false,
        properties: {
          dx: {
            type: 'number',
          },
          dy: {
            type: 'number',
          },
        },
        required: ['dx', 'dy'],
        type: 'object',
      },
      curvePoints: {
        items: {
          additionalProperties: false,
          properties: {
            dx: {
              type: 'number',
            },
            dy: {
              type: 'number',
            },
          },
          required: ['dx', 'dy'],
          type: 'object',
        },
        type: 'array',
      },
      elbowOffset: {
        additionalProperties: false,
        properties: {
          dx: {
            type: 'number',
          },
          dy: {
            type: 'number',
          },
        },
        required: ['dx', 'dy'],
        type: 'object',
      },
      exactEnd: {
        type: 'boolean',
      },
      exactStart: {
        type: 'boolean',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      flow: {
        $ref: '#/components/schemas/ArrowFlow',
      },
      flowRepeat: {
        type: 'boolean',
      },
      flowSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      font: {
        type: 'string',
      },
      from: {
        $ref: '#/components/schemas/Endpoint',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      labelFill: {
        type: 'string',
      },
      labelMaxWidth: {
        type: 'number',
      },
      labelOffset: {
        additionalProperties: false,
        properties: {
          offset: {
            type: 'number',
          },
          t: {
            type: 'number',
          },
        },
        required: ['t', 'offset'],
        type: 'object',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      opacity: {
        type: 'number',
      },
      penColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      penTextColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      routeBehind: {
        type: 'boolean',
      },
      strokeColor: {
        type: 'string',
      },
      strokeStyle: {
        $ref: '#/components/schemas/BorderStyle',
      },
      strokeSwatch: {
        $ref: '#/components/schemas/QuickSwatchSlot',
      },
      strokeWidth: {
        type: 'number',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      to: {
        $ref: '#/components/schemas/Endpoint',
      },
      type: {
        const: 'arrow',
        type: 'string',
      },
    },
    required: ['id', 'type', 'from', 'to'],
    type: 'object',
  },
  ArrowEnds: {
    enum: ['from', 'to', 'both', 'none'],
    type: 'string',
  },
  ArrowFlow: {
    enum: [
      'dashes',
      'dots',
      'beads',
      'pulse',
      'grow',
      'glow',
      'heartbeat',
      'breathe',
      'shimmer',
      'signal',
      'draw',
      'comet',
      'rainbow',
      'strobe',
      'wind',
    ],
    type: 'string',
  },
  ArrowStyle: {
    enum: ['straight', 'curved', 'angled'],
    type: 'string',
  },
  ArrowheadShape: {
    enum: [
      'triangle',
      'triangle-hollow',
      'line',
      'circle',
      'circle-hollow',
      'diamond',
      'diamond-hollow',
      'one',
      'zero-or-one',
      'many',
      'zero-or-many',
      'one-or-many',
    ],
    type: 'string',
  },
  ArrowheadSize: {
    enum: ['small', 'medium', 'large', 'extra-large'],
    type: 'string',
  },
  ArticleAlign: {
    enum: ['left', 'center', 'right', 'justify'],
    type: 'string',
  },
  ArticleBand: {
    additionalProperties: false,
    description: 'A header or a footer: its left, centre and right parts, plain text with fields.',
    properties: {
      center: {
        type: 'string',
      },
      left: {
        type: 'string',
      },
      right: {
        type: 'string',
      },
    },
    type: 'object',
  },
  ArticleBlock: {
    anyOf: [
      {
        $ref: '#/components/schemas/ArticleParagraphBlock',
      },
      {
        $ref: '#/components/schemas/ArticleListBlock',
      },
      {
        $ref: '#/components/schemas/ArticleCodeBlock',
      },
      {
        $ref: '#/components/schemas/ArticleDividerBlock',
      },
      {
        $ref: '#/components/schemas/ArticlePageBreakBlock',
      },
      {
        $ref: '#/components/schemas/ArticleTableBlock',
      },
      {
        $ref: '#/components/schemas/ArticleTocBlock',
      },
      {
        $ref: '#/components/schemas/ArticleZoneBlock',
      },
    ],
  },
  ArticleCodeBlock: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      lang: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
      type: {
        const: 'code',
        type: 'string',
      },
    },
    required: ['id', 'type', 'text'],
    type: 'object',
  },
  ArticleDividerBlock: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      type: {
        const: 'divider',
        type: 'string',
      },
    },
    required: ['id', 'type'],
    type: 'object',
  },
  ArticleFlow: {
    additionalProperties: false,
    properties: {
      blocks: {
        items: {
          $ref: '#/components/schemas/ArticleBlock',
        },
        type: 'array',
      },
      style: {
        $ref: '#/components/schemas/ArticleStyle',
      },
    },
    required: ['blocks'],
    type: 'object',
  },
  ArticleLineSpacing: {
    enum: ['single', 'onehalf', 'double'],
    type: 'string',
  },
  ArticleListBlock: {
    additionalProperties: false,
    properties: {
      align: {
        $ref: '#/components/schemas/ArticleAlign',
      },
      checked: {
        const: true,
        type: 'boolean',
      },
      id: {
        type: 'string',
      },
      level: {
        type: 'number',
      },
      list: {
        $ref: '#/components/schemas/ArticleListKind',
      },
      runs: {
        items: {
          $ref: '#/components/schemas/ArticleRun',
        },
        type: 'array',
      },
      type: {
        const: 'list',
        type: 'string',
      },
    },
    required: ['id', 'type', 'list', 'runs'],
    type: 'object',
  },
  ArticleListKind: {
    enum: ['bullet', 'numbered', 'todo'],
    type: 'string',
  },
  ArticleLookId: {
    enum: ['clean', 'classic', 'report', 'notebook', 'bold'],
    type: 'string',
  },
  ArticleMargins: {
    enum: ['narrow', 'normal', 'wide'],
    type: 'string',
  },
  ArticleNoteElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      articleNote: {
        enum: ['comment', 'action'],
        type: 'string',
      },
      aspectLocked: {
        type: 'boolean',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      fillColor: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      headerFill: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      rotation: {
        type: 'number',
      },
      strokeColor: {
        type: 'string',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'article-note',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height', 'articleNote'],
    type: 'object',
  },
  ArticlePageBreakBlock: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      type: {
        const: 'pageBreak',
        type: 'string',
      },
    },
    required: ['id', 'type'],
    type: 'object',
  },
  ArticleParagraphBlock: {
    additionalProperties: false,
    properties: {
      align: {
        $ref: '#/components/schemas/ArticleAlign',
      },
      id: {
        type: 'string',
      },
      runs: {
        items: {
          $ref: '#/components/schemas/ArticleRun',
        },
        type: 'array',
      },
      style: {
        $ref: '#/components/schemas/ArticleParagraphStyle',
      },
      type: {
        const: 'paragraph',
        type: 'string',
      },
    },
    required: ['id', 'type', 'runs'],
    type: 'object',
  },
  ArticleParagraphSpacing: {
    enum: ['none', 'normal', 'wide'],
    type: 'string',
  },
  ArticleParagraphStyle: {
    enum: ['body', 'title', 'subtitle', 'h1', 'h2', 'h3', 'quote'],
    type: 'string',
  },
  ArticleReadabilitySummary: {
    additionalProperties: false,
    properties: {
      ease: {
        type: ['number', 'null'],
      },
      level: {
        type: ['string', 'null'],
      },
      longSentences: {
        type: 'number',
      },
      readingMinutes: {
        type: 'number',
      },
      sentences: {
        type: 'number',
      },
      wordsPerSentence: {
        type: 'number',
      },
    },
    required: ['readingMinutes', 'sentences', 'wordsPerSentence', 'longSentences', 'ease', 'level'],
    type: 'object',
  },
  ArticleRules: {
    enum: ['none', 'title', 'headings'],
    type: 'string',
  },
  ArticleRun: {
    additionalProperties: false,
    description:
      "A stretch of text with one formatting. `text` may hold '\\n', a line break inside the block.",
    properties: {
      b: {
        const: true,
        type: 'boolean',
      },
      code: {
        const: true,
        type: 'boolean',
      },
      color: {
        type: 'string',
      },
      fn: {
        type: 'string',
      },
      hl: {
        type: 'string',
      },
      href: {
        type: 'string',
      },
      i: {
        const: true,
        type: 'boolean',
      },
      nk: {
        const: 'action',
        type: 'string',
      },
      note: {
        type: 'string',
      },
      s: {
        const: true,
        type: 'boolean',
      },
      sub: {
        const: true,
        type: 'boolean',
      },
      sup: {
        const: true,
        type: 'boolean',
      },
      text: {
        type: 'string',
      },
      u: {
        const: true,
        type: 'boolean',
      },
    },
    required: ['text'],
    type: 'object',
  },
  ArticleStyle: {
    additionalProperties: false,
    description:
      'An article\'s look (docs/specs/007-editor/article-pages.md "Article style"). Every field is optional, absent being its default (`resolveArticleStyle`).',
    properties: {
      accent: {
        type: 'string',
      },
      accentHeadings: {
        type: 'boolean',
      },
      bodyFont: {
        type: 'string',
      },
      differentFirstPage: {
        const: true,
        type: 'boolean',
      },
      footer: {
        $ref: '#/components/schemas/ArticleBand',
      },
      header: {
        $ref: '#/components/schemas/ArticleBand',
      },
      headingFont: {
        type: 'string',
      },
      lineSpacing: {
        $ref: '#/components/schemas/ArticleLineSpacing',
      },
      look: {
        $ref: '#/components/schemas/ArticleLookId',
      },
      margins: {
        $ref: '#/components/schemas/ArticleMargins',
      },
      pageNumbers: {
        type: 'boolean',
      },
      paragraphSpacing: {
        $ref: '#/components/schemas/ArticleParagraphSpacing',
      },
      rules: {
        $ref: '#/components/schemas/ArticleRules',
      },
      textSize: {
        $ref: '#/components/schemas/ArticleTextSize',
      },
    },
    type: 'object',
  },
  ArticleSummary: {
    additionalProperties: false,
    properties: {
      blocks: {
        type: 'number',
      },
      estimatedPages: {
        type: 'number',
      },
      flow: {
        type: 'string',
      },
      look: {
        anyOf: [
          {
            $ref: '#/components/schemas/ArticleLookId',
          },
          {
            type: 'null',
          },
        ],
      },
      pages: {
        items: {
          type: 'number',
        },
        type: 'array',
      },
      readability: {
        $ref: '#/components/schemas/ArticleReadabilitySummary',
      },
      title: {
        type: 'string',
      },
      words: {
        type: 'number',
      },
    },
    required: [
      'flow',
      'title',
      'pages',
      'blocks',
      'words',
      'estimatedPages',
      'readability',
      'look',
    ],
    type: 'object',
  },
  ArticleTableBlock: {
    additionalProperties: false,
    properties: {
      cols: {
        items: {
          $ref: '#/components/schemas/ArticleTableColumn',
        },
        type: 'array',
      },
      header: {
        const: true,
        type: 'boolean',
      },
      id: {
        type: 'string',
      },
      rows: {
        items: {
          $ref: '#/components/schemas/ArticleTableRow',
        },
        type: 'array',
      },
      type: {
        const: 'table',
        type: 'string',
      },
    },
    required: ['id', 'type', 'cols', 'rows'],
    type: 'object',
  },
  ArticleTableColumn: {
    additionalProperties: false,
    description:
      'A column: its id (what a cell op names) and its share of the text width (the shares sum to 1).',
    properties: {
      id: {
        type: 'string',
      },
      w: {
        type: 'number',
      },
    },
    required: ['id', 'w'],
    type: 'object',
  },
  ArticleTableRow: {
    additionalProperties: false,
    description:
      "A row: its id and one cell per column, in the columns' order; a cell is its runs.",
    properties: {
      cells: {
        items: {
          items: {
            $ref: '#/components/schemas/ArticleRun',
          },
          type: 'array',
        },
        type: 'array',
      },
      id: {
        type: 'string',
      },
    },
    required: ['id', 'cells'],
    type: 'object',
  },
  ArticleTextSize: {
    enum: ['small', 'normal', 'large'],
    type: 'string',
  },
  ArticleTocBlock: {
    additionalProperties: false,
    properties: {
      depth: {
        enum: [1, 2],
        type: 'number',
      },
      id: {
        type: 'string',
      },
      type: {
        const: 'toc',
        type: 'string',
      },
    },
    required: ['id', 'type'],
    type: 'object',
  },
  ArticleWrite: {
    additionalProperties: false,
    properties: {
      article: {
        type: 'string',
      },
      markdown: {
        type: 'string',
      },
      mode: {
        $ref: '#/components/schemas/ArticleWriteMode',
      },
    },
    required: ['markdown'],
    type: 'object',
  },
  ArticleWriteMode: {
    enum: ['replace', 'append'],
    type: 'string',
  },
  ArticleZoneAlign: {
    enum: ['left', 'center', 'right'],
    type: 'string',
  },
  ArticleZoneAt: {
    additionalProperties: false,
    properties: {
      page: {
        type: 'string',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['page', 'x', 'y'],
    type: 'object',
  },
  ArticleZoneBlock: {
    additionalProperties: false,
    properties: {
      align: {
        $ref: '#/components/schemas/ArticleZoneAlign',
      },
      at: {
        $ref: '#/components/schemas/ArticleZoneAt',
      },
      height: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      type: {
        const: 'zone',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      wrap: {
        $ref: '#/components/schemas/ArticleZoneWrap',
      },
      zone: {
        $ref: '#/components/schemas/ArticleZoneKind',
      },
    },
    required: ['id', 'type', 'zone', 'width', 'height'],
    type: 'object',
  },
  ArticleZoneKind: {
    enum: ['object', 'drawing'],
    type: 'string',
  },
  ArticleZoneWrap: {
    enum: ['inline', 'left', 'right'],
    type: 'string',
  },
  AskEvent: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          text: {
            type: 'string',
          },
          type: {
            const: 'delta',
            type: 'string',
          },
        },
        required: ['type', 'text'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          gaps: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          model: {
            type: 'string',
          },
          notUsed: {
            items: {
              $ref: '#/components/schemas/AskNotUsed',
            },
            type: 'array',
          },
          sources: {
            items: {
              $ref: '#/components/schemas/AskSource',
            },
            type: 'array',
          },
          text: {
            type: 'string',
          },
          type: {
            const: 'done',
            type: 'string',
          },
        },
        required: ['type', 'text', 'sources', 'notUsed', 'gaps', 'model'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
          },
          message: {
            type: 'string',
          },
          provider: {
            $ref: '#/components/schemas/KnowledgeAiProvider',
          },
          type: {
            const: 'error',
            type: 'string',
          },
        },
        required: ['type', 'kind', 'message'],
        type: 'object',
      },
    ],
    description:
      "Ask answers as server-sent events, in this order: `delta` (the answer's next piece), then one `done`; or one `error` in place of either.",
  },
  AskNotUsed: {
    additionalProperties: false,
    properties: {
      firstBlock: {
        type: 'string',
      },
      headings: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      lastBlock: {
        type: 'string',
      },
      number: {
        type: 'number',
      },
      passageId: {
        type: 'string',
      },
      reason: {
        type: 'string',
      },
      tab: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      trust: {
        $ref: '#/components/schemas/KnowledgeTrustState',
      },
      verifiedAt: {
        type: 'number',
      },
    },
    required: [
      'firstBlock',
      'headings',
      'lastBlock',
      'number',
      'passageId',
      'reason',
      'tab',
      'text',
      'title',
      'trust',
    ],
    type: 'object',
  },
  AskRequest: {
    additionalProperties: false,
    properties: {
      question: {
        type: 'string',
      },
      turns: {
        items: {
          $ref: '#/components/schemas/AskTurn',
        },
        type: 'array',
      },
    },
    required: ['question'],
    type: 'object',
  },
  AskSource: {
    additionalProperties: false,
    description: 'A passage an answer cites, or one it found and set aside.',
    properties: {
      firstBlock: {
        type: 'string',
      },
      headings: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      lastBlock: {
        type: 'string',
      },
      number: {
        type: 'number',
      },
      passageId: {
        type: 'string',
      },
      tab: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      trust: {
        $ref: '#/components/schemas/KnowledgeTrustState',
      },
      verifiedAt: {
        type: 'number',
      },
    },
    required: [
      'number',
      'passageId',
      'tab',
      'title',
      'headings',
      'text',
      'trust',
      'firstBlock',
      'lastBlock',
    ],
    type: 'object',
  },
  AskTurn: {
    additionalProperties: false,
    properties: {
      answer: {
        type: 'string',
      },
      question: {
        type: 'string',
      },
    },
    required: ['question', 'answer'],
    type: 'object',
  },
  AttachPoint: {
    enum: [
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ],
    type: 'string',
  },
  BackgroundPattern: {
    enum: [
      'grid',
      'blank',
      'lines',
      'crosshatch',
      'graph',
      'confetti',
      'stripes',
      'diagonal',
      'waves',
      'bricks',
      'hexagonal',
      'engineering',
      'checkerboard',
      'sparkles',
      'eggs',
      'cobwebs',
      'snowflakes',
      'candy-stripes',
      'flow',
      'drift',
      'aurora',
      'ripple',
      'ribbons',
    ],
    type: 'string',
  },
  BorderRadius: {
    enum: ['none', 'sm', 'md', 'lg', 'full'],
    type: 'string',
  },
  BorderStroke: {
    enum: ['none', 'thin', 'medium', 'thick', 'extra-thick'],
    type: 'string',
  },
  BorderStyle: {
    enum: ['solid', 'dashed', 'dotted', 'dash-dot', 'long-dash', 'dash-dot-dot'],
    type: 'string',
  },
  BoxedElement: {
    anyOf: [
      {
        $ref: '#/components/schemas/ShapeElement',
      },
      {
        $ref: '#/components/schemas/TextElement',
      },
      {
        $ref: '#/components/schemas/StickyElement',
      },
      {
        $ref: '#/components/schemas/ImageElement',
      },
      {
        $ref: '#/components/schemas/FreehandElement',
      },
      {
        $ref: '#/components/schemas/TableElement',
      },
      {
        $ref: '#/components/schemas/ArticleNoteElement',
      },
      {
        $ref: '#/components/schemas/LinkCardElement',
      },
      {
        $ref: '#/components/schemas/VideoElement',
      },
    ],
  },
  BuildEffect: {
    enum: ['appear', 'fade', 'rise'],
    type: 'string',
  },
  CapabilitiesResponse: {
    additionalProperties: false,
    properties: {
      apiBase: {
        type: 'string',
      },
      authEnabled: {
        type: 'boolean',
      },
      cli: {
        additionalProperties: false,
        properties: {
          minVersion: {
            type: 'string',
          },
        },
        required: ['minVersion'],
        type: 'object',
      },
      communityEnabled: {
        type: 'boolean',
      },
      documentFormat: {
        type: 'number',
      },
      emailEnabled: {
        type: 'boolean',
      },
      oauthIssuer: {
        type: 'string',
      },
    },
    type: 'object',
  },
  CardMedia: {
    enum: ['badge', 'tile', 'initial'],
    type: 'string',
  },
  ChangesetAuthor: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
    },
    required: ['name', 'color'],
    type: 'object',
  },
  ChangesetBase: {
    additionalProperties: false,
    properties: {
      elements: {
        additionalProperties: {
          type: 'string',
        },
        type: 'object',
      },
      rev: {
        type: 'number',
      },
    },
    required: ['rev'],
    type: 'object',
  },
  ChangesetCounts: {
    additionalProperties: false,
    properties: {
      added: {
        type: 'number',
      },
      changed: {
        type: 'number',
      },
      removed: {
        type: 'number',
      },
    },
    required: ['added', 'changed', 'removed'],
    type: 'object',
  },
  ChangesetDetail: {
    additionalProperties: false,
    properties: {
      changeset: {
        $ref: '#/components/schemas/ChangesetSummary',
      },
      results: {
        items: {
          $ref: '#/components/schemas/ResultLine',
        },
        type: 'array',
      },
      text: {
        type: 'string',
      },
    },
    required: ['changeset', 'results', 'text'],
    type: 'object',
  },
  ChangesetReplaceBody: {
    additionalProperties: false,
    properties: {
      elements: {
        items: {},
        type: 'array',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      layout: {
        enum: ['auto', 'preserve'],
        type: 'string',
      },
      name: {
        type: 'string',
      },
      template: {
        type: 'string',
      },
      theme: {
        type: 'string',
      },
    },
    type: 'object',
  },
  ChangesetRequest: {
    additionalProperties: false,
    properties: {
      base: {
        $ref: '#/components/schemas/ChangesetBase',
      },
      operations: {
        anyOf: [
          {
            items: {},
            type: 'array',
          },
          {
            type: 'string',
          },
        ],
      },
      replace: {
        $ref: '#/components/schemas/ChangesetReplaceBody',
      },
      strict: {
        type: 'boolean',
      },
      summary: {
        type: 'string',
      },
    },
    type: 'object',
  },
  ChangesetResponse: {
    additionalProperties: false,
    properties: {
      changeset: {
        anyOf: [
          {
            $ref: '#/components/schemas/ChangesetWritten',
          },
          {
            type: 'null',
          },
        ],
      },
      dryRun: {
        type: 'boolean',
      },
      lint: {
        anyOf: [
          {
            $ref: '#/components/schemas/LintReport',
          },
          {
            type: 'null',
          },
        ],
      },
      results: {
        items: {
          $ref: '#/components/schemas/ResultLine',
        },
        type: 'array',
      },
      text: {
        type: 'string',
      },
      warnings: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
    },
    required: ['dryRun', 'changeset', 'results', 'text', 'warnings', 'lint'],
    type: 'object',
  },
  ChangesetSummary: {
    additionalProperties: false,
    properties: {
      agent: {
        type: 'boolean',
      },
      author: {
        $ref: '#/components/schemas/ChangesetAuthor',
      },
      counts: {
        $ref: '#/components/schemas/ChangesetCounts',
      },
      createdAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      rev: {
        type: 'number',
      },
      revertOf: {
        type: ['string', 'null'],
      },
      summary: {
        type: ['string', 'null'],
      },
      tabId: {
        type: 'string',
      },
      tokenId: {
        type: 'string',
      },
    },
    required: [
      'id',
      'tabId',
      'rev',
      'author',
      'agent',
      'summary',
      'counts',
      'revertOf',
      'createdAt',
    ],
    type: 'object',
  },
  ChangesetWritten: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      previousRev: {
        type: 'number',
      },
      rebasedOver: {
        type: 'number',
      },
      rev: {
        type: 'number',
      },
      tabId: {
        type: 'string',
      },
    },
    required: ['id', 'tabId', 'rev', 'previousRev', 'rebasedOver'],
    type: 'object',
  },
  ChartLegendPosition: {
    enum: ['top', 'right', 'bottom', 'left'],
    type: 'string',
  },
  ChartPaletteId: {
    enum: ['vivid', 'ocean', 'forest', 'sunset', 'berry', 'earth', 'grey', 'contrast'],
    type: 'string',
  },
  ChartSheetSource: {
    additionalProperties: false,
    properties: {
      a1: {
        type: 'string',
      },
      app: {
        const: 'liveplanner',
        type: 'string',
      },
      cols: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      itemId: {
        type: 'string',
      },
      itemName: {
        type: 'string',
      },
      range: {
        additionalProperties: false,
        properties: {
          c1: {
            type: 'string',
          },
          c2: {
            type: 'string',
          },
          r1: {
            type: 'string',
          },
          r2: {
            type: 'string',
          },
        },
        required: ['r1', 'c1', 'r2', 'c2'],
        type: 'object',
      },
      readAt: {
        type: 'number',
      },
      sheetId: {
        type: 'string',
      },
      sheetName: {
        type: 'string',
      },
    },
    required: ['app', 'itemId', 'sheetId', 'range', 'itemName', 'sheetName', 'a1', 'readAt'],
    type: 'object',
  },
  ChartVariant: {
    enum: ['horizontal', 'area', 'scatter', 'doughnut'],
    type: 'string',
  },
  ChecklistItem: {
    additionalProperties: false,
    properties: {
      done: {
        type: 'boolean',
      },
      text: {
        type: 'string',
      },
    },
    required: ['text', 'done'],
    type: 'object',
  },
  ChipLook: {
    enum: ['solid', 'ink', 'outline', 'tinted', 'quiet'],
    type: 'string',
  },
  CodeLanguage: {
    enum: ['plain', 'ts', 'js', 'python', 'json', 'bash', 'sql', 'html', 'css', 'yaml'],
    type: 'string',
  },
  CodeThemeId: {
    enum: ['midnight', 'graphite', 'ocean', 'forest', 'plum', 'contrast', 'paper', 'parchment'],
    type: 'string',
  },
  Comment: {
    additionalProperties: false,
    properties: {
      ai: {
        const: true,
        type: 'boolean',
      },
      authorColor: {
        type: 'string',
      },
      authorId: {
        type: 'string',
      },
      authorName: {
        type: 'string',
      },
      createdAt: {
        type: 'number',
      },
      editedAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      mentions: {
        items: {
          $ref: '#/components/schemas/CommentMention',
        },
        type: 'array',
      },
      reactions: {
        items: {
          $ref: '#/components/schemas/CommentReaction',
        },
        type: 'array',
      },
      text: {
        type: 'string',
      },
      tokenId: {
        type: 'string',
      },
    },
    required: ['id', 'text', 'createdAt', 'authorName', 'authorColor'],
    type: 'object',
  },
  CommentMention: {
    additionalProperties: false,
    properties: {
      handle: {
        type: 'string',
      },
      memberId: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      userId: {
        type: ['string', 'null'],
      },
    },
    required: ['userId', 'name', 'handle'],
    type: 'object',
  },
  CommentReaction: {
    additionalProperties: false,
    properties: {
      by: {
        type: 'string',
      },
      emoji: {
        $ref: '#/components/schemas/CommentReactionId',
      },
      name: {
        type: 'string',
      },
      person: {
        type: 'string',
      },
    },
    required: ['emoji', 'by', 'name'],
    type: 'object',
  },
  CommentReactionId: {
    enum: ['thumbs-up', 'thumbs-down', 'laugh', 'hooray', 'heart', 'eyes'],
    type: 'string',
  },
  CommentThread: {
    additionalProperties: false,
    properties: {
      comments: {
        items: {
          $ref: '#/components/schemas/Comment',
        },
        type: 'array',
      },
      resolved: {
        type: 'boolean',
      },
    },
    required: ['comments', 'resolved'],
    type: 'object',
  },
  CommentsView: {
    additionalProperties: false,
    properties: {
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      threads: {
        items: {
          additionalProperties: false,
          properties: {
            comments: {
              items: {
                additionalProperties: false,
                properties: {
                  authorName: {
                    type: 'string',
                  },
                  createdAt: {
                    type: 'number',
                  },
                  text: {
                    type: 'string',
                  },
                },
                required: ['authorName', 'createdAt', 'text'],
                type: 'object',
              },
              type: 'array',
            },
            kind: {
              type: 'string',
            },
            label: {
              type: ['string', 'null'],
            },
            ref: {
              type: 'string',
            },
            resolved: {
              type: 'boolean',
            },
          },
          required: ['ref', 'kind', 'label', 'resolved', 'comments'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['header', 'threads', 'elision'],
    type: 'object',
  },
  CommunityApp: {
    enum: [
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
      'livehuddle.app',
      'liveknowledge.app',
    ],
    type: 'string',
  },
  CommunityAuthor: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      picture: {
        type: ['string', 'null'],
      },
    },
    required: ['name', 'color', 'picture'],
    type: 'object',
  },
  CommunityCategory: {
    enum: [
      'branding',
      'campus',
      'careers',
      'decisions',
      'education',
      'engineering',
      'events',
      'finance',
      'games',
      'goals',
      'handbooks',
      'health',
      'hiring',
      'home',
      'homes',
      'ideas',
      'learning',
      'marketing',
      'media',
      'meetings',
      'office',
      'onboarding',
      'other',
      'outdoor',
      'people',
      'personal',
      'photos',
      'pitches',
      'planning',
      'plans',
      'processes',
      'product',
      'recreation',
      'reports',
      'retros',
      'sales',
      'shopping',
      'social',
      'software',
      'speeches',
      'strategy',
      'support',
      'team',
      'travel',
      'venues',
      'websites',
      'work',
    ],
    type: 'string',
  },
  CommunityMinePost: {
    additionalProperties: false,
    properties: {
      anonymous: {
        type: 'boolean',
      },
      app: {
        $ref: '#/components/schemas/CommunityApp',
      },
      author: {
        $ref: '#/components/schemas/CommunityAuthor',
      },
      category: {
        $ref: '#/components/schemas/CommunityCategory',
      },
      copyCount: {
        type: 'number',
      },
      description: {
        type: 'string',
      },
      documentId: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
      likeCount: {
        type: 'number',
      },
      liked: {
        type: 'boolean',
      },
      publishedAt: {
        type: 'number',
      },
      shareCode: {
        type: 'string',
      },
      state: {
        $ref: '#/components/schemas/CommunityPostState',
      },
      tags: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      title: {
        type: 'string',
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: [
      'anonymous',
      'app',
      'author',
      'category',
      'copyCount',
      'description',
      'documentId',
      'id',
      'likeCount',
      'liked',
      'publishedAt',
      'shareCode',
      'state',
      'tags',
      'title',
      'updatedAt',
    ],
    type: 'object',
  },
  CommunityMineResponse: {
    additionalProperties: false,
    properties: {
      nextOffset: {
        type: ['number', 'null'],
      },
      posts: {
        items: {
          $ref: '#/components/schemas/CommunityMinePost',
        },
        type: 'array',
      },
      totals: {
        $ref: '#/components/schemas/CommunityMineTotals',
      },
    },
    required: ['posts', 'nextOffset', 'totals'],
    type: 'object',
  },
  CommunityMineTotals: {
    additionalProperties: false,
    properties: {
      copies: {
        type: 'number',
      },
      likes: {
        type: 'number',
      },
      posts: {
        type: 'number',
      },
    },
    required: ['posts', 'likes', 'copies'],
    type: 'object',
  },
  CommunityOwnPost: {
    additionalProperties: false,
    properties: {
      anonymous: {
        type: 'boolean',
      },
      app: {
        $ref: '#/components/schemas/CommunityApp',
      },
      author: {
        $ref: '#/components/schemas/CommunityAuthor',
      },
      category: {
        $ref: '#/components/schemas/CommunityCategory',
      },
      copyCount: {
        type: 'number',
      },
      description: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
      likeCount: {
        type: 'number',
      },
      liked: {
        type: 'boolean',
      },
      publishedAt: {
        type: 'number',
      },
      shareCode: {
        type: 'string',
      },
      state: {
        $ref: '#/components/schemas/CommunityPostState',
      },
      tags: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      title: {
        type: 'string',
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: [
      'anonymous',
      'app',
      'author',
      'category',
      'copyCount',
      'description',
      'id',
      'likeCount',
      'liked',
      'publishedAt',
      'shareCode',
      'state',
      'tags',
      'title',
      'updatedAt',
    ],
    type: 'object',
  },
  CommunityPostInput: {
    additionalProperties: false,
    properties: {
      anonymous: {
        type: 'boolean',
      },
      category: {
        $ref: '#/components/schemas/CommunityCategory',
      },
      description: {
        type: 'string',
      },
      tags: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      title: {
        type: 'string',
      },
    },
    required: ['title', 'description', 'category', 'tags', 'anonymous'],
    type: 'object',
  },
  CommunityPostState: {
    enum: ['listed', 'hidden'],
    type: 'string',
  },
  CommunityShareInfo: {
    additionalProperties: false,
    properties: {
      author: {
        $ref: '#/components/schemas/CommunityAuthor',
      },
      postId: {
        type: 'string',
      },
    },
    required: ['postId', 'author'],
    type: 'object',
  },
  ConceptAnim: {
    enum: ['build', 'pulse', 'flow'],
    type: 'string',
  },
  ConceptRow: {
    additionalProperties: false,
    properties: {
      label: {
        type: 'string',
      },
      note: {
        type: 'string',
      },
    },
    required: ['label'],
    type: 'object',
  },
  CoverGradientId: {
    enum: [
      'theme-dawn',
      'theme-mist',
      'theme-glow',
      'theme-haze',
      'theme-sorbet',
      'theme-pastel',
      'theme-bloom',
      'theme-bright',
      'theme-vivid',
      'theme-aurora',
      'theme-ember',
      'theme-dusk',
      'theme-twilight',
      'theme-ink',
    ],
    type: 'string',
  },
  CreatePageRequest: {
    additionalProperties: false,
    description:
      "`POST .../pages`: a new page from Markdown, under `parent` (a page's id or title; the top level when absent).",
    properties: {
      id: {
        description:
          "An import's own id for the page (a UUID), minted before its first page is written.",
        type: 'string',
      },
      markdown: {
        type: 'string',
      },
      pageIds: {
        additionalProperties: {
          type: 'string',
        },
        description:
          "Titles the Markdown may link to with `[[Title]]` beside the knowledgebase's own pages, each with its page's id: an import's pages, some not written yet.",
        type: 'object',
      },
      parent: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['title'],
    type: 'object',
  },
  CreatePageResponse: {
    additionalProperties: false,
    properties: {
      page: {
        additionalProperties: false,
        properties: {
          parent: {
            type: 'string',
          },
          rev: {
            type: 'number',
          },
          tab: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
        },
        required: ['rev', 'tab', 'title'],
        type: 'object',
      },
    },
    required: ['page'],
    type: 'object',
  },
  CurrentTokenResponse: {
    additionalProperties: false,
    properties: {
      accountId: {
        type: 'string',
      },
      accountName: {
        type: ['string', 'null'],
      },
      expiresAt: {
        type: ['number', 'null'],
      },
      role: {
        enum: ['full', 'read-only'],
        type: 'string',
      },
      tokenId: {
        type: 'string',
      },
      tokenName: {
        type: ['string', 'null'],
      },
    },
    required: ['accountId', 'accountName', 'tokenId', 'tokenName', 'role', 'expiresAt'],
    type: 'object',
  },
  DiffView: {
    additionalProperties: false,
    properties: {
      changes: {
        items: {
          additionalProperties: false,
          properties: {
            changes: {
              items: {
                additionalProperties: false,
                properties: {
                  after: {},
                  before: {},
                  field: {
                    type: 'string',
                  },
                },
                required: ['field', 'before', 'after'],
                type: 'object',
              },
              type: 'array',
            },
            kind: {
              type: 'string',
            },
            label: {
              type: ['string', 'null'],
            },
            op: {
              enum: ['+', '-', '~'],
              type: 'string',
            },
            ref: {
              type: 'string',
            },
          },
          required: ['op', 'ref', 'kind', 'label', 'changes'],
          type: 'object',
        },
        type: 'array',
      },
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      since: {
        type: 'number',
      },
    },
    required: ['header', 'since', 'changes', 'elision'],
    type: 'object',
  },
  Document: {
    additionalProperties: false,
    properties: {
      communityState: {
        enum: ['listed', 'hidden', null],
        type: ['string', 'null'],
      },
      createdAt: {
        type: 'number',
      },
      folderId: {
        type: ['string', 'null'],
      },
      id: {
        type: 'string',
      },
      knowledgeSettings: {
        $ref: '#/components/schemas/KnowledgeSettingsWire',
      },
      knowledgeStyle: {
        $ref: '#/components/schemas/KnowledgeStyleWire',
      },
      name: {
        type: 'string',
      },
      ownerColor: {
        type: ['string', 'null'],
      },
      ownerId: {
        type: 'string',
      },
      ownerName: {
        type: ['string', 'null'],
      },
      presentation: {
        type: ['string', 'null'],
      },
      savedAt: {
        type: 'number',
      },
      shareCode: {
        type: ['string', 'null'],
      },
      shareable: {
        type: 'boolean',
      },
      source: {
        anyOf: [
          {
            $ref: '#/components/schemas/DocumentSource',
          },
          {
            type: 'null',
          },
        ],
      },
      tabs: {
        items: {
          $ref: '#/components/schemas/TabSummary',
        },
        type: 'array',
      },
      teamId: {
        type: ['string', 'null'],
      },
    },
    required: [
      'id',
      'ownerId',
      'name',
      'tabs',
      'shareable',
      'shareCode',
      'folderId',
      'teamId',
      'source',
      'presentation',
      'knowledgeSettings',
      'knowledgeStyle',
      'savedAt',
      'createdAt',
      'ownerName',
      'ownerColor',
    ],
    type: 'object',
  },
  DocumentCommentThread: {
    additionalProperties: false,
    properties: {
      comments: {
        items: {
          additionalProperties: false,
          properties: {
            ai: {
              const: true,
              type: 'boolean',
            },
            authorColor: {
              type: 'string',
            },
            authorId: {
              type: 'string',
            },
            authorName: {
              type: 'string',
            },
            createdAt: {
              type: 'number',
            },
            editedAt: {
              type: 'number',
            },
            id: {
              type: 'string',
            },
            mentions: {
              items: {
                $ref: '#/components/schemas/CommentMention',
              },
              type: 'array',
            },
            reactions: {
              items: {
                $ref: '#/components/schemas/ReactionSummary',
              },
              type: 'array',
            },
            text: {
              type: 'string',
            },
            tokenId: {
              type: 'string',
            },
          },
          required: ['id', 'text', 'createdAt', 'authorName', 'authorColor'],
          type: 'object',
        },
        type: 'array',
      },
      elementId: {
        type: 'string',
      },
      label: {
        type: ['string', 'null'],
      },
      ref: {
        type: 'string',
      },
      resolved: {
        type: 'boolean',
      },
      tabId: {
        type: 'string',
      },
      tabName: {
        type: 'string',
      },
    },
    required: ['tabId', 'tabName', 'elementId', 'ref', 'label', 'resolved', 'comments'],
    type: 'object',
  },
  DocumentSource: {
    enum: ['mcp', 'cli'],
    type: 'string',
  },
  DocumentStats: {
    additionalProperties: false,
    properties: {
      bytes: {
        type: 'number',
      },
      comments: {
        type: 'number',
      },
      elements: {
        type: 'number',
      },
    },
    required: ['elements', 'comments', 'bytes'],
    type: 'object',
  },
  DocumentSummary: {
    additionalProperties: false,
    properties: {
      createdAt: {
        type: 'number',
      },
      empty: {
        type: 'boolean',
      },
      folderId: {
        type: ['string', 'null'],
      },
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      ownerId: {
        type: 'string',
      },
      savedAt: {
        type: 'number',
      },
      shareCode: {
        type: ['string', 'null'],
      },
      shareable: {
        type: 'boolean',
      },
      source: {
        anyOf: [
          {
            $ref: '#/components/schemas/DocumentSource',
          },
          {
            type: 'null',
          },
        ],
      },
      stats: {
        anyOf: [
          {
            $ref: '#/components/schemas/DocumentStats',
          },
          {
            type: 'null',
          },
        ],
      },
      teamId: {
        type: ['string', 'null'],
      },
    },
    required: [
      'id',
      'ownerId',
      'name',
      'shareable',
      'shareCode',
      'folderId',
      'teamId',
      'source',
      'savedAt',
      'createdAt',
      'empty',
      'stats',
    ],
    type: 'object',
  },
  DrawingAnimation: {
    enum: ['draw', 'trace', 'dash', 'boil', 'ink', 'glow', 'shimmer'],
    type: 'string',
  },
  EditWarning: {
    additionalProperties: false,
    properties: {
      code: {
        $ref: '#/components/schemas/EditWarningCode',
      },
      message: {
        type: 'string',
      },
      ref: {
        type: 'string',
      },
    },
    required: ['code', 'message'],
    type: 'object',
  },
  EditWarningCode: {
    enum: [
      'no_base',
      'shape_coerced',
      'value_coerced',
      'label_capped',
      'colour_overrides_theme',
      'arrows_freed',
    ],
    type: 'string',
  },
  Element: {
    anyOf: [
      {
        $ref: '#/components/schemas/BoxedElement',
      },
      {
        $ref: '#/components/schemas/ArrowElement',
      },
    ],
  },
  ElementAction: {
    additionalProperties: false,
    properties: {
      assignee: {
        $ref: '#/components/schemas/ElementActionAssignee',
      },
      assignerId: {
        type: 'string',
      },
      assignerName: {
        type: ['string', 'null'],
      },
      createdAt: {
        type: 'number',
      },
      description: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      status: {
        $ref: '#/components/schemas/ElementActionStatus',
      },
      teamId: {
        type: ['string', 'null'],
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: [
      'id',
      'name',
      'description',
      'assignee',
      'teamId',
      'assignerId',
      'assignerName',
      'status',
      'createdAt',
      'updatedAt',
    ],
    type: 'object',
  },
  ElementActionAssignee: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      memberId: {
        type: 'string',
      },
      name: {
        type: ['string', 'null'],
      },
      userId: {
        type: ['string', 'null'],
      },
    },
    required: ['userId', 'name'],
    type: 'object',
  },
  ElementActionStatus: {
    enum: ['open', 'done', 'wont-do'],
    type: 'string',
  },
  ElementAnimation: {
    anyOf: [
      {
        $ref: '#/components/schemas/ShapeAnimation',
      },
      {
        $ref: '#/components/schemas/StickyAnimation',
      },
      {
        $ref: '#/components/schemas/DrawingAnimation',
      },
      {
        $ref: '#/components/schemas/MediaAnimation',
      },
      {
        $ref: '#/components/schemas/TableAnimation',
      },
    ],
  },
  ElementBuild: {
    additionalProperties: false,
    description:
      'The step an element comes in at (a whole number from 1; equal orders come in together) and how.',
    properties: {
      effect: {
        $ref: '#/components/schemas/BuildEffect',
      },
      order: {
        type: 'number',
      },
    },
    required: ['order', 'effect'],
    type: 'object',
  },
  ElementId: {
    type: 'string',
  },
  ElementLink: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          kind: {
            const: 'tab',
            type: 'string',
          },
          tabId: {
            $ref: '#/components/schemas/TabId',
          },
        },
        required: ['kind', 'tabId'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          elementId: {
            $ref: '#/components/schemas/ElementId',
          },
          kind: {
            const: 'element',
            type: 'string',
          },
          tabId: {
            $ref: '#/components/schemas/TabId',
          },
        },
        required: ['kind', 'tabId', 'elementId'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          documentId: {
            type: 'string',
          },
          kind: {
            const: 'document',
            type: 'string',
          },
          name: {
            type: 'string',
          },
        },
        required: ['kind', 'documentId', 'name'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          kind: {
            const: 'url',
            type: 'string',
          },
          url: {
            type: 'string',
          },
        },
        required: ['kind', 'url'],
        type: 'object',
      },
    ],
  },
  ElementShadow: {
    additionalProperties: false,
    properties: {
      blur: {
        type: 'number',
      },
      offsetX: {
        type: 'number',
      },
      offsetY: {
        type: 'number',
      },
      opacity: {
        type: 'number',
      },
    },
    required: ['offsetX', 'offsetY', 'blur', 'opacity'],
    type: 'object',
  },
  Elision: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          arguments: {
            additionalProperties: {
              type: ['string', 'number', 'boolean'],
            },
            type: 'object',
          },
          collapsed: {
            items: {
              additionalProperties: false,
              properties: {
                elements: {
                  type: 'number',
                },
                kind: {
                  type: 'string',
                },
                ref: {
                  type: 'string',
                },
              },
              required: ['ref', 'kind', 'elements'],
              type: 'object',
            },
            type: 'array',
          },
          command: {
            type: 'string',
          },
          dropped: {
            items: {
              enum: ['notes', 'attributes'],
              type: 'string',
            },
            type: 'array',
          },
          omitted: {
            items: {
              additionalProperties: false,
              properties: {
                count: {
                  type: 'number',
                },
                noun: {
                  type: 'string',
                },
              },
              required: ['noun', 'count'],
              type: 'object',
            },
            type: 'array',
          },
        },
        required: ['dropped', 'collapsed', 'omitted', 'arguments', 'command'],
        type: 'object',
      },
      {
        type: 'null',
      },
    ],
  },
  EmbedProvider: {
    enum: ['youtube', 'vimeo', 'loom', 'figma', 'gdocs', 'website', 'live'],
    type: 'string',
  },
  Endpoint: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          kind: {
            const: 'free',
            type: 'string',
          },
          x: {
            type: 'number',
          },
          y: {
            type: 'number',
          },
        },
        required: ['kind', 'x', 'y'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          anchor: {
            $ref: '#/components/schemas/Anchor',
          },
          elementId: {
            $ref: '#/components/schemas/ElementId',
          },
          kind: {
            const: 'pinned',
            type: 'string',
          },
        },
        required: ['kind', 'elementId', 'anchor'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          arrowId: {
            $ref: '#/components/schemas/ElementId',
          },
          kind: {
            const: 'on-arrow',
            type: 'string',
          },
          t: {
            type: 'number',
          },
        },
        required: ['kind', 'arrowId', 't'],
        type: 'object',
      },
    ],
  },
  FieldChange: {
    additionalProperties: false,
    properties: {
      from: {
        $ref: '#/components/schemas/JsonValue',
      },
      key: {
        type: 'string',
      },
      to: {
        $ref: '#/components/schemas/JsonValue',
      },
    },
    required: ['key'],
    type: 'object',
  },
  FindField: {
    enum: ['label', 'edge', 'cell', 'item', 'node', 'code', 'comment'],
    type: 'string',
  },
  FindView: {
    additionalProperties: false,
    properties: {
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      matches: {
        items: {
          additionalProperties: false,
          properties: {
            field: {
              $ref: '#/components/schemas/FindField',
            },
            kind: {
              type: 'string',
            },
            label: {
              type: ['string', 'null'],
            },
            path: {
              items: {
                type: 'string',
              },
              type: 'array',
            },
            ref: {
              type: 'string',
            },
          },
          required: ['ref', 'kind', 'label', 'field', 'path'],
          type: 'object',
        },
        type: 'array',
      },
      q: {
        type: 'string',
      },
    },
    required: ['header', 'q', 'matches', 'elision'],
    type: 'object',
  },
  Finish: {
    enum: ['flexible', 'professional', 'sketch', 'marker'],
    type: 'string',
  },
  Folder: {
    additionalProperties: false,
    properties: {
      createdAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      ownerId: {
        type: 'string',
      },
      parentId: {
        type: ['string', 'null'],
      },
      teamId: {
        type: ['string', 'null'],
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: ['id', 'ownerId', 'parentId', 'teamId', 'name', 'createdAt', 'updatedAt'],
    type: 'object',
  },
  FreehandElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      borderRadius: {
        $ref: '#/components/schemas/BorderRadius',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      closed: {
        type: 'boolean',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      fillColor: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      packedPoints: {
        description:
          "The stroke's points, normalised into its box, and a pen's pressure at each when it reported one, packed into one block: base64 of a version byte, a flags byte and a little-endian record per point (x u16, y u16, optional pressure u8). See docs/specs/006-document/stroke-points.md.",
        format: 'byte',
        type: 'string',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      pen: {
        const: 'highlighter',
        type: 'string',
      },
      penColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      penWidth: {
        type: 'number',
      },
      rotation: {
        type: 'number',
      },
      straightEdges: {
        type: 'boolean',
      },
      streamline: {
        type: 'number',
      },
      strokeColor: {
        type: 'string',
      },
      strokeStyle: {
        $ref: '#/components/schemas/BorderStyle',
      },
      strokeWidth: {
        $ref: '#/components/schemas/BorderStroke',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      themeLockFill: {
        type: 'boolean',
      },
      type: {
        const: 'freehand',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height', 'packedPoints', 'closed'],
    type: 'object',
  },
  FreehandRunJson: {
    additionalProperties: false,
    properties: {
      closed: {
        type: 'number',
      },
      refs: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      run: {
        const: 'freehand',
        type: 'string',
      },
    },
    required: ['run', 'refs', 'closed'],
    type: 'object',
  },
  GraphView: {
    additionalProperties: false,
    properties: {
      arrows: {
        items: {
          $ref: '#/components/schemas/ViewEdgeJson',
        },
        type: 'array',
      },
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      nodes: {
        items: {
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
            },
            kind: {
              type: 'string',
            },
            label: {
              type: ['string', 'null'],
            },
            ref: {
              type: 'string',
            },
          },
          required: ['ref', 'id', 'kind', 'label'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['header', 'nodes', 'arrows', 'elision'],
    type: 'object',
  },
  HeroCaption: {
    additionalProperties: false,
    properties: {
      subtitle: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['title', 'subtitle'],
    type: 'object',
  },
  HuedPenColourName: {
    description: 'The eight hued stock colours, each tuned per board.',
    enum: ['blue', 'red', 'orange', 'yellow', 'green', 'teal', 'violet', 'pink'],
    type: 'string',
  },
  IconAnimation: {
    enum: [
      'spin',
      'beat',
      'pulse',
      'glow',
      'ping',
      'breathe',
      'shimmer',
      'bounce',
      'wiggle',
      'flash',
      'tada',
      'flip',
      'jump',
      'swing',
      'float',
    ],
    type: 'string',
  },
  IconPosition: {
    enum: ['left', 'right', 'above', 'below'],
    type: 'string',
  },
  IconSearchResponse: {
    additionalProperties: false,
    properties: {
      icons: {
        items: {
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
            },
            label: {
              type: 'string',
            },
            set: {
              enum: ['line', 'technology'],
              type: 'string',
            },
          },
          required: ['id', 'label', 'set'],
          type: 'object',
        },
        type: 'array',
      },
      more: {
        type: 'number',
      },
    },
    required: ['icons', 'more'],
    type: 'object',
  },
  IconSize: {
    enum: ['sm', 'md', 'lg', 'xl'],
    type: 'string',
  },
  IconWeight: {
    enum: ['thin', 'regular', 'bold'],
    type: 'string',
  },
  ImageCredit: {
    additionalProperties: false,
    properties: {
      licenseUrl: {
        type: 'string',
      },
      sourceUrl: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
    },
    required: ['text', 'sourceUrl'],
    type: 'object',
  },
  ImageCrop: {
    additionalProperties: false,
    properties: {
      height: {
        type: 'number',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['x', 'y', 'width', 'height'],
    type: 'object',
  },
  ImageElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      alt: {
        type: 'string',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      borderRadius: {
        $ref: '#/components/schemas/BorderRadius',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      credit: {
        $ref: '#/components/schemas/ImageCredit',
      },
      crop: {
        $ref: '#/components/schemas/ImageCrop',
      },
      fillColor: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      greyscale: {
        const: true,
        type: 'boolean',
      },
      height: {
        type: 'number',
      },
      heroCaption: {
        $ref: '#/components/schemas/HeroCaption',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      imageId: {
        type: ['string', 'null'],
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      mask: {
        $ref: '#/components/schemas/ImageMask',
      },
      naturalHeight: {
        type: 'number',
      },
      naturalWidth: {
        type: 'number',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      objectFit: {
        enum: ['cover', 'contain'],
        type: 'string',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      rotation: {
        type: 'number',
      },
      shadow: {
        $ref: '#/components/schemas/ElementShadow',
      },
      strokeColor: {
        type: 'string',
      },
      strokeStyle: {
        $ref: '#/components/schemas/BorderStyle',
      },
      strokeWidth: {
        $ref: '#/components/schemas/BorderStroke',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'image',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height', 'imageId'],
    type: 'object',
  },
  ImageMask: {
    enum: ['circle', 'rounded', 'arch', 'hexagon', 'diamond', 'triangle', 'star', 'blob'],
    type: 'string',
  },
  ImageSummary: {
    additionalProperties: false,
    properties: {
      byteSize: {
        type: 'number',
      },
      contentType: {
        type: 'string',
      },
      createdAt: {
        type: 'number',
      },
      height: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      originalName: {
        type: 'string',
      },
      source: {
        enum: ['mcp', 'cli'],
        type: 'string',
      },
      width: {
        type: 'number',
      },
    },
    required: ['id', 'contentType', 'byteSize', 'width', 'height', 'createdAt'],
    type: 'object',
  },
  JsonValue: {
    anyOf: [
      {
        type: 'string',
      },
      {
        type: 'number',
      },
      {
        type: 'boolean',
      },
      {
        type: 'null',
      },
      {
        items: {
          $ref: '#/components/schemas/JsonValue',
        },
        type: 'array',
      },
      {
        additionalProperties: {
          $ref: '#/components/schemas/JsonValue',
        },
        type: 'object',
      },
    ],
  },
  KnowledgeAgent: {
    additionalProperties: false,
    description:
      'One connection of AI Knowledge\'s Connected Agents (ai-knowledge.md "Connected agents"). What the room knows of the token behind it (`door`, `scopes`, `lastSeenAt`, `canHoldWrite`) is absent for an agent counted only by its reads, before the room kept its token.',
    properties: {
      canHoldWrite: {
        description:
          'Whether granting `write` would let it write: a full token acting for an Editor.',
        type: 'boolean',
      },
      door: {
        $ref: '#/components/schemas/KnowledgeAgentDoor',
      },
      id: {
        description: 'A stable id for the row: a hash, never the token or its id.',
        type: 'string',
      },
      lastSeenAt: {
        description: 'When it last called a knowledge route here, to the hour.',
        type: 'number',
      },
      name: {
        type: 'string',
      },
      readsThisWeek: {
        description: 'Pages read in the last seven days.',
        type: 'number',
      },
      scopes: {
        description:
          "What the connection holds in this knowledgebase now: its token's kind, what an Editor granted it here, and the role of the person it acts for.",
        items: {
          $ref: '#/components/schemas/AgentScope',
        },
        type: 'array',
      },
      tokenId: {
        description:
          "The token's id, as `PUT agents/<tokenId>/scopes` takes it. Sent only to an Editor in person, who alone may call that route; it is an id, never the token.",
        type: 'string',
      },
      topPages: {
        description: 'The pages it read most this week, at most three.',
        items: {
          additionalProperties: false,
          properties: {
            tab: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
          },
          required: ['tab', 'title'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['id', 'name', 'readsThisWeek', 'topPages'],
    type: 'object',
  },
  KnowledgeAgentContextResponse: {
    additionalProperties: false,
    description:
      '`GET .../context`: the Always in Context pages as Markdown in tree order, within the budget, with what the caller may do here.',
    properties: {
      budget: {
        type: 'number',
      },
      leftOut: {
        items: {
          additionalProperties: false,
          properties: {
            tab: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            tokens: {
              type: 'number',
            },
          },
          required: ['tab', 'title', 'tokens'],
          type: 'object',
        },
        type: 'array',
      },
      name: {
        type: 'string',
      },
      pageCount: {
        type: 'number',
      },
      pages: {
        items: {
          additionalProperties: false,
          properties: {
            markdown: {
              type: 'string',
            },
            tab: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            tokens: {
              type: 'number',
            },
            trust: {
              $ref: '#/components/schemas/KnowledgePageTrust',
            },
          },
          required: ['markdown', 'tab', 'title', 'tokens', 'trust'],
          type: 'object',
        },
        type: 'array',
      },
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
        description: "The knowledgebase's Review Period.",
      },
      role: {
        enum: ['edit', 'participate', 'view'],
        type: 'string',
      },
      scopes: {
        items: {
          $ref: '#/components/schemas/AgentScope',
        },
        type: 'array',
      },
      tokens: {
        type: 'number',
      },
    },
    required: [
      'name',
      'role',
      'scopes',
      'budget',
      'tokens',
      'reviewEvery',
      'pages',
      'leftOut',
      'pageCount',
    ],
    type: 'object',
  },
  KnowledgeAgentDoor: {
    description:
      'How an agent connects: the MCP server, the command line, or an API token used directly.',
    enum: ['mcp', 'cli', 'token'],
    type: 'string',
  },
  KnowledgeAiProvider: {
    description: 'Whose API a knowledgebase\'s key is for (search-and-ask.md "Providers").',
    enum: ['anthropic', 'openai'],
    type: 'string',
  },
  KnowledgeAiSettings: {
    additionalProperties: false,
    description:
      '`GET .../ai` (search-and-ask.md "Ask", "Providers"): never the key, only whether one is set, whose it is and its last characters. `models` are the stored provider\'s; `providers` are the two a team may choose between.',
    properties: {
      hasKey: {
        type: 'boolean',
      },
      keyHint: {
        type: 'string',
      },
      model: {
        type: 'string',
      },
      models: {
        items: {
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
            },
            label: {
              type: 'string',
            },
          },
          required: ['id', 'label'],
          type: 'object',
        },
        type: 'array',
      },
      provider: {
        $ref: '#/components/schemas/KnowledgeAiProvider',
      },
      providers: {
        items: {
          additionalProperties: false,
          properties: {
            id: {
              $ref: '#/components/schemas/KnowledgeAiProvider',
            },
            keyPrefix: {
              type: 'string',
            },
            label: {
              type: 'string',
            },
          },
          required: ['id', 'label', 'keyPrefix'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['provider', 'hasKey', 'keyHint', 'model', 'models', 'providers'],
    type: 'object',
  },
  KnowledgeBacklink: {
    additionalProperties: false,
    description: 'A page that links here (links-and-embeds.md "Backlinks"), in tree order.',
    properties: {
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['tab', 'title'],
    type: 'object',
  },
  KnowledgeBacklinksResponse: {
    additionalProperties: false,
    properties: {
      backlinks: {
        items: {
          $ref: '#/components/schemas/KnowledgeBacklink',
        },
        type: 'array',
      },
    },
    required: ['backlinks'],
    type: 'object',
  },
  KnowledgeConflict: {
    additionalProperties: false,
    properties: {
      a: {
        $ref: '#/components/schemas/KnowledgeConflictSide',
      },
      askedAt: {
        description:
          "When both pages' owners were emailed about it (Ask Both Owners): once a conflict.",
        type: 'number',
      },
      b: {
        $ref: '#/components/schemas/KnowledgeConflictSide',
      },
      foundAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      question: {
        type: 'string',
      },
    },
    required: ['id', 'question', 'a', 'b', 'foundAt'],
    type: 'object',
  },
  KnowledgeConflictSide: {
    additionalProperties: false,
    properties: {
      firstBlock: {
        description:
          "The passage's first block on its page: where the page opens when this side is the one to fix.",
        type: 'string',
      },
      passageId: {
        type: 'string',
      },
      tab: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      trust: {
        $ref: '#/components/schemas/KnowledgeTrustState',
      },
      verifiedAt: {
        type: 'number',
      },
    },
    required: ['passageId', 'tab', 'firstBlock', 'title', 'text', 'trust'],
    type: 'object',
  },
  KnowledgeConnectedRow: {
    additionalProperties: false,
    description:
      'A connected file in the tree (links-and-embeds.md "Connected files in the sidebar"): another app\'s file placed among the pages, which is no page. It holds no subpages and no trust, and `read_page` does not read it.',
    properties: {
      app: {
        description: 'The app the file is in ("livediagram", "liveplanner", ...).',
        type: 'string',
      },
      depth: {
        type: 'number',
      },
      kind: {
        const: 'connected',
        type: 'string',
      },
      parent: {
        type: 'string',
      },
      subpages: {
        const: 0,
        type: 'number',
      },
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['app', 'depth', 'kind', 'subpages', 'tab', 'title'],
    type: 'object',
  },
  KnowledgeContextPage: {
    additionalProperties: false,
    properties: {
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      tokens: {
        type: 'number',
      },
    },
    required: ['tab', 'title', 'tokens'],
    type: 'object',
  },
  KnowledgeDuePage: {
    additionalProperties: false,
    description:
      "A page of the caller's own that is due for review: `reviewAt` is when it came due (ms).",
    properties: {
      reviewAt: {
        type: 'number',
      },
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['tab', 'title', 'reviewAt'],
    type: 'object',
  },
  KnowledgeEmailResult: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          outcome: {
            const: 'sent',
            type: 'string',
          },
          owners: {
            type: 'number',
          },
          sent: {
            type: 'number',
          },
        },
        required: ['outcome', 'sent', 'owners'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          nextAt: {
            type: 'number',
          },
          outcome: {
            const: 'already_sent',
            type: 'string',
          },
          sentAt: {
            type: 'number',
          },
        },
        required: ['outcome', 'sentAt'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          outcome: {
            enum: ['no_owners', 'nothing_due', 'unavailable', 'daily_limit', 'no_recipients'],
            type: 'string',
          },
        },
        required: ['outcome'],
        type: 'object',
      },
    ],
    description:
      "What `POST conflicts/<id>/ask-owners` and `POST knowledge/remind-owners` answer: what was sent, or why nothing was. `sent` counts the owners emailed of `owners` named; `no_recipients` is owners who turned the emails off, have no verified address or can no longer open the knowledgebase; `daily_limit` the knowledgebase's ceiling of emails a day; `unavailable` a deployment that sends no email.",
  },
  KnowledgeHeadingStyle: {
    enum: ['plain', 'ruled'],
    type: 'string',
  },
  KnowledgeHealthCounts: {
    additionalProperties: false,
    properties: {
      neverVerified: {
        type: 'number',
      },
      reviewDue: {
        type: 'number',
      },
      total: {
        type: 'number',
      },
      verified: {
        type: 'number',
      },
    },
    required: ['verified', 'reviewDue', 'neverVerified', 'total'],
    type: 'object',
  },
  KnowledgeLineSpacing: {
    enum: ['compact', 'comfortable', 'relaxed'],
    type: 'string',
  },
  KnowledgeOverviewResponse: {
    additionalProperties: false,
    description: '`GET .../knowledge`: the AI Knowledge tab (ai-knowledge.md).',
    properties: {
      agents: {
        items: {
          $ref: '#/components/schemas/KnowledgeAgent',
        },
        type: 'array',
      },
      conflicts: {
        items: {
          $ref: '#/components/schemas/KnowledgeConflict',
        },
        type: 'array',
      },
      context: {
        additionalProperties: false,
        properties: {
          budget: {
            type: 'number',
          },
          pages: {
            items: {
              $ref: '#/components/schemas/KnowledgeContextPage',
            },
            type: 'array',
          },
          used: {
            type: 'number',
          },
        },
        required: ['budget', 'used', 'pages'],
        type: 'object',
      },
      hasKey: {
        type: 'boolean',
      },
      health: {
        $ref: '#/components/schemas/KnowledgeHealthCounts',
      },
      questions: {
        items: {
          $ref: '#/components/schemas/KnowledgeQuestion',
        },
        type: 'array',
      },
      reviewEmails: {
        additionalProperties: false,
        description:
          'The Knowledgebase Reviews emails: whether this deployment sends email, and when the owners were last reminded (Remind the Owners is once a week).',
        properties: {
          available: {
            type: 'boolean',
          },
          remindedAt: {
            type: 'number',
          },
        },
        required: ['available'],
        type: 'object',
      },
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
        description: "The knowledgebase's Review Period, which `health` is worked out under.",
      },
      suggestions: {
        items: {
          $ref: '#/components/schemas/KnowledgeSuggestion',
        },
        type: 'array',
      },
    },
    required: [
      'agents',
      'questions',
      'conflicts',
      'suggestions',
      'context',
      'health',
      'reviewEvery',
      'hasKey',
      'reviewEmails',
    ],
    type: 'object',
  },
  KnowledgePageRead: {
    additionalProperties: false,
    description:
      "`GET .../pages/<tab>`: one page as Markdown, its page links by their current titles. `heading` and `maxChars` narrow it; `leftOut` counts the characters not sent and `headings` lists the page's sections.",
    properties: {
      backlinks: {
        items: {
          $ref: '#/components/schemas/KnowledgePageRef',
        },
        type: 'array',
      },
      chars: {
        type: 'number',
      },
      cover: {
        anyOf: [
          {
            additionalProperties: false,
            properties: {
              focus: {
                type: 'number',
              },
              imageId: {
                type: 'string',
              },
              kind: {
                const: 'image',
                type: 'string',
              },
            },
            required: ['kind', 'imageId'],
            type: 'object',
          },
          {
            additionalProperties: false,
            properties: {
              kind: {
                const: 'gradient',
                type: 'string',
              },
              preset: {
                type: 'string',
              },
            },
            required: ['kind', 'preset'],
            type: 'object',
          },
          {
            additionalProperties: false,
            properties: {
              colouring: {
                type: 'string',
              },
              kind: {
                const: 'animated',
                type: 'string',
              },
              preset: {
                type: 'string',
              },
              speed: {
                type: 'number',
              },
            },
            required: ['kind', 'preset'],
            type: 'object',
          },
        ],
        description:
          'The page\'s cover (page-surface.md "The cover"): its kind, and its picture or its preset.',
      },
      headings: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      leftOut: {
        type: 'number',
      },
      markdown: {
        type: 'string',
      },
      parent: {
        type: 'string',
      },
      rev: {
        type: 'number',
      },
      subpages: {
        items: {
          $ref: '#/components/schemas/KnowledgePageRef',
        },
        type: 'array',
      },
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      trust: {
        $ref: '#/components/schemas/KnowledgePageTrust',
      },
    },
    required: [
      'backlinks',
      'chars',
      'headings',
      'leftOut',
      'markdown',
      'rev',
      'subpages',
      'tab',
      'title',
      'trust',
    ],
    type: 'object',
  },
  KnowledgePageReadResponse: {
    additionalProperties: false,
    properties: {
      page: {
        $ref: '#/components/schemas/KnowledgePageRead',
      },
    },
    required: ['page'],
    type: 'object',
  },
  KnowledgePageRef: {
    additionalProperties: false,
    description: 'A page by its id and current title.',
    properties: {
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['tab', 'title'],
    type: 'object',
  },
  KnowledgePageRow: {
    additionalProperties: false,
    description:
      'One row of `GET .../pages`: the page tree in order. `depth` is 1 at the top level.',
    properties: {
      context: {
        const: true,
        type: 'boolean',
      },
      depth: {
        type: 'number',
      },
      owner: {
        description: "The owner's account id.",
        type: 'string',
      },
      parent: {
        type: 'string',
      },
      subpages: {
        type: 'number',
      },
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      trust: {
        $ref: '#/components/schemas/KnowledgePageTrust',
      },
    },
    required: ['depth', 'subpages', 'tab', 'title', 'trust'],
    type: 'object',
  },
  KnowledgePageTrust: {
    additionalProperties: false,
    description:
      'How far a page or passage can be trusted, as every agent answer carries it. `stale` is review due.',
    properties: {
      conflictsWith: {
        description: 'The pages an open conflict sets this one against.',
        items: {
          $ref: '#/components/schemas/KnowledgePageRef',
        },
        type: 'array',
      },
      reviewAt: {
        type: 'number',
      },
      stale: {
        type: 'boolean',
      },
      state: {
        $ref: '#/components/schemas/KnowledgeTrustState',
      },
      verifiedAt: {
        type: 'number',
      },
      verifiedBy: {
        description: "The verifier's name, where the api has one.",
        type: 'string',
      },
    },
    required: ['state', 'stale'],
    type: 'object',
  },
  KnowledgePagesResponse: {
    additionalProperties: false,
    description:
      "`reviewEvery` is the knowledgebase's Review Period, said once for every page's `reviewAt`. `pages` is the tree in order, its connected files among its pages.",
    properties: {
      pages: {
        items: {
          $ref: '#/components/schemas/KnowledgeTreeRow',
        },
        type: 'array',
      },
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
      },
    },
    required: ['reviewEvery', 'pages'],
    type: 'object',
  },
  KnowledgeQuestion: {
    additionalProperties: false,
    properties: {
      agents: {
        items: {
          additionalProperties: false,
          properties: {
            asked: {
              type: 'number',
            },
            name: {
              type: 'string',
            },
          },
          required: ['name', 'asked'],
          type: 'object',
        },
        type: 'array',
      },
      asked: {
        type: 'number',
      },
      byPeople: {
        description:
          "Asks by people: a count of asks, not of distinct people (no asker's identity is kept).",
        type: 'number',
      },
      key: {
        type: 'string',
      },
      lastAt: {
        type: 'number',
      },
      question: {
        type: 'string',
      },
    },
    required: ['key', 'question', 'asked', 'byPeople', 'agents', 'lastAt'],
    type: 'object',
  },
  KnowledgeRecentPage: {
    additionalProperties: false,
    properties: {
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: ['tab', 'title', 'updatedAt'],
    type: 'object',
  },
  KnowledgeReviewEvery: {
    enum: [30, 90, 180, 365, 'never'],
    type: ['number', 'string'],
  },
  KnowledgeSearchResponse: {
    additionalProperties: false,
    properties: {
      results: {
        items: {
          $ref: '#/components/schemas/KnowledgeSearchResult',
        },
        type: 'array',
      },
    },
    required: ['results'],
    type: 'object',
  },
  KnowledgeSearchResult: {
    additionalProperties: false,
    description:
      "One search result: a page's title row, or a passage of its writing. `titleMarked` and `snippet` wrap each matched word in U+0002 and U+0003, so a client marks them without parsing HTML.",
    properties: {
      conflictsWith: {
        items: {
          $ref: '#/components/schemas/KnowledgePageRef',
        },
        type: 'array',
      },
      firstBlock: {
        type: 'string',
      },
      headings: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      id: {
        type: 'string',
      },
      isTitle: {
        type: 'boolean',
      },
      lastBlock: {
        type: 'string',
      },
      reviewAt: {
        type: 'number',
      },
      snippet: {
        type: 'string',
      },
      tab: {
        type: 'string',
      },
      text: {
        description:
          "For an agent (an API token, the MCP, the CLI): the passage whole, when its page's review is or was due, and the pages an open conflict sets this passage against.",
        type: 'string',
      },
      title: {
        type: 'string',
      },
      titleMarked: {
        type: 'string',
      },
      trust: {
        $ref: '#/components/schemas/KnowledgeTrustState',
      },
      verifiedAt: {
        type: 'number',
      },
    },
    required: [
      'id',
      'tab',
      'isTitle',
      'title',
      'titleMarked',
      'headings',
      'snippet',
      'firstBlock',
      'lastBlock',
      'trust',
    ],
    type: 'object',
  },
  KnowledgeSettingsPreviewResponse: {
    additionalProperties: false,
    description:
      '`GET .../knowledge-settings/preview?reviewEvery=`: how many pages are Review Due now and how many would be under the period asked about, so a dialog can say so before a shorter period is applied.',
    properties: {
      reviewDue: {
        type: 'number',
      },
      reviewDueNow: {
        type: 'number',
      },
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
      },
    },
    required: ['reviewEvery', 'reviewDue', 'reviewDueNow'],
    type: 'object',
  },
  KnowledgeSettingsRequest: {
    additionalProperties: false,
    description: '`PUT .../knowledge-settings`: Editor only. Answers the settings as stored.',
    properties: {
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
      },
    },
    required: ['reviewEvery'],
    type: 'object',
  },
  KnowledgeSettingsResponse: {
    additionalProperties: false,
    properties: {
      knowledgeSettings: {
        $ref: '#/components/schemas/KnowledgeSettingsWire',
      },
    },
    required: ['knowledgeSettings'],
    type: 'object',
  },
  KnowledgeSettingsWire: {
    additionalProperties: false,
    description:
      'What a knowledgebase decides for every page (verification.md "The Review Period"): how long after it was last verified a page comes due for review. In a document read, the `document-meta` op and the routes below.',
    properties: {
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
      },
    },
    required: ['reviewEvery'],
    type: 'object',
  },
  KnowledgeSetupPage: {
    additionalProperties: false,
    description:
      'One proposed page. `parent` is the `id` of a page earlier in the list, or null at the top; `depth` is 1 to 3.',
    properties: {
      depth: {
        type: 'number',
      },
      headings: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      id: {
        type: 'string',
      },
      parent: {
        type: ['string', 'null'],
      },
      summary: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: ['id', 'title', 'summary', 'headings', 'parent', 'depth'],
    type: 'object',
  },
  KnowledgeSetupProvider: {
    anyOf: [
      {
        const: 'built-in',
        type: 'string',
      },
      {
        $ref: '#/components/schemas/KnowledgeAiProvider',
      },
    ],
    description:
      'Which AI answered a suggestion (describe-to-set-up.md "The model"): built-in AI with no key, else the team\'s.',
  },
  KnowledgeSetupRequest: {
    additionalProperties: false,
    description:
      '`POST .../setup/suggest` (describe-to-set-up.md "The model"): what the knowledgebase is for and, when adding pages, the titles already there in tree order with their depth (1 is the top).',
    properties: {
      description: {
        type: 'string',
      },
      existing: {
        items: {
          additionalProperties: false,
          properties: {
            depth: {
              type: 'number',
            },
            title: {
              type: 'string',
            },
          },
          required: ['title', 'depth'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['description'],
    type: 'object',
  },
  KnowledgeSetupSuggestion: {
    additionalProperties: false,
    description:
      'A proposed structure: a name for the knowledgebase and up to 30 pages in tree order. Plain text throughout. `provider`: which AI answered; the route always says, and a structure picked on the start screen has none.',
    properties: {
      name: {
        type: 'string',
      },
      pages: {
        items: {
          $ref: '#/components/schemas/KnowledgeSetupPage',
        },
        type: 'array',
      },
      provider: {
        $ref: '#/components/schemas/KnowledgeSetupProvider',
      },
    },
    required: ['name', 'pages'],
    type: 'object',
  },
  KnowledgeStyle: {
    additionalProperties: false,
    properties: {
      accent: {
        type: 'string',
      },
      bodyFont: {
        type: 'string',
      },
      headingFont: {
        type: 'string',
      },
      headingStyle: {
        $ref: '#/components/schemas/KnowledgeHeadingStyle',
      },
      lineSpacing: {
        $ref: '#/components/schemas/KnowledgeLineSpacing',
      },
      textSize: {
        $ref: '#/components/schemas/KnowledgeTextSize',
      },
      theme: {
        type: 'string',
      },
    },
    required: ['theme', 'headingFont', 'bodyFont', 'textSize', 'lineSpacing', 'headingStyle'],
    type: 'object',
  },
  KnowledgeStyleWire: {
    $ref: '#/components/schemas/KnowledgeStyle',
    description:
      'The Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the one look every page is drawn in. In a document read (always whole), the `document-meta` op when it changed, and the metadata write (`PUT /api/documents/<id>`), which takes any of its fields and `accent: null` to clear a picked accent.',
  },
  KnowledgeSuggestion: {
    additionalProperties: false,
    description:
      'An agent\'s edit waiting for an Editor (ai-knowledge.md "Edits suggested by agents"): a passage of the page\'s Markdown (`before`) replaced by `after`, or `after` appended to the page (`before` is then empty).',
    properties: {
      after: {
        type: 'string',
      },
      agent: {
        type: 'string',
      },
      before: {
        type: 'string',
      },
      createdAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      kind: {
        enum: ['replace', 'append'],
        type: 'string',
      },
      reason: {
        description:
          "Why, in the agent's words; `summary` is its first line, for a card's heading.",
        type: 'string',
      },
      summary: {
        type: 'string',
      },
      tab: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
    },
    required: [
      'id',
      'tab',
      'title',
      'agent',
      'reason',
      'summary',
      'kind',
      'before',
      'after',
      'createdAt',
    ],
    type: 'object',
  },
  KnowledgeSuggestionsResponse: {
    additionalProperties: false,
    properties: {
      suggestions: {
        items: {
          $ref: '#/components/schemas/KnowledgeSuggestion',
        },
        type: 'array',
      },
    },
    required: ['suggestions'],
    type: 'object',
  },
  KnowledgeSummaryResponse: {
    additionalProperties: false,
    description:
      "`GET .../summary` (knowledgebase-home.md): what Home shows of one knowledgebase. `yoursToReview` is the caller's own pages whose review is due, oldest first, ten at most; empty for a caller with no account.",
    properties: {
      health: {
        $ref: '#/components/schemas/KnowledgeHealthCounts',
      },
      pages: {
        type: 'number',
      },
      recent: {
        items: {
          $ref: '#/components/schemas/KnowledgeRecentPage',
        },
        type: 'array',
      },
      reviewEvery: {
        $ref: '#/components/schemas/KnowledgeReviewEvery',
        description:
          "The knowledgebase's Review Period, which the counts and `yoursToReview` are worked out under.",
      },
      yoursToReview: {
        items: {
          $ref: '#/components/schemas/KnowledgeDuePage',
        },
        type: 'array',
      },
    },
    required: ['pages', 'reviewEvery', 'health', 'recent', 'yoursToReview'],
    type: 'object',
  },
  KnowledgeTextSize: {
    enum: ['small', 'medium', 'large'],
    type: 'string',
  },
  KnowledgeTreeRow: {
    anyOf: [
      {
        $ref: '#/components/schemas/KnowledgePageRow',
      },
      {
        $ref: '#/components/schemas/KnowledgeConnectedRow',
      },
    ],
    description: 'One row of the tree: a page, or a connected file.',
  },
  KnowledgeTrustState: {
    description: 'A page\'s verified state, worked out when read (verification.md "States").',
    enum: ['verified', 'review-due', 'never-verified'],
    type: 'string',
  },
  Layer: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      locked: {
        type: 'boolean',
      },
      name: {
        type: 'string',
      },
      opacity: {
        type: 'number',
      },
      visible: {
        type: 'boolean',
      },
    },
    required: ['id', 'name'],
    type: 'object',
  },
  LayoutView: {
    additionalProperties: false,
    properties: {
      arrows: {
        items: {
          additionalProperties: false,
          properties: {
            from: {
              type: 'string',
            },
            ref: {
              type: 'string',
            },
            style: {
              type: 'string',
            },
            to: {
              type: 'string',
            },
          },
          required: ['ref', 'from', 'to', 'style'],
          type: 'object',
        },
        type: 'array',
      },
      boxes: {
        items: {
          additionalProperties: false,
          properties: {
            h: {
              type: 'number',
            },
            r: {
              type: 'number',
            },
            ref: {
              type: 'string',
            },
            w: {
              type: 'number',
            },
            x: {
              type: 'number',
            },
            y: {
              type: 'number',
            },
          },
          required: ['ref', 'x', 'y', 'w', 'h', 'r'],
          type: 'object',
        },
        type: 'array',
      },
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      origin: {
        additionalProperties: false,
        properties: {
          x: {
            type: 'number',
          },
          y: {
            type: 'number',
          },
        },
        required: ['x', 'y'],
        type: 'object',
      },
      rows: {
        anyOf: [
          {
            items: {
              additionalProperties: false,
              properties: {
                container: {
                  type: ['string', 'null'],
                },
                rows: {
                  items: {
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                  type: 'array',
                },
              },
              required: ['container', 'rows'],
              type: 'object',
            },
            type: 'array',
          },
          {
            type: 'null',
          },
        ],
      },
    },
    required: ['header', 'origin', 'boxes', 'arrows', 'rows', 'elision'],
    type: 'object',
  },
  LegendItem: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      label: {
        type: 'string',
      },
    },
    required: ['label'],
    type: 'object',
  },
  LineSeries: {
    additionalProperties: false,
    properties: {
      axis: {
        const: 'right',
        type: 'string',
      },
      color: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      values: {
        items: {
          type: 'number',
        },
        type: 'array',
      },
    },
    required: ['name', 'values'],
    type: 'object',
  },
  LinkCardElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      fillColor: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      headerFill: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      meta: {
        $ref: '#/components/schemas/LinkCardMeta',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      rotation: {
        type: 'number',
      },
      shadow: {
        $ref: '#/components/schemas/ElementShadow',
      },
      strokeColor: {
        type: 'string',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'link-card',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height'],
    type: 'object',
  },
  LinkCardMeta: {
    additionalProperties: false,
    properties: {
      favicon: {
        type: 'string',
      },
      image: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      url: {
        type: 'string',
      },
    },
    required: ['url'],
    type: 'object',
  },
  LintCode: {
    enum: [
      'box-overlap',
      'arrow-dangling',
      'arrow-behind-box',
      'edge-crossings',
      'label-collision',
      'label-overflow',
      'node-isolated',
      'duplicate-label',
      'flow-backwards',
      'text-overflow',
    ],
    type: 'string',
  },
  LintFinding: {
    additionalProperties: false,
    properties: {
      code: {
        $ref: '#/components/schemas/LintCode',
      },
      fix: {
        type: 'string',
      },
      message: {
        type: 'string',
      },
      refs: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      severity: {
        $ref: '#/components/schemas/LintSeverity',
      },
    },
    required: ['code', 'severity', 'refs', 'message', 'fix'],
    type: 'object',
  },
  LintMeasures: {
    additionalProperties: false,
    properties: {
      arrows: {
        type: 'number',
      },
      behind: {
        type: 'number',
      },
      boxes: {
        type: 'number',
      },
      crossings: {
        type: ['number', 'null'],
      },
      extent: {
        anyOf: [
          {
            additionalProperties: false,
            properties: {
              height: {
                type: 'number',
              },
              width: {
                type: 'number',
              },
            },
            required: ['width', 'height'],
            type: 'object',
          },
          {
            type: 'null',
          },
        ],
      },
      overlaps: {
        type: 'number',
      },
    },
    required: ['crossings', 'behind', 'overlaps', 'extent', 'arrows', 'boxes'],
    type: 'object',
  },
  LintReport: {
    additionalProperties: false,
    properties: {
      counts: {
        additionalProperties: false,
        properties: {
          error: {
            type: 'number',
          },
          info: {
            type: 'number',
          },
          warning: {
            type: 'number',
          },
        },
        required: ['error', 'warning', 'info'],
        type: 'object',
      },
      findings: {
        items: {
          $ref: '#/components/schemas/LintFinding',
        },
        type: 'array',
      },
      measures: {
        $ref: '#/components/schemas/LintMeasures',
      },
      skipped: {
        additionalProperties: false,
        properties: {
          crossings: {
            type: 'boolean',
          },
        },
        required: ['crossings'],
        type: 'object',
      },
    },
    required: ['measures', 'findings', 'counts', 'skipped'],
    type: 'object',
  },
  LintSeverity: {
    enum: ['error', 'warning', 'info'],
    type: 'string',
  },
  LiveEmbedApp: {
    enum: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
    type: 'string',
  },
  LiveItem: {
    additionalProperties: false,
    properties: {
      app: {
        $ref: '#/components/schemas/LiveEmbedApp',
      },
      itemId: {
        type: 'string',
      },
    },
    required: ['app', 'itemId'],
    type: 'object',
  },
  MapPin: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      label: {
        type: 'string',
      },
      lat: {
        type: 'number',
      },
      lon: {
        type: 'number',
      },
    },
    required: ['id', 'lat', 'lon'],
    type: 'object',
  },
  MapRegion: {
    enum: [
      'world',
      'europe',
      'africa',
      'asia',
      'middle-east',
      'north-america',
      'south-america',
      'oceania',
    ],
    type: 'string',
  },
  MediaAnimation: {
    enum: ['kenburns', 'zoom', 'pan', 'tilt', 'develop', 'focus', 'wipe', 'iris', 'sheen'],
    type: 'string',
  },
  MovePageRequest: {
    additionalProperties: false,
    description:
      "`POST .../pages/<tab>/move`: under `parent` (a page's id or title; null for the top level), before its subpage `before` (last when absent). With `before` and no `parent`, under that page's own parent.",
    properties: {
      before: {
        type: 'string',
      },
      parent: {
        type: ['string', 'null'],
      },
    },
    type: 'object',
  },
  MovePageResponse: {
    additionalProperties: false,
    properties: {
      page: {
        additionalProperties: false,
        properties: {
          depth: {
            type: 'number',
          },
          parent: {
            type: 'string',
          },
          tab: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
        },
        required: ['depth', 'tab', 'title'],
        type: 'object',
      },
    },
    required: ['page'],
    type: 'object',
  },
  OutlineNode: {
    additionalProperties: false,
    properties: {
      attributes: {
        items: {
          $ref: '#/components/schemas/ViewAttributeJson',
        },
        type: 'array',
      },
      children: {
        items: {
          anyOf: [
            {
              $ref: '#/components/schemas/OutlineNode',
            },
            {
              $ref: '#/components/schemas/FreehandRunJson',
            },
          ],
        },
        type: 'array',
      },
      collapsed: {
        type: 'number',
      },
      edges: {
        items: {
          $ref: '#/components/schemas/ViewEdgeJson',
        },
        type: 'array',
      },
      id: {
        type: 'string',
      },
      kind: {
        type: 'string',
      },
      label: {
        type: ['string', 'null'],
      },
      ref: {
        type: 'string',
      },
      summary: {
        type: ['string', 'null'],
      },
      unknown: {
        type: 'boolean',
      },
    },
    required: [
      'ref',
      'id',
      'kind',
      'unknown',
      'label',
      'summary',
      'attributes',
      'edges',
      'children',
      'collapsed',
    ],
    type: 'object',
  },
  OutlineView: {
    additionalProperties: false,
    properties: {
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      nodes: {
        items: {
          anyOf: [
            {
              $ref: '#/components/schemas/OutlineNode',
            },
            {
              $ref: '#/components/schemas/FreehandRunJson',
            },
          ],
        },
        type: 'array',
      },
      ownLineArrows: {
        items: {
          $ref: '#/components/schemas/ViewEdgeJson',
        },
        type: 'array',
      },
    },
    required: ['header', 'nodes', 'ownLineArrows', 'elision'],
    type: 'object',
  },
  OverviewTab: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          outOfScope: {
            const: true,
            type: 'boolean',
          },
          ref: {
            type: 'string',
          },
        },
        required: ['outOfScope', 'ref'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          counts: {
            additionalProperties: false,
            properties: {
              arrows: {
                type: 'number',
              },
              boxes: {
                type: 'number',
              },
            },
            required: ['boxes', 'arrows'],
            type: 'object',
          },
          elements: {
            type: 'number',
          },
          finish: {
            $ref: '#/components/schemas/Finish',
          },
          hidden: {
            type: 'number',
          },
          outOfScope: {
            const: false,
            type: 'boolean',
          },
          pages: {
            additionalProperties: false,
            properties: {
              kinds: {
                additionalProperties: false,
                properties: {
                  article: {
                    type: 'number',
                  },
                  infographic: {
                    type: 'number',
                  },
                  slide: {
                    type: 'number',
                  },
                },
                type: 'object',
              },
              pages: {
                type: 'number',
              },
            },
            required: ['pages', 'kinds'],
            type: 'object',
          },
          rev: {
            type: ['number', 'null'],
          },
          tab: {
            additionalProperties: false,
            properties: {
              id: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              ref: {
                type: 'string',
              },
            },
            required: ['id', 'ref', 'name'],
            type: 'object',
          },
          threads: {
            additionalProperties: false,
            properties: {
              open: {
                type: 'number',
              },
              total: {
                type: 'number',
              },
            },
            required: ['open', 'total'],
            type: 'object',
          },
          unknown: {
            type: 'number',
          },
          view: {
            $ref: '#/components/schemas/ViewName',
          },
        },
        required: [
          'counts',
          'elements',
          'hidden',
          'outOfScope',
          'rev',
          'tab',
          'threads',
          'unknown',
          'view',
        ],
        type: 'object',
      },
    ],
  },
  OverviewView: {
    additionalProperties: false,
    properties: {
      document: {
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          savedAt: {
            type: 'number',
          },
          tabs: {
            type: 'number',
          },
        },
        required: ['id', 'name', 'savedAt', 'tabs'],
        type: 'object',
      },
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      tabs: {
        items: {
          $ref: '#/components/schemas/OverviewTab',
        },
        type: 'array',
      },
    },
    required: ['document', 'tabs', 'elision'],
    type: 'object',
  },
  Padding: {
    enum: ['none', 'sm', 'md', 'lg'],
    type: 'string',
  },
  Page: {
    additionalProperties: false,
    properties: {
      background: {
        $ref: '#/components/schemas/PageBackground',
      },
      fit: {
        $ref: '#/components/schemas/PageSides',
      },
      flow: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
      kind: {
        $ref: '#/components/schemas/PageKind',
      },
      locked: {
        const: true,
        type: 'boolean',
      },
      name: {
        type: 'string',
      },
      orientation: {
        $ref: '#/components/schemas/PageOrientation',
      },
      rowAt: {
        $ref: '#/components/schemas/RowAt',
      },
      size: {
        $ref: '#/components/schemas/PageSizeId',
      },
    },
    required: ['id', 'orientation'],
    type: 'object',
  },
  PageAgentReads: {
    additionalProperties: false,
    description: "One agent's reads of a page this week, by the agent's name.",
    properties: {
      agent: {
        type: 'string',
      },
      reads: {
        type: 'number',
      },
    },
    required: ['agent', 'reads'],
    type: 'object',
  },
  PageAnsweredQuestion: {
    additionalProperties: false,
    description:
      "One question answered from a page: the asker's words (the latest day's of like questions) and how many times.",
    properties: {
      asked: {
        type: 'number',
      },
      question: {
        type: 'string',
      },
    },
    required: ['question', 'asked'],
    type: 'object',
  },
  PageArrangement: {
    description:
      'How a tab\'s pages stand (pages-mode.md "Stacked or side by side"): one page in front with the rest fanned behind it, or side by side.',
    enum: ['stack', 'row'],
    type: 'string',
  },
  PageAuthorKind: {
    description:
      'What kind of writer made a stamp (verification.md "Made by a person or an agent").',
    enum: ['human', 'ai'],
    type: 'string',
  },
  PageAuthorStamp: {
    additionalProperties: false,
    description:
      "One stamp: the person (an agent's is its token's maker, or the Editor who accepted its suggestion), when, the kind, and an agent's name and door where they are known.",
    properties: {
      agent: {
        type: 'string',
      },
      at: {
        type: 'number',
      },
      by: {
        type: 'string',
      },
      kind: {
        $ref: '#/components/schemas/PageAuthorKind',
      },
      via: {
        $ref: '#/components/schemas/PageAuthorVia',
      },
    },
    required: ['by', 'at', 'kind'],
    type: 'object',
  },
  PageAuthorVia: {
    description:
      "The door an agent's write came through; `suggestion` is an agent's suggestion a person accepted.",
    enum: ['mcp', 'cli', 'api', 'suggestion'],
    type: 'string',
  },
  PageBackground: {
    additionalProperties: false,
    properties: {
      fill: {
        $ref: '#/components/schemas/PageFill',
      },
      pattern: {
        $ref: '#/components/schemas/PagePattern',
      },
    },
    type: 'object',
  },
  PageBackgroundInput: {
    additionalProperties: false,
    properties: {
      angle: {
        type: 'number',
      },
      color: {
        type: 'string',
      },
      gradient: {
        items: {
          type: 'string',
        },
        maxItems: 2,
        minItems: 2,
        type: 'array',
      },
      paper: {
        const: true,
        type: 'boolean',
      },
      pattern: {
        anyOf: [
          {
            $ref: '#/components/schemas/PagePattern',
          },
          {
            const: 'none',
            type: 'string',
          },
        ],
      },
    },
    type: 'object',
  },
  PageChange: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          at: {
            type: 'number',
          },
          background: {
            $ref: '#/components/schemas/PageBackgroundInput',
          },
          kind: {
            $ref: '#/components/schemas/PageKind',
          },
          layout: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          op: {
            const: 'add',
            type: 'string',
          },
          orientation: {
            $ref: '#/components/schemas/PageOrientation',
          },
          size: {
            $ref: '#/components/schemas/PageSizeId',
          },
        },
        required: ['op', 'kind'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          background: {
            $ref: '#/components/schemas/PageBackgroundInput',
          },
          locked: {
            type: 'boolean',
          },
          name: {
            type: 'string',
          },
          op: {
            const: 'set',
            type: 'string',
          },
          orientation: {
            $ref: '#/components/schemas/PageOrientation',
          },
          page: {
            $ref: '#/components/schemas/PageRef',
          },
          size: {
            $ref: '#/components/schemas/PageSizeId',
          },
        },
        required: ['op', 'page'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          layout: {
            type: 'string',
          },
          op: {
            const: 'layout',
            type: 'string',
          },
          page: {
            $ref: '#/components/schemas/PageRef',
          },
        },
        required: ['op', 'page', 'layout'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          op: {
            const: 'move',
            type: 'string',
          },
          page: {
            $ref: '#/components/schemas/PageRef',
          },
          to: {
            type: 'number',
          },
        },
        required: ['op', 'page', 'to'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          op: {
            const: 'duplicate',
            type: 'string',
          },
          page: {
            $ref: '#/components/schemas/PageRef',
          },
        },
        required: ['op', 'page'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          op: {
            const: 'delete',
            type: 'string',
          },
          page: {
            $ref: '#/components/schemas/PageRef',
          },
        },
        required: ['op', 'page'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          op: {
            const: 'apply_background_to_all',
            type: 'string',
          },
          page: {
            $ref: '#/components/schemas/PageRef',
          },
        },
        required: ['op', 'page'],
        type: 'object',
      },
    ],
  },
  PageColourFill: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          color: {
            type: 'string',
          },
          kind: {
            const: 'solid',
            type: 'string',
          },
        },
        required: ['kind', 'color'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          angle: {
            type: 'number',
          },
          from: {
            type: 'string',
          },
          kind: {
            const: 'gradient',
            type: 'string',
          },
          motion: {
            $ref: '#/components/schemas/PageMotion',
          },
          speed: {
            type: 'number',
          },
          to: {
            type: 'string',
          },
        },
        required: ['kind', 'from', 'to', 'angle'],
        type: 'object',
      },
    ],
  },
  PageFill: {
    anyOf: [
      {
        $ref: '#/components/schemas/PageColourFill',
      },
      {
        $ref: '#/components/schemas/PageImageFill',
      },
    ],
  },
  PageHealthResponse: {
    additionalProperties: false,
    description: 'Page Health (verification.md): the fields, and the reads of the last seven days.',
    properties: {
      agents: {
        description:
          'The agents that read this page in the last 7 days, the most reads first, 3 at most.',
        items: {
          $ref: '#/components/schemas/PageAgentReads',
        },
        type: 'array',
      },
      answered: {
        description:
          'The questions Ask answered citing this page in the last 30 days, the most asked first, 3 at most (ai-knowledge.md "AI Context on a page").',
        items: {
          $ref: '#/components/schemas/PageAnsweredQuestion',
        },
        type: 'array',
      },
      created: {
        $ref: '#/components/schemas/PageAuthorStamp',
        description:
          'Who made the page and who last saved it (verification.md "Created and Updated"), by account id; absent for a page not saved since the server began keeping them.',
      },
      knowledge: {
        $ref: '#/components/schemas/PageKnowledge',
      },
      reads: {
        additionalProperties: false,
        properties: {
          agents: {
            type: 'number',
          },
          people: {
            type: 'number',
          },
        },
        required: ['people', 'agents'],
        type: 'object',
      },
      updated: {
        $ref: '#/components/schemas/PageAuthorStamp',
      },
    },
    required: ['knowledge', 'reads'],
    type: 'object',
  },
  PageImageFill: {
    additionalProperties: false,
    properties: {
      blur: {
        type: 'number',
      },
      credit: {
        $ref: '#/components/schemas/ImageCredit',
      },
      imageId: {
        type: 'string',
      },
      kind: {
        const: 'image',
        type: 'string',
      },
      overlay: {
        $ref: '#/components/schemas/PageImageOverlay',
      },
      position: {
        $ref: '#/components/schemas/PageImagePosition',
      },
      preview: {
        type: 'string',
      },
      tone: {
        type: 'string',
      },
    },
    required: ['kind', 'imageId'],
    type: 'object',
  },
  PageImageOverlay: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      kind: {
        $ref: '#/components/schemas/PageImageOverlayKind',
      },
      strength: {
        type: 'number',
      },
    },
    required: ['kind', 'strength'],
    type: 'object',
  },
  PageImageOverlayKind: {
    enum: ['light', 'dark', 'tint', 'fade'],
    type: 'string',
  },
  PageImagePosition: {
    enum: ['top', 'bottom'],
    type: 'string',
  },
  PageKind: {
    enum: ['infographic', 'article', 'slide'],
    type: 'string',
  },
  PageKnowledge: {
    additionalProperties: false,
    description: "A page's knowledge fields with what is worked out from them.",
    properties: {
      changedSinceVerified: {
        description: 'More than a fifth of the writing changed since it was verified.',
        type: 'boolean',
      },
      context: {
        const: true,
        type: 'boolean',
      },
      owner: {
        type: 'string',
      },
      reviewAt: {
        description:
          "When the review comes due under the knowledgebase's Review Period; absent for a page never verified or a knowledgebase whose period is Never.",
        type: 'number',
      },
      state: {
        $ref: '#/components/schemas/KnowledgeTrustState',
      },
      tab: {
        type: 'string',
      },
      tokens: {
        description: "The page's size against the Always in Context budget.",
        type: 'number',
      },
      verifiedAt: {
        type: 'number',
      },
      verifiedBy: {
        type: 'string',
      },
    },
    required: ['tab', 'state', 'changedSinceVerified', 'tokens'],
    type: 'object',
  },
  PageKnowledgePatch: {
    additionalProperties: false,
    description:
      "`PUT .../pages/<tab>/knowledge`: each field optional; `owner: null` clears it. The Review Period is the knowledgebase's (`PUT .../knowledge-settings`): a `reviewEvery` here is refused.",
    properties: {
      context: {
        type: 'boolean',
      },
      owner: {
        type: ['string', 'null'],
      },
    },
    type: 'object',
  },
  PageKnowledgeResponse: {
    additionalProperties: false,
    properties: {
      knowledge: {
        $ref: '#/components/schemas/PageKnowledge',
      },
    },
    required: ['knowledge'],
    type: 'object',
  },
  PageMotion: {
    enum: [
      'flow',
      'drift',
      'aurora',
      'ripple',
      'ribbons',
      'mesh',
      'starfield',
      'retro-grid',
      'bokeh',
      'waves',
      'spotlight',
      'beams',
      'sunburst',
      'fireflies',
      'snowfall',
      'lava',
      'dot-wave',
      'clouds',
      'warp',
      'orbits',
      'radar',
      'equaliser',
      'confetti',
      'threads',
    ],
    type: 'string',
  },
  PageMotionColouringId: {
    enum: ['deep', 'night', 'bright', 'vivid', 'soft', 'mist'],
    type: 'string',
  },
  PageOrientation: {
    enum: ['portrait', 'landscape'],
    type: 'string',
  },
  PagePattern: {
    enum: ['dots', 'grid', 'lines'],
    type: 'string',
  },
  PageRect: {
    additionalProperties: false,
    properties: {
      height: {
        type: 'number',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['x', 'y', 'width', 'height'],
    type: 'object',
  },
  PageRef: {
    type: ['string', 'number'],
  },
  PageSides: {
    additionalProperties: false,
    properties: {
      height: {
        type: 'number',
      },
      width: {
        type: 'number',
      },
    },
    required: ['width', 'height'],
    type: 'object',
  },
  PageSizeId: {
    enum: ['a4', 'letter', 'a3', 'square', 'social', 'wide', 'slide', 'slide-classic', 'fit'],
    type: 'string',
  },
  PageSummary: {
    additionalProperties: false,
    properties: {
      background: {
        type: ['string', 'null'],
      },
      elements: {
        type: 'number',
      },
      flow: {
        type: ['string', 'null'],
      },
      id: {
        type: 'string',
      },
      kind: {
        $ref: '#/components/schemas/PageKind',
      },
      locked: {
        type: 'boolean',
      },
      name: {
        type: ['string', 'null'],
      },
      orientation: {
        anyOf: [
          {
            $ref: '#/components/schemas/PageOrientation',
          },
          {
            type: 'null',
          },
        ],
      },
      place: {
        type: 'number',
      },
      rect: {
        $ref: '#/components/schemas/PageRect',
      },
      size: {
        $ref: '#/components/schemas/PageSizeId',
      },
    },
    required: [
      'place',
      'id',
      'name',
      'kind',
      'size',
      'orientation',
      'rect',
      'background',
      'locked',
      'flow',
      'elements',
    ],
    type: 'object',
  },
  PagesAnswer: {
    additionalProperties: false,
    properties: {
      article: {
        additionalProperties: false,
        properties: {
          blocks: {
            type: 'number',
          },
          created: {
            type: 'boolean',
          },
          estimatedPages: {
            type: 'number',
          },
          flow: {
            type: 'string',
          },
          look: {
            anyOf: [
              {
                $ref: '#/components/schemas/ArticleLookId',
              },
              {
                type: 'null',
              },
            ],
          },
          pages: {
            items: {
              type: 'number',
            },
            type: 'array',
          },
          readability: {
            $ref: '#/components/schemas/ArticleReadabilitySummary',
          },
          title: {
            type: 'string',
          },
          words: {
            type: 'number',
          },
        },
        required: [
          'blocks',
          'created',
          'estimatedPages',
          'flow',
          'look',
          'pages',
          'readability',
          'title',
          'words',
        ],
        type: 'object',
      },
      articles: {
        items: {
          $ref: '#/components/schemas/ArticleSummary',
        },
        type: 'array',
      },
      changesetId: {
        type: ['string', 'null'],
      },
      lines: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      pages: {
        items: {
          $ref: '#/components/schemas/PageSummary',
        },
        type: 'array',
      },
      tab: {
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
          },
          rev: {
            type: 'number',
          },
        },
        required: ['id', 'rev'],
        type: 'object',
      },
    },
    required: ['tab', 'lines', 'pages', 'articles', 'changesetId'],
    type: 'object',
  },
  PagesRequest: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          pages: {
            items: {
              $ref: '#/components/schemas/PageChange',
            },
            type: 'array',
          },
        },
        required: ['pages'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          article: {
            $ref: '#/components/schemas/ArticleWrite',
          },
          cover: {
            anyOf: [
              {
                $ref: '#/components/schemas/TabCover',
              },
              {
                type: 'null',
              },
            ],
          },
        },
        required: ['article'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          cover: {
            anyOf: [
              {
                $ref: '#/components/schemas/TabCover',
              },
              {
                type: 'null',
              },
            ],
          },
        },
        required: ['cover'],
        type: 'object',
      },
    ],
  },
  PagesView: {
    additionalProperties: false,
    properties: {
      articles: {
        items: {
          additionalProperties: false,
          properties: {
            blocks: {
              type: 'number',
            },
            estimatedPages: {
              type: 'number',
            },
            flow: {
              type: 'string',
            },
            look: {
              anyOf: [
                {
                  $ref: '#/components/schemas/ArticleLookId',
                },
                {
                  type: 'null',
                },
              ],
            },
            markdown: {
              type: 'string',
            },
            pages: {
              items: {
                type: 'number',
              },
              type: 'array',
            },
            readability: {
              $ref: '#/components/schemas/ArticleReadabilitySummary',
            },
            title: {
              type: 'string',
            },
            words: {
              type: 'number',
            },
          },
          required: [
            'blocks',
            'estimatedPages',
            'flow',
            'look',
            'markdown',
            'pages',
            'readability',
            'title',
            'words',
          ],
          type: 'object',
        },
        type: 'array',
      },
      elision: {
        $ref: '#/components/schemas/Elision',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      layouts: {
        items: {
          additionalProperties: false,
          properties: {
            kind: {
              $ref: '#/components/schemas/PageKind',
            },
            layouts: {
              items: {
                additionalProperties: false,
                properties: {
                  id: {
                    type: 'string',
                  },
                  label: {
                    type: 'string',
                  },
                },
                required: ['id', 'label'],
                type: 'object',
              },
              type: 'array',
            },
          },
          required: ['kind', 'layouts'],
          type: 'object',
        },
        type: 'array',
      },
      pages: {
        items: {
          additionalProperties: false,
          properties: {
            background: {
              type: ['string', 'null'],
            },
            elements: {
              type: 'number',
            },
            flow: {
              type: ['string', 'null'],
            },
            id: {
              type: 'string',
            },
            kind: {
              $ref: '#/components/schemas/PageKind',
            },
            locked: {
              type: 'boolean',
            },
            name: {
              type: ['string', 'null'],
            },
            orientation: {
              anyOf: [
                {
                  $ref: '#/components/schemas/PageOrientation',
                },
                {
                  type: 'null',
                },
              ],
            },
            place: {
              type: 'number',
            },
            rect: {
              $ref: '#/components/schemas/PageRect',
            },
            refs: {
              items: {
                type: 'string',
              },
              type: 'array',
            },
            size: {
              $ref: '#/components/schemas/PageSizeId',
            },
          },
          required: [
            'background',
            'elements',
            'flow',
            'id',
            'kind',
            'locked',
            'name',
            'orientation',
            'place',
            'rect',
            'refs',
            'size',
          ],
          type: 'object',
        },
        type: 'array',
      },
      pagesMode: {
        type: 'boolean',
      },
    },
    required: ['header', 'pagesMode', 'pages', 'articles', 'layouts', 'elision'],
    type: 'object',
  },
  PairingRequestStatus: {
    enum: ['pending', 'approved', 'declined', 'expired'],
    type: 'string',
  },
  ParticipantRecord: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      createdAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      picture: {
        type: 'string',
      },
    },
    required: ['id', 'name', 'color', 'createdAt'],
    type: 'object',
  },
  PenColourName: {
    anyOf: [
      {
        const: 'ink',
        type: 'string',
      },
      {
        const: 'grey',
        type: 'string',
      },
      {
        $ref: '#/components/schemas/HuedPenColourName',
      },
    ],
  },
  PieAnim: {
    enum: ['grow', 'pop', 'spin', 'pulse'],
    type: 'string',
  },
  PieSlice: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      label: {
        type: 'string',
      },
      value: {
        type: 'number',
      },
    },
    required: ['label', 'value'],
    type: 'object',
  },
  ProgressAnim: {
    enum: ['fill', 'pulse', 'stripes'],
    type: 'string',
  },
  PyramidVariant: {
    enum: ['pyramid', 'inverted', 'funnel'],
    type: 'string',
  },
  QuickSwatchSlot: {
    enum: [1, 2, 3, 4, 5, 6],
    type: 'number',
  },
  QuoteLook: {
    enum: ['card', 'plain'],
    type: 'string',
  },
  RatingAnim: {
    enum: ['pop', 'twinkle', 'pulse', 'rock'],
    type: 'string',
  },
  ReactionSummary: {
    additionalProperties: false,
    properties: {
      by: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      count: {
        type: 'number',
      },
      emoji: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
    },
    required: ['emoji', 'name', 'count', 'by'],
    type: 'object',
  },
  RefCandidate: {
    additionalProperties: false,
    properties: {
      kind: {
        type: 'string',
      },
      label: {
        type: ['string', 'null'],
      },
      ref: {
        type: 'string',
      },
    },
    required: ['ref', 'kind', 'label'],
    type: 'object',
  },
  RefErrorBody: {
    additionalProperties: false,
    properties: {
      candidates: {
        items: {
          $ref: '#/components/schemas/RefCandidate',
        },
        type: 'array',
      },
      error: {
        enum: ['target_not_found', 'target_ambiguous'],
        type: 'string',
      },
      input: {
        type: 'string',
      },
      message: {
        type: 'string',
      },
      stale: {
        type: 'boolean',
      },
    },
    required: ['error', 'message', 'input', 'candidates', 'stale'],
    type: 'object',
  },
  ReportGapRequest: {
    additionalProperties: false,
    description: "`POST .../questions`: an agent's `report_gap`.",
    properties: {
      question: {
        type: 'string',
      },
    },
    required: ['question'],
    type: 'object',
  },
  ResultLine: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          at: {
            items: {
              type: 'number',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          ends: {
            items: {
              type: 'string',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          kind: {
            type: 'string',
          },
          label: {
            type: 'string',
          },
          mark: {
            const: '+',
            type: 'string',
          },
          ref: {
            type: 'string',
          },
          size: {
            items: {
              type: 'number',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          styleOf: {
            type: 'string',
          },
        },
        required: ['mark', 'ref', 'kind'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          changes: {
            items: {
              $ref: '#/components/schemas/FieldChange',
            },
            type: 'array',
          },
          mark: {
            const: '~',
            type: 'string',
          },
          ref: {
            type: 'string',
          },
        },
        required: ['mark', 'ref', 'changes'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          ends: {
            items: {
              type: 'string',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          kind: {
            type: 'string',
          },
          label: {
            type: 'string',
          },
          mark: {
            const: '-',
            type: 'string',
          },
          pinnedTo: {
            type: 'string',
          },
          reason: {
            enum: ['pinned', 'unwrapped'],
            type: 'string',
          },
          ref: {
            type: 'string',
          },
        },
        required: ['mark', 'ref', 'kind'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          delta: {
            items: {
              type: 'number',
            },
            maxItems: 2,
            minItems: 2,
            type: 'array',
          },
          layout: {
            additionalProperties: false,
            properties: {
              direction: {
                enum: ['down', 'right'],
                type: 'string',
              },
              style: {
                enum: ['flow', 'tree', 'mindmap'],
                type: 'string',
              },
            },
            required: ['style'],
            type: 'object',
          },
          mark: {
            const: '»',
            type: 'string',
          },
          reason: {
            enum: ['make room', 'carried', 'laid out'],
            type: 'string',
          },
          refs: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
        },
        required: ['mark', 'refs', 'reason'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          joined: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          left: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          mark: {
            const: 'container',
            type: 'string',
          },
          ref: {
            type: 'string',
          },
        },
        required: ['mark', 'ref', 'joined', 'left'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          mark: {
            const: '!',
            type: 'string',
          },
          warning: {
            $ref: '#/components/schemas/EditWarning',
          },
        },
        required: ['mark', 'warning'],
        type: 'object',
      },
    ],
  },
  RevertKept: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      reason: {
        enum: ['changed', 'gone', 'present', 'order'],
        type: 'string',
      },
    },
    required: ['id', 'reason'],
    type: 'object',
  },
  RevertResponse: {
    additionalProperties: false,
    properties: {
      changeset: {
        anyOf: [
          {
            $ref: '#/components/schemas/ChangesetWritten',
          },
          {
            type: 'null',
          },
        ],
      },
      kept: {
        items: {
          $ref: '#/components/schemas/RevertKept',
        },
        type: 'array',
      },
      lint: {
        anyOf: [
          {
            $ref: '#/components/schemas/LintReport',
          },
          {
            type: 'null',
          },
        ],
      },
      reverted: {
        type: 'number',
      },
    },
    required: ['changeset', 'reverted', 'kept', 'lint'],
    type: 'object',
  },
  RowAt: {
    additionalProperties: false,
    properties: {
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['x', 'y'],
    type: 'object',
  },
  RunHeading: {
    enum: [1, 2, 3],
    type: 'number',
  },
  RunSize: {
    enum: ['xs', 'sm', 'md', 'lg'],
    type: 'string',
  },
  SankeyAlign: {
    description:
      'Where the end nodes sit: every end node in the last column, or each node at its own step from the start.',
    enum: ['justify', 'left'],
    type: 'string',
  },
  SankeyAnim: {
    description:
      "Grow sweeps the diagram in from the left; Flow runs a current along every band; Cascade brings the columns in one after another; Pulse sends a slow wave of light across the bands; Rise grows each column's nodes, then fades their bands in. Flow and Pulse loop; the rest play once.",
    enum: ['grow', 'flow', 'cascade', 'pulse', 'rise'],
    type: 'string',
  },
  SankeyFlow: {
    additionalProperties: false,
    description:
      'One flow: `value` of something moving from the node named `from` to the node named `to`.',
    properties: {
      from: {
        type: 'string',
      },
      to: {
        type: 'string',
      },
      value: {
        type: 'number',
      },
    },
    required: ['from', 'to', 'value'],
    type: 'object',
  },
  SankeyLeftover: {
    description:
      'Whether a node that sends on less than it receives draws the difference as a band to a Leftover node.',
    enum: ['show', 'hide'],
    type: 'string',
  },
  SankeyLinkColor: {
    description:
      "How a flow's band is coloured: its source node, its target node, a blend of both, or one quiet grey.",
    enum: ['source', 'target', 'gradient', 'neutral'],
    type: 'string',
  },
  SankeyNodeStyle: {
    additionalProperties: false,
    description:
      "A node's own settings, by name: its colour, and `leftover: false` when its leftover is switched off (only `false` is ever stored; absent means it draws one while the diagram shows leftovers).",
    properties: {
      color: {
        type: 'string',
      },
      leftover: {
        type: 'boolean',
      },
      name: {
        type: 'string',
      },
    },
    required: ['name'],
    type: 'object',
  },
  SankeyValueLabel: {
    description: "What a node's label says under its name.",
    enum: ['value', 'percent', 'none'],
    type: 'string',
  },
  ShapeAnimation: {
    enum: [
      'pulse',
      'blink',
      'glow',
      'trace',
      'gradient',
      'heartbeat',
      'breathe',
      'shimmer',
      'highlight',
      'bounce',
      'wobble',
      'shake',
      'jelly',
      'float',
      'swing',
    ],
    type: 'string',
  },
  ShapeElement: {
    additionalProperties: false,
    properties: {
      accentEdge: {
        $ref: '#/components/schemas/AccentEdge',
      },
      accentEdgeColor: {
        type: 'string',
      },
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      attachAt: {
        $ref: '#/components/schemas/AttachPoint',
      },
      attachedTo: {
        $ref: '#/components/schemas/ElementId',
      },
      borderRadius: {
        $ref: '#/components/schemas/BorderRadius',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      cardHeader: {
        type: 'boolean',
      },
      cardMedia: {
        $ref: '#/components/schemas/CardMedia',
      },
      chartAxis: {
        type: 'boolean',
      },
      chartLegend: {
        type: 'boolean',
      },
      chartLegendPosition: {
        $ref: '#/components/schemas/ChartLegendPosition',
      },
      chartPalette: {
        $ref: '#/components/schemas/ChartPaletteId',
      },
      chartSheetPending: {
        type: 'boolean',
      },
      chartSheetSource: {
        $ref: '#/components/schemas/ChartSheetSource',
      },
      chartValues: {
        type: 'boolean',
      },
      chartVariant: {
        $ref: '#/components/schemas/ChartVariant',
      },
      checklistItems: {
        items: {
          $ref: '#/components/schemas/ChecklistItem',
        },
        type: 'array',
      },
      chipLook: {
        $ref: '#/components/schemas/ChipLook',
      },
      code: {
        type: 'string',
      },
      codeLanguage: {
        $ref: '#/components/schemas/CodeLanguage',
      },
      codeTheme: {
        $ref: '#/components/schemas/CodeThemeId',
      },
      codeWrap: {
        type: 'boolean',
      },
      colorPreset: {
        type: 'string',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      conceptAnim: {
        $ref: '#/components/schemas/ConceptAnim',
      },
      conceptAnimRepeat: {
        type: 'boolean',
      },
      conceptAnimSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      conceptRows: {
        items: {
          $ref: '#/components/schemas/ConceptRow',
        },
        type: 'array',
      },
      fillColor: {
        type: 'string',
      },
      fillSwatch: {
        $ref: '#/components/schemas/QuickSwatchSlot',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      fixedSize: {
        type: 'boolean',
      },
      font: {
        type: 'string',
      },
      headerFill: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      hubSpokes: {
        type: 'boolean',
      },
      iconAnimation: {
        $ref: '#/components/schemas/IconAnimation',
      },
      iconAnimationRepeat: {
        type: 'boolean',
      },
      iconAnimationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      iconId: {
        type: 'string',
      },
      iconPosition: {
        $ref: '#/components/schemas/IconPosition',
      },
      iconSize: {
        $ref: '#/components/schemas/IconSize',
      },
      iconWeight: {
        $ref: '#/components/schemas/IconWeight',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      imageId: {
        type: 'string',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      legendItems: {
        items: {
          $ref: '#/components/schemas/LegendItem',
        },
        type: 'array',
      },
      lineCategories: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      lineSeries: {
        items: {
          $ref: '#/components/schemas/LineSeries',
        },
        type: 'array',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      mapCountry: {
        type: 'string',
      },
      mapHighlights: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      mapPins: {
        items: {
          $ref: '#/components/schemas/MapPin',
        },
        type: 'array',
      },
      mapRegion: {
        $ref: '#/components/schemas/MapRegion',
      },
      marker: {
        $ref: '#/components/schemas/ShapeMarker',
      },
      markerSize: {
        $ref: '#/components/schemas/TextSizePreset',
      },
      navLinks: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      pageSubtitle: {
        type: 'string',
      },
      pageTitle: {
        type: 'string',
      },
      penColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      penTextColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      pieAnim: {
        $ref: '#/components/schemas/PieAnim',
      },
      pieAnimRepeat: {
        type: 'boolean',
      },
      pieAnimSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      pieSlices: {
        items: {
          $ref: '#/components/schemas/PieSlice',
        },
        type: 'array',
      },
      pointerAnchor: {
        $ref: '#/components/schemas/Anchor',
      },
      pointerTip: {
        additionalProperties: false,
        properties: {
          x: {
            type: 'number',
          },
          y: {
            type: 'number',
          },
        },
        required: ['x', 'y'],
        type: 'object',
      },
      processSteps: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      progress: {
        type: 'number',
      },
      progressAnim: {
        $ref: '#/components/schemas/ProgressAnim',
      },
      progressAnimRepeat: {
        type: 'boolean',
      },
      progressAnimSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      pyramidVariant: {
        $ref: '#/components/schemas/PyramidVariant',
      },
      quoteLook: {
        $ref: '#/components/schemas/QuoteLook',
      },
      railCount: {
        type: 'number',
      },
      railLabels: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      rating: {
        type: 'number',
      },
      ratingAnim: {
        $ref: '#/components/schemas/RatingAnim',
      },
      ratingAnimRepeat: {
        type: 'boolean',
      },
      ratingAnimSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      richText: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      rotation: {
        type: 'number',
      },
      sankeyAlign: {
        $ref: '#/components/schemas/SankeyAlign',
      },
      sankeyAnim: {
        $ref: '#/components/schemas/SankeyAnim',
      },
      sankeyAnimRepeat: {
        type: 'boolean',
      },
      sankeyAnimSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      sankeyFlows: {
        items: {
          $ref: '#/components/schemas/SankeyFlow',
        },
        type: 'array',
      },
      sankeyLeftover: {
        $ref: '#/components/schemas/SankeyLeftover',
      },
      sankeyLeftoverName: {
        type: 'string',
      },
      sankeyLinkColor: {
        $ref: '#/components/schemas/SankeyLinkColor',
      },
      sankeyNodes: {
        items: {
          $ref: '#/components/schemas/SankeyNodeStyle',
        },
        type: 'array',
      },
      sankeyUnit: {
        type: 'string',
      },
      sankeyValueLabel: {
        $ref: '#/components/schemas/SankeyValueLabel',
      },
      shadow: {
        $ref: '#/components/schemas/ElementShadow',
      },
      shape: {
        $ref: '#/components/schemas/ShapeKind',
      },
      stackAlign: {
        $ref: '#/components/schemas/StackAlign',
      },
      stackColumns: {
        type: 'number',
      },
      stackDirection: {
        $ref: '#/components/schemas/StackDirection',
      },
      stackGap: {
        type: 'number',
      },
      stackPadding: {
        type: 'number',
      },
      statCountUp: {
        type: 'boolean',
      },
      stats: {
        items: {
          $ref: '#/components/schemas/StatItem',
        },
        type: 'array',
      },
      stepSequence: {
        type: 'boolean',
      },
      stickerId: {
        type: 'string',
      },
      strokeColor: {
        type: 'string',
      },
      strokeStyle: {
        $ref: '#/components/schemas/BorderStyle',
      },
      strokeSwatch: {
        $ref: '#/components/schemas/QuickSwatchSlot',
      },
      strokeWidth: {
        $ref: '#/components/schemas/BorderStroke',
      },
      tags: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textAnimation: {
        $ref: '#/components/schemas/TextAnimation',
      },
      textAnimationRepeat: {
        type: 'boolean',
      },
      textAnimationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textScale: {
        type: 'number',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      themeLockFill: {
        type: 'boolean',
      },
      type: {
        const: 'shape',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      windowTabId: {
        type: 'string',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'shape', 'x', 'y', 'width', 'height'],
    type: 'object',
  },
  ShapeKind: {
    enum: [
      'square',
      'circle',
      'diamond',
      'cylinder',
      'parallelogram',
      'hexagon',
      'document',
      'banner',
      'card',
      'badge',
      'step',
      'pointer-note',
      'stack',
      'layer-stack',
      'pyramid',
      'cycle',
      'hub',
      'onion',
      'chevrons',
      'stat-row',
      'process',
      'site-header',
      'quote',
      'tab-window',
      'stadium',
      'cloud',
      'triangle',
      'trapezoid',
      'star',
      'speech-bubble',
      'browser',
      'monitor',
      'laptop',
      'phone',
      'tablet',
      'foldable',
      'smartwatch',
      'progress-bar',
      'progress-ring',
      'timeline-rail',
      'rating',
      'pie-chart',
      'bar-chart',
      'line-chart',
      'code-block',
      'checklist',
      'legend',
      'sankey',
      'map',
      'icon',
      'sticker',
    ],
    type: 'string',
  },
  ShapeMarker: {
    enum: ['green-circle', 'orange-circle', 'red-circle', 'checkbox-unchecked', 'checkbox-checked'],
    type: 'string',
  },
  ShareLink: {
    additionalProperties: false,
    properties: {
      code: {
        type: 'string',
      },
      createdAt: {
        type: 'number',
      },
      documentId: {
        type: 'string',
      },
      expiresAt: {
        type: ['number', 'null'],
      },
      expiry: {
        $ref: '#/components/schemas/ShareLinkExpiry',
      },
      role: {
        $ref: '#/components/schemas/ShareRole',
      },
      tabId: {
        type: ['string', 'null'],
      },
    },
    required: ['code', 'documentId', 'role', 'createdAt', 'expiry', 'expiresAt', 'tabId'],
    type: 'object',
  },
  ShareLinkExpiry: {
    enum: ['never', 'week', 'month', 'sixMonths'],
    type: 'string',
  },
  ShareRole: {
    $ref: '#/components/schemas/AccessLevel',
  },
  SharedTabsSummary: {
    additionalProperties: false,
    properties: {
      documents: {
        type: 'number',
      },
      tabs: {
        type: 'number',
      },
    },
    required: ['tabs', 'documents'],
    type: 'object',
  },
  ShowSelectedView: {
    additionalProperties: false,
    properties: {
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      selected: {
        items: {
          additionalProperties: false,
          properties: {
            container: {
              anyOf: [
                {
                  additionalProperties: false,
                  properties: {
                    kind: {
                      type: 'string',
                    },
                    label: {
                      type: ['string', 'null'],
                    },
                    ref: {
                      type: 'string',
                    },
                  },
                  required: ['ref', 'kind', 'label'],
                  type: 'object',
                },
                {
                  type: 'null',
                },
              ],
            },
            fields: {
              additionalProperties: {},
              type: 'object',
            },
            incoming: {
              items: {
                $ref: '#/components/schemas/ViewEdgeJson',
              },
              type: 'array',
            },
            kind: {
              type: 'string',
            },
            omitted: {
              items: {
                type: 'string',
              },
              type: 'array',
            },
            outgoing: {
              items: {
                $ref: '#/components/schemas/ViewEdgeJson',
              },
              type: 'array',
            },
            ref: {
              type: 'string',
            },
          },
          required: ['ref', 'kind', 'container', 'fields', 'incoming', 'outgoing', 'omitted'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['header', 'selected'],
    type: 'object',
  },
  ShowView: {
    additionalProperties: false,
    properties: {
      container: {
        anyOf: [
          {
            additionalProperties: false,
            properties: {
              kind: {
                type: 'string',
              },
              label: {
                type: ['string', 'null'],
              },
              ref: {
                type: 'string',
              },
            },
            required: ['ref', 'kind', 'label'],
            type: 'object',
          },
          {
            type: 'null',
          },
        ],
      },
      fields: {
        additionalProperties: {},
        type: 'object',
      },
      header: {
        $ref: '#/components/schemas/ViewHeader',
      },
      incoming: {
        items: {
          $ref: '#/components/schemas/ViewEdgeJson',
        },
        type: 'array',
      },
      kind: {
        type: 'string',
      },
      omitted: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      outgoing: {
        items: {
          $ref: '#/components/schemas/ViewEdgeJson',
        },
        type: 'array',
      },
      ref: {
        type: 'string',
      },
    },
    required: ['header', 'ref', 'kind', 'container', 'fields', 'incoming', 'outgoing', 'omitted'],
    type: 'object',
  },
  StackAlign: {
    enum: ['start', 'center', 'end'],
    type: 'string',
  },
  StackDirection: {
    enum: ['row', 'column', 'grid'],
    type: 'string',
  },
  StatItem: {
    additionalProperties: false,
    properties: {
      caption: {
        type: 'string',
      },
      change: {
        type: 'string',
      },
      value: {
        type: 'string',
      },
    },
    required: ['value', 'caption'],
    type: 'object',
  },
  StickyAnimation: {
    enum: [
      'flutter',
      'sway',
      'peel',
      'lift',
      'wiggle',
      'drop',
      'slap',
      'pulse',
      'glow',
      'highlight',
    ],
    type: 'string',
  },
  StickyElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      fillColor: {
        type: 'string',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      fixedSize: {
        type: 'boolean',
      },
      font: {
        type: 'string',
      },
      headerFill: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      penTextColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      richText: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      rotation: {
        type: 'number',
      },
      shadow: {
        $ref: '#/components/schemas/ElementShadow',
      },
      strokeColor: {
        type: 'string',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textAnimation: {
        $ref: '#/components/schemas/TextAnimation',
      },
      textAnimationRepeat: {
        type: 'boolean',
      },
      textAnimationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'sticky',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height'],
    type: 'object',
  },
  SuggestEditRequest: {
    additionalProperties: false,
    description:
      '`POST .../pages/<tab>/suggestions`: `before` absent or empty appends `after` to the page.',
    properties: {
      after: {
        type: 'string',
      },
      before: {
        type: 'string',
      },
      reason: {
        type: 'string',
      },
    },
    required: ['reason', 'after'],
    type: 'object',
  },
  SuggestEditResponse: {
    additionalProperties: false,
    properties: {
      pending: {
        type: 'number',
      },
      suggestion: {
        $ref: '#/components/schemas/KnowledgeSuggestion',
      },
    },
    required: ['suggestion', 'pending'],
    type: 'object',
  },
  Tab: {
    additionalProperties: false,
    properties: {
      articles: {
        additionalProperties: {
          $ref: '#/components/schemas/ArticleFlow',
        },
        type: 'object',
      },
      backgroundAnimationSpeed: {
        type: 'number',
      },
      backgroundColor: {
        type: 'string',
      },
      backgroundOpacity: {
        type: 'number',
      },
      backgroundPattern: {
        $ref: '#/components/schemas/BackgroundPattern',
      },
      backgroundPatternScale: {
        type: 'number',
      },
      cover: {
        $ref: '#/components/schemas/TabCover',
      },
      customColours: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      defaultTextSize: {
        $ref: '#/components/schemas/TextSize',
      },
      draft: {
        $ref: '#/components/schemas/TabDraft',
      },
      elements: {
        items: {
          $ref: '#/components/schemas/Element',
        },
        type: 'array',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      folder: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      id: {
        $ref: '#/components/schemas/TabId',
      },
      knowledge: {
        $ref: '#/components/schemas/TabKnowledge',
      },
      layers: {
        items: {
          $ref: '#/components/schemas/Layer',
        },
        type: 'array',
      },
      locked: {
        type: 'boolean',
      },
      name: {
        type: 'string',
      },
      newPageBackground: {
        $ref: '#/components/schemas/PageBackground',
      },
      pageArrangement: {
        $ref: '#/components/schemas/PageArrangement',
      },
      pageOrientation: {
        $ref: '#/components/schemas/PageOrientation',
      },
      pages: {
        items: {
          $ref: '#/components/schemas/Page',
        },
        type: 'array',
      },
      parent: {
        $ref: '#/components/schemas/TabId',
      },
      patternColor: {
        type: 'string',
      },
      tagColours: {
        items: {
          $ref: '#/components/schemas/TagColour',
        },
        type: 'array',
      },
      templateChosen: {
        type: 'boolean',
      },
      theme: {
        type: 'string',
      },
    },
    required: ['id', 'name', 'elements'],
    type: 'object',
  },
  TabConnectionApp: {
    enum: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    type: 'string',
  },
  TabConnectionWire: {
    additionalProperties: false,
    properties: {
      app: {
        $ref: '#/components/schemas/TabConnectionApp',
      },
      id: {
        type: 'string',
      },
      itemId: {
        type: 'string',
      },
    },
    required: ['id', 'app', 'itemId'],
    type: 'object',
  },
  TabCover: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          credit: {
            type: 'string',
          },
          focus: {
            type: 'number',
          },
          imageId: {
            type: 'string',
          },
        },
        required: ['imageId'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          gradient: {
            $ref: '#/components/schemas/CoverGradientId',
          },
        },
        required: ['gradient'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          colouring: {
            $ref: '#/components/schemas/PageMotionColouringId',
          },
          motion: {
            $ref: '#/components/schemas/PageMotion',
          },
          speed: {
            type: 'number',
          },
        },
        required: ['motion', 'colouring'],
        type: 'object',
      },
    ],
    description:
      "A page's cover: a picture (with where it sits and its credit), a theme gradient, or an animated background in a theme colouring, at a speed (1, its own pace, is left off).",
  },
  TabDraft: {
    additionalProperties: false,
    properties: {
      at: {
        type: 'number',
      },
      base: {
        additionalProperties: {
          type: 'string',
        },
        type: 'object',
      },
      by: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
    },
    required: ['by', 'at', 'base'],
    type: 'object',
  },
  TabId: {
    type: 'string',
  },
  TabKnowledge: {
    additionalProperties: false,
    description:
      "A page's knowledge fields as stored. Every one is optional: absent is no owner, never verified, not in context. When a verified page's review comes due is the knowledgebase's (`KnowledgeSettings.reviewEvery`), not the page's.",
    properties: {
      context: {
        const: true,
        type: 'boolean',
      },
      owner: {
        type: 'string',
      },
      verifiedAt: {
        type: 'number',
      },
      verifiedBy: {
        type: 'string',
      },
    },
    type: 'object',
  },
  TabRecord: {
    additionalProperties: false,
    properties: {
      articles: {
        additionalProperties: {
          $ref: '#/components/schemas/ArticleFlow',
        },
        type: 'object',
      },
      backgroundAnimationSpeed: {
        type: 'number',
      },
      backgroundColor: {
        type: 'string',
      },
      backgroundOpacity: {
        type: 'number',
      },
      backgroundPattern: {
        $ref: '#/components/schemas/BackgroundPattern',
      },
      backgroundPatternScale: {
        type: 'number',
      },
      connection: {
        $ref: '#/components/schemas/TabConnectionWire',
      },
      cover: {
        $ref: '#/components/schemas/TabCover',
      },
      customColours: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      defaultTextSize: {
        $ref: '#/components/schemas/TextSize',
      },
      documentId: {
        type: 'string',
      },
      draft: {
        $ref: '#/components/schemas/TabDraft',
      },
      elements: {
        items: {
          $ref: '#/components/schemas/Element',
        },
        type: 'array',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      folder: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      id: {
        $ref: '#/components/schemas/TabId',
      },
      knowledge: {
        $ref: '#/components/schemas/TabKnowledge',
      },
      layers: {
        items: {
          $ref: '#/components/schemas/Layer',
        },
        type: 'array',
      },
      locked: {
        type: 'boolean',
      },
      name: {
        type: 'string',
      },
      newPageBackground: {
        $ref: '#/components/schemas/PageBackground',
      },
      orderIndex: {
        type: 'number',
      },
      pageArrangement: {
        $ref: '#/components/schemas/PageArrangement',
      },
      pageOrientation: {
        $ref: '#/components/schemas/PageOrientation',
      },
      pages: {
        items: {
          $ref: '#/components/schemas/Page',
        },
        type: 'array',
      },
      parent: {
        $ref: '#/components/schemas/TabId',
      },
      patternColor: {
        type: 'string',
      },
      rev: {
        type: 'number',
      },
      tagColours: {
        items: {
          $ref: '#/components/schemas/TagColour',
        },
        type: 'array',
      },
      templateChosen: {
        type: 'boolean',
      },
      theme: {
        type: 'string',
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: ['documentId', 'elements', 'id', 'name', 'orderIndex', 'rev', 'updatedAt'],
    type: 'object',
  },
  TabSummary: {
    additionalProperties: false,
    properties: {
      connection: {
        $ref: '#/components/schemas/TabConnectionWire',
      },
      documentId: {
        type: 'string',
      },
      folder: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
      knowledge: {
        $ref: '#/components/schemas/TabKnowledge',
      },
      name: {
        type: 'string',
      },
      orderIndex: {
        type: 'number',
      },
      outOfScope: {
        const: true,
        type: 'boolean',
      },
      parent: {
        type: 'string',
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: ['id', 'documentId', 'name', 'orderIndex', 'updatedAt'],
    type: 'object',
  },
  TableAnimation: {
    enum: ['rows', 'columns', 'cells', 'scan', 'sweep', 'header', 'pulse', 'glow'],
    type: 'string',
  },
  TableCellStyle: {
    additionalProperties: false,
    properties: {
      alignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      bg: {
        type: 'string',
      },
      bold: {
        type: 'boolean',
      },
      italic: {
        type: 'boolean',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      textColor: {
        type: 'string',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      underline: {
        type: 'boolean',
      },
    },
    type: 'object',
  },
  TableElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      cellStyles: {
        items: {
          items: {
            anyOf: [
              {
                $ref: '#/components/schemas/TableCellStyle',
              },
              {
                type: 'null',
              },
            ],
          },
          type: 'array',
        },
        type: 'array',
      },
      cells: {
        items: {
          items: {
            type: 'string',
          },
          type: 'array',
        },
        type: 'array',
      },
      colWidths: {
        items: {
          type: ['number', 'null'],
        },
        type: 'array',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      fillColor: {
        type: 'string',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      font: {
        type: 'string',
      },
      headerColumn: {
        type: 'boolean',
      },
      headerFill: {
        type: 'string',
      },
      headerRow: {
        type: 'boolean',
      },
      headerTextColor: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      highlightColumn: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      rotation: {
        type: 'number',
      },
      rowHeights: {
        items: {
          type: ['number', 'null'],
        },
        type: 'array',
      },
      strokeColor: {
        type: 'string',
      },
      strokeStyle: {
        $ref: '#/components/schemas/BorderStyle',
      },
      strokeWidth: {
        $ref: '#/components/schemas/BorderStroke',
      },
      tablePreset: {
        type: 'string',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textAnimation: {
        $ref: '#/components/schemas/TextAnimation',
      },
      textAnimationRepeat: {
        type: 'boolean',
      },
      textAnimationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'table',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
      zebra: {
        type: 'boolean',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height', 'cells'],
    type: 'object',
  },
  TagColour: {
    additionalProperties: false,
    properties: {
      color: {
        type: 'string',
      },
      tag: {
        type: 'string',
      },
    },
    required: ['tag', 'color'],
    type: 'object',
  },
  Team: {
    additionalProperties: false,
    properties: {
      createdAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      organisation: {
        type: ['string', 'null'],
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: ['id', 'name', 'organisation', 'createdAt', 'updatedAt'],
    type: 'object',
  },
  TeamInvite: {
    additionalProperties: false,
    properties: {
      invitedAt: {
        type: 'number',
      },
      invitedByName: {
        type: ['string', 'null'],
      },
      memberCount: {
        type: 'number',
      },
      memberId: {
        type: 'string',
      },
      role: {
        $ref: '#/components/schemas/TeamRole',
      },
      team: {
        $ref: '#/components/schemas/Team',
      },
    },
    required: ['memberId', 'team', 'memberCount', 'invitedAt', 'role', 'invitedByName'],
    type: 'object',
  },
  TeamInviteLink: {
    additionalProperties: false,
    properties: {
      expiresAt: {
        type: 'number',
      },
      token: {
        type: 'string',
      },
    },
    required: ['token', 'expiresAt'],
    type: 'object',
  },
  TeamInviteLinkInfo: {
    additionalProperties: false,
    properties: {
      alreadyMember: {
        type: 'boolean',
      },
      memberCount: {
        type: 'number',
      },
      team: {
        $ref: '#/components/schemas/Team',
      },
    },
    required: ['team', 'memberCount', 'alreadyMember'],
    type: 'object',
  },
  TeamListItem: {
    additionalProperties: false,
    properties: {
      createdAt: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      memberCount: {
        type: 'number',
      },
      myRole: {
        $ref: '#/components/schemas/TeamRole',
      },
      name: {
        type: 'string',
      },
      organisation: {
        type: ['string', 'null'],
      },
      updatedAt: {
        type: 'number',
      },
    },
    required: ['createdAt', 'id', 'memberCount', 'myRole', 'name', 'organisation', 'updatedAt'],
    type: 'object',
  },
  TeamMember: {
    additionalProperties: false,
    properties: {
      color: {
        type: ['string', 'null'],
      },
      createdAt: {
        type: 'number',
      },
      email: {
        type: ['string', 'null'],
      },
      id: {
        type: 'string',
      },
      name: {
        type: ['string', 'null'],
      },
      role: {
        $ref: '#/components/schemas/TeamRole',
      },
      status: {
        $ref: '#/components/schemas/TeamMemberStatus',
      },
      teamId: {
        type: 'string',
      },
      updatedAt: {
        type: 'number',
      },
      userId: {
        type: ['string', 'null'],
      },
    },
    required: [
      'id',
      'teamId',
      'userId',
      'email',
      'role',
      'status',
      'name',
      'createdAt',
      'updatedAt',
    ],
    type: 'object',
  },
  TeamMemberStatus: {
    enum: ['invited', 'joined', 'declined', 'expired'],
    type: 'string',
  },
  TeamRole: {
    enum: ['admin', 'member'],
    type: 'string',
  },
  TemplateCatalogueResponse: {
    additionalProperties: false,
    properties: {
      categories: {
        items: {
          additionalProperties: false,
          properties: {
            description: {
              type: 'string',
            },
            id: {
              type: 'string',
            },
            label: {
              type: 'string',
            },
          },
          required: ['id', 'label', 'description'],
          type: 'object',
        },
        type: 'array',
      },
      templates: {
        items: {
          additionalProperties: false,
          properties: {
            category: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            kind: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
          },
          required: ['kind', 'title', 'description', 'category'],
          type: 'object',
        },
        type: 'array',
      },
    },
    required: ['categories', 'templates'],
    type: 'object',
  },
  TextAlignX: {
    enum: ['left', 'center', 'right'],
    type: 'string',
  },
  TextAlignY: {
    enum: ['top', 'middle', 'bottom'],
    type: 'string',
  },
  TextAnimation: {
    enum: [
      'typewriter',
      'words',
      'cascade',
      'focus',
      'scramble',
      'highlighter',
      'underline',
      'wave',
      'shine',
      'flicker',
      'rainbow',
      'glow',
      'bounce',
      'float',
    ],
    type: 'string',
  },
  TextElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      fillColor: {
        type: 'string',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      font: {
        type: 'string',
      },
      fontWeight: {
        enum: [400, 500, 700],
        type: 'number',
      },
      headerFill: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      letterSpacing: {
        type: 'number',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      locked: {
        type: 'boolean',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      penTextColour: {
        $ref: '#/components/schemas/PenColourName',
      },
      richText: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      rotation: {
        type: 'number',
      },
      shadow: {
        $ref: '#/components/schemas/ElementShadow',
      },
      sizing: {
        $ref: '#/components/schemas/TextSizing',
      },
      strokeColor: {
        type: 'string',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textAnimation: {
        $ref: '#/components/schemas/TextAnimation',
      },
      textAnimationRepeat: {
        type: 'boolean',
      },
      textAnimationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      textArc: {
        type: 'number',
      },
      textBold: {
        type: 'boolean',
      },
      textCase: {
        enum: ['upper', 'lower'],
        type: 'string',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textScale: {
        type: 'number',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textSwatch: {
        $ref: '#/components/schemas/QuickSwatchSlot',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'text',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height'],
    type: 'object',
  },
  TextRun: {
    additionalProperties: false,
    properties: {
      bold: {
        type: 'boolean',
      },
      color: {
        type: 'string',
      },
      gradient: {
        type: 'string',
      },
      heading: {
        $ref: '#/components/schemas/RunHeading',
      },
      highlight: {
        type: 'string',
      },
      italic: {
        type: 'boolean',
      },
      link: {
        type: 'string',
      },
      muted: {
        type: 'boolean',
      },
      size: {
        $ref: '#/components/schemas/RunSize',
      },
      strikethrough: {
        type: 'boolean',
      },
      text: {
        type: 'string',
      },
      underline: {
        type: 'boolean',
      },
    },
    required: ['text'],
    type: 'object',
  },
  TextSize: {
    anyOf: [
      {
        $ref: '#/components/schemas/TextSizePreset',
      },
      {
        type: 'number',
      },
    ],
  },
  TextSizePreset: {
    enum: ['scale', 'sm', 'md', 'lg'],
    type: 'string',
  },
  TextSizing: {
    enum: ['fit', 'wrap'],
    type: 'string',
  },
  TrashReason: {
    enum: ['deleted', 'empty'],
    type: 'string',
  },
  TrashedDocument: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      purgeAt: {
        type: 'number',
      },
      reason: {
        $ref: '#/components/schemas/TrashReason',
      },
      teamId: {
        type: ['string', 'null'],
      },
      teamName: {
        type: ['string', 'null'],
      },
      trashedAt: {
        type: 'number',
      },
    },
    required: ['id', 'name', 'teamId', 'teamName', 'trashedAt', 'purgeAt', 'reason'],
    type: 'object',
  },
  UnfurlResult: {
    additionalProperties: false,
    properties: {
      description: {
        type: 'string',
      },
      favicon: {
        type: 'string',
      },
      image: {
        type: 'string',
      },
      siteName: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      url: {
        type: 'string',
      },
    },
    required: ['url'],
    type: 'object',
  },
  VersionCopyResponse: {
    additionalProperties: false,
    properties: {
      tab: {
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          rev: {
            type: 'number',
          },
        },
        required: ['id', 'name', 'rev'],
        type: 'object',
      },
    },
    required: ['tab'],
    type: 'object',
  },
  VersionKind: {
    enum: ['idle', 'agent', 'restore', 'manual'],
    type: 'string',
  },
  VersionReadResponse: {
    additionalProperties: false,
    properties: {
      tab: {
        $ref: '#/components/schemas/Tab',
      },
      version: {
        $ref: '#/components/schemas/VersionSummary',
      },
    },
    required: ['version', 'tab'],
    type: 'object',
  },
  VersionRestoreResponse: {
    additionalProperties: false,
    properties: {
      restored: {
        anyOf: [
          {
            additionalProperties: false,
            properties: {
              changesetId: {
                type: ['string', 'null'],
              },
              rev: {
                type: 'number',
              },
              tabId: {
                type: 'string',
              },
              undoVersionId: {
                type: 'string',
              },
            },
            required: ['tabId', 'rev', 'changesetId', 'undoVersionId'],
            type: 'object',
          },
          {
            type: 'null',
          },
        ],
      },
    },
    required: ['restored'],
    type: 'object',
  },
  VersionSummary: {
    additionalProperties: false,
    properties: {
      author: {
        anyOf: [
          {
            additionalProperties: false,
            properties: {
              color: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
            },
            required: ['name', 'color'],
            type: 'object',
          },
          {
            type: 'null',
          },
        ],
      },
      bytes: {
        type: 'number',
      },
      createdAt: {
        type: 'number',
      },
      elementCount: {
        type: 'number',
      },
      id: {
        type: 'string',
      },
      kind: {
        $ref: '#/components/schemas/VersionKind',
      },
      name: {
        type: ['string', 'null'],
      },
      rev: {
        type: 'number',
      },
      savedAt: {
        type: 'number',
      },
      tabId: {
        type: 'string',
      },
    },
    required: [
      'id',
      'tabId',
      'rev',
      'kind',
      'name',
      'author',
      'savedAt',
      'createdAt',
      'bytes',
      'elementCount',
    ],
    type: 'object',
  },
  VideoElement: {
    additionalProperties: false,
    properties: {
      action: {
        $ref: '#/components/schemas/ElementAction',
      },
      animation: {
        $ref: '#/components/schemas/ElementAnimation',
      },
      animationRepeat: {
        type: 'boolean',
      },
      animationSpeed: {
        $ref: '#/components/schemas/AnimationSpeed',
      },
      aspectLocked: {
        type: 'boolean',
      },
      build: {
        $ref: '#/components/schemas/ElementBuild',
      },
      commentThread: {
        $ref: '#/components/schemas/CommentThread',
      },
      embedProvider: {
        $ref: '#/components/schemas/EmbedProvider',
      },
      fillColor: {
        type: 'string',
      },
      font: {
        type: 'string',
      },
      headerFill: {
        type: 'string',
      },
      height: {
        type: 'number',
      },
      id: {
        $ref: '#/components/schemas/ElementId',
      },
      label: {
        type: 'string',
      },
      layerId: {
        type: 'string',
      },
      link: {
        $ref: '#/components/schemas/ElementLink',
      },
      liveItem: {
        $ref: '#/components/schemas/LiveItem',
      },
      liveName: {
        type: 'string',
      },
      livePoster: {
        type: 'string',
      },
      locked: {
        type: 'boolean',
      },
      note: {
        type: 'string',
      },
      noteRich: {
        items: {
          $ref: '#/components/schemas/TextRun',
        },
        type: 'array',
      },
      opacity: {
        type: 'number',
      },
      padding: {
        $ref: '#/components/schemas/Padding',
      },
      rotation: {
        type: 'number',
      },
      shadow: {
        $ref: '#/components/schemas/ElementShadow',
      },
      strokeColor: {
        type: 'string',
      },
      textAlignX: {
        $ref: '#/components/schemas/TextAlignX',
      },
      textAlignY: {
        $ref: '#/components/schemas/TextAlignY',
      },
      textBold: {
        type: 'boolean',
      },
      textColor: {
        type: 'string',
      },
      textItalic: {
        type: 'boolean',
      },
      textSize: {
        $ref: '#/components/schemas/TextSize',
      },
      textStrikethrough: {
        type: 'boolean',
      },
      textUnderline: {
        type: 'boolean',
      },
      type: {
        const: 'video',
        type: 'string',
      },
      width: {
        type: 'number',
      },
      x: {
        type: 'number',
      },
      y: {
        type: 'number',
      },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height'],
    type: 'object',
  },
  ViewAttributeJson: {
    additionalProperties: false,
    properties: {
      key: {
        type: 'string',
      },
      value: {
        type: ['string', 'null'],
      },
    },
    required: ['key', 'value'],
    type: 'object',
  },
  ViewEdgeJson: {
    additionalProperties: false,
    properties: {
      from: {
        $ref: '#/components/schemas/ViewEnd',
      },
      id: {
        type: 'string',
      },
      label: {
        type: ['string', 'null'],
      },
      ref: {
        type: 'string',
      },
      style: {
        items: {
          type: 'string',
        },
        type: 'array',
      },
      to: {
        $ref: '#/components/schemas/ViewEnd',
      },
    },
    required: ['ref', 'id', 'from', 'to', 'label', 'style'],
    type: 'object',
  },
  ViewEnd: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          ref: {
            type: 'string',
          },
        },
        required: ['ref'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          arrow: {
            type: 'string',
          },
        },
        required: ['arrow'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          free: {
            additionalProperties: false,
            properties: {
              x: {
                type: 'number',
              },
              y: {
                type: 'number',
              },
            },
            required: ['x', 'y'],
            type: 'object',
          },
        },
        required: ['free'],
        type: 'object',
      },
    ],
  },
  ViewHeader: {
    additionalProperties: false,
    properties: {
      counts: {
        additionalProperties: false,
        properties: {
          arrows: {
            type: 'number',
          },
          boxes: {
            type: 'number',
          },
        },
        required: ['boxes', 'arrows'],
        type: 'object',
      },
      elements: {
        type: 'number',
      },
      finish: {
        $ref: '#/components/schemas/Finish',
      },
      hidden: {
        type: 'number',
      },
      pages: {
        additionalProperties: false,
        properties: {
          kinds: {
            additionalProperties: false,
            properties: {
              article: {
                type: 'number',
              },
              infographic: {
                type: 'number',
              },
              slide: {
                type: 'number',
              },
            },
            type: 'object',
          },
          pages: {
            type: 'number',
          },
        },
        required: ['pages', 'kinds'],
        type: 'object',
      },
      rev: {
        type: ['number', 'null'],
      },
      tab: {
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          ref: {
            type: 'string',
          },
        },
        required: ['id', 'ref', 'name'],
        type: 'object',
      },
      threads: {
        additionalProperties: false,
        properties: {
          open: {
            type: 'number',
          },
          total: {
            type: 'number',
          },
        },
        required: ['open', 'total'],
        type: 'object',
      },
      unknown: {
        type: 'number',
      },
      view: {
        $ref: '#/components/schemas/ViewName',
      },
    },
    required: ['view', 'tab', 'elements', 'counts', 'hidden', 'unknown', 'threads', 'rev'],
    type: 'object',
  },
  ViewName: {
    enum: [
      'overview',
      'outline',
      'graph',
      'layout',
      'comments',
      'show',
      'find',
      'diff',
      'lint',
      'pages',
    ],
    type: 'string',
  },
  WorkbenchPairing: {
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
      },
      name: {
        type: ['string', 'null'],
      },
      origin: {
        type: 'string',
      },
      pairedAt: {
        type: 'number',
      },
      scope: {
        $ref: '#/components/schemas/WorkbenchScope',
      },
      tokenId: {
        type: 'string',
      },
    },
    required: ['id', 'tokenId', 'origin', 'name', 'scope', 'pairedAt'],
    type: 'object',
  },
  WorkbenchPairingRequestCreate: {
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
      },
      origin: {
        type: 'string',
      },
      scope: {
        $ref: '#/components/schemas/WorkbenchScope',
      },
    },
    required: ['origin'],
    type: 'object',
  },
  WorkbenchPairingRequestCreated: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          pairing: {
            $ref: '#/components/schemas/WorkbenchPairing',
          },
          status: {
            const: 'paired',
            type: 'string',
          },
        },
        required: ['status', 'pairing'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          code: {
            type: 'string',
          },
          expiresAt: {
            type: 'number',
          },
          interval: {
            type: 'number',
          },
          pairingUrl: {
            type: 'string',
          },
          status: {
            const: 'pending',
            type: 'string',
          },
        },
        required: ['status', 'pairingUrl', 'code', 'expiresAt', 'interval'],
        type: 'object',
      },
    ],
  },
  WorkbenchPairingRequestView: {
    additionalProperties: false,
    properties: {
      expiresAt: {
        type: 'number',
      },
      name: {
        type: ['string', 'null'],
      },
      origin: {
        type: 'string',
      },
      scope: {
        $ref: '#/components/schemas/WorkbenchScope',
      },
      status: {
        $ref: '#/components/schemas/PairingRequestStatus',
      },
      tokenName: {
        type: ['string', 'null'],
      },
    },
    required: ['origin', 'name', 'tokenName', 'scope', 'expiresAt', 'status'],
    type: 'object',
  },
  WorkbenchPairingStatusResponse: {
    additionalProperties: false,
    properties: {
      expiresAt: {
        type: 'number',
      },
      interval: {
        type: 'number',
      },
      status: {
        $ref: '#/components/schemas/PairingRequestStatus',
      },
    },
    required: ['status', 'expiresAt', 'interval'],
    type: 'object',
  },
  WorkbenchPairingsResponse: {
    additionalProperties: false,
    properties: {
      pairings: {
        items: {
          $ref: '#/components/schemas/WorkbenchPairing',
        },
        type: 'array',
      },
    },
    required: ['pairings'],
    type: 'object',
  },
  WorkbenchPerson: {
    additionalProperties: false,
    properties: {
      color: {
        type: ['string', 'null'],
      },
      id: {
        type: 'string',
      },
      name: {
        type: ['string', 'null'],
      },
    },
    required: ['id', 'name', 'color'],
    type: 'object',
  },
  WorkbenchRole: {
    $ref: '#/components/schemas/AccessLevel',
  },
  WorkbenchScope: {
    enum: ['document', 'workspace'],
    type: 'string',
  },
  WorkbenchSessionRequest: {
    additionalProperties: false,
    properties: {
      ticket: {
        type: 'string',
      },
    },
    required: ['ticket'],
    type: 'object',
  },
  WorkbenchSessionResponse: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          documentId: {
            type: 'string',
          },
          expiresAt: {
            type: 'number',
          },
          folderId: {
            type: 'null',
          },
          origin: {
            type: 'string',
          },
          person: {
            $ref: '#/components/schemas/WorkbenchPerson',
          },
          role: {
            $ref: '#/components/schemas/WorkbenchRole',
          },
          scope: {
            const: 'document',
            type: 'string',
          },
          session: {
            type: 'string',
          },
          tabId: {
            type: ['string', 'null'],
          },
        },
        required: [
          'documentId',
          'expiresAt',
          'folderId',
          'origin',
          'person',
          'role',
          'scope',
          'session',
          'tabId',
        ],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          documentId: {
            type: 'null',
          },
          expiresAt: {
            type: 'number',
          },
          folderId: {
            type: ['string', 'null'],
          },
          origin: {
            type: 'string',
          },
          person: {
            $ref: '#/components/schemas/WorkbenchPerson',
          },
          role: {
            $ref: '#/components/schemas/WorkbenchRole',
          },
          scope: {
            const: 'workspace',
            type: 'string',
          },
          session: {
            type: 'string',
          },
          tabId: {
            type: 'null',
          },
        },
        required: [
          'documentId',
          'expiresAt',
          'folderId',
          'origin',
          'person',
          'role',
          'scope',
          'session',
          'tabId',
        ],
        type: 'object',
      },
    ],
  },
  WorkbenchTicketRequest: {
    anyOf: [
      {
        additionalProperties: false,
        properties: {
          documentId: {
            type: 'string',
          },
          origin: {
            type: 'string',
          },
          scope: {
            const: 'document',
            type: 'string',
          },
          tabId: {
            type: 'string',
          },
        },
        required: ['documentId', 'origin'],
        type: 'object',
      },
      {
        additionalProperties: false,
        properties: {
          folderId: {
            type: 'string',
          },
          origin: {
            type: 'string',
          },
          scope: {
            const: 'workspace',
            type: 'string',
          },
        },
        required: ['scope', 'origin'],
        type: 'object',
      },
    ],
  },
  WorkbenchTicketResponse: {
    additionalProperties: false,
    properties: {
      documentId: {
        type: 'string',
      },
      expiresAt: {
        type: 'number',
      },
      tabId: {
        type: ['string', 'null'],
      },
      url: {
        type: 'string',
      },
    },
    required: ['url', 'documentId', 'tabId', 'expiresAt'],
    type: 'object',
  },
  WorkbenchWorkspaceTicketResponse: {
    additionalProperties: false,
    properties: {
      expiresAt: {
        type: 'number',
      },
      folderId: {
        type: ['string', 'null'],
      },
      scope: {
        const: 'workspace',
        type: 'string',
      },
      url: {
        type: 'string',
      },
    },
    required: ['url', 'scope', 'folderId', 'expiresAt'],
    type: 'object',
  },
  WritePageRequest: {
    additionalProperties: false,
    description:
      "`PUT .../pages/<tab>`: the page's writing replaced by the Markdown, or the Markdown added after it. Answers as the article write does (`PagesAnswer`).",
    properties: {
      markdown: {
        type: 'string',
      },
      mode: {
        enum: ['replace', 'append'],
        type: 'string',
      },
    },
    required: ['markdown'],
    type: 'object',
  },
};
