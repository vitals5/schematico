#!/usr/bin/env node
// bridge-server/index.mjs
// Standalone stdio-to-WebSocket MCP Proxy Bridge for Schematico

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';

const WS_PORT = parseInt(process.env.WS_PORT || '3333', 10);
const REQUEST_TIMEOUT_MS = 15000;

// Default tool definitions used when browser has not yet connected or reported its tools
const DEFAULT_TOOLS = [
  // 1. Elements & Wiring
  {
    name: 'get_canvas_state',
    description: 'Returns the current state of the active schematic page (components, pins, wires, texts, boxes, cables, metadata).',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Optional page ID.' }
      }
    }
  },
  {
    name: 'add_component',
    description: 'Places an electrical or installation component at specified (x, y) coordinates with optional rotation, BMK, and function text.',
    inputSchema: {
      type: 'object',
      properties: {
        symbolId: { type: 'string', description: 'Exact symbol ID.' },
        symbolName: { type: 'string', description: 'Fuzzy keyword (e.g. "relay", "motor", "fuse", "Schütz", "Taster").' },
        x: { type: 'number', description: 'X coordinate.' },
        y: { type: 'number', description: 'Y coordinate.' },
        rotation: { type: 'number', enum: [0, 90, 180, 270], description: 'Rotation angle.' },
        bmk: { type: 'string', description: 'Optional device tag / BMK (e.g. "-K1").' },
        functionText: { type: 'string', description: 'Optional functional description text.' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'update_component',
    description: 'Updates properties of an existing placed component (BMK, function text, technical characteristics, manufacturer, position, rotation).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique component ID.' },
        bmk: { type: 'string', description: 'New device tag / BMK.' },
        functionText: { type: 'string', description: 'New functional description.' },
        technicalCharacteristics: { type: 'string', description: 'New technical data.' },
        manufacturer: { type: 'string', description: 'New manufacturer.' },
        articleNumber: { type: 'string', description: 'New part number.' },
        x: { type: 'number', description: 'New X position.' },
        y: { type: 'number', description: 'New Y position.' },
        rotation: { type: 'number', enum: [0, 90, 180, 270], description: 'New rotation angle.' }
      },
      required: ['id']
    }
  },
  {
    name: 'rotate_element',
    description: 'Rotates an element (component, text, cable, or box) by specified delta angle (default 90° clockwise).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Element ID.' },
        angle: { type: 'number', enum: [90, 180, 270, -90], description: 'Rotation angle delta.' }
      },
      required: ['id']
    }
  },
  {
    name: 'move_element',
    description: 'Moves an element by relative delta (dx, dy) or to absolute (x, y).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Element ID.' },
        dx: { type: 'number', description: 'Horizontal offset.' },
        dy: { type: 'number', description: 'Vertical offset.' },
        x: { type: 'number', description: 'Absolute X position.' },
        y: { type: 'number', description: 'Absolute Y position.' }
      },
      required: ['id']
    }
  },
  {
    name: 'draw_wire',
    description: 'Connects two component pins or specific (x1, y1) to (x2, y2) coordinates with an electrical wire.',
    inputSchema: {
      type: 'object',
      properties: {
        fromComponentId: { type: 'string', description: 'Source component ID.' },
        fromPinId: { type: 'string', description: 'Pin ID on source component.' },
        toComponentId: { type: 'string', description: 'Destination component ID.' },
        toPinId: { type: 'string', description: 'Pin ID on destination component.' },
        x1: { type: 'number', description: 'Starting X coordinate.' },
        y1: { type: 'number', description: 'Starting Y coordinate.' },
        x2: { type: 'number', description: 'Ending X coordinate.' },
        y2: { type: 'number', description: 'Ending Y coordinate.' },
        potential: { type: 'string', description: 'Potential designation (e.g. "L1", "N", "PE", "+24V").' },
        color: { type: 'string', description: 'Wire color code.' },
        crossSection: { type: 'string', description: 'Conductor cross-section.' }
      }
    }
  },
  {
    name: 'update_wire',
    description: 'Updates properties of an existing wire (potential, color, cross-section, wire number).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Wire ID.' },
        potential: { type: 'string', description: 'New potential designation.' },
        color: { type: 'string', description: 'New wire color.' },
        crossSection: { type: 'string', description: 'New conductor cross-section.' },
        wireNumber: { type: 'string', description: 'New wire number.' }
      },
      required: ['id']
    }
  },
  {
    name: 'add_cable',
    description: 'Defines a multi-core cable across wires on the schematic sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        startX: { type: 'number', description: 'Starting X position.' },
        startY: { type: 'number', description: 'Starting Y position.' },
        endX: { type: 'number', description: 'Ending X position.' },
        endY: { type: 'number', description: 'Ending Y position.' },
        bmk: { type: 'string', description: 'Cable BMK (e.g. "-W1").' },
        cableType: { type: 'string', description: 'Cable type (e.g. "NYM-J 3x1.5").' },
        crossSection: { type: 'string', description: 'Cross section.' },
        coreCount: { type: 'number', description: 'Number of cores.' }
      },
      required: ['startX', 'startY', 'endX', 'endY']
    }
  },
  {
    name: 'list_cables',
    description: 'Lists all cable definitions on the active schematic page.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Optional page ID.' }
      }
    }
  },
  {
    name: 'delete_element',
    description: 'Removes a component, wire, text, box, or cable by ID from the active schematic page.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Element ID.' }
      },
      required: ['id']
    }
  },
  {
    name: 'clear_canvas',
    description: 'Clears all components, wires, texts, and boxes from the active schematic page.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to proceed.' }
      },
      required: ['confirm']
    }
  },
  {
    name: 'search_symbols',
    description: 'Searches available electrical symbols in the Schematico library by query string or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword.' },
        category: { type: 'string', description: 'Optional category filter.' },
        limit: { type: 'number', description: 'Maximum results.' }
      },
      required: ['query']
    }
  },

  // 2. Project & Page Management
  {
    name: 'get_project_info',
    description: 'Returns project metadata, active page ID, and overview of all pages.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'update_project_info',
    description: 'Updates project metadata (name, description, author, company).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name.' },
        description: { type: 'string', description: 'Description.' },
        author: { type: 'string', description: 'Author.' },
        company: { type: 'string', description: 'Company.' }
      }
    }
  },
  {
    name: 'list_pages',
    description: 'Lists all pages in the project with IDs, sheet numbers, types, titles, and element counts.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_page',
    description: 'Creates a new page in the project (schematic, cover, installation, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        pageType: { type: 'string', enum: ['schematic', 'cover', 'installation', 'terminal_diagram', 'parts_list', 'overview'], description: 'Page type.' },
        title: { type: 'string', description: 'Page title.' },
        pageNumber: { type: 'string', description: 'Sheet number.' },
        higherLevel: { type: 'string', description: 'Higher level function (=A1).' },
        location: { type: 'string', description: 'Mounting location (+S1).' }
      }
    }
  },
  {
    name: 'switch_page',
    description: 'Switches the active drawing canvas to a different page by pageId or pageNumber.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Target page ID.' },
        pageNumber: { type: 'string', description: 'Target page sheet number.' }
      }
    }
  },
  {
    name: 'delete_page',
    description: 'Deletes a page from the project by its pageId.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'ID of the page to delete.' }
      },
      required: ['pageId']
    }
  },
  {
    name: 'update_page_info',
    description: 'Updates page title, sheet number, higher level (=A1), location (+S1), or title block fields.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Page ID.' },
        title: { type: 'string', description: 'Page title.' },
        pageNumber: { type: 'string', description: 'Sheet number.' },
        higherLevel: { type: 'string', description: 'Higher level function.' },
        location: { type: 'string', description: 'Location.' },
        commission: { type: 'string', description: 'Commission number.' },
        author: { type: 'string', description: 'Author.' },
        date: { type: 'string', description: 'Date (YYYY-MM-DD).' },
        revision: { type: 'string', description: 'Revision index.' }
      }
    }
  },

  // 3. Texts & Device Boxes
  {
    name: 'add_text',
    description: 'Places a free text or note on the schematic sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text content.' },
        x: { type: 'number', description: 'X coordinate.' },
        y: { type: 'number', description: 'Y coordinate.' },
        fontSize: { type: 'number', description: 'Font size.' },
        fontColor: { type: 'string', description: 'Color hex.' },
        fontWeight: { type: 'string', enum: ['normal', 'bold'], description: 'Font weight.' },
        align: { type: 'string', enum: ['start', 'center', 'end'], description: 'Alignment.' },
        rotation: { type: 'number', enum: [0, 90, 180, 270], description: 'Rotation angle.' }
      },
      required: ['text', 'x', 'y']
    }
  },
  {
    name: 'update_text',
    description: 'Updates an existing text element on the active page.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Text element ID.' },
        text: { type: 'string', description: 'New text content.' },
        x: { type: 'number', description: 'New X position.' },
        y: { type: 'number', description: 'New Y position.' },
        fontSize: { type: 'number', description: 'New font size.' }
      },
      required: ['id']
    }
  },
  {
    name: 'add_device_box',
    description: 'Adds a device box / black box boundary around functional units.',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Top-left X.' },
        y: { type: 'number', description: 'Top-left Y.' },
        width: { type: 'number', description: 'Width.' },
        height: { type: 'number', description: 'Height.' },
        bmk: { type: 'string', description: 'Device tag / BMK.' },
        label: { type: 'string', description: 'Label text.' },
        lineStyle: { type: 'string', enum: ['solid', 'dashed'], description: 'Line style.' }
      },
      required: ['x', 'y', 'width', 'height']
    }
  },
  {
    name: 'update_device_box',
    description: 'Updates an existing device box.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Device box ID.' },
        x: { type: 'number', description: 'New X.' },
        y: { type: 'number', description: 'New Y.' },
        width: { type: 'number', description: 'New width.' },
        height: { type: 'number', description: 'New height.' },
        bmk: { type: 'string', description: 'New BMK.' },
        label: { type: 'string', description: 'New label.' }
      },
      required: ['id']
    }
  },

  // 4. Macros
  {
    name: 'list_macros',
    description: 'Lists all available macros in the library.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter.' },
        type: { type: 'string', enum: ['window', 'page', 'all'], description: 'Macro type.' }
      }
    }
  },
  {
    name: 'place_macro',
    description: 'Places a multi-element window macro onto the active page at (x, y).',
    inputSchema: {
      type: 'object',
      properties: {
        macroId: { type: 'string', description: 'Macro ID.' },
        macroName: { type: 'string', description: 'Fuzzy macro name.' },
        x: { type: 'number', description: 'Target X.' },
        y: { type: 'number', description: 'Target Y.' }
      },
      required: ['x', 'y']
    }
  },

  // 5. Floor Plan
  {
    name: 'add_wall',
    description: 'Adds a wall segment to an installation floor plan page.',
    inputSchema: {
      type: 'object',
      properties: {
        startX: { type: 'number', description: 'Start X.' },
        startY: { type: 'number', description: 'Start Y.' },
        endX: { type: 'number', description: 'End X.' },
        endY: { type: 'number', description: 'End Y.' },
        thickness: { type: 'number', description: 'Wall thickness.' },
        isExterior: { type: 'boolean', description: 'Exterior wall.' }
      },
      required: ['startX', 'startY', 'endX', 'endY']
    }
  },
  {
    name: 'add_wall_opening',
    description: 'Adds an architectural opening (door, window, opening) to a floor plan wall.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['door', 'window', 'opening', 'garage_door'], description: 'Type of opening.' },
        x: { type: 'number', description: 'Center X.' },
        y: { type: 'number', description: 'Center Y.' },
        width: { type: 'number', description: 'Width.' },
        orientation: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Orientation.' }
      },
      required: ['kind', 'x', 'y']
    }
  },
  {
    name: 'get_floor_plan_state',
    description: 'Returns the floor plan data of the page.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Optional page ID.' }
      }
    }
  },

  // 6. Reports & Views
  {
    name: 'get_parts_list',
    description: 'Generates and returns the complete Bill of Materials (Stückliste) for the project.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_terminal_diagram',
    description: 'Generates and returns the terminal strip diagram (Klemmenplan) with internal/external targets.',
    inputSchema: {
      type: 'object',
      properties: {
        terminalStripBmk: { type: 'string', description: 'Optional terminal strip BMK (e.g. "-X1").' }
      }
    }
  },
  {
    name: 'recalculate_cross_references',
    description: 'Recalculates all contact cross-references across the entire project.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'export_pdf',
    description: 'Exports the schematic project or active page as a vector PDF document.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['all', 'active'], description: 'Export mode.' }
      }
    }
  },
  {
    name: 'zoom_canvas',
    description: 'Adjusts the canvas viewport zoom (fit, in, out, reset).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['fit', 'in', 'out', 'reset'], description: 'Zoom action.' }
      },
      required: ['action']
    }
  }
];

