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

// -------------------------------------------------------------
// 1. Core Canvas State & Management Tools
// -------------------------------------------------------------

export const GET_CANVAS_STATE_TOOL: McpToolDefinition = {
  name: 'get_canvas_state',
  description:
    'Returns the current state of the active schematic page, including placed components (with physical dimensions, bounds, and pin coordinates), wires, texts, boxes, cables, and plot frame metadata.',
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
    'Places an electrical or installation component at specified (x, y) coordinates with optional rotation, BMK (device tag), and function text. Returns the physical symbol dimensions (width, height), bounding box, and warns if it collides with existing elements.',
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
      },
      technicalCharacteristics: {
        type: 'string',
        description: 'Optional technical data (e.g. "4.0kW 400V 8.5A", "230V 16A").'
      },
      manufacturer: {
        type: 'string',
        description: 'Optional manufacturer (e.g. "Siemens", "Eaton", "Schneider Electric", "Phoenix Contact").'
      },
      articleNumber: {
        type: 'string',
        description: 'Optional order / article number (e.g. "3RT2026-1BB40").'
      }
    },
    required: ['x', 'y']
  }
};

export const UPDATE_COMPONENT_TOOL: McpToolDefinition = {
  name: 'update_component',
  description:
    'Updates properties of an existing placed component (BMK, function text, technical characteristics, manufacturer, position, rotation, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique ID of the placed component to update.'
      },
      bmk: {
        type: 'string',
        description: 'New device tag / BMK (e.g. "-K2", "-Q1").'
      },
      functionText: {
        type: 'string',
        description: 'New functional description text.'
      },
      technicalCharacteristics: {
        type: 'string',
        description: 'New technical data (e.g. "7.5kW 400V").'
      },
      manufacturer: {
        type: 'string',
        description: 'New manufacturer.'
      },
      articleNumber: {
        type: 'string',
        description: 'New article / part number.'
      },
      mountingLocation: {
        type: 'string',
        description: 'Mounting location (e.g. "+S1", "+UV").'
      },
      higherLevelFunction: {
        type: 'string',
        description: 'Higher level designation (e.g. "=A1").'
      },
      x: {
        type: 'number',
        description: 'New X position coordinate.'
      },
      y: {
        type: 'number',
        description: 'New Y position coordinate.'
      },
      rotation: {
        type: 'number',
        enum: [0, 90, 180, 270],
        description: 'New rotation angle in degrees.'
      }
    },
    required: ['id']
  }
};

export const ROTATE_ELEMENT_TOOL: McpToolDefinition = {
  name: 'rotate_element',
  description:
    'Rotates an element (component, text, cable, or box) by specified delta angle (default 90 degrees clockwise).',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the element to rotate.'
      },
      angle: {
        type: 'number',
        enum: [90, 180, 270, -90],
        description: 'Rotation angle delta in degrees (default: 90).'
      }
    },
    required: ['id']
  }
};

export const MOVE_ELEMENT_TOOL: McpToolDefinition = {
  name: 'move_element',
  description:
    'Moves an element (component, text, cable, or box) either by a relative offset (dx, dy) or to an absolute coordinate (x, y).',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the element to move.'
      },
      dx: {
        type: 'number',
        description: 'Relative horizontal displacement in drawing units.'
      },
      dy: {
        type: 'number',
        description: 'Relative vertical displacement in drawing units.'
      },
      x: {
        type: 'number',
        description: 'Absolute target X position.'
      },
      y: {
        type: 'number',
        description: 'Absolute target Y position.'
      }
    },
    required: ['id']
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
      },
      wireNumber: {
        type: 'string',
        description: 'Optional wire number tag (e.g. "101", "102").'
      }
    }
  }
};

export const UPDATE_WIRE_TOOL: McpToolDefinition = {
  name: 'update_wire',
  description: 'Updates properties of an existing wire (potential, color, cross-section, wire number).',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique ID of the wire to update.'
      },
      potential: {
        type: 'string',
        description: 'New potential designation (e.g. "L2", "N", "PE", "+24V", "0V").'
      },
      color: {
        type: 'string',
        description: 'New wire color code (e.g. "BU", "BK", "GNYE", "DB").'
      },
      crossSection: {
        type: 'string',
        description: 'New wire cross-section (e.g. "2.5mm²", "4mm²").'
      },
      wireNumber: {
        type: 'string',
        description: 'New wire number (e.g. "105").'
      }
    },
    required: ['id']
  }
};

