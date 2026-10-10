// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-openapi-schemas.mjs from @livediagram/api-schema.
// Regenerate with: pnpm --filter @livediagram/api gen:openapi
// Served as the `components.schemas` of GET /api/openapi.json (docs/specs/015-api/api-documentation.md).
import type { ComponentSchemas } from './types';

export const COMPONENT_SCHEMAS: ComponentSchemas = {
  "AccessLevel": {
    "enum": [
      "view",
      "participate",
      "edit"
    ],
    "type": "string"
  },
  "ActivityAction": {
    "additionalProperties": false,
    "properties": {
      "assignedToMe": {
        "type": "boolean"
      },
      "assignee": {
        "additionalProperties": false,
        "properties": {
          "name": {
            "type": [
              "string",
              "null"
            ]
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "userId",
          "name"
        ],
        "type": "object"
      },
      "assigner": {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "name"
        ],
        "type": "object"
      },
      "createdAt": {
        "type": "number"
      },
      "createdByMe": {
        "type": "boolean"
      },
      "description": {
        "type": "string"
      },
      "documentId": {
        "type": "string"
      },
      "documentName": {
        "type": "string"
      },
      "elementId": {
        "type": "string"
      },
      "elementLabel": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "type": "string"
      },
      "tabName": {
        "type": "string"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      },
      "via": {
        "enum": [
          "own",
          "team",
          "shared"
        ],
        "type": "string"
      }
    },
    "required": [
      "assignedToMe",
      "assignee",
      "assigner",
      "createdAt",
      "createdByMe",
      "description",
      "documentId",
      "documentName",
      "elementId",
      "elementLabel",
      "id",
      "name",
      "shareCode",
      "tabId",
      "tabName",
      "teamId",
      "updatedAt",
      "via"
    ],
    "type": "object"
  },
  "ActivityCard": {
    "additionalProperties": false,
    "properties": {
      "board": {
        "anyOf": [
          {
            "additionalProperties": false,
            "properties": {
              "elementId": {
                "type": "string"
              },
              "tabId": {
                "type": "string"
              },
              "tabName": {
                "type": "string"
              },
              "title": {
                "type": "string"
              }
            },
            "required": [
              "tabId",
              "tabName",
              "elementId",
              "title"
            ],
            "type": "object"
          },
          {
            "type": "null"
          }
        ]
      },
      "documentId": {
        "type": "string"
      },
      "documentName": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "key": {
        "type": "number"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "title": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      },
      "via": {
        "enum": [
          "own",
          "team",
          "shared"
        ],
        "type": "string"
      }
    },
    "required": [
      "documentId",
      "documentName",
      "teamId",
      "via",
      "shareCode",
      "board",
      "id",
      "key",
      "type",
      "title",
      "status",
      "updatedAt"
    ],
    "type": "object"
  },
  "ActivityCardThread": {
    "additionalProperties": false,
    "properties": {
      "board": {
        "anyOf": [
          {
            "additionalProperties": false,
            "properties": {
              "elementId": {
                "type": "string"
              },
              "tabId": {
                "type": "string"
              },
              "tabName": {
                "type": "string"
              },
              "title": {
                "type": "string"
              }
            },
            "required": [
              "tabId",
              "tabName",
              "elementId",
              "title"
            ],
            "type": "object"
          },
          {
            "type": "null"
          }
        ]
      },
      "commentCount": {
        "type": "number"
      },
      "documentId": {
        "type": "string"
      },
      "documentName": {
        "type": "string"
      },
      "firstAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "key": {
        "type": "number"
      },
      "latest": {
        "additionalProperties": false,
        "properties": {
          "at": {
            "type": "number"
          },
          "authorColor": {
            "type": "string"
          },
          "authorName": {
            "type": "string"
          },
          "text": {
            "type": "string"
          }
        },
        "required": [
          "text",
          "authorName",
          "authorColor",
          "at"
        ],
        "type": "object"
      },
      "mentionsYou": {
        "type": "boolean"
      },
      "onYourDocument": {
        "type": "boolean"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "title": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "via": {
        "enum": [
          "own",
          "team",
          "shared"
        ],
        "type": "string"
      },
      "youCommented": {
        "type": "boolean"
      }
    },
    "required": [
      "board",
      "commentCount",
      "documentId",
      "documentName",
      "firstAt",
      "id",
      "key",
      "latest",
      "mentionsYou",
      "onYourDocument",
      "shareCode",
      "teamId",
      "title",
      "type",
      "via",
      "youCommented"
    ],
    "type": "object"
  },
  "ActivityThread": {
    "additionalProperties": false,
    "properties": {
      "commentCount": {
        "type": "number"
      },
      "documentId": {
        "type": "string"
      },
      "documentName": {
        "type": "string"
      },
      "elementId": {
        "type": "string"
      },
      "elementLabel": {
        "type": "string"
      },
      "firstAt": {
        "type": "number"
      },
      "latest": {
        "additionalProperties": false,
        "properties": {
          "at": {
            "type": "number"
          },
          "authorColor": {
            "type": "string"
          },
          "authorName": {
            "type": "string"
          },
          "text": {
            "type": "string"
          }
        },
        "required": [
          "text",
          "authorName",
          "authorColor",
          "at"
        ],
        "type": "object"
      },
      "mentionsYou": {
        "type": "boolean"
      },
      "onYourDocument": {
        "type": "boolean"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "type": "string"
      },
      "tabName": {
        "type": "string"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "via": {
        "enum": [
          "own",
          "team",
          "shared"
        ],
        "type": "string"
      },
      "youCommented": {
        "type": "boolean"
      }
    },
    "required": [
      "commentCount",
      "documentId",
      "documentName",
      "elementId",
      "elementLabel",
      "firstAt",
      "latest",
      "mentionsYou",
      "onYourDocument",
      "shareCode",
      "tabId",
      "tabName",
      "teamId",
      "via",
      "youCommented"
    ],
    "type": "object"
  },
  "AgendaItem": {
    "additionalProperties": false,
    "properties": {
      "label": {
        "type": "string"
      },
      "minutes": {
        "type": "number"
      }
    },
    "required": [
      "label",
      "minutes"
    ],
    "type": "object"
  },
  "AgentPresenceResult": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "focus": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "status",
      "focus",
      "expiresAt"
    ],
    "type": "object"
  },
  "AiConversationTurn": {
    "additionalProperties": false,
    "properties": {
      "content": {
        "type": "string"
      },
      "role": {
        "enum": [
          "user",
          "assistant"
        ],
        "type": "string"
      }
    },
    "required": [
      "role",
      "content"
    ],
    "type": "object"
  },
  "AiMode": {
    "enum": [
      "clean",
      "ask"
    ],
    "type": "string"
  },
  "AiRequest": {
    "additionalProperties": false,
    "properties": {
      "elements": {
        "items": {},
        "type": "array"
      },
      "focusIds": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "history": {
        "items": {
          "$ref": "#/components/schemas/AiConversationTurn"
        },
        "type": "array"
      },
      "mode": {
        "$ref": "#/components/schemas/AiMode"
      },
      "prompt": {
        "type": "string"
      },
      "tabName": {
        "type": "string"
      }
    },
    "required": [
      "mode",
      "prompt",
      "elements",
      "tabName"
    ],
    "type": "object"
  },
  "Anchor": {
    "enum": [
      "n",
      "nne",
      "ne",
      "ene",
      "e",
      "ese",
      "se",
      "sse",
      "s",
      "ssw",
      "sw",
      "wsw",
      "w",
      "wnw",
      "nw",
      "nnw"
    ],
    "type": "string"
  },
  "AnimationSpeed": {
    "enum": [
      "slowest",
      "slow",
      "normal",
      "fast"
    ],
    "type": "string"
  },
  "AnnotationElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "articleNote": {
        "enum": [
          "comment",
          "action"
        ],
        "type": "string"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "annotation",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "ApiToken": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "expiresAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "lastUsedAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "readOnly": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "name",
      "createdAt",
      "lastUsedAt",
      "expiresAt",
      "readOnly"
    ],
    "type": "object"
  },
  "ArrowElement": {
    "additionalProperties": false,
    "properties": {
      "arrowEnds": {
        "$ref": "#/components/schemas/ArrowEnds"
      },
      "arrowStyle": {
        "$ref": "#/components/schemas/ArrowStyle"
      },
      "arrowheadColor": {
        "type": "string"
      },
      "arrowheadShape": {
        "$ref": "#/components/schemas/ArrowheadShape"
      },
      "arrowheadSize": {
        "$ref": "#/components/schemas/ArrowheadSize"
      },
      "curveOffset": {
        "additionalProperties": false,
        "properties": {
          "dx": {
            "type": "number"
          },
          "dy": {
            "type": "number"
          }
        },
        "required": [
          "dx",
          "dy"
        ],
        "type": "object"
      },
      "curvePoints": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "dx": {
              "type": "number"
            },
            "dy": {
              "type": "number"
            }
          },
          "required": [
            "dx",
            "dy"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elbowOffset": {
        "additionalProperties": false,
        "properties": {
          "dx": {
            "type": "number"
          },
          "dy": {
            "type": "number"
          }
        },
        "required": [
          "dx",
          "dy"
        ],
        "type": "object"
      },
      "exactEnd": {
        "type": "boolean"
      },
      "exactStart": {
        "type": "boolean"
      },
      "flow": {
        "$ref": "#/components/schemas/ArrowFlow"
      },
      "flowRepeat": {
        "type": "boolean"
      },
      "flowSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "font": {
        "type": "string"
      },
      "from": {
        "$ref": "#/components/schemas/Endpoint"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "labelFill": {
        "type": "string"
      },
      "labelMaxWidth": {
        "type": "number"
      },
      "labelOffset": {
        "additionalProperties": false,
        "properties": {
          "offset": {
            "type": "number"
          },
          "t": {
            "type": "number"
          }
        },
        "required": [
          "t",
          "offset"
        ],
        "type": "object"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "opacity": {
        "type": "number"
      },
      "penColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "routeBehind": {
        "type": "boolean"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "strokeWidth": {
        "type": "number"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "to": {
        "$ref": "#/components/schemas/Endpoint"
      },
      "type": {
        "const": "arrow",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "from",
      "to"
    ],
    "type": "object"
  },
  "ArrowEnds": {
    "enum": [
      "from",
      "to",
      "both",
      "none"
    ],
    "type": "string"
  },
  "ArrowFlow": {
    "enum": [
      "dashes",
      "dots",
      "beads",
      "pulse",
      "grow",
      "glow",
      "heartbeat",
      "breathe",
      "shimmer",
      "signal",
      "draw",
      "comet",
      "rainbow",
      "strobe",
      "wind"
    ],
    "type": "string"
  },
  "ArrowStyle": {
    "enum": [
      "straight",
      "curved",
      "angled"
    ],
    "type": "string"
  },
  "ArrowheadShape": {
    "enum": [
      "triangle",
      "triangle-hollow",
      "line",
      "circle",
      "circle-hollow",
      "diamond",
      "diamond-hollow"
    ],
    "type": "string"
  },
  "ArrowheadSize": {
    "enum": [
      "small",
      "medium",
      "large",
      "extra-large"
    ],
    "type": "string"
  },
  "ArticleAlign": {
    "enum": [
      "left",
      "center",
      "right",
      "justify"
    ],
    "type": "string"
  },
  "ArticleBlock": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/ArticleParagraphBlock"
      },
      {
        "$ref": "#/components/schemas/ArticleListBlock"
      },
      {
        "$ref": "#/components/schemas/ArticleCodeBlock"
      },
      {
        "$ref": "#/components/schemas/ArticleDividerBlock"
      },
      {
        "$ref": "#/components/schemas/ArticlePageBreakBlock"
      },
      {
        "$ref": "#/components/schemas/ArticleZoneBlock"
      }
    ]
  },
  "ArticleCodeBlock": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "text": {
        "type": "string"
      },
      "type": {
        "const": "code",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "text"
    ],
    "type": "object"
  },
  "ArticleDividerBlock": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "const": "divider",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type"
    ],
    "type": "object"
  },
  "ArticleFlow": {
    "additionalProperties": false,
    "properties": {
      "blocks": {
        "items": {
          "$ref": "#/components/schemas/ArticleBlock"
        },
        "type": "array"
      },
      "style": {
        "$ref": "#/components/schemas/ArticleStyle"
      }
    },
    "required": [
      "blocks"
    ],
    "type": "object"
  },
  "ArticleLineSpacing": {
    "enum": [
      "single",
      "onehalf",
      "double"
    ],
    "type": "string"
  },
  "ArticleListBlock": {
    "additionalProperties": false,
    "properties": {
      "align": {
        "$ref": "#/components/schemas/ArticleAlign"
      },
      "checked": {
        "const": true,
        "type": "boolean"
      },
      "id": {
        "type": "string"
      },
      "level": {
        "type": "number"
      },
      "list": {
        "$ref": "#/components/schemas/ArticleListKind"
      },
      "runs": {
        "items": {
          "$ref": "#/components/schemas/ArticleRun"
        },
        "type": "array"
      },
      "type": {
        "const": "list",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "list",
      "runs"
    ],
    "type": "object"
  },
  "ArticleListKind": {
    "enum": [
      "bullet",
      "numbered",
      "todo"
    ],
    "type": "string"
  },
  "ArticleLookId": {
    "enum": [
      "clean",
      "classic",
      "report",
      "notebook",
      "bold"
    ],
    "type": "string"
  },
  "ArticleMargins": {
    "enum": [
      "narrow",
      "normal",
      "wide"
    ],
    "type": "string"
  },
  "ArticlePageBreakBlock": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "const": "pageBreak",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type"
    ],
    "type": "object"
  },
  "ArticleParagraphBlock": {
    "additionalProperties": false,
    "properties": {
      "align": {
        "$ref": "#/components/schemas/ArticleAlign"
      },
      "id": {
        "type": "string"
      },
      "runs": {
        "items": {
          "$ref": "#/components/schemas/ArticleRun"
        },
        "type": "array"
      },
      "style": {
        "$ref": "#/components/schemas/ArticleParagraphStyle"
      },
      "type": {
        "const": "paragraph",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "runs"
    ],
    "type": "object"
  },
  "ArticleParagraphSpacing": {
    "enum": [
      "none",
      "normal",
      "wide"
    ],
    "type": "string"
  },
  "ArticleParagraphStyle": {
    "enum": [
      "body",
      "title",
      "subtitle",
      "h1",
      "h2",
      "h3",
      "quote"
    ],
    "type": "string"
  },
  "ArticleRules": {
    "enum": [
      "none",
      "title",
      "headings"
    ],
    "type": "string"
  },
  "ArticleRun": {
    "additionalProperties": false,
    "description": "A stretch of text with one formatting. `text` may hold '\\n', a line break inside the block.",
    "properties": {
      "b": {
        "const": true,
        "type": "boolean"
      },
      "code": {
        "const": true,
        "type": "boolean"
      },
      "color": {
        "type": "string"
      },
      "hl": {
        "type": "string"
      },
      "href": {
        "type": "string"
      },
      "i": {
        "const": true,
        "type": "boolean"
      },
      "nk": {
        "const": "action",
        "type": "string"
      },
      "note": {
        "type": "string"
      },
      "s": {
        "const": true,
        "type": "boolean"
      },
      "sub": {
        "const": true,
        "type": "boolean"
      },
      "sup": {
        "const": true,
        "type": "boolean"
      },
      "text": {
        "type": "string"
      },
      "u": {
        "const": true,
        "type": "boolean"
      }
    },
    "required": [
      "text"
    ],
    "type": "object"
  },
  "ArticleStyle": {
    "additionalProperties": false,
    "description": "An article's look (docs/specs/007-editor/article-pages.md \"Article style\"). Every field is optional, absent being its default (`resolveArticleStyle`).",
    "properties": {
      "accent": {
        "type": "string"
      },
      "accentHeadings": {
        "type": "boolean"
      },
      "bodyFont": {
        "type": "string"
      },
      "headingFont": {
        "type": "string"
      },
      "lineSpacing": {
        "$ref": "#/components/schemas/ArticleLineSpacing"
      },
      "look": {
        "$ref": "#/components/schemas/ArticleLookId"
      },
      "margins": {
        "$ref": "#/components/schemas/ArticleMargins"
      },
      "pageNumbers": {
        "type": "boolean"
      },
      "paragraphSpacing": {
        "$ref": "#/components/schemas/ArticleParagraphSpacing"
      },
      "rules": {
        "$ref": "#/components/schemas/ArticleRules"
      },
      "textSize": {
        "$ref": "#/components/schemas/ArticleTextSize"
      }
    },
    "type": "object"
  },
  "ArticleTextSize": {
    "enum": [
      "small",
      "normal",
      "large"
    ],
    "type": "string"
  },
  "ArticleZoneAlign": {
    "enum": [
      "left",
      "center",
      "right"
    ],
    "type": "string"
  },
  "ArticleZoneAt": {
    "additionalProperties": false,
    "properties": {
      "page": {
        "type": "string"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "page",
      "x",
      "y"
    ],
    "type": "object"
  },
  "ArticleZoneBlock": {
    "additionalProperties": false,
    "properties": {
      "align": {
        "$ref": "#/components/schemas/ArticleZoneAlign"
      },
      "at": {
        "$ref": "#/components/schemas/ArticleZoneAt"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "type": {
        "const": "zone",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "wrap": {
        "$ref": "#/components/schemas/ArticleZoneWrap"
      },
      "zone": {
        "$ref": "#/components/schemas/ArticleZoneKind"
      }
    },
    "required": [
      "id",
      "type",
      "zone",
      "width",
      "height"
    ],
    "type": "object"
  },
  "ArticleZoneKind": {
    "enum": [
      "object",
      "drawing"
    ],
    "type": "string"
  },
  "ArticleZoneWrap": {
    "enum": [
      "inline",
      "left",
      "right"
    ],
    "type": "string"
  },
  "Axis": {
    "enum": [
      "r",
      "c"
    ],
    "type": "string"
  },
  "BackgroundPattern": {
    "enum": [
      "grid",
      "blank",
      "lines",
      "crosshatch",
      "graph",
      "confetti",
      "stripes",
      "diagonal",
      "waves",
      "bricks",
      "isometric",
      "hexagonal",
      "engineering",
      "checkerboard",
      "flow",
      "drift",
      "aurora",
      "ripple",
      "ribbons"
    ],
    "type": "string"
  },
  "BoardWidgetKind": {
    "enum": [
      "count",
      "progress",
      "filter",
      "mine",
      "people",
      "unplaced",
      "types",
      "wip",
      "due",
      "points",
      "priorities",
      "unassigned",
      "top-voted",
      "stale"
    ],
    "type": "string"
  },
  "Border": {
    "additionalProperties": false,
    "properties": {
      "c": {
        "type": "string"
      },
      "s": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "w": {
        "enum": [
          1,
          2,
          3
        ],
        "type": "number"
      }
    },
    "required": [
      "w",
      "s",
      "c"
    ],
    "type": "object"
  },
  "BorderRadius": {
    "enum": [
      "none",
      "sm",
      "md",
      "lg",
      "full"
    ],
    "type": "string"
  },
  "BorderStroke": {
    "enum": [
      "none",
      "thin",
      "medium",
      "thick",
      "extra-thick"
    ],
    "type": "string"
  },
  "BorderStyle": {
    "enum": [
      "solid",
      "dashed",
      "dotted",
      "dash-dot",
      "long-dash",
      "dash-dot-dot"
    ],
    "type": "string"
  },
  "BoxedElement": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/ShapeElement"
      },
      {
        "$ref": "#/components/schemas/TextElement"
      },
      {
        "$ref": "#/components/schemas/StickyElement"
      },
      {
        "$ref": "#/components/schemas/ImageElement"
      },
      {
        "$ref": "#/components/schemas/FreehandElement"
      },
      {
        "$ref": "#/components/schemas/PathElement"
      },
      {
        "$ref": "#/components/schemas/TableElement"
      },
      {
        "$ref": "#/components/schemas/AnnotationElement"
      },
      {
        "$ref": "#/components/schemas/LinkCardElement"
      },
      {
        "$ref": "#/components/schemas/VideoElement"
      }
    ]
  },
  "CapabilitiesResponse": {
    "additionalProperties": false,
    "properties": {
      "aiEnabled": {
        "type": "boolean"
      },
      "apiBase": {
        "type": "string"
      },
      "authEnabled": {
        "type": "boolean"
      },
      "cli": {
        "additionalProperties": false,
        "properties": {
          "minVersion": {
            "type": "string"
          }
        },
        "required": [
          "minVersion"
        ],
        "type": "object"
      },
      "communityEnabled": {
        "type": "boolean"
      },
      "documentFormat": {
        "type": "number"
      },
      "driveMode": {
        "$ref": "#/components/schemas/DriveMode"
      },
      "emailEnabled": {
        "type": "boolean"
      },
      "oauthIssuer": {
        "type": "string"
      }
    },
    "required": [
      "aiEnabled"
    ],
    "type": "object"
  },
  "CardField": {
    "anyOf": [
      {
        "const": "key",
        "type": "string"
      },
      {
        "const": "type",
        "type": "string"
      },
      {
        "const": "assignee",
        "type": "string"
      },
      {
        "const": "priority",
        "type": "string"
      },
      {
        "const": "labels",
        "type": "string"
      },
      {
        "const": "estimate",
        "type": "string"
      },
      {
        "const": "start",
        "type": "string"
      },
      {
        "const": "due",
        "type": "string"
      },
      {
        "const": "votes",
        "type": "string"
      },
      {
        "const": "checklist",
        "type": "string"
      },
      {
        "const": "comments",
        "type": "string"
      },
      {
        "const": "description",
        "type": "string"
      },
      {
        "$ref": "#/components/schemas/CustomCardField"
      }
    ]
  },
  "CardSearchFilter": {
    "additionalProperties": false,
    "properties": {
      "by": {
        "$ref": "#/components/schemas/SwimlaneBy"
      },
      "field": {
        "type": "string"
      },
      "key": {
        "type": "string"
      }
    },
    "required": [
      "by",
      "key"
    ],
    "type": "object"
  },
  "CardSize": {
    "enum": [
      "minimal",
      "compact",
      "detailed"
    ],
    "type": "string"
  },
  "CardTable": {
    "additionalProperties": false,
    "properties": {
      "cols": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "c": {
              "type": "string"
            },
            "field": {
              "type": "string"
            }
          },
          "required": [
            "c",
            "field"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "controls": {
        "type": "string"
      },
      "drafts": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "head": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "rows": {
        "additionalProperties": {
          "type": "string"
        },
        "type": "object"
      },
      "type": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "head",
      "cols",
      "rows",
      "type"
    ],
    "type": "object"
  },
  "CellChange": {
    "additionalProperties": false,
    "properties": {
      "c": {
        "type": "string"
      },
      "f": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/FormatPatch"
          },
          {
            "type": "null"
          }
        ]
      },
      "i": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/CellInput"
          },
          {
            "type": "null"
          }
        ]
      },
      "r": {
        "type": "string"
      }
    },
    "required": [
      "r",
      "c"
    ],
    "type": "object"
  },
  "CellFormat": {
    "additionalProperties": false,
    "properties": {
      "b": {
        "const": true,
        "type": "boolean"
      },
      "bb": {
        "$ref": "#/components/schemas/Border"
      },
      "bg": {
        "type": "string"
      },
      "bl": {
        "$ref": "#/components/schemas/Border"
      },
      "br": {
        "$ref": "#/components/schemas/Border"
      },
      "bt": {
        "$ref": "#/components/schemas/Border"
      },
      "cur": {
        "type": "string"
      },
      "dp": {
        "type": "number"
      },
      "fc": {
        "type": "string"
      },
      "ff": {
        "type": "string"
      },
      "fs": {
        "$ref": "#/components/schemas/FontSize"
      },
      "ha": {
        "enum": [
          "l",
          "c",
          "r"
        ],
        "type": "string"
      },
      "i": {
        "const": true,
        "type": "boolean"
      },
      "nf": {
        "$ref": "#/components/schemas/NumberFormatKind"
      },
      "st": {
        "const": true,
        "type": "boolean"
      },
      "u": {
        "const": true,
        "type": "boolean"
      },
      "va": {
        "enum": [
          "t",
          "m",
          "b"
        ],
        "type": "string"
      },
      "wr": {
        "enum": [
          "o",
          "w",
          "c"
        ],
        "type": "string"
      }
    },
    "type": "object"
  },
  "CellInput": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "n": {
            "type": "number"
          }
        },
        "required": [
          "n"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "s": {
            "type": "string"
          }
        },
        "required": [
          "s"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "b": {
            "type": "boolean"
          }
        },
        "required": [
          "b"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "f": {
            "$ref": "#/components/schemas/StoredFormula"
          }
        },
        "required": [
          "f"
        ],
        "type": "object"
      }
    ]
  },
  "ChairFacing": {
    "enum": [
      "n",
      "e",
      "s",
      "w"
    ],
    "type": "string"
  },
  "ChangesetAuthor": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "color"
    ],
    "type": "object"
  },
  "ChangesetBase": {
    "additionalProperties": false,
    "properties": {
      "elements": {
        "additionalProperties": {
          "type": "string"
        },
        "type": "object"
      },
      "rev": {
        "type": "number"
      }
    },
    "required": [
      "rev"
    ],
    "type": "object"
  },
  "ChangesetCounts": {
    "additionalProperties": false,
    "properties": {
      "added": {
        "type": "number"
      },
      "changed": {
        "type": "number"
      },
      "removed": {
        "type": "number"
      }
    },
    "required": [
      "added",
      "changed",
      "removed"
    ],
    "type": "object"
  },
  "ChangesetDetail": {
    "additionalProperties": false,
    "properties": {
      "changeset": {
        "$ref": "#/components/schemas/ChangesetSummary"
      },
      "results": {
        "items": {
          "$ref": "#/components/schemas/ResultLine"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "changeset",
      "results",
      "text"
    ],
    "type": "object"
  },
  "ChangesetReplaceBody": {
    "additionalProperties": false,
    "properties": {
      "elements": {
        "items": {},
        "type": "array"
      },
      "graph": {},
      "layout": {
        "enum": [
          "auto",
          "preserve"
        ],
        "type": "string"
      },
      "mermaid": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "template": {
        "type": "string"
      },
      "theme": {
        "type": "string"
      }
    },
    "type": "object"
  },
  "ChangesetRequest": {
    "additionalProperties": false,
    "properties": {
      "base": {
        "$ref": "#/components/schemas/ChangesetBase"
      },
      "operations": {
        "anyOf": [
          {
            "items": {},
            "type": "array"
          },
          {
            "type": "string"
          }
        ]
      },
      "replace": {
        "$ref": "#/components/schemas/ChangesetReplaceBody"
      },
      "strict": {
        "type": "boolean"
      },
      "summary": {
        "type": "string"
      }
    },
    "type": "object"
  },
  "ChangesetResponse": {
    "additionalProperties": false,
    "properties": {
      "changeset": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ChangesetWritten"
          },
          {
            "type": "null"
          }
        ]
      },
      "dryRun": {
        "type": "boolean"
      },
      "lint": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/LintReport"
          },
          {
            "type": "null"
          }
        ]
      },
      "results": {
        "items": {
          "$ref": "#/components/schemas/ResultLine"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      },
      "warnings": {
        "items": {
          "type": "string"
        },
        "type": "array"
      }
    },
    "required": [
      "dryRun",
      "changeset",
      "results",
      "text",
      "warnings",
      "lint"
    ],
    "type": "object"
  },
  "ChangesetSummary": {
    "additionalProperties": false,
    "properties": {
      "agent": {
        "type": "boolean"
      },
      "author": {
        "$ref": "#/components/schemas/ChangesetAuthor"
      },
      "counts": {
        "$ref": "#/components/schemas/ChangesetCounts"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "rev": {
        "type": "number"
      },
      "revertOf": {
        "type": [
          "string",
          "null"
        ]
      },
      "summary": {
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "type": "string"
      },
      "tokenId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "tabId",
      "rev",
      "author",
      "agent",
      "summary",
      "counts",
      "revertOf",
      "createdAt"
    ],
    "type": "object"
  },
  "ChangesetWritten": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "previousRev": {
        "type": "number"
      },
      "rebasedOver": {
        "type": "number"
      },
      "rev": {
        "type": "number"
      },
      "tabId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "tabId",
      "rev",
      "previousRev",
      "rebasedOver"
    ],
    "type": "object"
  },
  "ChartLegendPosition": {
    "enum": [
      "top",
      "right",
      "bottom",
      "left"
    ],
    "type": "string"
  },
  "ChartPaletteId": {
    "enum": [
      "vivid",
      "ocean",
      "forest",
      "sunset",
      "berry",
      "earth",
      "grey",
      "contrast"
    ],
    "type": "string"
  },
  "ChartSource": {
    "additionalProperties": false,
    "properties": {
      "cols": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "range": {
        "additionalProperties": false,
        "properties": {
          "c1": {
            "type": "string"
          },
          "c2": {
            "type": "string"
          },
          "r1": {
            "type": "string"
          },
          "r2": {
            "type": "string"
          }
        },
        "required": [
          "r1",
          "c1",
          "r2",
          "c2"
        ],
        "type": "object"
      },
      "sheetId": {
        "type": "string"
      }
    },
    "required": [
      "sheetId",
      "range"
    ],
    "type": "object"
  },
  "ChecklistItem": {
    "additionalProperties": false,
    "properties": {
      "done": {
        "type": "boolean"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "text",
      "done"
    ],
    "type": "object"
  },
  "CodeLanguage": {
    "enum": [
      "plain",
      "ts",
      "js",
      "python",
      "json",
      "bash",
      "sql",
      "html",
      "css",
      "yaml"
    ],
    "type": "string"
  },
  "CodeThemeId": {
    "enum": [
      "midnight",
      "graphite",
      "ocean",
      "forest",
      "plum",
      "contrast",
      "paper",
      "parchment"
    ],
    "type": "string"
  },
  "ColumnWidth": {
    "enum": [
      1,
      2,
      3
    ],
    "type": "number"
  },
  "Comment": {
    "additionalProperties": false,
    "properties": {
      "authorColor": {
        "type": "string"
      },
      "authorId": {
        "type": "string"
      },
      "authorName": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "mentions": {
        "items": {
          "$ref": "#/components/schemas/CommentMention"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      },
      "tokenId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "text",
      "createdAt",
      "authorName",
      "authorColor"
    ],
    "type": "object"
  },
  "CommentMention": {
    "additionalProperties": false,
    "properties": {
      "handle": {
        "type": "string"
      },
      "memberId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "userId",
      "name",
      "handle"
    ],
    "type": "object"
  },
  "CommentThread": {
    "additionalProperties": false,
    "properties": {
      "comments": {
        "items": {
          "$ref": "#/components/schemas/Comment"
        },
        "type": "array"
      },
      "resolved": {
        "type": "boolean"
      }
    },
    "required": [
      "comments",
      "resolved"
    ],
    "type": "object"
  },
  "CommentsView": {
    "additionalProperties": false,
    "properties": {
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "threads": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "comments": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "authorName": {
                    "type": "string"
                  },
                  "createdAt": {
                    "type": "number"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "authorName",
                  "createdAt",
                  "text"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "ref": {
              "type": "string"
            },
            "resolved": {
              "type": "boolean"
            }
          },
          "required": [
            "ref",
            "kind",
            "label",
            "resolved",
            "comments"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "threads",
      "elision"
    ],
    "type": "object"
  },
  "CommunityAuthor": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "picture": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "name",
      "color",
      "picture"
    ],
    "type": "object"
  },
  "CommunityCategory": {
    "enum": [
      "architecture",
      "flows",
      "planning",
      "workshops",
      "mindmaps",
      "design",
      "data",
      "learning",
      "infographics",
      "art",
      "other"
    ],
    "type": "string"
  },
  "CommunityFacetsResponse": {
    "additionalProperties": false,
    "properties": {
      "categories": {
        "additionalProperties": false,
        "properties": {
          "architecture": {
            "type": "number"
          },
          "art": {
            "type": "number"
          },
          "data": {
            "type": "number"
          },
          "design": {
            "type": "number"
          },
          "flows": {
            "type": "number"
          },
          "infographics": {
            "type": "number"
          },
          "learning": {
            "type": "number"
          },
          "mindmaps": {
            "type": "number"
          },
          "other": {
            "type": "number"
          },
          "planning": {
            "type": "number"
          },
          "workshops": {
            "type": "number"
          }
        },
        "type": "object"
      },
      "tags": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "count": {
              "type": "number"
            },
            "tag": {
              "type": "string"
            }
          },
          "required": [
            "tag",
            "count"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "total": {
        "type": "number"
      }
    },
    "required": [
      "total",
      "categories",
      "tags"
    ],
    "type": "object"
  },
  "CommunityFeaturedResponse": {
    "additionalProperties": false,
    "properties": {
      "posts": {
        "items": {
          "$ref": "#/components/schemas/CommunityPost"
        },
        "type": "array"
      }
    },
    "required": [
      "posts"
    ],
    "type": "object"
  },
  "CommunityLikeResponse": {
    "additionalProperties": false,
    "properties": {
      "likeCount": {
        "type": "number"
      },
      "liked": {
        "type": "boolean"
      }
    },
    "required": [
      "likeCount",
      "liked"
    ],
    "type": "object"
  },
  "CommunityListResponse": {
    "additionalProperties": false,
    "properties": {
      "nextOffset": {
        "type": [
          "number",
          "null"
        ]
      },
      "posts": {
        "items": {
          "$ref": "#/components/schemas/CommunityPost"
        },
        "type": "array"
      }
    },
    "required": [
      "posts",
      "nextOffset"
    ],
    "type": "object"
  },
  "CommunityMinePost": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "copyCount": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "documentId": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "likeCount": {
        "type": "number"
      },
      "liked": {
        "type": "boolean"
      },
      "publishedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": "string"
      },
      "state": {
        "$ref": "#/components/schemas/CommunityPostState"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "anonymous",
      "author",
      "category",
      "copyCount",
      "description",
      "documentId",
      "id",
      "likeCount",
      "liked",
      "publishedAt",
      "shareCode",
      "state",
      "tags",
      "title",
      "updatedAt"
    ],
    "type": "object"
  },
  "CommunityMineResponse": {
    "additionalProperties": false,
    "properties": {
      "nextOffset": {
        "type": [
          "number",
          "null"
        ]
      },
      "posts": {
        "items": {
          "$ref": "#/components/schemas/CommunityMinePost"
        },
        "type": "array"
      },
      "totals": {
        "$ref": "#/components/schemas/CommunityMineTotals"
      }
    },
    "required": [
      "posts",
      "nextOffset",
      "totals"
    ],
    "type": "object"
  },
  "CommunityMineTotals": {
    "additionalProperties": false,
    "properties": {
      "copies": {
        "type": "number"
      },
      "likes": {
        "type": "number"
      },
      "posts": {
        "type": "number"
      }
    },
    "required": [
      "posts",
      "likes",
      "copies"
    ],
    "type": "object"
  },
  "CommunityOwnPost": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "copyCount": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "likeCount": {
        "type": "number"
      },
      "liked": {
        "type": "boolean"
      },
      "publishedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": "string"
      },
      "state": {
        "$ref": "#/components/schemas/CommunityPostState"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "anonymous",
      "author",
      "category",
      "copyCount",
      "description",
      "id",
      "likeCount",
      "liked",
      "publishedAt",
      "shareCode",
      "state",
      "tags",
      "title",
      "updatedAt"
    ],
    "type": "object"
  },
  "CommunityPost": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "copyCount": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "likeCount": {
        "type": "number"
      },
      "liked": {
        "type": "boolean"
      },
      "publishedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": "string"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "title",
      "description",
      "category",
      "tags",
      "likeCount",
      "copyCount",
      "publishedAt",
      "updatedAt",
      "shareCode",
      "author",
      "anonymous",
      "liked"
    ],
    "type": "object"
  },
  "CommunityPostInput": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "description": {
        "type": "string"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "title",
      "description",
      "category",
      "tags",
      "anonymous"
    ],
    "type": "object"
  },
  "CommunityPostResponse": {
    "additionalProperties": false,
    "properties": {
      "post": {
        "$ref": "#/components/schemas/CommunityPost"
      },
      "related": {
        "items": {
          "$ref": "#/components/schemas/CommunityPost"
        },
        "type": "array"
      }
    },
    "required": [
      "post",
      "related"
    ],
    "type": "object"
  },
  "CommunityPostState": {
    "enum": [
      "listed",
      "hidden"
    ],
    "type": "string"
  },
  "CommunityReportInput": {
    "additionalProperties": false,
    "properties": {
      "note": {
        "type": [
          "string",
          "null"
        ]
      },
      "reason": {
        "$ref": "#/components/schemas/CommunityReportReason"
      }
    },
    "required": [
      "reason"
    ],
    "type": "object"
  },
  "CommunityReportReason": {
    "enum": [
      "spam",
      "offensive",
      "personal-info",
      "copyright",
      "other"
    ],
    "type": "string"
  },
  "CommunityShareInfo": {
    "additionalProperties": false,
    "properties": {
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "postId": {
        "type": "string"
      }
    },
    "required": [
      "postId",
      "author"
    ],
    "type": "object"
  },
  "ConditionOp": {
    "enum": [
      "empty",
      "notEmpty",
      "contains",
      "notContains",
      "startsWith",
      "endsWith",
      "exactly",
      "dateBefore",
      "dateAfter",
      "dateOn",
      "gt",
      "gte",
      "lt",
      "lte",
      "between",
      "eq",
      "neq"
    ],
    "type": "string"
  },
  "CreationTabKind": {
    "enum": [
      "diagram",
      "event-storming"
    ],
    "type": "string"
  },
  "CurrentTokenResponse": {
    "additionalProperties": false,
    "properties": {
      "accountId": {
        "type": "string"
      },
      "accountName": {
        "type": [
          "string",
          "null"
        ]
      },
      "expiresAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "role": {
        "enum": [
          "full",
          "read-only"
        ],
        "type": "string"
      },
      "tokenId": {
        "type": "string"
      },
      "tokenName": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "accountId",
      "accountName",
      "tokenId",
      "tokenName",
      "role",
      "expiresAt"
    ],
    "type": "object"
  },
  "CustomCardField": {
    "type": "string"
  },
  "CustomFieldDef": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "kind": {
        "$ref": "#/components/schemas/CustomFieldKind"
      },
      "label": {
        "type": "string"
      },
      "linkType": {
        "type": "string"
      },
      "onCard": {
        "type": "boolean"
      },
      "options": {
        "items": {
          "type": "string"
        },
        "type": "array"
      }
    },
    "required": [
      "id",
      "label",
      "kind"
    ],
    "type": "object"
  },
  "CustomFieldKind": {
    "enum": [
      "text",
      "longtext",
      "number",
      "date",
      "checkbox",
      "link",
      "choice",
      "card"
    ],
    "type": "string"
  },
  "CustomTheme": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "definition": {
        "$ref": "#/components/schemas/CustomThemeDefinition"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "ownerId": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "ownerId",
      "name",
      "definition",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "CustomThemeDefinition": {
    "additionalProperties": false,
    "properties": {
      "backgroundColor": {
        "type": "string"
      },
      "backgroundOpacity": {
        "type": "number"
      },
      "backgroundPattern": {
        "$ref": "#/components/schemas/BackgroundPattern"
      },
      "elementFill": {
        "type": [
          "string",
          "null"
        ]
      },
      "elementStroke": {
        "type": [
          "string",
          "null"
        ]
      },
      "elementText": {
        "type": [
          "string",
          "null"
        ]
      },
      "palette": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "fill": {
              "type": "string"
            },
            "stroke": {
              "type": "string"
            },
            "text": {
              "type": "string"
            }
          },
          "required": [
            "fill",
            "stroke",
            "text"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "patternColor": {
        "type": "string"
      },
      "rootColor": {
        "additionalProperties": false,
        "properties": {
          "fill": {
            "type": "string"
          },
          "stroke": {
            "type": "string"
          },
          "text": {
            "type": "string"
          }
        },
        "required": [
          "fill",
          "stroke",
          "text"
        ],
        "type": "object"
      },
      "shapeColors": {
        "additionalProperties": false,
        "properties": {
          "action-card": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "actor": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "agenda": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "banner": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "bar-chart": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "browser": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "callout": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "chair": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "checklist": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "circle": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "cloud": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "code-block": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "comment-pin": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "cylinder": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "decision": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "diamond": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "document": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "done-check": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "entity": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "estimate": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "focus-button": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "foldable": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "frame": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "hexagon": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "icon": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "idea-box": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "lane": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "laptop": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "legend": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "line-chart": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "mind-node": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "mode-button": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "monitor": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "page": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "parallelogram": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "phone": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "picker": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "pie-chart": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "plan-board": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "plan-card": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "plan-sheet": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "plan-view": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "portal": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "process": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "progress-bar": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "progress-ring": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "qa-board": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "quiz": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "rating": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "reaction-pad": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "reveal": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "roll-call": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "session-button": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "site-header": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "smartwatch": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "speech-bubble": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "square": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "stadium": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "star": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "stat-row": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "sticker": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "tablet": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "temperature": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "timeline-rail": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "trapezoid": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          },
          "triangle": {
            "additionalProperties": false,
            "properties": {
              "fill": {
                "type": "string"
              },
              "stroke": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "type": "object"
          }
        },
        "type": "object"
      }
    },
    "required": [
      "backgroundColor",
      "backgroundPattern",
      "patternColor",
      "elementFill",
      "elementStroke",
      "elementText"
    ],
    "type": "object"
  },
  "DecisionStatus": {
    "enum": [
      "proposed",
      "accepted",
      "rejected",
      "superseded"
    ],
    "type": "string"
  },
  "DiffView": {
    "additionalProperties": false,
    "properties": {
      "changes": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "changes": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "after": {},
                  "before": {},
                  "field": {
                    "type": "string"
                  }
                },
                "required": [
                  "field",
                  "before",
                  "after"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "op": {
              "enum": [
                "+",
                "-",
                "~"
              ],
              "type": "string"
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "op",
            "ref",
            "kind",
            "label",
            "changes"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "since": {
        "type": "number"
      }
    },
    "required": [
      "header",
      "since",
      "changes",
      "elision"
    ],
    "type": "object"
  },
  "Document": {
    "additionalProperties": false,
    "properties": {
      "communityState": {
        "enum": [
          "listed",
          "hidden",
          null
        ],
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "number"
      },
      "folderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "itemTypes": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ItemTypeCatalogue"
          },
          {
            "type": "null"
          }
        ]
      },
      "itemTypesRev": {
        "type": "number"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/EditorMode"
          },
          {
            "type": "null"
          }
        ]
      },
      "ownerColor": {
        "type": [
          "string",
          "null"
        ]
      },
      "ownerId": {
        "type": "string"
      },
      "ownerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "presentation": {
        "type": [
          "string",
          "null"
        ]
      },
      "savedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "shareable": {
        "type": "boolean"
      },
      "source": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DocumentSource"
          },
          {
            "type": "null"
          }
        ]
      },
      "tabKind": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/CreationTabKind"
          },
          {
            "type": "null"
          }
        ]
      },
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/TabSummary"
        },
        "type": "array"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "templateFamily": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/TemplateFamily"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "createdAt",
      "folderId",
      "id",
      "name",
      "opensIn",
      "ownerColor",
      "ownerId",
      "ownerName",
      "presentation",
      "savedAt",
      "shareCode",
      "shareable",
      "source",
      "tabKind",
      "tabs",
      "teamId",
      "templateFamily"
    ],
    "type": "object"
  },
  "DocumentCommentThread": {
    "additionalProperties": false,
    "properties": {
      "comments": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "authorColor": {
              "type": "string"
            },
            "authorId": {
              "type": "string"
            },
            "authorName": {
              "type": "string"
            },
            "createdAt": {
              "type": "number"
            },
            "id": {
              "type": "string"
            },
            "mentions": {
              "items": {
                "$ref": "#/components/schemas/CommentMention"
              },
              "type": "array"
            },
            "text": {
              "type": "string"
            },
            "tokenId": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "text",
            "createdAt",
            "authorName",
            "authorColor"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elementId": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      },
      "resolved": {
        "type": "boolean"
      },
      "tabId": {
        "type": "string"
      },
      "tabName": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "tabName",
      "elementId",
      "ref",
      "label",
      "resolved",
      "comments"
    ],
    "type": "object"
  },
  "DocumentSource": {
    "enum": [
      "ai",
      "mcp",
      "cli"
    ],
    "type": "string"
  },
  "DocumentStats": {
    "additionalProperties": false,
    "properties": {
      "bytes": {
        "type": "number"
      },
      "comments": {
        "type": "number"
      },
      "elements": {
        "type": "number"
      },
      "mode": {
        "$ref": "#/components/schemas/EditorMode"
      }
    },
    "required": [
      "mode",
      "elements",
      "comments",
      "bytes"
    ],
    "type": "object"
  },
  "DocumentSummary": {
    "additionalProperties": false,
    "properties": {
      "communityListed": {
        "type": "boolean"
      },
      "createdAt": {
        "type": "number"
      },
      "empty": {
        "type": "boolean"
      },
      "folderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/EditorMode"
          },
          {
            "type": "null"
          }
        ]
      },
      "ownerId": {
        "type": "string"
      },
      "savedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "shareable": {
        "type": "boolean"
      },
      "source": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DocumentSource"
          },
          {
            "type": "null"
          }
        ]
      },
      "stats": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DocumentStats"
          },
          {
            "type": "null"
          }
        ]
      },
      "tabKind": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/CreationTabKind"
          },
          {
            "type": "null"
          }
        ]
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "templateFamily": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/TemplateFamily"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "communityListed",
      "createdAt",
      "empty",
      "folderId",
      "id",
      "name",
      "opensIn",
      "ownerId",
      "savedAt",
      "shareCode",
      "shareable",
      "source",
      "stats",
      "tabKind",
      "teamId",
      "templateFamily"
    ],
    "type": "object"
  },
  "DrawingAnimation": {
    "enum": [
      "draw",
      "trace",
      "dash",
      "boil",
      "ink",
      "glow",
      "shimmer"
    ],
    "type": "string"
  },
  "DriveAccessToken": {
    "additionalProperties": false,
    "properties": {
      "accessToken": {
        "type": "string"
      },
      "expiresAt": {
        "type": "number"
      }
    },
    "required": [
      "accessToken",
      "expiresAt"
    ],
    "type": "object"
  },
  "DriveConnection": {
    "additionalProperties": false,
    "properties": {
      "connectedAt": {
        "type": "number"
      },
      "hasRefreshToken": {
        "type": "boolean"
      },
      "pageToken": {
        "type": [
          "string",
          "null"
        ]
      },
      "pageTokenSavedAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "rootFolderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "$ref": "#/components/schemas/DriveConnectionStatus"
      }
    },
    "required": [
      "status",
      "hasRefreshToken",
      "rootFolderId",
      "pageToken",
      "pageTokenSavedAt",
      "connectedAt"
    ],
    "type": "object"
  },
  "DriveConnectionStatus": {
    "enum": [
      "connected",
      "needs_reconnect"
    ],
    "type": "string"
  },
  "DriveItem": {
    "additionalProperties": false,
    "properties": {
      "driveFileId": {
        "type": "string"
      },
      "headRevisionId": {
        "type": [
          "string",
          "null"
        ]
      },
      "kind": {
        "$ref": "#/components/schemas/DriveItemKind"
      },
      "ldId": {
        "type": "string"
      },
      "ldName": {
        "type": "string"
      },
      "md5": {
        "type": [
          "string",
          "null"
        ]
      },
      "mirroredSavedAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "name": {
        "type": "string"
      },
      "notice": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DriveNotice"
          },
          {
            "type": "null"
          }
        ]
      },
      "noticeParentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "parentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "trashed": {
        "type": "boolean"
      }
    },
    "required": [
      "kind",
      "ldId",
      "driveFileId",
      "name",
      "ldName",
      "parentId",
      "trashed",
      "md5",
      "headRevisionId",
      "mirroredSavedAt",
      "notice",
      "noticeParentId"
    ],
    "type": "object"
  },
  "DriveItemKind": {
    "enum": [
      "document",
      "folder"
    ],
    "type": "string"
  },
  "DriveLease": {
    "additionalProperties": false,
    "properties": {
      "acquired": {
        "type": "boolean"
      },
      "expiresAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "holder": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "acquired",
      "holder",
      "expiresAt"
    ],
    "type": "object"
  },
  "DriveMode": {
    "enum": [
      "off",
      "browser",
      "broker"
    ],
    "type": "string"
  },
  "DriveNotice": {
    "const": "unseen_folder",
    "type": "string"
  },
  "EditWarning": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "$ref": "#/components/schemas/EditWarningCode"
      },
      "message": {
        "type": "string"
      },
      "ref": {
        "type": "string"
      }
    },
    "required": [
      "code",
      "message"
    ],
    "type": "object"
  },
  "EditWarningCode": {
    "enum": [
      "no_base",
      "shape_coerced",
      "value_coerced",
      "label_capped",
      "colour_overrides_theme",
      "arrows_freed"
    ],
    "type": "string"
  },
  "EditorMode": {
    "enum": [
      "diagram",
      "draw",
      "illustrate",
      "plan"
    ],
    "type": "string"
  },
  "Element": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/BoxedElement"
      },
      {
        "$ref": "#/components/schemas/ArrowElement"
      }
    ]
  },
  "ElementAction": {
    "additionalProperties": false,
    "properties": {
      "assignee": {
        "$ref": "#/components/schemas/ElementActionAssignee"
      },
      "assignerId": {
        "type": "string"
      },
      "assignerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "status": {
        "enum": [
          "open",
          "done"
        ],
        "type": "string"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "description",
      "assignee",
      "teamId",
      "assignerId",
      "assignerName",
      "status",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "ElementActionAssignee": {
    "additionalProperties": false,
    "properties": {
      "memberId": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "userId",
      "name"
    ],
    "type": "object"
  },
  "ElementAnimation": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/ShapeAnimation"
      },
      {
        "$ref": "#/components/schemas/StickyAnimation"
      },
      {
        "$ref": "#/components/schemas/DrawingAnimation"
      },
      {
        "$ref": "#/components/schemas/MediaAnimation"
      },
      {
        "$ref": "#/components/schemas/TableAnimation"
      }
    ]
  },
  "ElementId": {
    "type": "string"
  },
  "ElementLink": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "tab",
            "type": "string"
          },
          "tabId": {
            "$ref": "#/components/schemas/TabId"
          }
        },
        "required": [
          "kind",
          "tabId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "elementId": {
            "$ref": "#/components/schemas/ElementId"
          },
          "kind": {
            "const": "element",
            "type": "string"
          },
          "tabId": {
            "$ref": "#/components/schemas/TabId"
          }
        },
        "required": [
          "kind",
          "tabId",
          "elementId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "documentId": {
            "type": "string"
          },
          "kind": {
            "const": "document",
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "documentId",
          "name"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "url",
            "type": "string"
          },
          "url": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "url"
        ],
        "type": "object"
      }
    ]
  },
  "ElementShadow": {
    "additionalProperties": false,
    "properties": {
      "blur": {
        "type": "number"
      },
      "offsetX": {
        "type": "number"
      },
      "offsetY": {
        "type": "number"
      },
      "opacity": {
        "type": "number"
      }
    },
    "required": [
      "offsetX",
      "offsetY",
      "blur",
      "opacity"
    ],
    "type": "object"
  },
  "Elision": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "arguments": {
            "additionalProperties": {
              "type": [
                "string",
                "number",
                "boolean"
              ]
            },
            "type": "object"
          },
          "collapsed": {
            "items": {
              "additionalProperties": false,
              "properties": {
                "elements": {
                  "type": "number"
                },
                "kind": {
                  "type": "string"
                },
                "ref": {
                  "type": "string"
                }
              },
              "required": [
                "ref",
                "kind",
                "elements"
              ],
              "type": "object"
            },
            "type": "array"
          },
          "command": {
            "type": "string"
          },
          "dropped": {
            "items": {
              "enum": [
                "notes",
                "attributes"
              ],
              "type": "string"
            },
            "type": "array"
          },
          "omitted": {
            "items": {
              "additionalProperties": false,
              "properties": {
                "count": {
                  "type": "number"
                },
                "noun": {
                  "type": "string"
                }
              },
              "required": [
                "noun",
                "count"
              ],
              "type": "object"
            },
            "type": "array"
          }
        },
        "required": [
          "dropped",
          "collapsed",
          "omitted",
          "arguments",
          "command"
        ],
        "type": "object"
      },
      {
        "type": "null"
      }
    ]
  },
  "EmbedProvider": {
    "enum": [
      "youtube",
      "vimeo",
      "loom",
      "figma",
      "gdocs",
      "website"
    ],
    "type": "string"
  },
  "Endpoint": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "free",
            "type": "string"
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          }
        },
        "required": [
          "kind",
          "x",
          "y"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "anchor": {
            "$ref": "#/components/schemas/Anchor"
          },
          "elementId": {
            "$ref": "#/components/schemas/ElementId"
          },
          "kind": {
            "const": "pinned",
            "type": "string"
          }
        },
        "required": [
          "kind",
          "elementId",
          "anchor"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "arrowId": {
            "$ref": "#/components/schemas/ElementId"
          },
          "kind": {
            "const": "on-arrow",
            "type": "string"
          },
          "t": {
            "type": "number"
          }
        },
        "required": [
          "kind",
          "arrowId",
          "t"
        ],
        "type": "object"
      }
    ]
  },
  "EntityField": {
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "type": {
        "type": "string"
      }
    },
    "required": [
      "name"
    ],
    "type": "object"
  },
  "EstimateScale": {
    "enum": [
      "fibonacci",
      "tshirt",
      "powers"
    ],
    "type": "string"
  },
  "EventStormingNoteKind": {
    "enum": [
      "domain-event",
      "command",
      "actor",
      "policy",
      "read-model",
      "external-system",
      "aggregate",
      "hotspot"
    ],
    "type": "string"
  },
  "FieldChange": {
    "additionalProperties": false,
    "properties": {
      "from": {
        "$ref": "#/components/schemas/JsonValue"
      },
      "key": {
        "type": "string"
      },
      "to": {
        "$ref": "#/components/schemas/JsonValue"
      }
    },
    "required": [
      "key"
    ],
    "type": "object"
  },
  "FilterCondition": {
    "additionalProperties": false,
    "properties": {
      "a": {
        "type": "string"
      },
      "b": {
        "type": "string"
      },
      "op": {
        "$ref": "#/components/schemas/ConditionOp"
      },
      "values": {
        "items": {
          "type": "string"
        },
        "type": "array"
      }
    },
    "type": "object"
  },
  "FindField": {
    "enum": [
      "label",
      "note",
      "edge",
      "cell",
      "field",
      "item",
      "code",
      "comment"
    ],
    "type": "string"
  },
  "FindView": {
    "additionalProperties": false,
    "properties": {
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "matches": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "field": {
              "$ref": "#/components/schemas/FindField"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "path": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "kind",
            "label",
            "field",
            "path"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "q": {
        "type": "string"
      }
    },
    "required": [
      "header",
      "q",
      "matches",
      "elision"
    ],
    "type": "object"
  },
  "Folder": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "ownerId": {
        "type": "string"
      },
      "parentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "ownerId",
      "parentId",
      "teamId",
      "name",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "FontSize": {
    "type": "number"
  },
  "FormatPatch": {
    "additionalProperties": false,
    "properties": {
      "b": {},
      "bb": {},
      "bg": {},
      "bl": {},
      "br": {},
      "bt": {},
      "cur": {},
      "dp": {},
      "fc": {},
      "ff": {},
      "fs": {},
      "ha": {},
      "i": {},
      "nf": {},
      "st": {},
      "u": {},
      "va": {},
      "wr": {}
    },
    "type": "object"
  },
  "FreehandElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "closed": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "packedPoints": {
        "description": "The stroke's points, normalised into its box, and a pen's pressure at each when it reported one, packed into one block: base64 of a version byte, a flags byte and a little-endian record per point (x u16, y u16, optional pressure u8). See docs/specs/006-document/stroke-points.md.",
        "format": "byte",
        "type": "string"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "pen": {
        "const": "highlighter",
        "type": "string"
      },
      "penColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "penWidth": {
        "type": "number"
      },
      "rotation": {
        "type": "number"
      },
      "straightEdges": {
        "type": "boolean"
      },
      "streamline": {
        "type": "number"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "freehand",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height",
      "packedPoints",
      "closed"
    ],
    "type": "object"
  },
  "FreehandRunJson": {
    "additionalProperties": false,
    "properties": {
      "closed": {
        "type": "number"
      },
      "refs": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "run": {
        "const": "freehand",
        "type": "string"
      }
    },
    "required": [
      "run",
      "refs",
      "closed"
    ],
    "type": "object"
  },
  "GraphView": {
    "additionalProperties": false,
    "properties": {
      "arrows": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "nodes": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "id",
            "kind",
            "label"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "nodes",
      "arrows",
      "elision"
    ],
    "type": "object"
  },
  "HeroCaption": {
    "additionalProperties": false,
    "properties": {
      "subtitle": {
        "type": "string"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "title",
      "subtitle"
    ],
    "type": "object"
  },
  "HomeAction": {
    "additionalProperties": false,
    "description": "One thing somebody did.",
    "properties": {
      "detail": {
        "description": "The comment's words, the action's name, or the team's name; null for an edit.",
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "description": "The event's id.",
        "type": "string"
      },
      "occurredAt": {
        "type": "number"
      },
      "personId": {
        "type": "string"
      },
      "verb": {
        "$ref": "#/components/schemas/HomeVerb"
      }
    },
    "required": [
      "id",
      "verb",
      "personId",
      "occurredAt",
      "detail"
    ],
    "type": "object"
  },
  "HomeGroup": {
    "additionalProperties": false,
    "description": "One document's actions on one of the reader's days.",
    "properties": {
      "actions": {
        "description": "Every action, newest first.",
        "items": {
          "$ref": "#/components/schemas/HomeAction"
        },
        "type": "array"
      },
      "day": {
        "description": "YYYY-MM-DD in the reader's time zone.",
        "type": "string"
      },
      "documentId": {
        "type": "string"
      },
      "empty": {
        "description": "Nothing drawn: ask for no thumbnail.",
        "type": "boolean"
      },
      "folderId": {
        "description": "Null for `shared`, and for a document at its space's root.",
        "type": [
          "string",
          "null"
        ]
      },
      "folderName": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "description": "`<documentId>:<day>`.",
        "type": "string"
      },
      "latestAt": {
        "type": "number"
      },
      "name": {
        "description": "The document's current name.",
        "type": "string"
      },
      "ownerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "people": {
        "description": "Distinct people, newest action first.",
        "items": {
          "$ref": "#/components/schemas/HomePerson"
        },
        "type": "array"
      },
      "savedAt": {
        "description": "The thumbnail's version.",
        "type": "number"
      },
      "shareCode": {
        "description": "The live share code that opens it; set for `shared` only.",
        "type": [
          "string",
          "null"
        ]
      },
      "summary": {
        "description": "More than one person acted: one entry with a summary sentence.",
        "type": "boolean"
      },
      "tabId": {
        "description": "The one tab a tab-scoped share opens; null = every tab.",
        "type": [
          "string",
          "null"
        ]
      },
      "teamId": {
        "description": "Null for `shared`: the owner's filing is theirs.",
        "type": [
          "string",
          "null"
        ]
      },
      "teamName": {
        "type": [
          "string",
          "null"
        ]
      },
      "total": {
        "type": "number"
      },
      "verbs": {
        "description": "Distinct verbs with their counts, in `HOME_VERBS` order.",
        "items": {
          "$ref": "#/components/schemas/HomeVerbCount"
        },
        "type": "array"
      },
      "via": {
        "description": "How the person reaches it: their own, a joined team's, or shared with them by a link.",
        "enum": [
          "own",
          "team",
          "shared"
        ],
        "type": "string"
      }
    },
    "required": [
      "actions",
      "day",
      "documentId",
      "empty",
      "folderId",
      "folderName",
      "id",
      "latestAt",
      "name",
      "ownerName",
      "people",
      "savedAt",
      "shareCode",
      "summary",
      "tabId",
      "teamId",
      "teamName",
      "total",
      "verbs",
      "via"
    ],
    "type": "object"
  },
  "HomeJumpBackInItem": {
    "additionalProperties": false,
    "description": "One document of Jump back in, with the two measures Within reach places it by.",
    "properties": {
      "documentId": {
        "type": "string"
      },
      "empty": {
        "description": "Nothing drawn: ask for no thumbnail.",
        "type": "boolean"
      },
      "folderId": {
        "description": "Null for `shared`, and for a document at its space's root.",
        "type": [
          "string",
          "null"
        ]
      },
      "folderName": {
        "type": [
          "string",
          "null"
        ]
      },
      "lastUsedAt": {
        "description": "The later of the person's last open and last real edit: recent.",
        "type": "number"
      },
      "name": {
        "description": "The document's current name.",
        "type": "string"
      },
      "ownerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "savedAt": {
        "description": "The thumbnail's version.",
        "type": "number"
      },
      "shareCode": {
        "description": "The live share code that opens it; set for `shared` only.",
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "description": "The one tab a tab-scoped share opens; null = every tab.",
        "type": [
          "string",
          "null"
        ]
      },
      "teamId": {
        "description": "Null for `shared`: the owner's filing is theirs.",
        "type": [
          "string",
          "null"
        ]
      },
      "teamName": {
        "type": [
          "string",
          "null"
        ]
      },
      "useDays": {
        "description": "UTC days in the use window on which the person opened or edited it: most used.",
        "type": "number"
      },
      "via": {
        "description": "How the person reaches it: their own, a joined team's, or shared with them by a link.",
        "enum": [
          "own",
          "team",
          "shared"
        ],
        "type": "string"
      }
    },
    "required": [
      "documentId",
      "empty",
      "folderId",
      "folderName",
      "lastUsedAt",
      "name",
      "ownerName",
      "savedAt",
      "shareCode",
      "tabId",
      "teamId",
      "teamName",
      "useDays",
      "via"
    ],
    "type": "object"
  },
  "HomePerson": {
    "additionalProperties": false,
    "description": "Somebody who acted.",
    "properties": {
      "color": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "pictureUrl": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "color",
      "pictureUrl"
    ],
    "type": "object"
  },
  "HomeResponse": {
    "additionalProperties": false,
    "description": "`GET /api/home`.",
    "properties": {
      "jumpBackIn": {
        "description": "The server's Within reach set: the most used, then the recent; at most twice the per-row N.",
        "items": {
          "$ref": "#/components/schemas/HomeJumpBackInItem"
        },
        "type": "array"
      },
      "lastSeenAt": {
        "description": "The Timeline feed's unread mark as it stood before this read (the read moves it, once per visit); null when the person had never looked. What happened after it is new to them.",
        "type": [
          "number",
          "null"
        ]
      },
      "whatHappened": {
        "items": {
          "$ref": "#/components/schemas/HomeGroup"
        },
        "type": "array"
      }
    },
    "required": [
      "jumpBackIn",
      "whatHappened",
      "lastSeenAt"
    ],
    "type": "object"
  },
  "HomeVerb": {
    "enum": [
      "commented",
      "replied",
      "resolved",
      "edited",
      "assigned_you",
      "assigned",
      "completed",
      "shared"
    ],
    "type": "string"
  },
  "HomeVerbCount": {
    "additionalProperties": false,
    "properties": {
      "count": {
        "type": "number"
      },
      "verb": {
        "$ref": "#/components/schemas/HomeVerb"
      }
    },
    "required": [
      "verb",
      "count"
    ],
    "type": "object"
  },
  "HuedPenColourName": {
    "description": "The eight hued stock colours, each tuned per board.",
    "enum": [
      "blue",
      "red",
      "orange",
      "yellow",
      "green",
      "teal",
      "violet",
      "pink"
    ],
    "type": "string"
  },
  "IconAnimation": {
    "enum": [
      "spin",
      "beat",
      "pulse",
      "glow",
      "ping",
      "breathe",
      "shimmer",
      "bounce",
      "wiggle",
      "flash",
      "tada",
      "flip",
      "jump",
      "swing",
      "float"
    ],
    "type": "string"
  },
  "IconPosition": {
    "enum": [
      "left",
      "right",
      "above",
      "below"
    ],
    "type": "string"
  },
  "IconSearchResponse": {
    "additionalProperties": false,
    "properties": {
      "icons": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string"
            },
            "label": {
              "type": "string"
            },
            "set": {
              "enum": [
                "line",
                "technology"
              ],
              "type": "string"
            }
          },
          "required": [
            "id",
            "label",
            "set"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "more": {
        "type": "number"
      }
    },
    "required": [
      "icons",
      "more"
    ],
    "type": "object"
  },
  "IconSize": {
    "enum": [
      "sm",
      "md",
      "lg",
      "xl"
    ],
    "type": "string"
  },
  "IconWeight": {
    "enum": [
      "thin",
      "regular",
      "bold"
    ],
    "type": "string"
  },
  "IdRange": {
    "additionalProperties": false,
    "properties": {
      "c1": {
        "type": "string"
      },
      "c2": {
        "type": "string"
      },
      "r1": {
        "type": "string"
      },
      "r2": {
        "type": "string"
      }
    },
    "required": [
      "r1",
      "c1",
      "r2",
      "c2"
    ],
    "type": "object"
  },
  "IllustratePage": {
    "additionalProperties": false,
    "properties": {
      "background": {
        "$ref": "#/components/schemas/PageBackground"
      },
      "fit": {
        "$ref": "#/components/schemas/PageSides"
      },
      "flow": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "kind": {
        "$ref": "#/components/schemas/PageKind"
      },
      "locked": {
        "const": true,
        "type": "boolean"
      },
      "name": {
        "type": "string"
      },
      "orientation": {
        "$ref": "#/components/schemas/PageOrientation"
      },
      "rowAt": {
        "$ref": "#/components/schemas/RowAt"
      },
      "size": {
        "$ref": "#/components/schemas/PageSizeId"
      },
      "startedBlank": {
        "const": true,
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "orientation"
    ],
    "type": "object"
  },
  "ImageCredit": {
    "additionalProperties": false,
    "properties": {
      "licenseUrl": {
        "type": "string"
      },
      "sourceUrl": {
        "type": "string"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "text",
      "sourceUrl"
    ],
    "type": "object"
  },
  "ImageElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "alt": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "credit": {
        "$ref": "#/components/schemas/ImageCredit"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "heroCaption": {
        "$ref": "#/components/schemas/HeroCaption"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "imageId": {
        "type": [
          "string",
          "null"
        ]
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "naturalHeight": {
        "type": "number"
      },
      "naturalWidth": {
        "type": "number"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "objectFit": {
        "enum": [
          "cover",
          "contain"
        ],
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "image",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height",
      "imageId"
    ],
    "type": "object"
  },
  "ImageSummary": {
    "additionalProperties": false,
    "properties": {
      "byteSize": {
        "type": "number"
      },
      "contentType": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "originalName": {
        "type": "string"
      },
      "width": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "contentType",
      "byteSize",
      "width",
      "height",
      "createdAt"
    ],
    "type": "object"
  },
  "Item": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "createdBy": {
        "$ref": "#/components/schemas/ItemPerson"
      },
      "fields": {
        "$ref": "#/components/schemas/ItemFields"
      },
      "id": {
        "type": "string"
      },
      "key": {
        "type": "number"
      },
      "rank": {
        "type": "string"
      },
      "rev": {
        "type": "number"
      },
      "type": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      },
      "updatedBy": {
        "$ref": "#/components/schemas/ItemPerson"
      }
    },
    "required": [
      "id",
      "type",
      "key",
      "rank",
      "fields",
      "rev",
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy"
    ],
    "type": "object"
  },
  "ItemCreate": {
    "additionalProperties": false,
    "properties": {
      "comments": {
        "$ref": "#/components/schemas/ItemFieldValue"
      },
      "fields": {
        "$ref": "#/components/schemas/ItemFields"
      },
      "id": {
        "type": "string"
      },
      "key": {
        "type": "number"
      },
      "place": {
        "$ref": "#/components/schemas/ItemPlace"
      },
      "type": {
        "type": "string"
      },
      "votes": {
        "additionalProperties": {
          "type": "number"
        },
        "type": "object"
      }
    },
    "required": [
      "type",
      "fields"
    ],
    "type": "object"
  },
  "ItemFieldValue": {
    "anyOf": [
      {
        "type": "string"
      },
      {
        "type": "number"
      },
      {
        "type": "boolean"
      },
      {
        "type": "null"
      },
      {
        "items": {
          "$ref": "#/components/schemas/ItemFieldValue"
        },
        "type": "array"
      },
      {
        "additionalProperties": {
          "$ref": "#/components/schemas/ItemFieldValue"
        },
        "type": "object"
      }
    ]
  },
  "ItemFields": {
    "additionalProperties": {
      "$ref": "#/components/schemas/ItemFieldValue"
    },
    "type": "object"
  },
  "ItemMoveRequest": {
    "additionalProperties": false,
    "properties": {
      "after": {
        "type": [
          "string",
          "null"
        ]
      },
      "before": {
        "type": [
          "string",
          "null"
        ]
      },
      "clear": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "set": {
        "$ref": "#/components/schemas/ItemFields"
      },
      "status": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "undo": {
        "const": true,
        "description": "Marks an undo or redo of an earlier change: lets it restore a status the card's type leaves out.",
        "type": "boolean"
      }
    },
    "type": "object"
  },
  "ItemPatchRequest": {
    "additionalProperties": false,
    "properties": {
      "clear": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "set": {
        "$ref": "#/components/schemas/ItemFields"
      },
      "type": {
        "type": "string"
      },
      "undo": {
        "const": true,
        "description": "Marks an undo or redo of an earlier change: lets it restore a status the card's type leaves out.",
        "type": "boolean"
      }
    },
    "type": "object"
  },
  "ItemPerson": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "color"
    ],
    "type": "object"
  },
  "ItemPlace": {
    "additionalProperties": false,
    "properties": {
      "after": {
        "type": [
          "string",
          "null"
        ]
      },
      "before": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": "string"
      }
    },
    "type": "object"
  },
  "ItemResponse": {
    "additionalProperties": false,
    "properties": {
      "item": {
        "$ref": "#/components/schemas/Item"
      },
      "rev": {
        "type": "number"
      }
    },
    "required": [
      "item",
      "rev"
    ],
    "type": "object"
  },
  "ItemTypeCatalogue": {
    "additionalProperties": false,
    "properties": {
      "types": {
        "items": {
          "$ref": "#/components/schemas/ItemTypeDef"
        },
        "type": "array"
      },
      "version": {
        "type": "number"
      }
    },
    "required": [
      "version",
      "types"
    ],
    "type": "object"
  },
  "ItemTypeDef": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "custom": {
        "items": {
          "$ref": "#/components/schemas/CustomFieldDef"
        },
        "type": "array"
      },
      "defaultStatus": {
        "type": "string"
      },
      "detailsLabel": {
        "type": "string"
      },
      "display": {
        "additionalProperties": false,
        "properties": {
          "compact": {
            "additionalProperties": false,
            "properties": {
              "body": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "foot": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "footEnd": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "head": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "headEnd": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "lead": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "row": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "trail": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              }
            },
            "type": "object"
          },
          "detailed": {
            "additionalProperties": false,
            "properties": {
              "body": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "foot": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "footEnd": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "head": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "headEnd": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "lead": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "row": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "trail": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              }
            },
            "type": "object"
          },
          "minimal": {
            "additionalProperties": false,
            "properties": {
              "body": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "foot": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "footEnd": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "head": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "headEnd": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "lead": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "row": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              },
              "trail": {
                "items": {
                  "$ref": "#/components/schemas/CardField"
                },
                "type": "array"
              }
            },
            "type": "object"
          }
        },
        "type": "object"
      },
      "excludedStatuses": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "fields": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "glyph": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/PlanGlyphId"
          },
          {
            "type": "string"
          }
        ]
      },
      "id": {
        "type": "string"
      },
      "label": {
        "type": "string"
      },
      "newTitle": {
        "type": "string"
      },
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/ItemTypeTab"
        },
        "type": "array"
      }
    },
    "required": [
      "id",
      "label",
      "newTitle",
      "glyph",
      "color",
      "fields"
    ],
    "type": "object"
  },
  "ItemTypeTab": {
    "additionalProperties": false,
    "properties": {
      "fields": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "id": {
        "type": "string"
      },
      "label": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "label",
      "fields"
    ],
    "type": "object"
  },
  "ItemTypesRequest": {
    "additionalProperties": false,
    "properties": {
      "expectedRev": {
        "type": "number"
      },
      "itemTypes": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ItemTypeCatalogue"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "itemTypes"
    ],
    "type": "object"
  },
  "ItemTypesResponse": {
    "additionalProperties": false,
    "properties": {
      "itemTypes": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ItemTypeCatalogue"
          },
          {
            "type": "null"
          }
        ]
      },
      "itemTypesRev": {
        "type": "number"
      }
    },
    "required": [
      "itemTypes",
      "itemTypesRev"
    ],
    "type": "object"
  },
  "ItemsBulkRequest": {
    "additionalProperties": false,
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/ItemCreate"
        },
        "type": "array"
      }
    },
    "required": [
      "items"
    ],
    "type": "object"
  },
  "ItemsPatchRequest": {
    "additionalProperties": false,
    "properties": {
      "items": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "clear": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "id": {
              "type": "string"
            },
            "set": {
              "$ref": "#/components/schemas/ItemFields"
            },
            "type": {
              "type": "string"
            }
          },
          "required": [
            "id"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "undo": {
        "const": true,
        "description": "Marks an undo or redo of an earlier change: lets it restore a status the card's type leaves out.",
        "type": "boolean"
      }
    },
    "required": [
      "items"
    ],
    "type": "object"
  },
  "ItemsResponse": {
    "additionalProperties": false,
    "properties": {
      "items": {
        "items": {
          "$ref": "#/components/schemas/Item"
        },
        "type": "array"
      },
      "rev": {
        "type": "number"
      }
    },
    "required": [
      "items",
      "rev"
    ],
    "type": "object"
  },
  "ItemsTallyRequest": {
    "additionalProperties": false,
    "properties": {
      "items": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string"
            },
            "votes": {
              "additionalProperties": {
                "type": "number"
              },
              "type": "object"
            }
          },
          "required": [
            "id",
            "votes"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "items"
    ],
    "type": "object"
  },
  "JsonValue": {
    "anyOf": [
      {
        "type": "string"
      },
      {
        "type": "number"
      },
      {
        "type": "boolean"
      },
      {
        "type": "null"
      },
      {
        "items": {
          "$ref": "#/components/schemas/JsonValue"
        },
        "type": "array"
      },
      {
        "additionalProperties": {
          "$ref": "#/components/schemas/JsonValue"
        },
        "type": "object"
      }
    ]
  },
  "KnownTimelineEventType": {
    "enum": [
      "document_created",
      "document_renamed",
      "document_duplicated",
      "document_moved",
      "document_edited",
      "document_offline",
      "document_synced",
      "document_opened_by_visitor",
      "document_copied_by_visitor",
      "folder_created",
      "folder_deleted",
      "comment_added",
      "comment_resolved",
      "action_assigned",
      "action_completed",
      "share_link_created",
      "share_link_expiring",
      "team_created",
      "team_invite_received",
      "team_invite_accepted",
      "team_invite_declined",
      "team_member_joined",
      "team_member_left",
      "team_member_removed",
      "team_role_changed",
      "team_document_added",
      "team_document_removed",
      "team_renamed",
      "team_deleted",
      "team_invite_link_enabled",
      "team_invite_link_disabled",
      "token_created",
      "token_revoked",
      "token_expiring",
      "theme_saved",
      "theme_deleted",
      "image_uploaded"
    ],
    "type": "string"
  },
  "Layer": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "locked": {
        "type": "boolean"
      },
      "name": {
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "visible": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "name"
    ],
    "type": "object"
  },
  "LayoutChange": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "after": {
            "type": [
              "string",
              "null"
            ]
          },
          "ids": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "k": {
            "enum": [
              "insertRows",
              "insertCols"
            ],
            "type": "string"
          }
        },
        "required": [
          "k",
          "after",
          "ids"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "ids": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "k": {
            "enum": [
              "deleteRows",
              "deleteCols"
            ],
            "type": "string"
          }
        },
        "required": [
          "k",
          "ids"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "after": {
            "type": [
              "string",
              "null"
            ]
          },
          "ids": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "k": {
            "enum": [
              "moveRows",
              "moveCols"
            ],
            "type": "string"
          }
        },
        "required": [
          "k",
          "ids",
          "after"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "ids": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "k": {
            "enum": [
              "orderRows",
              "orderCols"
            ],
            "type": "string"
          }
        },
        "required": [
          "k",
          "ids"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "axis": {
            "$ref": "#/components/schemas/Axis"
          },
          "ids": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "k": {
            "const": "size",
            "type": "string"
          },
          "px": {
            "type": [
              "number",
              "null"
            ]
          }
        },
        "required": [
          "k",
          "axis",
          "ids",
          "px"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "axis": {
            "$ref": "#/components/schemas/Axis"
          },
          "hidden": {
            "type": "boolean"
          },
          "ids": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "k": {
            "const": "hide",
            "type": "string"
          }
        },
        "required": [
          "k",
          "axis",
          "ids",
          "hidden"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "cols": {
            "type": "number"
          },
          "k": {
            "const": "freeze",
            "type": "string"
          },
          "rows": {
            "type": "number"
          }
        },
        "required": [
          "k"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "k": {
            "const": "merge",
            "type": "string"
          },
          "range": {
            "$ref": "#/components/schemas/IdRange"
          }
        },
        "required": [
          "k",
          "range"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "k": {
            "const": "unmerge",
            "type": "string"
          },
          "range": {
            "$ref": "#/components/schemas/IdRange"
          }
        },
        "required": [
          "k",
          "range"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "k": {
            "const": "merges",
            "type": "string"
          },
          "merges": {
            "items": {
              "$ref": "#/components/schemas/IdRange"
            },
            "type": "array"
          }
        },
        "required": [
          "k",
          "merges"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "filter": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/SheetFilter"
              },
              {
                "type": "null"
              }
            ]
          },
          "k": {
            "const": "filter",
            "type": "string"
          }
        },
        "required": [
          "k",
          "filter"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "col": {
            "type": "string"
          },
          "cond": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/FilterCondition"
              },
              {
                "type": "null"
              }
            ]
          },
          "k": {
            "const": "filterCond",
            "type": "string"
          }
        },
        "required": [
          "k",
          "col",
          "cond"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "colWidth": {
            "type": [
              "number",
              "null"
            ]
          },
          "k": {
            "const": "options",
            "type": "string"
          },
          "rowHeight": {
            "type": [
              "number",
              "null"
            ]
          },
          "setupPending": {
            "type": "boolean"
          },
          "showGrid": {
            "type": "boolean"
          },
          "showHeaders": {
            "type": "boolean"
          }
        },
        "required": [
          "k"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "k": {
            "const": "cardTable",
            "type": "string"
          },
          "table": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/CardTable"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "k",
          "id",
          "table"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "k": {
            "const": "name",
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "range": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/IdRange"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "k",
          "name",
          "range"
        ],
        "type": "object"
      }
    ]
  },
  "LayoutView": {
    "additionalProperties": false,
    "properties": {
      "arrows": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "from": {
              "type": "string"
            },
            "ref": {
              "type": "string"
            },
            "style": {
              "type": "string"
            },
            "to": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "from",
            "to",
            "style"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "boxes": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "h": {
              "type": "number"
            },
            "r": {
              "type": "number"
            },
            "ref": {
              "type": "string"
            },
            "w": {
              "type": "number"
            },
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            }
          },
          "required": [
            "ref",
            "x",
            "y",
            "w",
            "h",
            "r"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "origin": {
        "additionalProperties": false,
        "properties": {
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          }
        },
        "required": [
          "x",
          "y"
        ],
        "type": "object"
      },
      "rows": {
        "anyOf": [
          {
            "items": {
              "additionalProperties": false,
              "properties": {
                "container": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "rows": {
                  "items": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  },
                  "type": "array"
                }
              },
              "required": [
                "container",
                "rows"
              ],
              "type": "object"
            },
            "type": "array"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "header",
      "origin",
      "boxes",
      "arrows",
      "rows",
      "elision"
    ],
    "type": "object"
  },
  "LegendItem": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "label": {
        "type": "string"
      }
    },
    "required": [
      "label"
    ],
    "type": "object"
  },
  "LineSeries": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "values": {
        "items": {
          "type": "number"
        },
        "type": "array"
      }
    },
    "required": [
      "name",
      "values"
    ],
    "type": "object"
  },
  "LinkCardElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "meta": {
        "$ref": "#/components/schemas/LinkCardMeta"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "link-card",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "LinkCardMeta": {
    "additionalProperties": false,
    "properties": {
      "favicon": {
        "type": "string"
      },
      "image": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    },
    "required": [
      "url"
    ],
    "type": "object"
  },
  "LintCode": {
    "enum": [
      "box-overlap",
      "arrow-dangling",
      "arrow-behind-box",
      "edge-crossings",
      "label-collision",
      "label-overflow",
      "node-isolated",
      "group-escape",
      "group-split-edges",
      "duplicate-label",
      "flow-backwards",
      "aspect-extreme",
      "colour-on-themed"
    ],
    "type": "string"
  },
  "LintFinding": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "$ref": "#/components/schemas/LintCode"
      },
      "fix": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "refs": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "severity": {
        "$ref": "#/components/schemas/LintSeverity"
      }
    },
    "required": [
      "code",
      "severity",
      "refs",
      "message",
      "fix"
    ],
    "type": "object"
  },
  "LintMeasures": {
    "additionalProperties": false,
    "properties": {
      "arrows": {
        "type": "number"
      },
      "behind": {
        "type": "number"
      },
      "boxes": {
        "type": "number"
      },
      "crossings": {
        "type": [
          "number",
          "null"
        ]
      },
      "extent": {
        "anyOf": [
          {
            "additionalProperties": false,
            "properties": {
              "height": {
                "type": "number"
              },
              "width": {
                "type": "number"
              }
            },
            "required": [
              "width",
              "height"
            ],
            "type": "object"
          },
          {
            "type": "null"
          }
        ]
      },
      "overlaps": {
        "type": "number"
      }
    },
    "required": [
      "crossings",
      "behind",
      "overlaps",
      "extent",
      "arrows",
      "boxes"
    ],
    "type": "object"
  },
  "LintReport": {
    "additionalProperties": false,
    "properties": {
      "counts": {
        "additionalProperties": false,
        "properties": {
          "error": {
            "type": "number"
          },
          "info": {
            "type": "number"
          },
          "warning": {
            "type": "number"
          }
        },
        "required": [
          "error",
          "warning",
          "info"
        ],
        "type": "object"
      },
      "findings": {
        "items": {
          "$ref": "#/components/schemas/LintFinding"
        },
        "type": "array"
      },
      "measures": {
        "$ref": "#/components/schemas/LintMeasures"
      },
      "skipped": {
        "additionalProperties": false,
        "properties": {
          "crossings": {
            "type": "boolean"
          }
        },
        "required": [
          "crossings"
        ],
        "type": "object"
      }
    },
    "required": [
      "measures",
      "findings",
      "counts",
      "skipped"
    ],
    "type": "object"
  },
  "LintSeverity": {
    "enum": [
      "error",
      "warning",
      "info"
    ],
    "type": "string"
  },
  "MediaAnimation": {
    "enum": [
      "kenburns",
      "zoom",
      "pan",
      "tilt",
      "develop",
      "focus",
      "wipe",
      "iris",
      "sheen"
    ],
    "type": "string"
  },
  "MindFlow": {
    "enum": [
      "tree",
      "balanced",
      "downward",
      "bubble"
    ],
    "type": "string"
  },
  "NoteCrop": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "number"
      },
      "image": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "image"
    ],
    "type": "object"
  },
  "NoteText": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "number"
      },
      "legible": {
        "type": "boolean"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "text",
      "legible"
    ],
    "type": "object"
  },
  "NumberFormatKind": {
    "enum": [
      "auto",
      "number",
      "percent",
      "currency",
      "accounting",
      "scientific",
      "date",
      "time",
      "datetime",
      "duration",
      "text"
    ],
    "type": "string"
  },
  "OutlineNode": {
    "additionalProperties": false,
    "properties": {
      "attributes": {
        "items": {
          "$ref": "#/components/schemas/ViewAttributeJson"
        },
        "type": "array"
      },
      "children": {
        "items": {
          "anyOf": [
            {
              "$ref": "#/components/schemas/OutlineNode"
            },
            {
              "$ref": "#/components/schemas/FreehandRunJson"
            }
          ]
        },
        "type": "array"
      },
      "collapsed": {
        "type": "number"
      },
      "edges": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "id": {
        "type": "string"
      },
      "kind": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      },
      "summary": {
        "type": [
          "string",
          "null"
        ]
      },
      "unknown": {
        "type": "boolean"
      }
    },
    "required": [
      "ref",
      "id",
      "kind",
      "unknown",
      "label",
      "summary",
      "attributes",
      "edges",
      "children",
      "collapsed"
    ],
    "type": "object"
  },
  "OutlineView": {
    "additionalProperties": false,
    "properties": {
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "nodes": {
        "items": {
          "anyOf": [
            {
              "$ref": "#/components/schemas/OutlineNode"
            },
            {
              "$ref": "#/components/schemas/FreehandRunJson"
            }
          ]
        },
        "type": "array"
      },
      "ownLineArrows": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "nodes",
      "ownLineArrows",
      "elision"
    ],
    "type": "object"
  },
  "OverviewTab": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "outOfScope": {
            "const": true,
            "type": "boolean"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "outOfScope",
          "ref"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "counts": {
            "additionalProperties": false,
            "properties": {
              "arrows": {
                "type": "number"
              },
              "boxes": {
                "type": "number"
              },
              "frames": {
                "type": "number"
              },
              "lanes": {
                "type": "number"
              }
            },
            "required": [
              "boxes",
              "frames",
              "lanes",
              "arrows"
            ],
            "type": "object"
          },
          "elements": {
            "type": "number"
          },
          "hidden": {
            "type": "number"
          },
          "outOfScope": {
            "const": false,
            "type": "boolean"
          },
          "rev": {
            "type": [
              "number",
              "null"
            ]
          },
          "tab": {
            "additionalProperties": false,
            "properties": {
              "id": {
                "type": "string"
              },
              "kind": {
                "$ref": "#/components/schemas/TabKind"
              },
              "name": {
                "type": "string"
              },
              "ref": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "ref",
              "name",
              "kind"
            ],
            "type": "object"
          },
          "threads": {
            "additionalProperties": false,
            "properties": {
              "open": {
                "type": "number"
              },
              "total": {
                "type": "number"
              }
            },
            "required": [
              "open",
              "total"
            ],
            "type": "object"
          },
          "unknown": {
            "type": "number"
          },
          "view": {
            "$ref": "#/components/schemas/ViewName"
          }
        },
        "required": [
          "counts",
          "elements",
          "hidden",
          "outOfScope",
          "rev",
          "tab",
          "threads",
          "unknown",
          "view"
        ],
        "type": "object"
      }
    ]
  },
  "OverviewView": {
    "additionalProperties": false,
    "properties": {
      "document": {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "savedAt": {
            "type": "number"
          },
          "tabs": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "name",
          "savedAt",
          "tabs"
        ],
        "type": "object"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/OverviewTab"
        },
        "type": "array"
      }
    },
    "required": [
      "document",
      "tabs",
      "elision"
    ],
    "type": "object"
  },
  "Padding": {
    "enum": [
      "none",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "PageBackground": {
    "additionalProperties": false,
    "properties": {
      "fill": {
        "$ref": "#/components/schemas/PageFill"
      },
      "pattern": {
        "$ref": "#/components/schemas/PagePattern"
      }
    },
    "type": "object"
  },
  "PageFill": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "color": {
            "type": "string"
          },
          "kind": {
            "const": "solid",
            "type": "string"
          }
        },
        "required": [
          "kind",
          "color"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "angle": {
            "type": "number"
          },
          "from": {
            "type": "string"
          },
          "kind": {
            "const": "gradient",
            "type": "string"
          },
          "to": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "from",
          "to",
          "angle"
        ],
        "type": "object"
      }
    ]
  },
  "PageKind": {
    "enum": [
      "infographic",
      "article",
      "slide",
      "logo"
    ],
    "type": "string"
  },
  "PageOrientation": {
    "enum": [
      "portrait",
      "landscape"
    ],
    "type": "string"
  },
  "PagePattern": {
    "enum": [
      "dots",
      "grid",
      "lines"
    ],
    "type": "string"
  },
  "PageSides": {
    "additionalProperties": false,
    "properties": {
      "height": {
        "type": "number"
      },
      "width": {
        "type": "number"
      }
    },
    "required": [
      "width",
      "height"
    ],
    "type": "object"
  },
  "PageSizeId": {
    "enum": [
      "a4",
      "letter",
      "a3",
      "square",
      "social",
      "wide",
      "slide",
      "slide-classic",
      "logo",
      "fit"
    ],
    "type": "string"
  },
  "PairingRequestStatus": {
    "enum": [
      "pending",
      "approved",
      "declined",
      "expired"
    ],
    "type": "string"
  },
  "ParticipantRecord": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "pictureUrl": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "color",
      "createdAt",
      "pictureUrl"
    ],
    "type": "object"
  },
  "ParticipantResponse": {
    "additionalProperties": false,
    "properties": {
      "at": {
        "type": "number"
      },
      "participantId": {
        "type": "string"
      },
      "value": {
        "type": "string"
      }
    },
    "required": [
      "participantId",
      "value",
      "at"
    ],
    "type": "object"
  },
  "PathElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "closed": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "fillSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "font": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "nodes": {
        "items": {
          "$ref": "#/components/schemas/PathNode"
        },
        "type": "array"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "penColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "rotation": {
        "type": "number"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "subpaths": {
        "items": {
          "items": {
            "$ref": "#/components/schemas/PathNode"
          },
          "type": "array"
        },
        "type": "array"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "path",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height",
      "nodes",
      "closed"
    ],
    "type": "object"
  },
  "PathHandleMode": {
    "enum": [
      "corner",
      "mirrored",
      "aligned"
    ],
    "type": "string"
  },
  "PathNode": {
    "additionalProperties": false,
    "properties": {
      "handleIn": {
        "$ref": "#/components/schemas/PathPoint"
      },
      "handleOut": {
        "$ref": "#/components/schemas/PathPoint"
      },
      "mode": {
        "$ref": "#/components/schemas/PathHandleMode"
      },
      "nx": {
        "type": "number"
      },
      "ny": {
        "type": "number"
      }
    },
    "required": [
      "mode",
      "nx",
      "ny"
    ],
    "type": "object"
  },
  "PathPoint": {
    "additionalProperties": false,
    "properties": {
      "nx": {
        "type": "number"
      },
      "ny": {
        "type": "number"
      }
    },
    "required": [
      "nx",
      "ny"
    ],
    "type": "object"
  },
  "PenColourName": {
    "anyOf": [
      {
        "const": "ink",
        "type": "string"
      },
      {
        "const": "grey",
        "type": "string"
      },
      {
        "$ref": "#/components/schemas/HuedPenColourName"
      }
    ]
  },
  "PickerSource": {
    "enum": [
      "participants",
      "options"
    ],
    "type": "string"
  },
  "PieAnim": {
    "enum": [
      "grow",
      "pop",
      "spin",
      "pulse"
    ],
    "type": "string"
  },
  "PieSlice": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "label": {
        "type": "string"
      },
      "value": {
        "type": "number"
      }
    },
    "required": [
      "label",
      "value"
    ],
    "type": "object"
  },
  "PlanBoardKind": {
    "enum": [
      "board",
      "all-cards",
      "archive"
    ],
    "type": "string"
  },
  "PlanBoardOutline": {
    "additionalProperties": false,
    "properties": {
      "columns": {
        "items": {
          "$ref": "#/components/schemas/PlanColumnOutline"
        },
        "type": "array"
      },
      "elementId": {
        "type": "string"
      },
      "kind": {
        "$ref": "#/components/schemas/PlanBoardKind"
      },
      "tabId": {
        "type": "string"
      },
      "tabName": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "types": {
        "anyOf": [
          {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "tabId",
      "tabName",
      "elementId",
      "title",
      "kind",
      "types",
      "columns"
    ],
    "type": "object"
  },
  "PlanBoardSetup": {
    "additionalProperties": false,
    "properties": {
      "addTypes": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "allCards": {
        "type": "boolean"
      },
      "archive": {
        "type": "boolean"
      },
      "cardFields": {
        "items": {
          "$ref": "#/components/schemas/CardField"
        },
        "type": "array"
      },
      "cardSize": {
        "$ref": "#/components/schemas/CardSize"
      },
      "columns": {
        "items": {
          "$ref": "#/components/schemas/PlanColumn"
        },
        "type": "array"
      },
      "doneColumnId": {
        "type": "string"
      },
      "fillTab": {
        "type": "boolean"
      },
      "hideWriting": {
        "type": "boolean"
      },
      "swimlaneBy": {
        "$ref": "#/components/schemas/SwimlaneBy"
      },
      "swimlaneField": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "widgets": {
        "items": {
          "$ref": "#/components/schemas/BoardWidgetKind"
        },
        "type": "array"
      }
    },
    "required": [
      "title",
      "columns",
      "swimlaneBy",
      "cardFields",
      "hideWriting"
    ],
    "type": "object"
  },
  "PlanCardRef": {
    "additionalProperties": false,
    "properties": {
      "itemId": {
        "type": "string"
      },
      "size": {
        "enum": [
          "minimal",
          "compact",
          "detailed"
        ],
        "type": "string"
      }
    },
    "required": [
      "itemId"
    ],
    "type": "object"
  },
  "PlanColumn": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "status": {
        "type": "string"
      },
      "width": {
        "$ref": "#/components/schemas/ColumnWidth"
      },
      "wipLimit": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "status",
      "name"
    ],
    "type": "object"
  },
  "PlanColumnOutline": {
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "status": {
        "type": "string"
      },
      "wipLimit": {
        "type": "number"
      }
    },
    "required": [
      "status",
      "name"
    ],
    "type": "object"
  },
  "PlanGlyphId": {
    "enum": [
      "task",
      "story",
      "bug",
      "project",
      "action",
      "epic",
      "milestone",
      "release",
      "ticket",
      "kanban",
      "checklist",
      "inbox",
      "person",
      "team",
      "user-plus",
      "user-check",
      "contact",
      "crown",
      "chat",
      "mail",
      "phone",
      "megaphone",
      "bell",
      "send",
      "video",
      "at",
      "calendar",
      "flag",
      "clock",
      "target",
      "pin",
      "hourglass",
      "repeat",
      "note",
      "idea",
      "bookmark",
      "book",
      "document",
      "pencil",
      "lightbulb",
      "puzzle",
      "quote",
      "star",
      "heart",
      "risk",
      "shield",
      "lock",
      "eye",
      "fire",
      "sparkle",
      "info",
      "question",
      "ban",
      "trophy",
      "coin",
      "chart",
      "trend",
      "briefcase",
      "cart",
      "building",
      "percent",
      "wallet",
      "cube",
      "gift",
      "wrench",
      "code",
      "laptop",
      "database",
      "cloud",
      "globe",
      "home",
      "key",
      "leaf",
      "link"
    ],
    "type": "string"
  },
  "PlanResponse": {
    "additionalProperties": false,
    "properties": {
      "boards": {
        "items": {
          "$ref": "#/components/schemas/PlanBoardOutline"
        },
        "type": "array"
      },
      "itemTypesRev": {
        "type": "number"
      },
      "statuses": {
        "items": {
          "$ref": "#/components/schemas/PlanStatusName"
        },
        "type": "array"
      },
      "types": {
        "items": {
          "$ref": "#/components/schemas/ItemTypeDef"
        },
        "type": "array"
      }
    },
    "required": [
      "boards",
      "statuses",
      "types",
      "itemTypesRev"
    ],
    "type": "object"
  },
  "PlanSheetRef": {
    "additionalProperties": false,
    "properties": {
      "copyOf": {
        "type": "string"
      },
      "fillTab": {
        "const": true,
        "type": "boolean"
      },
      "sheetId": {
        "type": "string"
      }
    },
    "required": [
      "sheetId"
    ],
    "type": "object"
  },
  "PlanStatusName": {
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "status": {
        "type": "string"
      }
    },
    "required": [
      "status",
      "name"
    ],
    "type": "object"
  },
  "PlanViewId": {
    "anyOf": [
      {
        "const": "metric:count",
        "type": "string"
      },
      {
        "const": "metric:progress",
        "type": "string"
      },
      {
        "const": "metric:people",
        "type": "string"
      },
      {
        "const": "metric:types",
        "type": "string"
      },
      {
        "const": "metric:priorities",
        "type": "string"
      },
      {
        "const": "metric:due",
        "type": "string"
      },
      {
        "const": "metric:unassigned",
        "type": "string"
      },
      {
        "const": "metric:points",
        "type": "string"
      },
      {
        "const": "metric:top-voted",
        "type": "string"
      },
      {
        "const": "metric:stale",
        "type": "string"
      },
      {
        "$ref": "#/components/schemas/PlanVisualisation"
      }
    ]
  },
  "PlanViewRef": {
    "additionalProperties": false,
    "properties": {
      "filters": {
        "items": {
          "$ref": "#/components/schemas/CardSearchFilter"
        },
        "type": "array"
      },
      "namesWidth": {
        "type": "number"
      },
      "rowOrder": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "swimlaneBy": {
        "$ref": "#/components/schemas/SwimlaneBy"
      },
      "swimlaneField": {
        "type": "string"
      },
      "types": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "view": {
        "$ref": "#/components/schemas/PlanViewId"
      }
    },
    "required": [
      "view"
    ],
    "type": "object"
  },
  "PlanVisualisation": {
    "enum": [
      "gantt",
      "calendar",
      "workload",
      "status-mix",
      "priority-matrix",
      "search"
    ],
    "type": "string"
  },
  "PollStyle": {
    "enum": [
      "yesNo",
      "yesNoAbstain",
      "choice",
      "collaborators",
      "rating",
      "text"
    ],
    "type": "string"
  },
  "ProgressAnim": {
    "enum": [
      "fill",
      "pulse",
      "stripes"
    ],
    "type": "string"
  },
  "QaNote": {
    "additionalProperties": false,
    "properties": {
      "at": {
        "type": "number"
      },
      "author": {
        "additionalProperties": false,
        "properties": {
          "color": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "color"
        ],
        "type": "object"
      },
      "doneAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "state": {
        "$ref": "#/components/schemas/QaNoteState"
      },
      "text": {
        "type": "string"
      },
      "voters": {
        "items": {
          "type": "string"
        },
        "type": "array"
      }
    },
    "required": [
      "id",
      "text",
      "at",
      "voters"
    ],
    "type": "object"
  },
  "QaNoteState": {
    "enum": [
      "discussing",
      "done"
    ],
    "type": "string"
  },
  "QuickSwatchSlot": {
    "enum": [
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "type": "number"
  },
  "RangeName": {
    "additionalProperties": false,
    "properties": {
      "c1": {
        "type": "string"
      },
      "c2": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "r1": {
        "type": "string"
      },
      "r2": {
        "type": "string"
      }
    },
    "required": [
      "c1",
      "c2",
      "name",
      "r1",
      "r2"
    ],
    "type": "object"
  },
  "RatingAnim": {
    "enum": [
      "pop",
      "twinkle",
      "pulse",
      "rock"
    ],
    "type": "string"
  },
  "Reaction": {
    "enum": [
      "confetti",
      "sparkles",
      "hearts",
      "applause",
      "fireworks"
    ],
    "type": "string"
  },
  "ReadNotesRequest": {
    "additionalProperties": false,
    "properties": {
      "crops": {
        "items": {
          "$ref": "#/components/schemas/NoteCrop"
        },
        "type": "array"
      }
    },
    "required": [
      "crops"
    ],
    "type": "object"
  },
  "ReadNotesResponse": {
    "additionalProperties": false,
    "properties": {
      "texts": {
        "items": {
          "$ref": "#/components/schemas/NoteText"
        },
        "type": "array"
      }
    },
    "required": [
      "texts"
    ],
    "type": "object"
  },
  "RefCandidate": {
    "additionalProperties": false,
    "properties": {
      "kind": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      }
    },
    "required": [
      "ref",
      "kind",
      "label"
    ],
    "type": "object"
  },
  "RefErrorBody": {
    "additionalProperties": false,
    "properties": {
      "candidates": {
        "items": {
          "$ref": "#/components/schemas/RefCandidate"
        },
        "type": "array"
      },
      "error": {
        "enum": [
          "target_not_found",
          "target_ambiguous"
        ],
        "type": "string"
      },
      "input": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "stale": {
        "type": "boolean"
      }
    },
    "required": [
      "error",
      "message",
      "input",
      "candidates",
      "stale"
    ],
    "type": "object"
  },
  "ResultLine": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "at": {
            "items": {
              "type": "number"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "ends": {
            "items": {
              "type": "string"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "kind": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "mark": {
            "const": "+",
            "type": "string"
          },
          "ref": {
            "type": "string"
          },
          "size": {
            "items": {
              "type": "number"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "styleOf": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "kind"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "changes": {
            "items": {
              "$ref": "#/components/schemas/FieldChange"
            },
            "type": "array"
          },
          "mark": {
            "const": "~",
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "changes"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "ends": {
            "items": {
              "type": "string"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "kind": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "mark": {
            "const": "-",
            "type": "string"
          },
          "pinnedTo": {
            "type": "string"
          },
          "reason": {
            "enum": [
              "pinned",
              "unwrapped"
            ],
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "kind"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "delta": {
            "items": {
              "type": "number"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "layout": {
            "additionalProperties": false,
            "properties": {
              "direction": {
                "enum": [
                  "down",
                  "right"
                ],
                "type": "string"
              },
              "style": {
                "enum": [
                  "flow",
                  "tree",
                  "mindmap"
                ],
                "type": "string"
              }
            },
            "required": [
              "style"
            ],
            "type": "object"
          },
          "mark": {
            "const": "»",
            "type": "string"
          },
          "reason": {
            "enum": [
              "make room",
              "carried",
              "laid out",
              "landed on a lane"
            ],
            "type": "string"
          },
          "refs": {
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        },
        "required": [
          "mark",
          "refs",
          "reason"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "joined": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "left": {
            "items": {
              "type": "string"
            },
            "type": "array"
          },
          "mark": {
            "const": "container",
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "joined",
          "left"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "mark": {
            "const": "!",
            "type": "string"
          },
          "warning": {
            "$ref": "#/components/schemas/EditWarning"
          }
        },
        "required": [
          "mark",
          "warning"
        ],
        "type": "object"
      }
    ]
  },
  "RevertKept": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "reason": {
        "enum": [
          "changed",
          "gone",
          "present",
          "order"
        ],
        "type": "string"
      }
    },
    "required": [
      "id",
      "reason"
    ],
    "type": "object"
  },
  "RevertResponse": {
    "additionalProperties": false,
    "properties": {
      "changeset": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ChangesetWritten"
          },
          {
            "type": "null"
          }
        ]
      },
      "kept": {
        "items": {
          "$ref": "#/components/schemas/RevertKept"
        },
        "type": "array"
      },
      "lint": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/LintReport"
          },
          {
            "type": "null"
          }
        ]
      },
      "reverted": {
        "type": "number"
      }
    },
    "required": [
      "changeset",
      "reverted",
      "kept",
      "lint"
    ],
    "type": "object"
  },
  "RollCallEntry": {
    "additionalProperties": false,
    "properties": {
      "at": {
        "type": "number"
      },
      "color": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "color",
      "at"
    ],
    "type": "object"
  },
  "RowAt": {
    "additionalProperties": false,
    "properties": {
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "x",
      "y"
    ],
    "type": "object"
  },
  "RunHeading": {
    "enum": [
      1,
      2,
      3
    ],
    "type": "number"
  },
  "RunSize": {
    "enum": [
      "xs",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "SelectionMode": {
    "enum": [
      "select",
      "pan",
      "laser",
      "spotlight",
      "avatar",
      "eraser",
      "format",
      "isometric"
    ],
    "type": "string"
  },
  "SessionButtonConfig": {
    "additionalProperties": false,
    "properties": {
      "dots": {
        "type": "number"
      },
      "minutes": {
        "type": "number"
      },
      "options": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "question": {
        "type": "string"
      },
      "style": {
        "$ref": "#/components/schemas/PollStyle"
      },
      "tool": {
        "$ref": "#/components/schemas/SessionTool"
      }
    },
    "required": [
      "tool"
    ],
    "type": "object"
  },
  "SessionTool": {
    "enum": [
      "timer",
      "stopwatch",
      "vote",
      "poll"
    ],
    "type": "string"
  },
  "ShapeAnimation": {
    "enum": [
      "pulse",
      "blink",
      "glow",
      "trace",
      "gradient",
      "heartbeat",
      "breathe",
      "shimmer",
      "highlight",
      "bounce",
      "wobble",
      "shake",
      "jelly",
      "float",
      "swing"
    ],
    "type": "string"
  },
  "ShapeElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "actions": {
        "items": {
          "$ref": "#/components/schemas/ElementAction"
        },
        "type": "array"
      },
      "agendaCurrent": {
        "type": "number"
      },
      "agendaItems": {
        "items": {
          "$ref": "#/components/schemas/AgendaItem"
        },
        "type": "array"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "chairFacing": {
        "$ref": "#/components/schemas/ChairFacing"
      },
      "chartLegend": {
        "type": "boolean"
      },
      "chartLegendPosition": {
        "$ref": "#/components/schemas/ChartLegendPosition"
      },
      "chartPalette": {
        "$ref": "#/components/schemas/ChartPaletteId"
      },
      "chartSource": {
        "$ref": "#/components/schemas/ChartSource"
      },
      "checklistItems": {
        "items": {
          "$ref": "#/components/schemas/ChecklistItem"
        },
        "type": "array"
      },
      "code": {
        "type": "string"
      },
      "codeLanguage": {
        "$ref": "#/components/schemas/CodeLanguage"
      },
      "codeTheme": {
        "$ref": "#/components/schemas/CodeThemeId"
      },
      "codeWrap": {
        "type": "boolean"
      },
      "collabRound": {
        "type": "string"
      },
      "colorPreset": {
        "type": "string"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "decisionDate": {
        "type": "string"
      },
      "decisionDrivers": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "decisionStatus": {
        "$ref": "#/components/schemas/DecisionStatus"
      },
      "entityFields": {
        "items": {
          "$ref": "#/components/schemas/EntityField"
        },
        "type": "array"
      },
      "estimateScale": {
        "$ref": "#/components/schemas/EstimateScale"
      },
      "fillColor": {
        "type": "string"
      },
      "fillSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "fixedSize": {
        "type": "boolean"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "headerSize": {
        "type": "number"
      },
      "height": {
        "type": "number"
      },
      "iconAnimation": {
        "$ref": "#/components/schemas/IconAnimation"
      },
      "iconAnimationRepeat": {
        "type": "boolean"
      },
      "iconAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "iconId": {
        "type": "string"
      },
      "iconPosition": {
        "$ref": "#/components/schemas/IconPosition"
      },
      "iconSize": {
        "$ref": "#/components/schemas/IconSize"
      },
      "iconWeight": {
        "$ref": "#/components/schemas/IconWeight"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "ideaCards": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "ideasRevealed": {
        "type": "boolean"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "legendItems": {
        "items": {
          "$ref": "#/components/schemas/LegendItem"
        },
        "type": "array"
      },
      "lineCategories": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "lineSeries": {
        "items": {
          "$ref": "#/components/schemas/LineSeries"
        },
        "type": "array"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "marker": {
        "$ref": "#/components/schemas/ShapeMarker"
      },
      "markerSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "mindFlow": {
        "$ref": "#/components/schemas/MindFlow"
      },
      "mindParentId": {
        "$ref": "#/components/schemas/ElementId"
      },
      "mode": {
        "$ref": "#/components/schemas/SelectionMode"
      },
      "navLinks": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "pageSubtitle": {
        "type": "string"
      },
      "pageTitle": {
        "type": "string"
      },
      "penColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "pickerOptions": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "pickerResult": {
        "type": "string"
      },
      "pickerSource": {
        "$ref": "#/components/schemas/PickerSource"
      },
      "pieAnim": {
        "$ref": "#/components/schemas/PieAnim"
      },
      "pieAnimRepeat": {
        "type": "boolean"
      },
      "pieAnimSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "pieSlices": {
        "items": {
          "$ref": "#/components/schemas/PieSlice"
        },
        "type": "array"
      },
      "planBoard": {
        "$ref": "#/components/schemas/PlanBoardSetup"
      },
      "planCard": {
        "$ref": "#/components/schemas/PlanCardRef"
      },
      "planSheet": {
        "$ref": "#/components/schemas/PlanSheetRef"
      },
      "planView": {
        "$ref": "#/components/schemas/PlanViewRef"
      },
      "portalTarget": {
        "$ref": "#/components/schemas/ElementId"
      },
      "processSteps": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "progress": {
        "type": "number"
      },
      "progressAnim": {
        "$ref": "#/components/schemas/ProgressAnim"
      },
      "progressAnimRepeat": {
        "type": "boolean"
      },
      "progressAnimSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "qaNotes": {
        "items": {
          "$ref": "#/components/schemas/QaNote"
        },
        "type": "array"
      },
      "qaRev": {
        "type": "number"
      },
      "quizCorrect": {
        "type": "number"
      },
      "quizLockedAt": {
        "type": "number"
      },
      "quizOptions": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "quizRevealed": {
        "type": "boolean"
      },
      "quizSeconds": {
        "type": "number"
      },
      "quizStartedAt": {
        "type": "number"
      },
      "railCount": {
        "type": "number"
      },
      "railLabels": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "rating": {
        "type": "number"
      },
      "ratingAnim": {
        "$ref": "#/components/schemas/RatingAnim"
      },
      "ratingAnimRepeat": {
        "type": "boolean"
      },
      "ratingAnimSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "reaction": {
        "$ref": "#/components/schemas/Reaction"
      },
      "responses": {
        "items": {
          "$ref": "#/components/schemas/ParticipantResponse"
        },
        "type": "array"
      },
      "responsesRevealed": {
        "type": "boolean"
      },
      "revealed": {
        "type": "boolean"
      },
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "rollCall": {
        "items": {
          "$ref": "#/components/schemas/RollCallEntry"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "session": {
        "$ref": "#/components/schemas/SessionButtonConfig"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "shape": {
        "$ref": "#/components/schemas/ShapeKind"
      },
      "stats": {
        "items": {
          "$ref": "#/components/schemas/StatItem"
        },
        "type": "array"
      },
      "stickerId": {
        "type": "string"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "themeLockFill": {
        "type": "boolean"
      },
      "titleOrientation": {
        "const": "upright",
        "type": "string"
      },
      "type": {
        "const": "shape",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "shape",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "ShapeKind": {
    "enum": [
      "square",
      "circle",
      "diamond",
      "cylinder",
      "parallelogram",
      "hexagon",
      "document",
      "page",
      "mind-node",
      "lane",
      "entity",
      "banner",
      "callout",
      "stat-row",
      "process",
      "site-header",
      "mode-button",
      "portal",
      "session-button",
      "reveal",
      "picker",
      "reaction-pad",
      "comment-pin",
      "action-card",
      "done-check",
      "chair",
      "estimate",
      "temperature",
      "idea-box",
      "qa-board",
      "agenda",
      "decision",
      "roll-call",
      "quiz",
      "stadium",
      "actor",
      "cloud",
      "triangle",
      "trapezoid",
      "star",
      "speech-bubble",
      "frame",
      "browser",
      "monitor",
      "laptop",
      "phone",
      "tablet",
      "foldable",
      "smartwatch",
      "progress-bar",
      "progress-ring",
      "timeline-rail",
      "rating",
      "pie-chart",
      "bar-chart",
      "line-chart",
      "code-block",
      "checklist",
      "legend",
      "focus-button",
      "icon",
      "sticker",
      "plan-board",
      "plan-card",
      "plan-view",
      "plan-sheet"
    ],
    "type": "string"
  },
  "ShapeLibrary": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "items": {
        "items": {
          "$ref": "#/components/schemas/ShapeLibraryItem"
        },
        "type": "array"
      },
      "name": {
        "type": "string"
      },
      "ownerId": {
        "type": "string"
      },
      "source": {
        "$ref": "#/components/schemas/ShapeLibrarySource"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "ownerId",
      "name",
      "source",
      "items",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "ShapeLibraryItem": {
    "additionalProperties": false,
    "description": "One reusable shape: its elements placed from its top-left corner at (0, 0).",
    "properties": {
      "elements": {
        "items": {
          "$ref": "#/components/schemas/Element"
        },
        "type": "array"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "width": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "title",
      "width",
      "height",
      "elements"
    ],
    "type": "object"
  },
  "ShapeLibrarySource": {
    "const": "drawio",
    "description": "Where a library came from; one value today.",
    "type": "string"
  },
  "ShapeMarker": {
    "enum": [
      "green-circle",
      "orange-circle",
      "red-circle",
      "checkbox-unchecked",
      "checkbox-checked"
    ],
    "type": "string"
  },
  "ShareLink": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "documentId": {
        "type": "string"
      },
      "expiresAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "expiry": {
        "$ref": "#/components/schemas/ShareLinkExpiry"
      },
      "purpose": {
        "$ref": "#/components/schemas/SharePurpose"
      },
      "role": {
        "$ref": "#/components/schemas/ShareRole"
      },
      "tabId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "code",
      "documentId",
      "role",
      "createdAt",
      "expiry",
      "expiresAt",
      "tabId",
      "purpose"
    ],
    "type": "object"
  },
  "ShareLinkExpiry": {
    "enum": [
      "never",
      "week",
      "month",
      "sixMonths"
    ],
    "type": "string"
  },
  "SharePurpose": {
    "enum": [
      "share",
      "community"
    ],
    "type": "string"
  },
  "ShareRole": {
    "$ref": "#/components/schemas/AccessLevel"
  },
  "SharedTabsSummary": {
    "additionalProperties": false,
    "properties": {
      "documents": {
        "type": "number"
      },
      "tabs": {
        "type": "number"
      }
    },
    "required": [
      "tabs",
      "documents"
    ],
    "type": "object"
  },
  "SharedWithItem": {
    "additionalProperties": false,
    "properties": {
      "empty": {
        "type": "boolean"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "ownerColor": {
        "type": [
          "string",
          "null"
        ]
      },
      "ownerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "role": {
        "$ref": "#/components/schemas/ShareRole"
      },
      "savedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": "string"
      },
      "tabId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "savedAt",
      "role",
      "shareCode",
      "tabId",
      "ownerName",
      "ownerColor",
      "empty"
    ],
    "type": "object"
  },
  "SheetCellDto": {
    "$ref": "#/components/schemas/SheetCellJson"
  },
  "SheetCellJson": {
    "additionalProperties": false,
    "properties": {
      "c": {
        "type": "string"
      },
      "f": {
        "$ref": "#/components/schemas/CellFormat"
      },
      "i": {
        "$ref": "#/components/schemas/CellInput"
      },
      "r": {
        "type": "string"
      }
    },
    "required": [
      "r",
      "c"
    ],
    "type": "object"
  },
  "SheetCreateRequest": {
    "additionalProperties": false,
    "properties": {
      "cells": {
        "items": {
          "$ref": "#/components/schemas/SheetCellDto"
        },
        "type": "array"
      },
      "copyOf": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "layout": {
        "$ref": "#/components/schemas/SheetLayout"
      },
      "restore": {
        "const": true,
        "type": "boolean"
      },
      "tabId": {
        "type": "string"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "title"
    ],
    "type": "object"
  },
  "SheetDto": {
    "$ref": "#/components/schemas/SheetJson"
  },
  "SheetFilter": {
    "additionalProperties": false,
    "properties": {
      "c1": {
        "type": "string"
      },
      "c2": {
        "type": "string"
      },
      "conds": {
        "additionalProperties": {
          "$ref": "#/components/schemas/FilterCondition"
        },
        "type": "object"
      },
      "r1": {
        "type": "string"
      },
      "r2": {
        "type": "string"
      }
    },
    "required": [
      "c1",
      "c2",
      "conds",
      "r1",
      "r2"
    ],
    "type": "object"
  },
  "SheetJson": {
    "additionalProperties": false,
    "properties": {
      "cells": {
        "items": {
          "$ref": "#/components/schemas/SheetCellJson"
        },
        "type": "array"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "layout": {
        "$ref": "#/components/schemas/SheetLayout"
      },
      "rev": {
        "type": "number"
      },
      "tabId": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      },
      "updatedBy": {
        "$ref": "#/components/schemas/SheetPerson"
      }
    },
    "required": [
      "id",
      "tabId",
      "title",
      "layout",
      "cells",
      "rev",
      "createdAt",
      "updatedAt",
      "updatedBy"
    ],
    "type": "object"
  },
  "SheetLayout": {
    "additionalProperties": false,
    "properties": {
      "cardTables": {
        "items": {
          "$ref": "#/components/schemas/CardTable"
        },
        "type": "array"
      },
      "colSize": {
        "additionalProperties": {
          "type": "number"
        },
        "type": "object"
      },
      "colWidth": {
        "type": "number"
      },
      "cols": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "filter": {
        "$ref": "#/components/schemas/SheetFilter"
      },
      "frozenCols": {
        "type": "number"
      },
      "frozenRows": {
        "type": "number"
      },
      "hiddenCols": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "hiddenRows": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "merges": {
        "items": {
          "$ref": "#/components/schemas/IdRange"
        },
        "type": "array"
      },
      "names": {
        "items": {
          "$ref": "#/components/schemas/RangeName"
        },
        "type": "array"
      },
      "rowHeight": {
        "type": "number"
      },
      "rowSize": {
        "additionalProperties": {
          "type": "number"
        },
        "type": "object"
      },
      "rows": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "setupPending": {
        "const": true,
        "type": "boolean"
      },
      "showGrid": {
        "const": false,
        "type": "boolean"
      },
      "showHeaders": {
        "const": false,
        "type": "boolean"
      }
    },
    "required": [
      "rows",
      "cols"
    ],
    "type": "object"
  },
  "SheetPerson": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "color"
    ],
    "type": "object"
  },
  "SheetResponse": {
    "additionalProperties": false,
    "properties": {
      "sheet": {
        "$ref": "#/components/schemas/SheetDto"
      }
    },
    "required": [
      "sheet"
    ],
    "type": "object"
  },
  "SheetWrite": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "cells": {
            "items": {
              "$ref": "#/components/schemas/CellChange"
            },
            "type": "array"
          },
          "kind": {
            "const": "cells",
            "type": "string"
          }
        },
        "required": [
          "kind",
          "cells"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "cells": {
            "items": {
              "$ref": "#/components/schemas/CellChange"
            },
            "type": "array"
          },
          "changes": {
            "items": {
              "$ref": "#/components/schemas/LayoutChange"
            },
            "type": "array"
          },
          "kind": {
            "const": "layout",
            "type": "string"
          }
        },
        "required": [
          "kind",
          "changes"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "title",
            "type": "string"
          },
          "title": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "title"
        ],
        "type": "object"
      }
    ]
  },
  "SheetWriteRequest": {
    "additionalProperties": false,
    "properties": {
      "undo": {
        "type": "boolean"
      },
      "wid": {
        "type": "string"
      },
      "write": {
        "$ref": "#/components/schemas/SheetWrite"
      }
    },
    "required": [
      "write"
    ],
    "type": "object"
  },
  "SheetWriteResponse": {
    "additionalProperties": false,
    "properties": {
      "applied": {
        "$ref": "#/components/schemas/SheetWrite"
      },
      "cells": {
        "items": {
          "$ref": "#/components/schemas/SheetCellDto"
        },
        "type": "array"
      },
      "rev": {
        "type": "number"
      }
    },
    "required": [
      "applied",
      "rev",
      "cells"
    ],
    "type": "object"
  },
  "SheetsResponse": {
    "additionalProperties": false,
    "properties": {
      "sheets": {
        "items": {
          "$ref": "#/components/schemas/SheetDto"
        },
        "type": "array"
      }
    },
    "required": [
      "sheets"
    ],
    "type": "object"
  },
  "ShowSelectedView": {
    "additionalProperties": false,
    "properties": {
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "selected": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "container": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "kind": {
                      "type": "string"
                    },
                    "label": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "ref": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "ref",
                    "kind",
                    "label"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "fields": {
              "additionalProperties": {},
              "type": "object"
            },
            "incoming": {
              "items": {
                "$ref": "#/components/schemas/ViewEdgeJson"
              },
              "type": "array"
            },
            "kind": {
              "type": "string"
            },
            "omitted": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "outgoing": {
              "items": {
                "$ref": "#/components/schemas/ViewEdgeJson"
              },
              "type": "array"
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "kind",
            "container",
            "fields",
            "incoming",
            "outgoing",
            "omitted"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "selected"
    ],
    "type": "object"
  },
  "ShowView": {
    "additionalProperties": false,
    "properties": {
      "container": {
        "anyOf": [
          {
            "additionalProperties": false,
            "properties": {
              "kind": {
                "type": "string"
              },
              "label": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "ref": {
                "type": "string"
              }
            },
            "required": [
              "ref",
              "kind",
              "label"
            ],
            "type": "object"
          },
          {
            "type": "null"
          }
        ]
      },
      "fields": {
        "additionalProperties": {},
        "type": "object"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "incoming": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "kind": {
        "type": "string"
      },
      "omitted": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "outgoing": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "ref": {
        "type": "string"
      }
    },
    "required": [
      "header",
      "ref",
      "kind",
      "container",
      "fields",
      "incoming",
      "outgoing",
      "omitted"
    ],
    "type": "object"
  },
  "StatItem": {
    "additionalProperties": false,
    "properties": {
      "caption": {
        "type": "string"
      },
      "value": {
        "type": "string"
      }
    },
    "required": [
      "value",
      "caption"
    ],
    "type": "object"
  },
  "StickyAnimation": {
    "enum": [
      "flutter",
      "sway",
      "peel",
      "lift",
      "wiggle",
      "drop",
      "slap",
      "pulse",
      "glow",
      "highlight"
    ],
    "type": "string"
  },
  "StickyElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "addedBy": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "esDraft": {
        "const": true,
        "type": "boolean"
      },
      "esKind": {
        "$ref": "#/components/schemas/EventStormingNoteKind"
      },
      "fillColor": {
        "type": "string"
      },
      "fixedSize": {
        "type": "boolean"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "sticky",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "StoredFormula": {
    "additionalProperties": false,
    "properties": {
      "r": {
        "items": {
          "$ref": "#/components/schemas/StoredRef"
        },
        "type": "array"
      },
      "t": {
        "type": "string"
      }
    },
    "required": [
      "t",
      "r"
    ],
    "type": "object"
  },
  "StoredRef": {
    "additionalProperties": false,
    "properties": {
      "a": {
        "type": "number"
      },
      "c1": {
        "type": "string"
      },
      "c2": {
        "type": "string"
      },
      "open": {
        "enum": [
          "r",
          "c"
        ],
        "type": "string"
      },
      "p": {
        "items": {
          "type": "number"
        },
        "maxItems": 4,
        "minItems": 4,
        "type": "array"
      },
      "r1": {
        "type": "string"
      },
      "r2": {
        "type": "string"
      },
      "s": {
        "type": "string"
      },
      "spill": {
        "const": true,
        "type": "boolean"
      },
      "st": {
        "type": "string"
      }
    },
    "type": "object"
  },
  "SwimlaneBy": {
    "enum": [
      "none",
      "assignee",
      "type",
      "priority",
      "status",
      "field"
    ],
    "type": "string"
  },
  "Tab": {
    "additionalProperties": false,
    "properties": {
      "articles": {
        "additionalProperties": {
          "$ref": "#/components/schemas/ArticleFlow"
        },
        "type": "object"
      },
      "backgroundAnimationSpeed": {
        "type": "number"
      },
      "backgroundColor": {
        "type": "string"
      },
      "backgroundOpacity": {
        "type": "number"
      },
      "backgroundPattern": {
        "$ref": "#/components/schemas/BackgroundPattern"
      },
      "backgroundPatternScale": {
        "type": "number"
      },
      "customColours": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "defaultTextSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "elements": {
        "items": {
          "$ref": "#/components/schemas/Element"
        },
        "type": "array"
      },
      "esLanesSettled": {
        "type": "boolean"
      },
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "id": {
        "$ref": "#/components/schemas/TabId"
      },
      "kind": {
        "$ref": "#/components/schemas/TabKind"
      },
      "layers": {
        "items": {
          "$ref": "#/components/schemas/Layer"
        },
        "type": "array"
      },
      "locked": {
        "type": "boolean"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "$ref": "#/components/schemas/EditorMode"
      },
      "pageOrientation": {
        "$ref": "#/components/schemas/PageOrientation"
      },
      "pages": {
        "items": {
          "$ref": "#/components/schemas/IllustratePage"
        },
        "type": "array"
      },
      "patternColor": {
        "type": "string"
      },
      "templateChosen": {
        "type": "boolean"
      },
      "theme": {
        "type": "string"
      },
      "timer": {
        "$ref": "#/components/schemas/TabTimer"
      },
      "vote": {
        "$ref": "#/components/schemas/TabVote"
      }
    },
    "required": [
      "id",
      "name",
      "elements"
    ],
    "type": "object"
  },
  "TabId": {
    "type": "string"
  },
  "TabKind": {
    "enum": [
      "diagram",
      "event-storming"
    ],
    "type": "string"
  },
  "TabRecord": {
    "additionalProperties": false,
    "properties": {
      "articles": {
        "additionalProperties": {
          "$ref": "#/components/schemas/ArticleFlow"
        },
        "type": "object"
      },
      "backgroundAnimationSpeed": {
        "type": "number"
      },
      "backgroundColor": {
        "type": "string"
      },
      "backgroundOpacity": {
        "type": "number"
      },
      "backgroundPattern": {
        "$ref": "#/components/schemas/BackgroundPattern"
      },
      "backgroundPatternScale": {
        "type": "number"
      },
      "customColours": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "defaultTextSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "documentId": {
        "type": "string"
      },
      "elements": {
        "items": {
          "$ref": "#/components/schemas/Element"
        },
        "type": "array"
      },
      "esLanesSettled": {
        "type": "boolean"
      },
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "id": {
        "$ref": "#/components/schemas/TabId"
      },
      "kind": {
        "$ref": "#/components/schemas/TabKind"
      },
      "layers": {
        "items": {
          "$ref": "#/components/schemas/Layer"
        },
        "type": "array"
      },
      "locked": {
        "type": "boolean"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "$ref": "#/components/schemas/EditorMode"
      },
      "orderIndex": {
        "type": "number"
      },
      "pageOrientation": {
        "$ref": "#/components/schemas/PageOrientation"
      },
      "pages": {
        "items": {
          "$ref": "#/components/schemas/IllustratePage"
        },
        "type": "array"
      },
      "patternColor": {
        "type": "string"
      },
      "rev": {
        "type": "number"
      },
      "templateChosen": {
        "type": "boolean"
      },
      "theme": {
        "type": "string"
      },
      "timer": {
        "$ref": "#/components/schemas/TabTimer"
      },
      "updatedAt": {
        "type": "number"
      },
      "vote": {
        "$ref": "#/components/schemas/TabVote"
      }
    },
    "required": [
      "documentId",
      "elements",
      "id",
      "name",
      "orderIndex",
      "rev",
      "updatedAt"
    ],
    "type": "object"
  },
  "TabSummary": {
    "additionalProperties": false,
    "properties": {
      "documentId": {
        "type": "string"
      },
      "folder": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "orderIndex": {
        "type": "number"
      },
      "outOfScope": {
        "const": true,
        "type": "boolean"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "documentId",
      "name",
      "orderIndex",
      "updatedAt"
    ],
    "type": "object"
  },
  "TabTimer": {
    "additionalProperties": false,
    "properties": {
      "anchorAt": {
        "type": "number"
      },
      "durationMs": {
        "type": "number"
      },
      "frozenMs": {
        "type": "number"
      },
      "mode": {
        "$ref": "#/components/schemas/TimerMode"
      },
      "running": {
        "type": "boolean"
      }
    },
    "required": [
      "mode",
      "running"
    ],
    "type": "object"
  },
  "TabVote": {
    "additionalProperties": false,
    "properties": {
      "active": {
        "type": "boolean"
      },
      "hideCounts": {
        "type": "boolean"
      },
      "hideCursors": {
        "type": "boolean"
      },
      "onePerElement": {
        "type": "boolean"
      },
      "revealed": {
        "type": "boolean"
      },
      "reviewIndex": {
        "type": "number"
      },
      "round": {
        "type": "string"
      },
      "startedBy": {
        "type": "string"
      },
      "voteLayerId": {
        "type": "string"
      },
      "votes": {
        "additionalProperties": {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        "type": "object"
      },
      "votesPerPerson": {
        "type": "number"
      }
    },
    "required": [
      "active",
      "revealed",
      "votesPerPerson",
      "votes"
    ],
    "type": "object"
  },
  "TableAnimation": {
    "enum": [
      "rows",
      "columns",
      "cells",
      "scan",
      "sweep",
      "header",
      "pulse",
      "glow"
    ],
    "type": "string"
  },
  "TableCellStyle": {
    "additionalProperties": false,
    "properties": {
      "alignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "bg": {
        "type": "string"
      },
      "bold": {
        "type": "boolean"
      },
      "italic": {
        "type": "boolean"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "textColor": {
        "type": "string"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "underline": {
        "type": "boolean"
      }
    },
    "type": "object"
  },
  "TableElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "cellStyles": {
        "items": {
          "items": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TableCellStyle"
              },
              {
                "type": "null"
              }
            ]
          },
          "type": "array"
        },
        "type": "array"
      },
      "cells": {
        "items": {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        "type": "array"
      },
      "colWidths": {
        "items": {
          "type": [
            "number",
            "null"
          ]
        },
        "type": "array"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "headerColumn": {
        "type": "boolean"
      },
      "headerFill": {
        "type": "string"
      },
      "headerRow": {
        "type": "boolean"
      },
      "headerTextColor": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "rowHeights": {
        "items": {
          "type": [
            "number",
            "null"
          ]
        },
        "type": "array"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "tablePreset": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "table",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      },
      "zebra": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height",
      "cells"
    ],
    "type": "object"
  },
  "Team": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "organisation": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "organisation",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamInvite": {
    "additionalProperties": false,
    "properties": {
      "invitedAt": {
        "type": "number"
      },
      "memberCount": {
        "type": "number"
      },
      "memberId": {
        "type": "string"
      },
      "team": {
        "$ref": "#/components/schemas/Team"
      }
    },
    "required": [
      "memberId",
      "team",
      "memberCount",
      "invitedAt"
    ],
    "type": "object"
  },
  "TeamInviteLink": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "token": {
        "type": "string"
      }
    },
    "required": [
      "token",
      "expiresAt"
    ],
    "type": "object"
  },
  "TeamInviteLinkInfo": {
    "additionalProperties": false,
    "properties": {
      "alreadyMember": {
        "type": "boolean"
      },
      "memberCount": {
        "type": "number"
      },
      "team": {
        "$ref": "#/components/schemas/Team"
      }
    },
    "required": [
      "team",
      "memberCount",
      "alreadyMember"
    ],
    "type": "object"
  },
  "TeamListItem": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "memberCount": {
        "type": "number"
      },
      "myRole": {
        "$ref": "#/components/schemas/TeamRole"
      },
      "name": {
        "type": "string"
      },
      "organisation": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "createdAt",
      "id",
      "memberCount",
      "myRole",
      "name",
      "organisation",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamMember": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "email": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "pictureUrl": {
        "type": [
          "string",
          "null"
        ]
      },
      "role": {
        "$ref": "#/components/schemas/TeamRole"
      },
      "status": {
        "$ref": "#/components/schemas/TeamMemberStatus"
      },
      "teamId": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "teamId",
      "userId",
      "email",
      "role",
      "status",
      "name",
      "pictureUrl",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamMemberStatus": {
    "enum": [
      "invited",
      "joined"
    ],
    "type": "string"
  },
  "TeamRole": {
    "enum": [
      "admin",
      "member"
    ],
    "type": "string"
  },
  "TelemetryAction": {
    "enum": [
      "Created",
      "Deleted",
      "Added",
      "Removed",
      "Shared",
      "Joined",
      "Declined",
      "Used",
      "Changed",
      "Exported",
      "Locked",
      "Unlocked",
      "Grouped",
      "Ungrouped",
      "Duplicated",
      "Renamed",
      "Reordered",
      "Linked",
      "Unlinked",
      "Resolved",
      "Unresolved",
      "Mentioned",
      "Imported",
      "Aligned",
      "Undone",
      "Redone",
      "Cleared",
      "Loaded",
      "Opened",
      "Searched",
      "Selected",
      "Toggled",
      "Zoomed",
      "Moved",
      "Closed",
      "Copied",
      "Reverted",
      "SignedIn",
      "SignedUp",
      "SignedOut",
      "Started",
      "Ended",
      "Revealed",
      "Voted",
      "View",
      "Helpful",
      "Unhelpful",
      "Returned",
      "Restored",
      "Applied",
      "Conflicted",
      "Present",
      "Held",
      "Viewed",
      "Sent",
      "Api",
      "Client",
      "Warning",
      "Liked",
      "Unliked",
      "Reported",
      "Measured"
    ],
    "type": "string"
  },
  "TelemetryCategory": {
    "enum": [
      "Document",
      "Element",
      "Tab",
      "Theme",
      "Canvas",
      "Template",
      "Comment",
      "Note",
      "Action",
      "Search",
      "UI",
      "Folder",
      "Layer",
      "Session",
      "Facilitator",
      "AI",
      "Team",
      "Participant",
      "Help",
      "Token",
      "Mcp",
      "Cli",
      "Email",
      "Error",
      "Timeline",
      "Home",
      "Activity",
      "Page",
      "Cta",
      "Trash",
      "Draw",
      "Editor",
      "Drive",
      "Explorer",
      "Agent",
      "Plan",
      "Sheet",
      "Community",
      "Timing"
    ],
    "type": "string"
  },
  "TelemetryCount": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "type": "string"
      },
      "category": {
        "type": "string"
      },
      "count": {
        "type": "number"
      },
      "type": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "category",
      "action",
      "type",
      "count"
    ],
    "type": "object"
  },
  "TelemetryDaily": {
    "additionalProperties": false,
    "properties": {
      "byCategory": {
        "additionalProperties": {
          "items": {
            "type": "number"
          },
          "type": "array"
        },
        "type": "object"
      },
      "byMetric": {
        "additionalProperties": {
          "items": {
            "type": "number"
          },
          "type": "array"
        },
        "type": "object"
      },
      "days": {
        "items": {
          "type": "number"
        },
        "type": "array"
      },
      "totals": {
        "items": {
          "type": "number"
        },
        "type": "array"
      }
    },
    "required": [
      "days",
      "totals",
      "byCategory",
      "byMetric"
    ],
    "type": "object"
  },
  "TelemetryEvent": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/TelemetryAction"
      },
      "category": {
        "$ref": "#/components/schemas/TelemetryCategory"
      },
      "type": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "category",
      "action"
    ],
    "type": "object"
  },
  "TelemetrySummary": {
    "additionalProperties": false,
    "properties": {
      "daily": {
        "$ref": "#/components/schemas/TelemetryDaily"
      },
      "enabled": {
        "type": "boolean"
      },
      "generatedAt": {
        "type": "number"
      },
      "previousWindows": {
        "additionalProperties": false,
        "properties": {
          "last30": {
            "$ref": "#/components/schemas/TelemetryWindow"
          },
          "last7": {
            "$ref": "#/components/schemas/TelemetryWindow"
          },
          "today": {
            "$ref": "#/components/schemas/TelemetryWindow"
          }
        },
        "required": [
          "today",
          "last7",
          "last30"
        ],
        "type": "object"
      },
      "windows": {
        "additionalProperties": false,
        "properties": {
          "last30": {
            "$ref": "#/components/schemas/TelemetryWindow"
          },
          "last7": {
            "$ref": "#/components/schemas/TelemetryWindow"
          },
          "today": {
            "$ref": "#/components/schemas/TelemetryWindow"
          }
        },
        "required": [
          "today",
          "last7",
          "last30"
        ],
        "type": "object"
      }
    },
    "required": [
      "enabled",
      "generatedAt",
      "windows"
    ],
    "type": "object"
  },
  "TelemetryWindow": {
    "additionalProperties": false,
    "properties": {
      "rows": {
        "items": {
          "$ref": "#/components/schemas/TelemetryCount"
        },
        "type": "array"
      },
      "total": {
        "type": "number"
      }
    },
    "required": [
      "total",
      "rows"
    ],
    "type": "object"
  },
  "TemplateCatalogueResponse": {
    "additionalProperties": false,
    "properties": {
      "categories": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "description": {
              "type": "string"
            },
            "id": {
              "type": "string"
            },
            "label": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "label",
            "description"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "templates": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "category": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "kind": {
              "type": "string"
            },
            "title": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "title",
            "description",
            "category"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "categories",
      "templates"
    ],
    "type": "object"
  },
  "TemplateFamily": {
    "enum": [
      "retrospective",
      "kanban"
    ],
    "type": "string"
  },
  "TextAlignX": {
    "enum": [
      "left",
      "center",
      "right"
    ],
    "type": "string"
  },
  "TextAlignY": {
    "enum": [
      "top",
      "middle",
      "bottom"
    ],
    "type": "string"
  },
  "TextAnimation": {
    "enum": [
      "typewriter",
      "words",
      "cascade",
      "focus",
      "scramble",
      "highlighter",
      "underline",
      "wave",
      "shine",
      "flicker",
      "rainbow",
      "glow",
      "bounce",
      "float"
    ],
    "type": "string"
  },
  "TextElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "addedBy": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "fontWeight": {
        "enum": [
          400,
          500,
          700
        ],
        "type": "number"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "letterSpacing": {
        "type": "number"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "sizing": {
        "$ref": "#/components/schemas/TextSizing"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textArc": {
        "type": "number"
      },
      "textBold": {
        "type": "boolean"
      },
      "textCase": {
        "enum": [
          "upper",
          "lower"
        ],
        "type": "string"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textScale": {
        "type": "number"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "text",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "TextRun": {
    "additionalProperties": false,
    "properties": {
      "bold": {
        "type": "boolean"
      },
      "color": {
        "type": "string"
      },
      "heading": {
        "$ref": "#/components/schemas/RunHeading"
      },
      "italic": {
        "type": "boolean"
      },
      "link": {
        "type": "string"
      },
      "size": {
        "$ref": "#/components/schemas/RunSize"
      },
      "strikethrough": {
        "type": "boolean"
      },
      "text": {
        "type": "string"
      },
      "underline": {
        "type": "boolean"
      }
    },
    "required": [
      "text"
    ],
    "type": "object"
  },
  "TextSize": {
    "enum": [
      "scale",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "TextSizing": {
    "enum": [
      "fit",
      "wrap"
    ],
    "type": "string"
  },
  "TimelineEvent": {
    "additionalProperties": false,
    "properties": {
      "actorId": {
        "type": [
          "string",
          "null"
        ]
      },
      "description": {
        "type": [
          "string",
          "null"
        ]
      },
      "eventType": {
        "$ref": "#/components/schemas/TimelineEventType"
      },
      "id": {
        "type": "string"
      },
      "occurredAt": {
        "type": "number"
      },
      "snapshot": {
        "additionalProperties": {},
        "type": "object"
      },
      "sourceId": {
        "type": "string"
      },
      "sourceType": {
        "$ref": "#/components/schemas/TimelineSourceType"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "sourceType",
      "sourceId",
      "eventType",
      "title",
      "description",
      "occurredAt",
      "actorId",
      "snapshot"
    ],
    "type": "object"
  },
  "TimelineEventType": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/KnownTimelineEventType"
      },
      {
        "type": "string"
      }
    ]
  },
  "TimelineSourceType": {
    "anyOf": [
      {
        "type": "string"
      },
      {
        "enum": [
          "document",
          "team",
          "account"
        ],
        "type": "string"
      }
    ]
  },
  "TimerMode": {
    "enum": [
      "countdown",
      "stopwatch"
    ],
    "type": "string"
  },
  "TrashReason": {
    "enum": [
      "deleted",
      "empty"
    ],
    "type": "string"
  },
  "TrashedDocument": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "purgeAt": {
        "type": "number"
      },
      "reason": {
        "$ref": "#/components/schemas/TrashReason"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "teamName": {
        "type": [
          "string",
          "null"
        ]
      },
      "trashedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "teamId",
      "teamName",
      "trashedAt",
      "purgeAt",
      "reason"
    ],
    "type": "object"
  },
  "UnfurlResult": {
    "additionalProperties": false,
    "properties": {
      "description": {
        "type": "string"
      },
      "favicon": {
        "type": "string"
      },
      "image": {
        "type": "string"
      },
      "siteName": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    },
    "required": [
      "url"
    ],
    "type": "object"
  },
  "VideoElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "embedProvider": {
        "$ref": "#/components/schemas/EmbedProvider"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "layerId": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "video",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "ViewAttributeJson": {
    "additionalProperties": false,
    "properties": {
      "key": {
        "type": "string"
      },
      "value": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "key",
      "value"
    ],
    "type": "object"
  },
  "ViewEdgeJson": {
    "additionalProperties": false,
    "properties": {
      "from": {
        "$ref": "#/components/schemas/ViewEnd"
      },
      "id": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      },
      "style": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "to": {
        "$ref": "#/components/schemas/ViewEnd"
      }
    },
    "required": [
      "ref",
      "id",
      "from",
      "to",
      "label",
      "style"
    ],
    "type": "object"
  },
  "ViewEnd": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "ref"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "arrow": {
            "type": "string"
          }
        },
        "required": [
          "arrow"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "free": {
            "additionalProperties": false,
            "properties": {
              "x": {
                "type": "number"
              },
              "y": {
                "type": "number"
              }
            },
            "required": [
              "x",
              "y"
            ],
            "type": "object"
          }
        },
        "required": [
          "free"
        ],
        "type": "object"
      }
    ]
  },
  "ViewHeader": {
    "additionalProperties": false,
    "properties": {
      "counts": {
        "additionalProperties": false,
        "properties": {
          "arrows": {
            "type": "number"
          },
          "boxes": {
            "type": "number"
          },
          "frames": {
            "type": "number"
          },
          "lanes": {
            "type": "number"
          }
        },
        "required": [
          "boxes",
          "frames",
          "lanes",
          "arrows"
        ],
        "type": "object"
      },
      "elements": {
        "type": "number"
      },
      "hidden": {
        "type": "number"
      },
      "rev": {
        "type": [
          "number",
          "null"
        ]
      },
      "tab": {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "kind": {
            "$ref": "#/components/schemas/TabKind"
          },
          "name": {
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "ref",
          "name",
          "kind"
        ],
        "type": "object"
      },
      "threads": {
        "additionalProperties": false,
        "properties": {
          "open": {
            "type": "number"
          },
          "total": {
            "type": "number"
          }
        },
        "required": [
          "open",
          "total"
        ],
        "type": "object"
      },
      "unknown": {
        "type": "number"
      },
      "view": {
        "$ref": "#/components/schemas/ViewName"
      }
    },
    "required": [
      "view",
      "tab",
      "elements",
      "counts",
      "hidden",
      "unknown",
      "threads",
      "rev"
    ],
    "type": "object"
  },
  "ViewName": {
    "enum": [
      "overview",
      "outline",
      "graph",
      "layout",
      "comments",
      "show",
      "find",
      "diff",
      "lint"
    ],
    "type": "string"
  },
  "WorkbenchPairing": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "origin": {
        "type": "string"
      },
      "pairedAt": {
        "type": "number"
      },
      "tokenId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "tokenId",
      "origin",
      "name",
      "pairedAt"
    ],
    "type": "object"
  },
  "WorkbenchPairingRequestCreate": {
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "origin": {
        "type": "string"
      }
    },
    "required": [
      "origin"
    ],
    "type": "object"
  },
  "WorkbenchPairingRequestCreated": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "pairing": {
            "$ref": "#/components/schemas/WorkbenchPairing"
          },
          "status": {
            "const": "paired",
            "type": "string"
          }
        },
        "required": [
          "status",
          "pairing"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string"
          },
          "expiresAt": {
            "type": "number"
          },
          "interval": {
            "type": "number"
          },
          "pairingUrl": {
            "type": "string"
          },
          "status": {
            "const": "pending",
            "type": "string"
          }
        },
        "required": [
          "status",
          "pairingUrl",
          "code",
          "expiresAt",
          "interval"
        ],
        "type": "object"
      }
    ]
  },
  "WorkbenchPairingRequestView": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "origin": {
        "type": "string"
      },
      "status": {
        "$ref": "#/components/schemas/PairingRequestStatus"
      },
      "tokenName": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "origin",
      "name",
      "tokenName",
      "expiresAt",
      "status"
    ],
    "type": "object"
  },
  "WorkbenchPairingStatusResponse": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "interval": {
        "type": "number"
      },
      "status": {
        "$ref": "#/components/schemas/PairingRequestStatus"
      }
    },
    "required": [
      "status",
      "expiresAt",
      "interval"
    ],
    "type": "object"
  },
  "WorkbenchPairingsResponse": {
    "additionalProperties": false,
    "properties": {
      "pairings": {
        "items": {
          "$ref": "#/components/schemas/WorkbenchPairing"
        },
        "type": "array"
      }
    },
    "required": [
      "pairings"
    ],
    "type": "object"
  },
  "WorkbenchPerson": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "pictureUrl": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "color",
      "pictureUrl"
    ],
    "type": "object"
  },
  "WorkbenchRole": {
    "$ref": "#/components/schemas/AccessLevel"
  },
  "WorkbenchSessionRequest": {
    "additionalProperties": false,
    "properties": {
      "ticket": {
        "type": "string"
      }
    },
    "required": [
      "ticket"
    ],
    "type": "object"
  },
  "WorkbenchSessionResponse": {
    "additionalProperties": false,
    "properties": {
      "documentId": {
        "type": "string"
      },
      "expiresAt": {
        "type": "number"
      },
      "origin": {
        "type": "string"
      },
      "person": {
        "$ref": "#/components/schemas/WorkbenchPerson"
      },
      "role": {
        "$ref": "#/components/schemas/WorkbenchRole"
      },
      "session": {
        "type": "string"
      },
      "tabId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "session",
      "documentId",
      "tabId",
      "origin",
      "role",
      "expiresAt",
      "person"
    ],
    "type": "object"
  },
  "WorkbenchTicketRequest": {
    "additionalProperties": false,
    "properties": {
      "documentId": {
        "type": "string"
      },
      "origin": {
        "type": "string"
      },
      "tabId": {
        "type": "string"
      }
    },
    "required": [
      "documentId",
      "origin"
    ],
    "type": "object"
  },
  "WorkbenchTicketResponse": {
    "additionalProperties": false,
    "properties": {
      "documentId": {
        "type": "string"
      },
      "expiresAt": {
        "type": "number"
      },
      "tabId": {
        "type": [
          "string",
          "null"
        ]
      },
      "url": {
        "type": "string"
      }
    },
    "required": [
      "url",
      "documentId",
      "tabId",
      "expiresAt"
    ],
    "type": "object"
  }
};
