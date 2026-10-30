// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-openapi-schemas.mjs from @liveplanner/api-schema.
// Regenerate with: pnpm --filter @liveplanner/api gen:openapi
// Served as the `components.schemas` of GET /api/openapi.json (docs/specs/015-api/api-documentation.md).
import type { ComponentSchemas } from '@liveworkspace/api-kit/openapi-types';

export const COMPONENT_SCHEMAS: ComponentSchemas = {
  "AccentEdge": {
    "enum": [
      "left",
      "top",
      "bottom"
    ],
    "type": "string"
  },
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
      "projectId": {
        "type": "string"
      },
      "projectName": {
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
      "elementId",
      "elementLabel",
      "id",
      "name",
      "projectId",
      "projectName",
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
      "id": {
        "type": "string"
      },
      "key": {
        "type": "number"
      },
      "projectId": {
        "type": "string"
      },
      "projectName": {
        "type": "string"
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
      "projectId",
      "projectName",
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
      "onYourProject": {
        "type": "boolean"
      },
      "projectId": {
        "type": "string"
      },
      "projectName": {
        "type": "string"
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
      "threadId": {
        "type": "string"
      },
      "threadTitle": {
        "type": "string"
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
      "firstAt",
      "id",
      "key",
      "latest",
      "mentionsYou",
      "onYourProject",
      "projectId",
      "projectName",
      "shareCode",
      "teamId",
      "threadId",
      "threadTitle",
      "title",
      "type",
      "via",
      "youCommented"
    ],
    "type": "object"
  },
  "ActivityFormResponses": {
    "additionalProperties": false,
    "properties": {
      "boardTabId": {
        "type": [
          "string",
          "null"
        ]
      },
      "heading": {
        "type": "string"
      },
      "latestAt": {
        "type": "number"
      },
      "projectId": {
        "type": "string"
      },
      "projectName": {
        "type": "string"
      },
      "tabId": {
        "type": "string"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "unseen": {
        "type": "number"
      },
      "via": {
        "enum": [
          "own",
          "team"
        ],
        "type": "string"
      }
    },
    "required": [
      "projectId",
      "projectName",
      "teamId",
      "via",
      "tabId",
      "heading",
      "boardTabId",
      "unseen",
      "latestAt"
    ],
    "type": "object"
  },
  "ActivityThread": {
    "additionalProperties": false,
    "properties": {
      "commentCount": {
        "type": "number"
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
      "onYourProject": {
        "type": "boolean"
      },
      "projectId": {
        "type": "string"
      },
      "projectName": {
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
      "elementId",
      "elementLabel",
      "firstAt",
      "latest",
      "mentionsYou",
      "onYourProject",
      "projectId",
      "projectName",
      "shareCode",
      "tabId",
      "tabName",
      "teamId",
      "via",
      "youCommented"
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
  "AnswerTarget": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "to": {
            "const": "description",
            "type": "string"
          }
        },
        "required": [
          "to"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "to": {
            "const": "title",
            "type": "string"
          }
        },
        "required": [
          "to"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "fieldId": {
            "type": "string"
          },
          "to": {
            "const": "field",
            "type": "string"
          }
        },
        "required": [
          "to",
          "fieldId"
        ],
        "type": "object"
      }
    ]
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
      "arrowheadStartShape": {
        "$ref": "#/components/schemas/ArrowheadShape"
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
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
      "diamond-hollow",
      "one",
      "zero-or-one",
      "many",
      "zero-or-many",
      "one-or-many"
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
  "AttachPoint": {
    "enum": [
      "top-left",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left"
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
      "hexagonal",
      "engineering",
      "checkerboard",
      "sparkles",
      "eggs",
      "cobwebs",
      "snowflakes",
      "candy-stripes",
      "flow",
      "drift",
      "aurora",
      "ripple",
      "ribbons"
    ],
    "type": "string"
  },
  "BoardSortDir": {
    "enum": [
      "asc",
      "desc"
    ],
    "type": "string"
  },
  "BoardSortLevel": {
    "additionalProperties": false,
    "properties": {
      "dir": {
        "$ref": "#/components/schemas/BoardSortDir"
      },
      "field": {
        "type": "string"
      }
    },
    "required": [
      "field",
      "dir"
    ],
    "type": "object"
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
      "dotted"
    ],
    "type": "string"
  },
  "BoundaryStyle": {
    "enum": [
      "tab",
      "inset",
      "c4"
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
  "Calculation": {
    "enum": [
      "childCount",
      "childrenDone"
    ],
    "type": "string"
  },
  "CapabilitiesResponse": {
    "additionalProperties": false,
    "properties": {
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
      "emailEnabled": {
        "type": "boolean"
      },
      "oauthIssuer": {
        "type": "string"
      },
      "projectFormat": {
        "type": "number"
      }
    },
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
        "const": "attachments",
        "type": "string"
      },
      {
        "const": "cover",
        "type": "string"
      },
      {
        "$ref": "#/components/schemas/CustomCardField"
      }
    ]
  },
  "CardMedia": {
    "enum": [
      "badge",
      "tile",
      "initial"
    ],
    "type": "string"
  },
  "CardRef": {
    "additionalProperties": false,
    "description": "One card a thread is on: its plan and id, its number, and (a card in another plan) that plan's name when the thread was added there.",
    "properties": {
      "itemId": {
        "type": "string"
      },
      "key": {
        "type": [
          "number",
          "null"
        ]
      },
      "projectId": {
        "type": "string"
      },
      "projectName": {
        "type": "string"
      }
    },
    "required": [
      "projectId",
      "itemId",
      "key"
    ],
    "type": "object"
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
  "CardThread": {
    "additionalProperties": false,
    "properties": {
      "cards": {
        "items": {
          "$ref": "#/components/schemas/CardRef"
        },
        "type": "array"
      },
      "comments": {
        "items": {
          "$ref": "#/components/schemas/Comment"
        },
        "type": "array"
      },
      "createdAt": {
        "type": "number"
      },
      "createdBy": {
        "$ref": "#/components/schemas/ThreadPerson"
      },
      "field": {
        "type": "string"
      },
      "home": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "resolved": {
        "type": "boolean"
      },
      "resolvedAt": {
        "type": "number"
      },
      "resolvedBy": {
        "type": "string"
      },
      "rev": {
        "type": "number"
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
      "resolved",
      "comments",
      "createdAt",
      "createdBy",
      "updatedAt",
      "home",
      "cards",
      "rev"
    ],
    "type": "object"
  },
  "CardThreadAddCardRequest": {
    "additionalProperties": false,
    "properties": {
      "itemId": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      }
    },
    "required": [
      "itemId"
    ],
    "type": "object"
  },
  "CardThreadCommentRequest": {
    "additionalProperties": false,
    "properties": {
      "mentions": {
        "items": {
          "$ref": "#/components/schemas/CommentMention"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "text"
    ],
    "type": "object"
  },
  "CardThreadRenameRequest": {
    "additionalProperties": false,
    "properties": {
      "title": {
        "type": "string"
      }
    },
    "required": [
      "title"
    ],
    "type": "object"
  },
  "CardThreadStartRequest": {
    "additionalProperties": false,
    "properties": {
      "field": {
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
      "title": {
        "type": "string"
      }
    },
    "required": [
      "text"
    ],
    "type": "object"
  },
  "CardThreadWriteResponse": {
    "additionalProperties": false,
    "properties": {
      "commentId": {
        "type": "string"
      },
      "thread": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/CardThread"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "thread"
    ],
    "type": "object"
  },
  "CardThreadsResponse": {
    "additionalProperties": false,
    "properties": {
      "threads": {
        "items": {
          "$ref": "#/components/schemas/CardThread"
        },
        "type": "array"
      }
    },
    "required": [
      "threads"
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
  "CellCommentThreads": {
    "additionalProperties": {
      "$ref": "#/components/schemas/CommentThread"
    },
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
      "nc": {
        "type": "string"
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
      "dashboard": {
        "additionalProperties": {},
        "type": "object"
      },
      "elements": {
        "items": {},
        "type": "array"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "form": {
        "additionalProperties": {},
        "type": "object"
      },
      "kind": {
        "enum": [
          "board",
          "sheet"
        ],
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
      "warnings"
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
  "ChartVariant": {
    "enum": [
      "horizontal",
      "area",
      "scatter",
      "doughnut"
    ],
    "type": "string"
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
  "ChipLook": {
    "enum": [
      "solid",
      "ink",
      "outline",
      "tinted",
      "quiet"
    ],
    "type": "string"
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
  "ColourBackground": {
    "additionalProperties": false,
    "properties": {
      "fill": {
        "$ref": "#/components/schemas/PageColourFill"
      },
      "pattern": {
        "$ref": "#/components/schemas/PagePattern"
      }
    },
    "type": "object"
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
      "ai": {
        "const": true,
        "type": "boolean"
      },
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
      "editedAt": {
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
            "cell": {
              "type": "string"
            },
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
  "ConceptAnim": {
    "enum": [
      "build",
      "pulse",
      "flow"
    ],
    "type": "string"
  },
  "ConceptRow": {
    "additionalProperties": false,
    "properties": {
      "label": {
        "type": "string"
      },
      "note": {
        "type": "string"
      }
    },
    "required": [
      "label"
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
    "anyOf": [
      {
        "$ref": "#/components/schemas/PlanTabKind"
      },
      {
        "const": "empty",
        "type": "string"
      }
    ]
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
      "calculation": {
        "$ref": "#/components/schemas/Calculation"
      },
      "currency": {
        "type": "string"
      },
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
      "linkTypes": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "notifies": {
        "type": "boolean"
      },
      "onCard": {
        "type": "boolean"
      },
      "options": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "required": {
        "type": "boolean"
      },
      "scale": {
        "type": "number"
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
      "currency",
      "date",
      "checkbox",
      "link",
      "email",
      "choice",
      "multichoice",
      "rating",
      "card",
      "calculated",
      "person",
      "labels",
      "colour",
      "checklist",
      "image",
      "comments",
      "votes"
    ],
    "type": "string"
  },
  "DashboardCardContent": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "at": {
            "type": "number"
          },
          "state": {
            "$ref": "#/components/schemas/DashboardStatus"
          },
          "style": {
            "$ref": "#/components/schemas/DashboardCardStyle"
          },
          "text": {
            "type": "string"
          },
          "type": {
            "const": "status",
            "type": "string"
          }
        },
        "required": [
          "type",
          "state",
          "text",
          "at"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "items": {
            "items": {
              "$ref": "#/components/schemas/DashboardChecklistItem"
            },
            "type": "array"
          },
          "style": {
            "$ref": "#/components/schemas/DashboardCardStyle"
          },
          "title": {
            "type": "string"
          },
          "type": {
            "const": "checklist",
            "type": "string"
          }
        },
        "required": [
          "type",
          "title",
          "items"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "date": {
            "type": "string"
          },
          "style": {
            "$ref": "#/components/schemas/DashboardCardStyle"
          },
          "title": {
            "type": "string"
          },
          "type": {
            "const": "key-date",
            "type": "string"
          }
        },
        "required": [
          "type",
          "title",
          "date"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "links": {
            "items": {
              "$ref": "#/components/schemas/DashboardLink"
            },
            "type": "array"
          },
          "style": {
            "$ref": "#/components/schemas/DashboardCardStyle"
          },
          "title": {
            "type": "string"
          },
          "type": {
            "const": "links",
            "type": "string"
          }
        },
        "required": [
          "type",
          "title",
          "links"
        ],
        "type": "object"
      },
      {
        "$ref": "#/components/schemas/SheetMetricContent"
      },
      {
        "$ref": "#/components/schemas/FormMetricContent"
      }
    ]
  },
  "DashboardCardStyle": {
    "additionalProperties": false,
    "properties": {
      "borderStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "borderWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "fill": {
        "type": "string"
      },
      "preset": {
        "type": "string"
      },
      "shadow": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ElementShadow"
          },
          {
            "const": "none",
            "type": "string"
          }
        ]
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
  "DashboardChecklistItem": {
    "additionalProperties": false,
    "properties": {
      "done": {
        "type": "boolean"
      },
      "id": {
        "type": "string"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "text",
      "done"
    ],
    "type": "object"
  },
  "DashboardContent": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "of": {
            "$ref": "#/components/schemas/DashboardTabOf"
          },
          "tabId": {
            "type": "string"
          },
          "type": {
            "const": "tab",
            "type": "string"
          }
        },
        "required": [
          "type",
          "tabId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "elementId": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "type": {
            "const": "element",
            "type": "string"
          }
        },
        "required": [
          "type",
          "elementId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "style": {
            "$ref": "#/components/schemas/DashboardCardStyle"
          },
          "text": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "type": {
            "const": "note",
            "type": "string"
          }
        },
        "required": [
          "type",
          "title",
          "text"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "style": {
            "$ref": "#/components/schemas/DashboardCardStyle"
          },
          "text": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "type": {
            "const": "title",
            "type": "string"
          }
        },
        "required": [
          "type",
          "title",
          "text"
        ],
        "type": "object"
      },
      {
        "$ref": "#/components/schemas/DashboardCardContent"
      }
    ]
  },
  "DashboardLayout": {
    "additionalProperties": false,
    "properties": {
      "background": {
        "const": "tint",
        "type": "string"
      },
      "rows": {
        "items": {
          "$ref": "#/components/schemas/DashboardRow"
        },
        "type": "array"
      }
    },
    "required": [
      "rows"
    ],
    "type": "object"
  },
  "DashboardLink": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "tabId": {
            "not": {}
          },
          "url": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "label",
          "url"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "tabId": {
            "type": "string"
          },
          "url": {
            "not": {}
          }
        },
        "required": [
          "id",
          "label",
          "tabId"
        ],
        "type": "object"
      }
    ]
  },
  "DashboardRow": {
    "additionalProperties": false,
    "properties": {
      "fill": {
        "const": true,
        "type": "boolean"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "slots": {
        "items": {
          "$ref": "#/components/schemas/DashboardSlot"
        },
        "type": "array"
      }
    },
    "required": [
      "id",
      "height",
      "slots"
    ],
    "type": "object"
  },
  "DashboardSlot": {
    "additionalProperties": false,
    "properties": {
      "content": {
        "$ref": "#/components/schemas/DashboardContent"
      },
      "id": {
        "type": "string"
      },
      "span": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "span"
    ],
    "type": "object"
  },
  "DashboardStatus": {
    "enum": [
      "on-track",
      "at-risk",
      "off-track"
    ],
    "type": "string"
  },
  "DashboardTabOf": {
    "enum": [
      "board",
      "sheet"
    ],
    "type": "string"
  },
  "DateOp": {
    "enum": [
      "valid",
      "before",
      "onOrBefore",
      "after",
      "onOrAfter",
      "on",
      "between",
      "notBetween"
    ],
    "type": "string"
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
  "DropdownOption": {
    "additionalProperties": false,
    "properties": {
      "c": {
        "type": "string"
      },
      "v": {
        "type": "string"
      }
    },
    "required": [
      "v"
    ],
    "type": "object"
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
    "const": "no_base",
    "type": "string"
  },
  "EditorMode": {
    "const": "plan",
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
        "$ref": "#/components/schemas/ElementActionStatus"
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
  "ElementActionStatus": {
    "enum": [
      "open",
      "done",
      "wont-do"
    ],
    "type": "string"
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
          "kind": {
            "const": "project",
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "projectId": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "projectId",
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
          "field": {
            "type": "number"
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
      "key": {
        "$ref": "#/components/schemas/EntityKey"
      },
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
  "EntityKey": {
    "enum": [
      "pk",
      "fk",
      "pk-fk",
      "uk"
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
      "node",
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
  "Finish": {
    "enum": [
      "flexible",
      "professional",
      "sketch",
      "marker"
    ],
    "type": "string"
  },
  "FlowchartDirection": {
    "enum": [
      "down",
      "right"
    ],
    "type": "string"
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
  "FormCanvas": {
    "additionalProperties": false,
    "description": "A canvas style as a form draws it: the pattern in each half's colour, at the tab's size, speed and strength.",
    "properties": {
      "color": {
        "$ref": "#/components/schemas/FormHalves"
      },
      "opacity": {
        "type": "number"
      },
      "pattern": {
        "$ref": "#/components/schemas/BackgroundPattern"
      },
      "scale": {
        "type": "number"
      },
      "speed": {
        "type": "number"
      }
    },
    "required": [
      "pattern",
      "color"
    ],
    "type": "object"
  },
  "FormCover": {
    "$ref": "#/components/schemas/ColourBackground"
  },
  "FormDefinition": {
    "additionalProperties": false,
    "properties": {
      "closedMessage": {
        "type": "string"
      },
      "closesAt": {
        "type": "number"
      },
      "confirmation": {
        "type": "string"
      },
      "cover": {
        "$ref": "#/components/schemas/FormCover"
      },
      "description": {
        "type": "string"
      },
      "destination": {
        "$ref": "#/components/schemas/FormDestination"
      },
      "heading": {
        "type": "string"
      },
      "limit": {
        "type": "number"
      },
      "sections": {
        "items": {
          "$ref": "#/components/schemas/FormSection"
        },
        "type": "array"
      },
      "sheet": {
        "$ref": "#/components/schemas/FormSheetDestination"
      },
      "starter": {
        "$ref": "#/components/schemas/StarterId"
      },
      "v": {
        "const": 1,
        "type": "number"
      }
    },
    "required": [
      "v",
      "heading",
      "sections"
    ],
    "type": "object"
  },
  "FormDestination": {
    "additionalProperties": false,
    "properties": {
      "status": {
        "type": "string"
      },
      "tabId": {
        "type": "string"
      },
      "typeId": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "typeId",
      "status"
    ],
    "type": "object"
  },
  "FormHalves": {
    "additionalProperties": false,
    "description": "A colour for each half of the page.",
    "properties": {
      "dark": {
        "type": "string"
      },
      "light": {
        "type": "string"
      }
    },
    "required": [
      "light",
      "dark"
    ],
    "type": "object"
  },
  "FormLink": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "open": {
        "type": "boolean"
      }
    },
    "required": [
      "code",
      "open",
      "createdAt"
    ],
    "type": "object"
  },
  "FormLinkResponse": {
    "additionalProperties": false,
    "properties": {
      "canPublish": {
        "type": "boolean"
      },
      "link": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/FormLink"
          },
          {
            "type": "null"
          }
        ]
      },
      "responses": {
        "type": "number"
      },
      "suspendedAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "unseen": {
        "type": "number"
      }
    },
    "required": [
      "link",
      "responses",
      "unseen",
      "suspendedAt",
      "canPublish"
    ],
    "type": "object"
  },
  "FormLook": {
    "additionalProperties": false,
    "properties": {
      "accent": {
        "$ref": "#/components/schemas/FormHalves"
      },
      "backdrop": {
        "$ref": "#/components/schemas/FormHalves"
      },
      "canvas": {
        "$ref": "#/components/schemas/FormCanvas"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "font": {
        "type": "string"
      },
      "onAccent": {
        "$ref": "#/components/schemas/FormHalves"
      }
    },
    "required": [
      "backdrop",
      "accent",
      "onAccent",
      "finish"
    ],
    "type": "object"
  },
  "FormMetricContent": {
    "additionalProperties": false,
    "properties": {
      "formTabId": {
        "type": "string"
      },
      "metric": {
        "$ref": "#/components/schemas/FormMetricKind"
      },
      "name": {
        "type": "string"
      },
      "type": {
        "const": "form-metric",
        "type": "string"
      }
    },
    "required": [
      "type",
      "metric",
      "formTabId"
    ],
    "type": "object"
  },
  "FormMetricKind": {
    "enum": [
      "responses",
      "new",
      "status",
      "limit",
      "closes",
      "link"
    ],
    "type": "string"
  },
  "FormQuestion": {
    "additionalProperties": false,
    "properties": {
      "dropdown": {
        "const": true,
        "type": "boolean"
      },
      "goesTo": {
        "$ref": "#/components/schemas/AnswerTarget"
      },
      "help": {
        "type": "string"
      },
      "highLabel": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "lowLabel": {
        "type": "string"
      },
      "max": {
        "type": "number"
      },
      "min": {
        "type": "number"
      },
      "options": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "other": {
        "const": true,
        "type": "boolean"
      },
      "placeholder": {
        "type": "string"
      },
      "prompt": {
        "type": "string"
      },
      "required": {
        "const": true,
        "type": "boolean"
      },
      "scale": {
        "type": "number"
      },
      "style": {
        "enum": [
          "stars",
          "numbers"
        ],
        "type": "string"
      },
      "type": {
        "$ref": "#/components/schemas/QuestionType"
      },
      "whole": {
        "const": true,
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "type",
      "prompt"
    ],
    "type": "object"
  },
  "FormReportBody": {
    "additionalProperties": false,
    "properties": {
      "note": {
        "type": "string"
      },
      "reason": {
        "$ref": "#/components/schemas/FormReportReason"
      }
    },
    "required": [
      "reason"
    ],
    "type": "object"
  },
  "FormReportReason": {
    "enum": [
      "spam",
      "phishing",
      "offensive",
      "other"
    ],
    "type": "string"
  },
  "FormResponseAccepted": {
    "additionalProperties": false,
    "properties": {
      "number": {
        "type": "number"
      }
    },
    "required": [
      "number"
    ],
    "type": "object"
  },
  "FormResponseBody": {
    "additionalProperties": false,
    "properties": {
      "answers": {
        "additionalProperties": {},
        "type": "object"
      },
      "other": {
        "additionalProperties": {},
        "type": "object"
      },
      "website": {
        "type": "string"
      }
    },
    "required": [
      "answers"
    ],
    "type": "object"
  },
  "FormSection": {
    "additionalProperties": false,
    "properties": {
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "questions": {
        "items": {
          "$ref": "#/components/schemas/FormQuestion"
        },
        "type": "array"
      },
      "showIf": {
        "$ref": "#/components/schemas/SectionRule"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "title",
      "questions"
    ],
    "type": "object"
  },
  "FormSheetDestination": {
    "additionalProperties": false,
    "properties": {
      "columns": {
        "additionalProperties": {
          "type": "string"
        },
        "type": "object"
      },
      "sheetId": {
        "type": "string"
      },
      "tabId": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "sheetId"
    ],
    "type": "object"
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
      "nc": {},
      "nf": {},
      "st": {},
      "u": {},
      "va": {},
      "wr": {}
    },
    "type": "object"
  },
  "FormatRule": {
    "additionalProperties": false,
    "properties": {
      "a": {
        "type": "string"
      },
      "b": {
        "type": "string"
      },
      "c1": {
        "type": "string"
      },
      "c2": {
        "type": "string"
      },
      "fx": {
        "$ref": "#/components/schemas/StoredFormula"
      },
      "id": {
        "type": "string"
      },
      "is": {
        "enum": [
          "when",
          "scale"
        ],
        "type": "string"
      },
      "max": {
        "$ref": "#/components/schemas/ScalePoint"
      },
      "mid": {
        "$ref": "#/components/schemas/ScalePoint"
      },
      "min": {
        "$ref": "#/components/schemas/ScalePoint"
      },
      "op": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ConditionOp"
          },
          {
            "const": "formula",
            "type": "string"
          }
        ]
      },
      "r1": {
        "type": "string"
      },
      "r2": {
        "type": "string"
      },
      "style": {
        "$ref": "#/components/schemas/FormatStyle"
      }
    },
    "required": [
      "c1",
      "c2",
      "id",
      "is",
      "r1",
      "r2"
    ],
    "type": "object"
  },
  "FormatStyle": {
    "additionalProperties": false,
    "properties": {
      "b": {
        "const": true,
        "type": "boolean"
      },
      "bg": {
        "type": "string"
      },
      "fc": {
        "type": "string"
      },
      "i": {
        "const": true,
        "type": "boolean"
      },
      "st": {
        "const": true,
        "type": "boolean"
      },
      "u": {
        "const": true,
        "type": "boolean"
      }
    },
    "type": "object"
  },
  "FreehandElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
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
        "description": "The stroke's points, normalised into its box, and a pen's pressure at each when it reported one, packed into one block: base64 of a version byte, a flags byte and a little-endian record per point (x u16, y u16, optional pressure u8). See docs/specs/006-project/stroke-points.md.",
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
      "themeLockFill": {
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
    "description": "One plan's actions on one of the reader's days.",
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
      "empty": {
        "description": "Nothing drawn: ask for no thumbnail.",
        "type": "boolean"
      },
      "folderId": {
        "description": "Null for `shared`, and for a plan at its space's root.",
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
        "description": "`<projectId>:<day>`.",
        "type": "string"
      },
      "latestAt": {
        "type": "number"
      },
      "name": {
        "description": "The plan's current name.",
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
      "projectId": {
        "type": "string"
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
      "empty",
      "folderId",
      "folderName",
      "id",
      "latestAt",
      "name",
      "ownerName",
      "people",
      "projectId",
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
    "description": "One plan of Jump back in, with the two measures Within reach places it by.",
    "properties": {
      "empty": {
        "description": "Nothing drawn: ask for no thumbnail.",
        "type": "boolean"
      },
      "folderId": {
        "description": "Null for `shared`, and for a plan at its space's root.",
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
        "description": "The plan's current name.",
        "type": "string"
      },
      "ownerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "projectId": {
        "type": "string"
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
      "empty",
      "folderId",
      "folderName",
      "lastUsedAt",
      "name",
      "ownerName",
      "projectId",
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
      }
    },
    "required": [
      "id",
      "name",
      "color"
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
        "description": "Home's unread mark as it stood before this read (the read moves it, once per visit); null when the person had never looked. What happened after it is new to them.",
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
  "ImageElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "alt": {
        "type": "string"
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
      "openComments": {
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
      "threads": {
        "items": {},
        "type": "array"
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
      "assigneeNotifies": {
        "type": "boolean"
      },
      "color": {
        "type": "string"
      },
      "colourField": {
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
            "const": "item",
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
      "statuses": {
        "items": {
          "type": "string"
        },
        "type": "array"
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
      "calculated": {
        "additionalProperties": {
          "additionalProperties": {
            "type": [
              "number",
              "null"
            ]
          },
          "type": "object"
        },
        "description": "Asked for with include=calculated: each card's Calculated field values (a count, a whole percentage, or null), by card id then field id; only cards whose type has a Calculated field. Worked out as read, never stored.",
        "type": "object"
      },
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
      "field": {
        "type": "string"
      },
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
  "KeyRow": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "kind": {
        "enum": [
          "line",
          "tag"
        ],
        "type": "string"
      },
      "style": {
        "type": "string"
      },
      "tag": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "kind"
    ],
    "type": "object"
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
      },
      {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "k": {
            "const": "vrule",
            "type": "string"
          },
          "rule": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/ValidationRule"
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
          "rule"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "at": {
            "type": "number"
          },
          "id": {
            "type": "string"
          },
          "k": {
            "const": "frule",
            "type": "string"
          },
          "rule": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/FormatRule"
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
          "rule"
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
            "const": "fruleOrder",
            "type": "string"
          }
        },
        "required": [
          "k",
          "ids"
        ],
        "type": "object"
      }
    ]
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
      "axis": {
        "const": "right",
        "type": "string"
      },
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
  "LinkedRecordKind": {
    "const": "actions",
    "type": "string"
  },
  "MindFlow": {
    "enum": [
      "tree",
      "leftward",
      "balanced",
      "downward",
      "upward",
      "bubble"
    ],
    "type": "string"
  },
  "MindLook": {
    "const": "person",
    "type": "string"
  },
  "MindSpacing": {
    "description": "How far apart a map's nodes sit (docs/specs/009-elements/mind-node.md \"Spacing\").",
    "enum": [
      "tight",
      "compact",
      "comfortable",
      "wide"
    ],
    "type": "string"
  },
  "NumOp": {
    "enum": [
      "between",
      "notBetween",
      "gt",
      "gte",
      "lt",
      "lte",
      "eq",
      "neq"
    ],
    "type": "string"
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
      "text",
      "custom"
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
          "finish": {
            "$ref": "#/components/schemas/Finish"
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
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "project": {
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
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/OverviewTab"
        },
        "type": "array"
      }
    },
    "required": [
      "project",
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
  "PageColourFill": {
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
          "motion": {
            "$ref": "#/components/schemas/PageMotion"
          },
          "speed": {
            "type": "number"
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
  "PageMotion": {
    "enum": [
      "flow",
      "drift",
      "aurora",
      "ripple",
      "ribbons",
      "mesh",
      "starfield",
      "retro-grid",
      "bokeh",
      "waves",
      "spotlight",
      "beams",
      "sunburst",
      "fireflies",
      "snowfall",
      "lava",
      "dot-wave",
      "clouds",
      "warp",
      "orbits",
      "radar",
      "equaliser",
      "confetti",
      "threads"
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
      "picture": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "color",
      "createdAt"
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
      "sortBy": {
        "items": {
          "$ref": "#/components/schemas/BoardSortLevel"
        },
        "type": "array"
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
      "collects": {
        "$ref": "#/components/schemas/LinkedRecordKind"
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
      "sortBy": {
        "items": {
          "$ref": "#/components/schemas/BoardSortLevel"
        },
        "type": "array"
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
      "done": {
        "type": "boolean"
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
      "done": {
        "const": true,
        "type": "boolean"
      },
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
      "page",
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
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/PlanTabOutline"
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
      },
      "start": {
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
  "PlanTabKind": {
    "enum": [
      "board",
      "sheet",
      "dashboard",
      "form"
    ],
    "type": "string"
  },
  "PlanTabOutline": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "kind": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "sheetIds": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "theme": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "kind"
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
      "dueField": {
        "type": "string"
      },
      "filters": {
        "items": {
          "$ref": "#/components/schemas/CardSearchFilter"
        },
        "type": "array"
      },
      "measure": {
        "type": "string"
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
      "startField": {
        "type": "string"
      },
      "statuses": {
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
      "title": {
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
      "start-calendar",
      "workload",
      "status-mix",
      "priority-matrix",
      "search"
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
  "Project": {
    "additionalProperties": false,
    "properties": {
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
            "$ref": "#/components/schemas/ProjectSource"
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
  "ProjectCommentThread": {
    "additionalProperties": false,
    "properties": {
      "cell": {
        "type": "string"
      },
      "cellRef": {
        "type": "string"
      },
      "comments": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "ai": {
              "const": true,
              "type": "boolean"
            },
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
            "editedAt": {
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
  "ProjectSource": {
    "enum": [
      "mcp",
      "cli"
    ],
    "type": "string"
  },
  "ProjectStats": {
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
  "ProjectSummary": {
    "additionalProperties": false,
    "properties": {
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
            "$ref": "#/components/schemas/ProjectSource"
          },
          {
            "type": "null"
          }
        ]
      },
      "stats": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ProjectStats"
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
  "PublicForm": {
    "additionalProperties": false,
    "properties": {
      "confirmation": {
        "type": "string"
      },
      "cover": {
        "$ref": "#/components/schemas/FormCover"
      },
      "description": {
        "type": "string"
      },
      "heading": {
        "type": "string"
      },
      "sections": {
        "items": {
          "$ref": "#/components/schemas/PublicSection"
        },
        "type": "array"
      }
    },
    "required": [
      "heading",
      "sections",
      "confirmation"
    ],
    "type": "object"
  },
  "PublicFormResponse": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "form": {
            "$ref": "#/components/schemas/PublicForm"
          },
          "look": {
            "$ref": "#/components/schemas/FormLook"
          },
          "state": {
            "const": "open",
            "type": "string"
          }
        },
        "required": [
          "state",
          "form",
          "look"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "heading": {
            "type": "string"
          },
          "look": {
            "$ref": "#/components/schemas/FormLook"
          },
          "message": {
            "type": "string"
          },
          "state": {
            "const": "closed",
            "type": "string"
          }
        },
        "required": [
          "state",
          "heading",
          "message",
          "look"
        ],
        "type": "object"
      }
    ]
  },
  "PublicQuestion": {
    "additionalProperties": false,
    "properties": {
      "dropdown": {
        "const": true,
        "type": "boolean"
      },
      "help": {
        "type": "string"
      },
      "highLabel": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "lowLabel": {
        "type": "string"
      },
      "max": {
        "type": "number"
      },
      "min": {
        "type": "number"
      },
      "options": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "other": {
        "const": true,
        "type": "boolean"
      },
      "placeholder": {
        "type": "string"
      },
      "prompt": {
        "type": "string"
      },
      "required": {
        "const": true,
        "type": "boolean"
      },
      "scale": {
        "type": "number"
      },
      "style": {
        "enum": [
          "stars",
          "numbers"
        ],
        "type": "string"
      },
      "type": {
        "$ref": "#/components/schemas/QuestionType"
      },
      "whole": {
        "const": true,
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "type",
      "prompt"
    ],
    "type": "object"
  },
  "PublicSection": {
    "additionalProperties": false,
    "properties": {
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "questions": {
        "items": {
          "$ref": "#/components/schemas/PublicQuestion"
        },
        "type": "array"
      },
      "showIf": {
        "$ref": "#/components/schemas/SectionRule"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "questions",
      "title"
    ],
    "type": "object"
  },
  "PyramidVariant": {
    "enum": [
      "pyramid",
      "inverted",
      "funnel"
    ],
    "type": "string"
  },
  "QuestionType": {
    "enum": [
      "short",
      "paragraph",
      "number",
      "email",
      "link",
      "date",
      "single",
      "multi",
      "rating",
      "checkbox"
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
      "reverted": {
        "type": "number"
      }
    },
    "required": [
      "changeset",
      "reverted",
      "kept"
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
  "SankeyAlign": {
    "description": "Where the end nodes sit: every end node in the last column, or each node at its own step from the start.",
    "enum": [
      "justify",
      "left"
    ],
    "type": "string"
  },
  "SankeyAnim": {
    "description": "Grow sweeps the diagram in from the left; Flow runs a current along every band; Cascade brings the columns in one after another; Pulse sends a slow wave of light across the bands; Rise grows each column's nodes, then fades their bands in. Flow and Pulse loop; the rest play once.",
    "enum": [
      "grow",
      "flow",
      "cascade",
      "pulse",
      "rise"
    ],
    "type": "string"
  },
  "SankeyFlow": {
    "additionalProperties": false,
    "description": "One flow: `value` of something moving from the node named `from` to the node named `to`.",
    "properties": {
      "from": {
        "type": "string"
      },
      "to": {
        "type": "string"
      },
      "value": {
        "type": "number"
      }
    },
    "required": [
      "from",
      "to",
      "value"
    ],
    "type": "object"
  },
  "SankeyLeftover": {
    "description": "Whether a node that sends on less than it receives draws the difference as a band to a Leftover node.",
    "enum": [
      "show",
      "hide"
    ],
    "type": "string"
  },
  "SankeyLinkColor": {
    "description": "How a flow's band is coloured: its source node, its target node, a blend of both, or one quiet grey.",
    "enum": [
      "source",
      "target",
      "gradient",
      "neutral"
    ],
    "type": "string"
  },
  "SankeyNodeStyle": {
    "additionalProperties": false,
    "description": "A node's own settings, by name: its colour, and `leftover: false` when its leftover is switched off (only `false` is ever stored; absent means it draws one while the diagram shows leftovers).",
    "properties": {
      "color": {
        "type": "string"
      },
      "leftover": {
        "type": "boolean"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "name"
    ],
    "type": "object"
  },
  "SankeyValueLabel": {
    "description": "What a node's label says under its name.",
    "enum": [
      "value",
      "percent",
      "none"
    ],
    "type": "string"
  },
  "ScalePoint": {
    "additionalProperties": false,
    "properties": {
      "at": {
        "enum": [
          "min",
          "max",
          "num",
          "pct",
          "pctile"
        ],
        "type": "string"
      },
      "c": {
        "type": "string"
      },
      "v": {
        "type": "number"
      }
    },
    "required": [
      "c",
      "at"
    ],
    "type": "object"
  },
  "SectionRule": {
    "additionalProperties": false,
    "properties": {
      "anyOf": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "questionId": {
        "type": "string"
      }
    },
    "required": [
      "questionId",
      "anyOf"
    ],
    "type": "object"
  },
  "SequenceElementMessage": {
    "additionalProperties": false,
    "properties": {
      "from": {
        "type": "string"
      },
      "kind": {
        "$ref": "#/components/schemas/SequenceMessageKindName"
      },
      "label": {
        "type": "string"
      },
      "to": {
        "type": "string"
      }
    },
    "required": [
      "from",
      "to",
      "label",
      "kind"
    ],
    "type": "object"
  },
  "SequenceElementParticipant": {
    "additionalProperties": false,
    "properties": {
      "actor": {
        "type": "boolean"
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
      "label"
    ],
    "type": "object"
  },
  "SequenceMessageKindName": {
    "enum": [
      "call",
      "async",
      "reply"
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
      "vote"
    ],
    "type": "string"
  },
  "ShapeElement": {
    "additionalProperties": false,
    "properties": {
      "accentEdge": {
        "$ref": "#/components/schemas/AccentEdge"
      },
      "accentEdgeColor": {
        "type": "string"
      },
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "actions": {
        "items": {
          "$ref": "#/components/schemas/ElementAction"
        },
        "type": "array"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "attachAt": {
        "$ref": "#/components/schemas/AttachPoint"
      },
      "attachedTo": {
        "$ref": "#/components/schemas/ElementId"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "boundaryStyle": {
        "$ref": "#/components/schemas/BoundaryStyle"
      },
      "cardHeader": {
        "type": "boolean"
      },
      "cardMedia": {
        "$ref": "#/components/schemas/CardMedia"
      },
      "cellComments": {
        "$ref": "#/components/schemas/CellCommentThreads"
      },
      "chartAxis": {
        "type": "boolean"
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
      "chartValues": {
        "type": "boolean"
      },
      "chartVariant": {
        "$ref": "#/components/schemas/ChartVariant"
      },
      "checklistItems": {
        "items": {
          "$ref": "#/components/schemas/ChecklistItem"
        },
        "type": "array"
      },
      "chipLook": {
        "$ref": "#/components/schemas/ChipLook"
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
      "conceptAnim": {
        "$ref": "#/components/schemas/ConceptAnim"
      },
      "conceptAnimRepeat": {
        "type": "boolean"
      },
      "conceptAnimSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "conceptRows": {
        "items": {
          "$ref": "#/components/schemas/ConceptRow"
        },
        "type": "array"
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
      "fillColor": {
        "type": "string"
      },
      "fillSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "fixedSize": {
        "type": "boolean"
      },
      "flowDirection": {
        "$ref": "#/components/schemas/FlowchartDirection"
      },
      "flowLaneId": {
        "$ref": "#/components/schemas/ElementId"
      },
      "flowchartId": {
        "type": "string"
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
      "hubSpokes": {
        "type": "boolean"
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
      "keyMeanings": {
        "additionalProperties": {
          "type": "string"
        },
        "type": "object"
      },
      "keyRows": {
        "items": {
          "$ref": "#/components/schemas/KeyRow"
        },
        "type": "array"
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
        "$ref": "#/components/schemas/TextSizePreset"
      },
      "mindFlow": {
        "$ref": "#/components/schemas/MindFlow"
      },
      "mindLook": {
        "$ref": "#/components/schemas/MindLook"
      },
      "mindParentId": {
        "$ref": "#/components/schemas/ElementId"
      },
      "mindSpacing": {
        "$ref": "#/components/schemas/MindSpacing"
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
      "pointerTip": {
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
      "pyramidVariant": {
        "$ref": "#/components/schemas/PyramidVariant"
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
      "responses": {
        "items": {
          "$ref": "#/components/schemas/ParticipantResponse"
        },
        "type": "array"
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
      "sankeyAlign": {
        "$ref": "#/components/schemas/SankeyAlign"
      },
      "sankeyAnim": {
        "$ref": "#/components/schemas/SankeyAnim"
      },
      "sankeyAnimRepeat": {
        "type": "boolean"
      },
      "sankeyAnimSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "sankeyFlows": {
        "items": {
          "$ref": "#/components/schemas/SankeyFlow"
        },
        "type": "array"
      },
      "sankeyLeftover": {
        "$ref": "#/components/schemas/SankeyLeftover"
      },
      "sankeyLeftoverName": {
        "type": "string"
      },
      "sankeyLinkColor": {
        "$ref": "#/components/schemas/SankeyLinkColor"
      },
      "sankeyNodes": {
        "items": {
          "$ref": "#/components/schemas/SankeyNodeStyle"
        },
        "type": "array"
      },
      "sankeyUnit": {
        "type": "string"
      },
      "sankeyValueLabel": {
        "$ref": "#/components/schemas/SankeyValueLabel"
      },
      "sequenceAnim": {
        "const": "play",
        "type": "string"
      },
      "sequenceAnimRepeat": {
        "type": "boolean"
      },
      "sequenceAnimSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "sequenceMessages": {
        "items": {
          "$ref": "#/components/schemas/SequenceElementMessage"
        },
        "type": "array"
      },
      "sequenceNumbered": {
        "type": "boolean"
      },
      "sequenceParticipants": {
        "items": {
          "$ref": "#/components/schemas/SequenceElementParticipant"
        },
        "type": "array"
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
      "sheetAnchor": {
        "$ref": "#/components/schemas/SheetAnchor"
      },
      "stackAlign": {
        "$ref": "#/components/schemas/StackAlign"
      },
      "stackColumns": {
        "type": "number"
      },
      "stackDirection": {
        "$ref": "#/components/schemas/StackDirection"
      },
      "stackGap": {
        "type": "number"
      },
      "stackPadding": {
        "type": "number"
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
      "tags": {
        "items": {
          "type": "string"
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
      "windowTabId": {
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
      "card",
      "badge",
      "step",
      "pointer-note",
      "diagram-key",
      "stack",
      "sequence",
      "boundary",
      "layer-stack",
      "pyramid",
      "cycle",
      "hub",
      "onion",
      "chevrons",
      "stat-row",
      "process",
      "site-header",
      "portal",
      "tab-window",
      "session-button",
      "picker",
      "comment-pin",
      "action-card",
      "temperature",
      "decision",
      "stadium",
      "actor",
      "final-state",
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
      "sankey",
      "icon",
      "sticker",
      "plan-board",
      "plan-card",
      "plan-view",
      "plan-sheet"
    ],
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
      "expiresAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "expiry": {
        "$ref": "#/components/schemas/ShareLinkExpiry"
      },
      "projectId": {
        "type": "string"
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
      "projectId",
      "role",
      "createdAt",
      "expiry",
      "expiresAt",
      "tabId"
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
  "ShareRole": {
    "$ref": "#/components/schemas/AccessLevel"
  },
  "SharedTabsSummary": {
    "additionalProperties": false,
    "properties": {
      "projects": {
        "type": "number"
      },
      "tabs": {
        "type": "number"
      }
    },
    "required": [
      "tabs",
      "projects"
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
  "SheetAnchor": {
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
      "formatRules": {
        "items": {
          "$ref": "#/components/schemas/FormatRule"
        },
        "type": "array"
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
      "rules": {
        "items": {
          "$ref": "#/components/schemas/ValidationRule"
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
  "SheetMetricCell": {
    "additionalProperties": false,
    "properties": {
      "c": {
        "type": "string"
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
  "SheetMetricContent": {
    "additionalProperties": false,
    "properties": {
      "cell": {
        "$ref": "#/components/schemas/SheetMetricCell"
      },
      "col": {
        "type": "string"
      },
      "metric": {
        "$ref": "#/components/schemas/SheetMetricKind"
      },
      "name": {
        "type": "string"
      },
      "sheetId": {
        "type": "string"
      },
      "stat": {
        "$ref": "#/components/schemas/SheetMetricStat"
      },
      "target": {
        "$ref": "#/components/schemas/SheetMetricCell"
      },
      "type": {
        "const": "sheet-metric",
        "type": "string"
      }
    },
    "required": [
      "type",
      "metric",
      "sheetId"
    ],
    "type": "object"
  },
  "SheetMetricKind": {
    "enum": [
      "figure",
      "summary",
      "trend"
    ],
    "type": "string"
  },
  "SheetMetricStat": {
    "enum": [
      "sum",
      "average",
      "min",
      "max",
      "count"
    ],
    "type": "string"
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
      "unchecked": {
        "type": "boolean"
      },
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
  "StackAlign": {
    "enum": [
      "start",
      "center",
      "end"
    ],
    "type": "string"
  },
  "StackDirection": {
    "enum": [
      "row",
      "column",
      "grid"
    ],
    "type": "string"
  },
  "StarterId": {
    "enum": [
      "blank",
      "bug-report",
      "feedback",
      "feature-request",
      "rsvp",
      "job-application",
      "contact"
    ],
    "type": "string"
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
  "StickyElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "addedBy": {
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
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
      "dashboard": {
        "$ref": "#/components/schemas/DashboardLayout"
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "form": {
        "$ref": "#/components/schemas/FormDefinition"
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
      "patternColor": {
        "type": "string"
      },
      "tagColours": {
        "items": {
          "$ref": "#/components/schemas/TagColour"
        },
        "type": "array"
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
      "board",
      "sheet",
      "dashboard",
      "form"
    ],
    "type": "string"
  },
  "TabRecord": {
    "additionalProperties": false,
    "properties": {
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
      "dashboard": {
        "$ref": "#/components/schemas/DashboardLayout"
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "form": {
        "$ref": "#/components/schemas/FormDefinition"
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
      "orderIndex": {
        "type": "number"
      },
      "patternColor": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "rev": {
        "type": "number"
      },
      "tagColours": {
        "items": {
          "$ref": "#/components/schemas/TagColour"
        },
        "type": "array"
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
      "elements",
      "id",
      "name",
      "orderIndex",
      "projectId",
      "rev",
      "updatedAt"
    ],
    "type": "object"
  },
  "TabSummary": {
    "additionalProperties": false,
    "properties": {
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
      "projectId": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
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
      },
      "startedAt": {
        "type": "number"
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
      "voteField": {
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
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
  "TagColour": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "tag": {
        "type": "string"
      }
    },
    "required": [
      "tag",
      "color"
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
  "TeamInviteDecline": {
    "additionalProperties": false,
    "properties": {
      "status": {
        "$ref": "#/components/schemas/TeamMemberStatus"
      },
      "teamName": {
        "type": "string"
      }
    },
    "required": [
      "teamName",
      "status"
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
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamMemberStatus": {
    "enum": [
      "invited",
      "joined",
      "declined",
      "expired"
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
  "TextElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "addedBy": {
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
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
      "textBold": {
        "type": "boolean"
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
  "TextOp": {
    "enum": [
      "contains",
      "notContains",
      "exactly",
      "email",
      "url"
    ],
    "type": "string"
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
      "muted": {
        "type": "boolean"
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
    "anyOf": [
      {
        "$ref": "#/components/schemas/TextSizePreset"
      },
      {
        "type": "number"
      }
    ]
  },
  "TextSizePreset": {
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
  "ThreadPerson": {
    "additionalProperties": false,
    "description": "Who started a thread: their name and colour, and (to themselves alone) their owner id.",
    "properties": {
      "authorId": {
        "type": "string"
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
      "color"
    ],
    "type": "object"
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
  "TrashedProject": {
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
  "ValidationKind": {
    "enum": [
      "list",
      "range",
      "check",
      "num",
      "date",
      "text"
    ],
    "type": "string"
  },
  "ValidationRule": {
    "additionalProperties": false,
    "properties": {
      "a": {
        "type": [
          "number",
          "string"
        ]
      },
      "b": {
        "type": "number"
      },
      "c1": {
        "type": "string"
      },
      "c2": {
        "type": "string"
      },
      "help": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "is": {
        "$ref": "#/components/schemas/ValidationKind"
      },
      "op": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/NumOp"
          },
          {
            "$ref": "#/components/schemas/DateOp"
          },
          {
            "$ref": "#/components/schemas/TextOp"
          }
        ]
      },
      "opts": {
        "items": {
          "$ref": "#/components/schemas/DropdownOption"
        },
        "type": "array"
      },
      "r1": {
        "type": "string"
      },
      "r2": {
        "type": "string"
      },
      "show": {
        "enum": [
          "arrow",
          "plain"
        ],
        "type": "string"
      },
      "src": {
        "$ref": "#/components/schemas/IdRange"
      },
      "warn": {
        "const": true,
        "type": "boolean"
      }
    },
    "required": [
      "c1",
      "c2",
      "id",
      "is",
      "r1",
      "r2"
    ],
    "type": "object"
  },
  "VideoElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
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
      "finish": {
        "$ref": "#/components/schemas/Finish"
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
      "comments",
      "show",
      "find",
      "diff"
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
      "scope": {
        "$ref": "#/components/schemas/WorkbenchScope"
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
      "scope",
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
      },
      "scope": {
        "$ref": "#/components/schemas/WorkbenchScope"
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
      "scope": {
        "$ref": "#/components/schemas/WorkbenchScope"
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
      "scope",
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
      }
    },
    "required": [
      "id",
      "name",
      "color"
    ],
    "type": "object"
  },
  "WorkbenchRole": {
    "$ref": "#/components/schemas/AccessLevel"
  },
  "WorkbenchScope": {
    "enum": [
      "project",
      "workspace"
    ],
    "type": "string"
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
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "expiresAt": {
            "type": "number"
          },
          "folderId": {
            "type": "null"
          },
          "origin": {
            "type": "string"
          },
          "person": {
            "$ref": "#/components/schemas/WorkbenchPerson"
          },
          "projectId": {
            "type": "string"
          },
          "role": {
            "$ref": "#/components/schemas/WorkbenchRole"
          },
          "scope": {
            "const": "project",
            "type": "string"
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
          "expiresAt",
          "folderId",
          "origin",
          "person",
          "projectId",
          "role",
          "scope",
          "session",
          "tabId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "expiresAt": {
            "type": "number"
          },
          "folderId": {
            "type": [
              "string",
              "null"
            ]
          },
          "origin": {
            "type": "string"
          },
          "person": {
            "$ref": "#/components/schemas/WorkbenchPerson"
          },
          "projectId": {
            "type": "null"
          },
          "role": {
            "$ref": "#/components/schemas/WorkbenchRole"
          },
          "scope": {
            "const": "workspace",
            "type": "string"
          },
          "session": {
            "type": "string"
          },
          "tabId": {
            "type": "null"
          }
        },
        "required": [
          "expiresAt",
          "folderId",
          "origin",
          "person",
          "projectId",
          "role",
          "scope",
          "session",
          "tabId"
        ],
        "type": "object"
      }
    ]
  },
  "WorkbenchTicketRequest": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "origin": {
            "type": "string"
          },
          "projectId": {
            "type": "string"
          },
          "scope": {
            "const": "project",
            "type": "string"
          },
          "tabId": {
            "type": "string"
          }
        },
        "required": [
          "projectId",
          "origin"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "folderId": {
            "type": "string"
          },
          "origin": {
            "type": "string"
          },
          "scope": {
            "const": "workspace",
            "type": "string"
          }
        },
        "required": [
          "scope",
          "origin"
        ],
        "type": "object"
      }
    ]
  },
  "WorkbenchTicketResponse": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "projectId": {
        "type": "string"
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
      "projectId",
      "tabId",
      "expiresAt"
    ],
    "type": "object"
  },
  "WorkbenchWorkspaceTicketResponse": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "folderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "scope": {
        "const": "workspace",
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    },
    "required": [
      "url",
      "scope",
      "folderId",
      "expiresAt"
    ],
    "type": "object"
  }
};