export const ADD_CABLE_TOOL: McpToolDefinition = {
  name: 'add_cable',
  description:
    'Defines a multi-core cable (e.g. NYM-J 5x2.5, ÖLFLEX 4G1.5) cutting across wires on the schematic sheet.',
  inputSchema: {
    type: 'object',
    properties: {
      startX: { type: 'number', description: 'Starting X position of the cable line.' },
      startY: { type: 'number', description: 'Starting Y position of the cable line.' },
      endX: { type: 'number', description: 'Ending X position of the cable line.' },
      endY: { type: 'number', description: 'Ending Y position of the cable line.' },
      bmk: { type: 'string', description: 'Cable BMK (e.g. "-W1", "-W2"). Defaults to next available -W tag.' },
      cableType: { type: 'string', description: 'Cable designation (e.g. "NYM-J 3x1.5", "ÖLFLEX CLASSIC 110 5G2.5").' },
      crossSection: { type: 'string', description: 'Conductor cross-section (e.g. "1.5mm²", "2.5mm²"). Default: "1.5mm²".' },
      coreCount: { type: 'number', description: 'Number of cores (e.g. 3, 5). Default: 3.' },
      description: { type: 'string', description: 'Optional cable description / function text.' }
    },
    required: ['startX', 'startY', 'endX', 'endY']
  }
};

export const LIST_CABLES_TOOL: McpToolDefinition = {
  name: 'list_cables',
  description: 'Lists all cable definitions on the active schematic page or across the project.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'Optional page ID to filter by. Defaults to active page.' }
    }
  }
};

export const DELETE_ELEMENT_TOOL: McpToolDefinition = {
  name: 'delete_element',
  description: 'Removes a component, wire, text, box, or cable by ID from the active schematic page.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique ID of the element to delete.'
      }
    },
    required: ['id']
  }
};

export const CLEAR_CANVAS_TOOL: McpToolDefinition = {
  name: 'clear_canvas',
  description: 'Clears all components, wires, texts, and boxes from the active schematic page.',
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

// -------------------------------------------------------------
// 2. Project & Page Management Tools
// -------------------------------------------------------------

export const GET_PROJECT_INFO_TOOL: McpToolDefinition = {
  name: 'get_project_info',
  description: 'Returns high-level project metadata, active page ID, and overview of all pages in the project.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export const UPDATE_PROJECT_INFO_TOOL: McpToolDefinition = {
  name: 'update_project_info',
  description: 'Updates project metadata (name/title, description, author, company).',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Project name / title.' },
      description: { type: 'string', description: 'Project description.' },
      author: { type: 'string', description: 'Author / engineer name.' },
      company: { type: 'string', description: 'Company / organization name.' }
    }
  }
};

export const LIST_PAGES_TOOL: McpToolDefinition = {
  name: 'list_pages',
  description: 'Lists all pages in the project with IDs, sheet numbers, types, titles, and element counts.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export const CREATE_PAGE_TOOL: McpToolDefinition = {
  name: 'create_page',
  description: 'Creates a new page in the project (schematic, cover, installation, terminal_diagram, or parts_list).',
  inputSchema: {
    type: 'object',
    properties: {
      pageType: {
        type: 'string',
        enum: ['schematic', 'cover', 'installation', 'terminal_diagram', 'parts_list', 'overview'],
        description: 'Type of the page (default: "schematic").'
      },
      title: { type: 'string', description: 'Page title (e.g. "Hauptstromkreis Antrieb 1", "Steuerspannung 24V DC").' },
      pageNumber: { type: 'string', description: 'Sheet number (e.g. "2", "3.1"). Automatically assigned if omitted.' },
      higherLevel: { type: 'string', description: 'Higher level function (e.g. "=A1"). Defaults to project setting.' },
      location: { type: 'string', description: 'Mounting location (e.g. "+S1"). Defaults to project setting.' }
    }
  }
};

export const SWITCH_PAGE_TOOL: McpToolDefinition = {
  name: 'switch_page',
  description: 'Switches the active drawing canvas to a different page by pageId or pageNumber.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'ID of the page to activate.' },
      pageNumber: { type: 'string', description: 'Sheet number of the page to activate (alternative to pageId).' }
    }
  }
};