// Active WebSocket connections from open Schematico browser tab(s)
let activeClients = new Set();
let cachedTools = DEFAULT_TOOLS;
let requestIdCounter = 1;
const pendingRequests = new Map();

// Start WebSocket server on WS_PORT
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('listening', () => {
  console.error(`[Schematico MCP Bridge] WebSocket Server running on ws://localhost:${WS_PORT}`);
});

wss.on('connection', (ws) => {
  console.error('[Schematico MCP Bridge] Browser tab connected.');
  activeClients.add(ws);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'schematico/hello') {
        console.error(`[Schematico MCP Bridge] Handshake received from ${msg.params?.app || 'Browser'} (${msg.params?.version || '1.0'})`);
      } else if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        resolve(msg);
      }
    } catch (e) {
      console.error('[Schematico MCP Bridge] Error parsing message from browser:', e);
    }
  });

  ws.on('close', () => {
    console.error('[Schematico MCP Bridge] Browser tab disconnected.');
    activeClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[Schematico MCP Bridge] WebSocket error:', err.message);
  });
});

/**
 * Sends a JSON-RPC request to the connected browser tab and awaits reply.
 */
function sendToBrowser(method, params) {
  return new Promise((resolve, reject) => {
    if (activeClients.size === 0) {
      return reject(
        new Error(
          'No Schematico browser tab is currently connected. Please open Schematico in your browser (http://localhost:5173).'
        )
      );
    }

    const id = ++requestIdCounter;
    const client = Array.from(activeClients)[activeClients.size - 1]; // Pick latest active client

    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Timed out waiting for Schematico canvas response after ${REQUEST_TIMEOUT_MS / 1000}s`));
      }
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, {
      resolve: (val) => {
        clearTimeout(timeout);
        resolve(val);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    });

    client.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}

// Create and configure MCP Server over stdio
const server = new Server(
  {
    name: 'schematico-mcp-bridge',
    version: '1.2.46'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register list_tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (activeClients.size > 0) {
    try {
      const response = await sendToBrowser('tools/list', {});
      if (response?.result?.tools) {
        cachedTools = response.result.tools;
      }
    } catch {
      // Fallback to cached tools
    }
  }

  return {
    tools: cachedTools
  };
});

// Register call_tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const response = await sendToBrowser('tools/call', {
      name,
      arguments: args
    });

    if (response.error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error from Schematico: ${response.error.message || JSON.stringify(response.error)}`
          }
        ]
      };
    }

    return response.result || {
      content: [
        {
          type: 'text',
          text: 'Action completed successfully.'
        }
      ]
    };
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `MCP Bridge Error: ${err.message}`
        }
      ]
    };
  }
});

// Start stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Schematico MCP Bridge] Stdio transport connected and ready for MCP clients (Hermes / Claude Desktop).');
}

main().catch((err) => {
  console.error('[Schematico MCP Bridge] Fatal error:', err);
  process.exit(1);
});
