// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-openapi-schemas.mjs from @livediagram/api-schema.
// Regenerate with: pnpm --filter @livediagram/api gen:openapi
// Served as the `components.schemas` of GET /api/openapi.json (spec/37).
import type { ComponentSchemas } from './types';

export const COMPONENT_SCHEMAS: ComponentSchemas = {
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
      "ne",
      "e",
      "se",
      "s",
      "sw",
      "w",
      "nw"
    ],
    "type": "string"
  },
  "AnimationSpeed": {
    "enum": [
      "slow",
      "normal",
      "fast"
    ],
    "type": "string"
  },
  "AnnotationElement": {
    "additionalProperties": false,
    "properties": {
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
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
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
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
      }
    },
    "required": [
      "id",
      "name",
      "createdAt",
      "lastUsedAt",
      "expiresAt"
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
      "flow": {
        "$ref": "#/components/schemas/ArrowFlow"
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
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "opacity": {
        "type": "number"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
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
        "$ref": "#/components/schemas/TableElement"
      },
      {
        "$ref": "#/components/schemas/AnnotationElement"
      },
      {
        "$ref": "#/components/schemas/LinkCardElement"
      }
    ]
  },
  "CapabilitiesResponse": {
    "additionalProperties": false,
    "properties": {
      "aiEnabled": {
        "type": "boolean"
      },
      "emailEnabled": {
        "type": "boolean"
      }
    },
    "required": [
      "aiEnabled"
    ],
    "type": "object"
  },
  "ChangeLogEntry": {
    "additionalProperties": false,
    "properties": {
      "afterState": {
        "additionalProperties": {},
        "type": "object"
      },
      "beforeState": {
        "additionalProperties": {},
        "type": "object"
      },
      "createdAt": {
        "type": "number"
      },
      "elementIds": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "id": {
        "type": "string"
      },
      "kind": {
        "$ref": "#/components/schemas/ChangeLogKind"
      },
      "participantColor": {
        "type": "string"
      },
      "participantId": {
        "type": "string"
      },
      "participantName": {
        "type": "string"
      },
      "summary": {
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
      "tabId",
      "participantId",
      "participantName",
      "participantColor",
      "kind",
      "summary",
      "elementIds",
      "beforeState",
      "afterState",
      "createdAt"
    ],
    "type": "object"
  },
  "ChangeLogKind": {
    "enum": [
      "add",
      "edit",
      "delete",
      "revert"
    ],
    "type": "string"
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
      "text": {
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
  "Diagram": {
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
      "name": {
        "type": "string"
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
            "$ref": "#/components/schemas/DiagramSource"
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
      }
    },
    "required": [
      "id",
      "ownerId",
      "name",
      "tabs",
      "shareable",
      "shareCode",
      "folderId",
      "teamId",
      "source",
      "savedAt",
      "createdAt",
      "ownerName",
      "ownerColor"
    ],
    "type": "object"
  },
  "DiagramSource": {
    "enum": [
      "ai",
      "mcp"
    ],
    "type": "string"
  },
  "DiagramSummary": {
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
      "name": {
        "type": "string"
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
            "$ref": "#/components/schemas/DiagramSource"
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
      }
    },
    "required": [
      "id",
      "ownerId",
      "name",
      "shareable",
      "shareCode",
      "folderId",
      "teamId",
      "source",
      "savedAt",
      "createdAt"
    ],
    "type": "object"
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
  "ElementAnimation": {
    "enum": [
      "pulse",
      "blink",
      "glow",
      "trace",
      "gradient",
      "bounce",
      "wobble",
      "shake",
      "jelly",
      "float",
      "swing"
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
          "diagramId": {
            "type": "string"
          },
          "kind": {
            "const": "diagram",
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "diagramId",
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
          },
          "manual": {
            "type": "boolean"
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
  "FreehandElement": {
    "additionalProperties": false,
    "properties": {
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
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
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "points": {
        "items": {
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
        "type": "array"
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
      "points",
      "closed"
    ],
    "type": "object"
  },
  "IconAnimation": {
    "enum": [
      "spin",
      "beat",
      "pulse",
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
  "ImageElement": {
    "additionalProperties": false,
    "properties": {
      "alt": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
      },
      "height": {
        "type": "number"
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
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
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
  "Padding": {
    "enum": [
      "none",
      "sm",
      "md",
      "lg"
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
  "ProgressAnim": {
    "enum": [
      "fill",
      "pulse",
      "stripes"
    ],
    "type": "string"
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
  "RunSize": {
    "enum": [
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "ShapeElement": {
    "additionalProperties": false,
    "properties": {
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "chartLegend": {
        "type": "boolean"
      },
      "chartLegendPosition": {
        "$ref": "#/components/schemas/ChartLegendPosition"
      },
      "colorPreset": {
        "type": "string"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
      },
      "height": {
        "type": "number"
      },
      "iconAnimation": {
        "$ref": "#/components/schemas/IconAnimation"
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
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
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
      "note": {
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
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
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "shape": {
        "$ref": "#/components/schemas/ShapeKind"
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
      "smartwatch",
      "progress-bar",
      "progress-ring",
      "timeline-rail",
      "rating",
      "pie-chart",
      "bar-chart",
      "line-chart",
      "icon"
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
      "diagramId": {
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
      "role": {
        "$ref": "#/components/schemas/ShareRole"
      }
    },
    "required": [
      "code",
      "diagramId",
      "role",
      "createdAt",
      "expiry",
      "expiresAt"
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
    "enum": [
      "edit",
      "view"
    ],
    "type": "string"
  },
  "SharedWithItem": {
    "additionalProperties": false,
    "properties": {
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
      }
    },
    "required": [
      "id",
      "name",
      "savedAt",
      "role",
      "shareCode",
      "ownerName",
      "ownerColor"
    ],
    "type": "object"
  },
  "StickyElement": {
    "additionalProperties": false,
    "properties": {
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
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
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
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
  "Tab": {
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
      "backgroundPatternScale": {
        "type": "number"
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
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "id": {
        "$ref": "#/components/schemas/TabId"
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
  "TabSummary": {
    "additionalProperties": false,
    "properties": {
      "diagramId": {
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
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "diagramId",
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
      "revealed": {
        "type": "boolean"
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
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
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
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
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
      "Rotated",
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
      "Returned"
    ],
    "type": "string"
  },
  "TelemetryCategory": {
    "enum": [
      "Diagram",
      "Element",
      "Tab",
      "Theme",
      "Canvas",
      "Template",
      "Comment",
      "Note",
      "Search",
      "UI",
      "Folder",
      "Session",
      "AI",
      "Team",
      "Participant",
      "Help",
      "Token",
      "Mcp"
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
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
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
      "groupId": {
        "$ref": "#/components/schemas/ElementId"
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
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "locked": {
        "type": "boolean"
      },
      "note": {
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
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
      "italic": {
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
    "enum": [
      "scale",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "TimerMode": {
    "enum": [
      "countdown",
      "stopwatch"
    ],
    "type": "string"
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
  }
};