export const DELETE_PAGE_TOOL: McpToolDefinition = {
  name: 'delete_page',
  description: 'Deletes a page from the project by its pageId (cannot delete the only remaining page).',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'ID of the page to delete.' }
    },
    required: ['pageId']
  }
};

export const UPDATE_PAGE_INFO_TOOL: McpToolDefinition = {
  name: 'update_page_info',
  description: 'Updates page title, sheet number, higher level (=A1), location (+S1), or title block fields.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'ID of the page to update (defaults to active page).' },
      title: { type: 'string', description: 'New page title.' },
      pageNumber: { type: 'string', description: 'New sheet number.' },
      higherLevel: { type: 'string', description: 'New higher level function (=Anlage).' },
      location: { type: 'string', description: 'New location (+Ort).' },
      commission: { type: 'string', description: 'Order / Commission number in title block.' },
      author: { type: 'string', description: 'Author name in title block.' },
      date: { type: 'string', description: 'Date in title block (YYYY-MM-DD).' },
      revision: { type: 'string', description: 'Revision index.' }
    }
  }
};

// -------------------------------------------------------------
// 3. Text & Device Box Annotations
// -------------------------------------------------------------

export const ADD_TEXT_TOOL: McpToolDefinition = {
  name: 'add_text',
  description: 'Places a free text or note on the schematic sheet.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text content (supports multiline).' },
      x: { type: 'number', description: 'X coordinate.' },
      y: { type: 'number', description: 'Y coordinate.' },
      fontSize: { type: 'number', description: 'Font size in px (default: 12).' },
      fontColor: { type: 'string', description: 'Text color hex (default: "#edf2f7").' },
      fontWeight: { type: 'string', enum: ['normal', 'bold'], description: 'Font weight.' },
      align: { type: 'string', enum: ['start', 'center', 'end'], description: 'Text alignment.' },
      rotation: { type: 'number', enum: [0, 90, 180, 270], description: 'Text rotation angle.' }
    },
    required: ['text', 'x', 'y']
  }
};

export const UPDATE_TEXT_TOOL: McpToolDefinition = {
  name: 'update_text',
  description: 'Updates an existing text element on the active page.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'ID of the text element to update.' },
      text: { type: 'string', description: 'New text content.' },
      x: { type: 'number', description: 'New X coordinate.' },
      y: { type: 'number', description: 'New Y coordinate.' },
      fontSize: { type: 'number', description: 'New font size in px.' },
      fontColor: { type: 'string', description: 'New font color hex.' },
      fontWeight: { type: 'string', enum: ['normal', 'bold'], description: 'New font weight.' },
      rotation: { type: 'number', enum: [0, 90, 180, 270], description: 'New rotation angle.' }
    },
    required: ['id']
  }
};

export const ADD_DEVICE_BOX_TOOL: McpToolDefinition = {
  name: 'add_device_box',
  description: 'Adds a device box / black box boundary around functional units (e.g. PLC, frequency drive, module).',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'Top-left X coordinate.' },
      y: { type: 'number', description: 'Top-left Y coordinate.' },
      width: { type: 'number', description: 'Box width.' },
      height: { type: 'number', description: 'Box height.' },
      bmk: { type: 'string', description: 'Device tag / BMK (e.g. "-U1", "-A2").' },
      label: { type: 'string', description: 'Box label text (e.g. "Frequenzumrichter G120").' },
      description: { type: 'string', description: 'Sub-label or description.' },
      lineStyle: { type: 'string', enum: ['solid', 'dashed'], description: 'Line style (default: "dashed").' },
      color: { type: 'string', description: 'Border color hex (default: "#63b3ed").' }
    },
    required: ['x', 'y', 'width', 'height']
  }
};

export const UPDATE_DEVICE_BOX_TOOL: McpToolDefinition = {
  name: 'update_device_box',
  description: 'Updates an existing device box (dimensions, BMK, label, line style).',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'ID of the device box to update.' },
      x: { type: 'number', description: 'New top-left X coordinate.' },
      y: { type: 'number', description: 'New top-left Y coordinate.' },
      width: { type: 'number', description: 'New width.' },
      height: { type: 'number', description: 'New height.' },
      bmk: { type: 'string', description: 'New BMK.' },
      label: { type: 'string', description: 'New label text.' },
      description: { type: 'string', description: 'New description text.' },
      lineStyle: { type: 'string', enum: ['solid', 'dashed'], description: 'New line style.' }
    },
    required: ['id']
  }
};

