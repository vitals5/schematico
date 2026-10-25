// src/ai/mcp-tools/definitions.ts
// Standard MCP Tool Schema Definitions for Schematico Electrical CAD

export interface McpToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  items?: Record<string, any>;
  properties?: Record<string, McpToolProperty>;
  required?: string[];
  default?: any;
}

export interface McpToolInputSchema {
  type: 'object';
  properties: Record<string, McpToolProperty>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

export const GET_CANVAS_STATE_TOOL: McpToolDefinition = {
  name: 'get_canvas_state',
  description:
    'Returns the current state of the active schematic page, including placed components, pins, coordinates, wires, and plot frame metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: {
        type: 'string',
        description: 'Optional ID of the page to inspect. If omitted, the currently active page is returned.'
      }
    }
  }
};

export const ADD_COMPONENT_TOOL: McpToolDefinition = {
  name: 'add_component',
  description:
    'Places an electrical or installation component at specified (x, y) coordinates with optional rotation, BMK (device tag), and function text.',
  inputSchema: {
    type: 'object',
    properties: {
      symbolId: {
        type: 'string',
        description:
          'Exact symbol ID (e.g. "contactor_coil", "contact_no", "contact_nc", "fuse_1p", "circuit_breaker_1p", "pushbutton_no", "pilot_lamp", "power_supply_dc", "resistor", "terminal_single", "motor_3phase"). If unknown, provide symbolName.'
      },
      symbolName: {
        type: 'string',
        description:
          'Fuzzy name, keyword, or device type (e.g. "resistor", "switch", "fuse", "relay", "lamp", "power supply", "contactor", "Schütz", "Taster", "Sicherung", "Lampe", "Motor").'
      },
      x: {
        type: 'number',
        description: 'X coordinate in drawing units (standard page width is ~420 mm, grid ~8 mm).'
      },
      y: {
        type: 'number',
        description: 'Y coordinate in drawing units (standard page height is ~297 mm, grid ~8 mm).'
      },
      rotation: {
        type: 'number',
        enum: [0, 90, 180, 270],
        description: 'Rotation angle in degrees: 0, 90, 180, or 270. Default is 0.'
      },
      bmk: {
        type: 'string',
        description:
          'Optional device tag / BMK (e.g. "-K1", "-F1", "-S1", "-M1"). Automatically generated following IEC 81346 if omitted.'
      },
      functionText: {
        type: 'string',
        description: 'Optional functional description (e.g. "Hauptschütz", "Steuersicherung 230V", "Ein-Taster").'
      }
    },
    required: ['x', 'y']
  }
};

export const DRAW_WIRE_TOOL: McpToolDefinition = {
  name: 'draw_wire',
  description:
    'Connects two component pins or specific (x1, y1) to (x2, y2) coordinates with an electrical wire.',
  inputSchema: {
    type: 'object',
    properties: {
      fromComponentId: {
        type: 'string',
        description: 'ID of the source component.'
      },
      fromPinId: {
        type: 'string',
        description: 'Pin ID on the source component (e.g. "13", "14", "A1", "A2", "1", "2"). If omitted, first available or closest pin is chosen.'
      },
      toComponentId: {
        type: 'string',
        description: 'ID of the destination component.'
      },
      toPinId: {
        type: 'string',
        description: 'Pin ID on the destination component (e.g. "13", "14", "A1", "A2", "1", "2"). If omitted, first available or closest pin is chosen.'
      },
      x1: {
        type: 'number',
        description: 'Starting X coordinate (used when connecting coordinates directly).'
      },
      y1: {
        type: 'number',
        description: 'Starting Y coordinate (used when connecting coordinates directly).'
      },
      x2: {
        type: 'number',
        description: 'Ending X coordinate (used when connecting coordinates directly).'
      },
      y2: {
        type: 'number',
        description: 'Ending Y coordinate (used when connecting coordinates directly).'
      },
      potential: {
        type: 'string',
        description: 'Potential designation (e.g. "L1", "L2", "L3", "N", "PE", "+24V", "0V", "Signal"). Default is "L1".'
      },
      color: {
        type: 'string',
        description: 'Wire color code (e.g. "BK", "BU", "GNYE", "RD", "WH"). Defaults to color matching the potential.'
      },
      crossSection: {
        type: 'string',
        description: 'Conductor cross-section (e.g. "1.5mm²", "2.5mm²", "0.75mm²"). Default is "1.5mm²".'
      }
    }
  }
};

export const DELETE_ELEMENT_TOOL: McpToolDefinition = {
  name: 'delete_element',
  description: 'Removes a component or wire by ID from the active schematic page.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique ID of the component or wire to delete.'
      }
    },
    required: ['id']
  }
};

export const CLEAR_CANVAS_TOOL: McpToolDefinition = {
  name: 'clear_canvas',
  description: 'Clears all components and wires from the active schematic page.',
  inputSchema: {
    type: 'object',
    properties: {
      confirm: {
        type: 'boolean',
        description: 'Must be explicitly set to true to execute the clear canvas operation.'
      }
    },
    required: ['confirm']
  }
};

export const SEARCH_SYMBOLS_TOOL: McpToolDefinition = {
  name: 'search_symbols',
  description: 'Searches available electrical symbols in the Schematico library by query string or category.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keyword (e.g. "relay", "motor", "Schütz", "fuse", "switch", "sensor", "klemme", "24V").'
      },
      category: {
        type: 'string',
        description: 'Optional category filter: "relays", "protection", "supply", "controls", "motors", "terminals", "sensors", "automation", "installation".'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 15).'
      }
    },
    required: ['query']
  }
};

export const SCHEMATICO_MCP_TOOLS: McpToolDefinition[] = [
  GET_CANVAS_STATE_TOOL,
  ADD_COMPONENT_TOOL,
  DRAW_WIRE_TOOL,
  DELETE_ELEMENT_TOOL,
  CLEAR_CANVAS_TOOL,
  SEARCH_SYMBOLS_TOOL
];
