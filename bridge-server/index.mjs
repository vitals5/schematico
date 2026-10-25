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
  {
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
  },
  {
    name: 'add_component',
    description:
      'Places an electrical or installation component at specified (x, y) coordinates with optional rotation, BMK (device tag), and function text.',
    inputSchema: {
      type: 'object',
      properties: {
        symbolId: {
          type: 'string',
          description:
            'Exact symbol ID (e.g. "contactor_coil", "contact_no", "contact_nc", "fuse_1p", "circuit_breaker_1p", "pushbutton_no", "pilot_lamp", "power_supply_dc", "resistor", "terminal_single", "motor_3phase").'
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
          description: 'Optional device tag / BMK (e.g. "-K1", "-F1", "-S1", "-M1"). Automatically generated following IEC 81346 if omitted.'
        },
        functionText: {
          type: 'string',
          description: 'Optional functional description (e.g. "Hauptschütz", "Steuersicherung 230V", "Ein-Taster").'
        }
      },
      required: ['x', 'y']
    }
  },
  {
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
          description: 'Pin ID on the source component (e.g. "13", "14", "A1", "A2", "1", "2").'
        },
        toComponentId: {
          type: 'string',
          description: 'ID of the destination component.'
        },
        toPinId: {
          type: 'string',
          description: 'Pin ID on the destination component (e.g. "13", "14", "A1", "A2", "1", "2").'
        },
        x1: { type: 'number', description: 'Starting X coordinate.' },
        y1: { type: 'number', description: 'Starting Y coordinate.' },
        x2: { type: 'number', description: 'Ending X coordinate.' },
        y2: { type: 'number', description: 'Ending Y coordinate.' },
        potential: {
          type: 'string',
          description: 'Potential designation (e.g. "L1", "L2", "L3", "N", "PE", "+24V", "0V"). Default: "L1".'
        },
        color: {
          type: 'string',
          description: 'Wire color code (e.g. "BK", "BU", "GNYE", "RD").'
        },
        crossSection: {
          type: 'string',
          description: 'Conductor cross-section (e.g. "1.5mm²", "2.5mm²"). Default: "1.5mm²".'
        }
      }
    }
  },
  {
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
  },
  {
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
  },
  {
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
    version: '1.2.44'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register list_tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // If browser is connected, try to get live tool definitions
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