// -------------------------------------------------------------
// 4. Macro System
// -------------------------------------------------------------

export const LIST_MACROS_TOOL: McpToolDefinition = {
  name: 'list_macros',
  description: 'Lists all available macros in the library (built-in IEC assemblies, motor starters, supply units, user macros).',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Optional category filter.' },
      type: { type: 'string', enum: ['window', 'page', 'all'], description: 'Filter by macro type (default: "all").' }
    }
  }
};

export const PLACE_MACRO_TOOL: McpToolDefinition = {
  name: 'place_macro',
  description: 'Places a multi-element window macro (.ema) or a complete pre-engineered page macro (.ems, e.g. "macro_ems_messkonzept_mk_c3" or "macro_ems_full_feed_page") onto the schematic.',
  inputSchema: {
    type: 'object',
    properties: {
      macroId: { type: 'string', description: 'ID of the macro to place (e.g. "macro_ems_messkonzept_mk_c3", "macro_ems_full_feed_page", "macro_ema_motorabzweig_400v", "macro_ema_wendeschuetz_400v", "macro_ema_power_supply_24v").' },
      macroName: { type: 'string', description: 'Fuzzy name or search keyword of the macro (e.g. "Messkonzept MK C3", "Wendeschütz", "Motor Feeder", "Supply").' },
      x: { type: 'number', description: 'Target X coordinate (for window macros; default: 80; not needed for page macros).' },
      y: { type: 'number', description: 'Target Y coordinate (for window macros; default: 60; not needed for page macros).' }
    }
  }
};

// -------------------------------------------------------------
// 5. Architectural Installation Plan (Floor Plan)
// -------------------------------------------------------------

export const ADD_WALL_TOOL: McpToolDefinition = {
  name: 'add_wall',
  description: 'Adds a wall segment to an installation floor plan page.',
  inputSchema: {
    type: 'object',
    properties: {
      startX: { type: 'number', description: 'Starting X coordinate.' },
      startY: { type: 'number', description: 'Starting Y coordinate.' },
      endX: { type: 'number', description: 'Ending X coordinate.' },
      endY: { type: 'number', description: 'Ending Y coordinate.' },
      thickness: { type: 'number', description: 'Wall thickness in drawing units / mm (default: 24).' },
      isExterior: { type: 'boolean', description: 'Whether this is an exterior wall (default: false).' }
    },
    required: ['startX', 'startY', 'endX', 'endY']
  }
};

export const ADD_WALL_OPENING_TOOL: McpToolDefinition = {
  name: 'add_wall_opening',
  description: 'Adds an architectural opening (door, window, opening, garage door) to a floor plan wall.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['door', 'window', 'opening', 'garage_door'],
        description: 'Type of opening.'
      },
      x: { type: 'number', description: 'Center X coordinate.' },
      y: { type: 'number', description: 'Center Y coordinate.' },
      width: { type: 'number', description: 'Opening width in units / mm (default: 90).' },
      orientation: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Orientation along wall.' },
      wallId: { type: 'string', description: 'Optional ID of the wall segment.' }
    },
    required: ['kind', 'x', 'y']
  }
};

export const GET_FLOOR_PLAN_STATE_TOOL: McpToolDefinition = {
  name: 'get_floor_plan_state',
  description: 'Returns the floor plan data (walls, openings, rooms, installation circuits, scale calibration) of the page.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: { type: 'string', description: 'Optional page ID. Defaults to active page.' }
    }
  }
};

// -------------------------------------------------------------
// 6. Reports, Diagnostics & Exports
// -------------------------------------------------------------

export const GET_PARTS_LIST_TOOL: McpToolDefinition = {
  name: 'get_parts_list',
  description: 'Generates and returns the complete Bill of Materials (Stückliste) for the project, grouped by article number and manufacturer.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export const GET_TERMINAL_DIAGRAM_TOOL: McpToolDefinition = {
  name: 'get_terminal_diagram',
  description: 'Generates and returns the terminal strip diagram (Klemmenplan) with internal and external connection targets.',
  inputSchema: {
    type: 'object',
    properties: {
      terminalStripBmk: {
        type: 'string',
        description: 'Optional terminal strip BMK (e.g. "-X1", "-X2") to filter results. If omitted, all terminal strips are returned.'
      }
    }
  }
};

export const RECALCULATE_CROSS_REFERENCES_TOOL: McpToolDefinition = {
  name: 'recalculate_cross_references',
  description: 'Recalculates all contact cross-references (Kontaktspiegel) and interruption points across the entire project.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export const EXPORT_PDF_TOOL: McpToolDefinition = {
  name: 'export_pdf',
  description: 'Exports the schematic project or active page as a vector PDF document.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['all', 'active'],
        description: 'Export all pages or only the active page (default: "active").'
      }
    }
  }
};

export const ZOOM_CANVAS_TOOL: McpToolDefinition = {
  name: 'zoom_canvas',
  description: 'Adjusts the canvas viewport zoom (fit to screen, zoom in, zoom out, reset 100%).',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['fit', 'in', 'out', 'reset'],
        description: 'Viewport zoom action.'
      }
    },
    required: ['action']
  }
};

export const DISTRIBUTE_SHEET_LAYOUT_TOOL: McpToolDefinition = {
  name: 'distribute_sheet_layout',
  description:
    'Automatically analyzes and distributes all components, columns, and wires evenly across the entire DIN A3 drawing sheet (X: 75..345 mm, Y: 50..240 mm). Eliminates cramped layouts, maximizes sheet utilization, avoids label collisions, and updates autoconnections.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: {
        type: 'string',
        description: 'Optional ID of the page to distribute. If omitted, the currently active page is rebalanced.'
      },
      horizontalSpread: {
        type: 'string',
        enum: ['full_sheet', 'compact', 'center'],
        description: 'Layout mode. "full_sheet" (default) spreads columns across the full DIN A3 width (X: 75..340 mm). "center" centers the layout. "compact" keeps columns closer together.'
      },
      columnCoordinates: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional explicit X coordinates for each column (e.g. [85, 205, 315] for a 3-strang circuit). If omitted, optimal full-sheet column centers are automatically calculated.'
      },
      clearIntermediateWireWaypoints: {
        type: 'boolean',
        description: 'Whether to clear manual zigzag waypoints on moved wires so the CAD engine re-routes cleanly (default: true).'
      }
    }
  }
};

// -------------------------------------------------------------
// All Registered MCP Tools in Schematico
// -------------------------------------------------------------

export const SCHEMATICO_MCP_TOOLS: McpToolDefinition[] = [
  // Core Elements
  GET_CANVAS_STATE_TOOL,
  ADD_COMPONENT_TOOL,
  UPDATE_COMPONENT_TOOL,
  ROTATE_ELEMENT_TOOL,
  MOVE_ELEMENT_TOOL,
  DISTRIBUTE_SHEET_LAYOUT_TOOL,
  DRAW_WIRE_TOOL,
  UPDATE_WIRE_TOOL,
  ADD_CABLE_TOOL,
  LIST_CABLES_TOOL,
  DELETE_ELEMENT_TOOL,
  CLEAR_CANVAS_TOOL,
  SEARCH_SYMBOLS_TOOL,

  // Text & Annotations
  ADD_TEXT_TOOL,
  UPDATE_TEXT_TOOL,
  ADD_DEVICE_BOX_TOOL,
  UPDATE_DEVICE_BOX_TOOL,

  // Project & Page Management
  GET_PROJECT_INFO_TOOL,
  UPDATE_PROJECT_INFO_TOOL,
  LIST_PAGES_TOOL,
  CREATE_PAGE_TOOL,
  SWITCH_PAGE_TOOL,
  DELETE_PAGE_TOOL,
  UPDATE_PAGE_INFO_TOOL,

  // Macros
  LIST_MACROS_TOOL,
  PLACE_MACRO_TOOL,

  // Architectural Floor Plan
  ADD_WALL_TOOL,
  ADD_WALL_OPENING_TOOL,
  GET_FLOOR_PLAN_STATE_TOOL,

  // Reports & View
  GET_PARTS_LIST_TOOL,
  GET_TERMINAL_DIAGRAM_TOOL,
  RECALCULATE_CROSS_REFERENCES_TOOL,
  EXPORT_PDF_TOOL,
  ZOOM_CANVAS_TOOL
];
