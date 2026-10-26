# Schematico Local MCP Bridge Server

Standalone MCP (Model Context Protocol) Bridge Server connecting external AI agents (Claude Desktop, Hermes, Cursor) with the live Schematico Electrical CAD canvas via WebSockets.

---

## 1. Quickstart

### Prerequisites
- Node.js >= 18.0.0
- Schematico web application running in a browser tab (e.g. `http://localhost:5173`)

### Installation & Startup
```bash
# Navigate to bridge-server directory
cd bridge-server

# Install dependencies
npm install

# Start the bridge server (stdio MCP server + ws://localhost:3333)
npm start
```

When started, the server exposes:
1. **MCP stdio interface** for local LLM tools (Claude Desktop, Hermes, etc.).
2. **WebSocket Server** on `ws://localhost:3333` which automatically pairs with open Schematico browser tabs.

---

## 2. Agent Configuration

### A. Claude Desktop
Add the server definition to your `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "schematico": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/schematico/bridge-server/index.mjs"]
    }
  }
}
```

### B. Hermes Agent
Add to your `hermes.json` or config:
```json
{
  "tools": {
    "mcp": {
      "schematico": {
        "command": "node",
        "args": ["/ABSOLUTE/PATH/TO/schematico/bridge-server/index.mjs"]
      }
    }
  }
}
```

---

## 3. Available MCP Tools (Complete App Control)

Schematico exposes **33 standard MCP tools** enabling full programmatic control across 6 functional domains:

### A. Schematic Elements & Wiring
| Tool Name | Description | Key Arguments |
|---|---|---|
| `get_canvas_state` | Returns placed components, pins, coordinates, and wires on the active sheet | `pageId` (optional) |
| `add_component` | Places an electrical or installation component by symbol ID or fuzzy name | `symbolId`, `symbolName`, `x`, `y`, `rotation`, `bmk`, `functionText` |
| `update_component` | Modifies properties of a placed component (BMK, function text, technical specs, coords) | `id`, `bmk`, `functionText`, `technicalCharacteristics`, `x`, `y` |
| `rotate_element` | Rotates a component or text element to 0°, 90°, 180°, or 270° | `id`, `rotation` |
| `move_element` | Moves an element by relative delta `(dx, dy)` or to absolute `(x, y)` | `id`, `dx`, `dy`, `x`, `y` |
| `draw_wire` | Connects two component pins or coordinates with electrical wire | `fromComponentId`, `toComponentId`, `fromPinId`, `toPinId`, `potential`, `color` |
| `update_wire` | Modifies wire potential, conductor color, cross-section, or wire number | `id`, `potential`, `color`, `crossSection`, `wireNumber` |
| `add_cable` | Defines a multi-core cable (e.g. NYM-J 5x2.5) with BMK and cores | `bmk`, `cableType`, `coreCount`, `crossSection`, `voltage` |
| `list_cables` | Lists all defined multi-core cables in the project | — |
| `delete_element` | Deletes a component, wire, text, box, or cable by ID | `id` |
| `clear_canvas` | Clears all components and wires on the active sheet | `confirm: true` |
| `search_symbols` | Searches the Schematico symbol library (~540+ IEC/DIN symbols) | `query`, `category`, `limit` |

### B. Annotations & Device Boxes
| Tool Name | Description | Key Arguments |
|---|---|---|
| `add_text` | Adds a text annotation or label to the canvas | `text`, `x`, `y`, `fontSize`, `fontColor`, `fontWeight` |
| `update_text` | Updates content, position, size, or styling of a text annotation | `id`, `text`, `x`, `y`, `fontSize`, `fontColor` |
| `add_device_box` | Draws a device box (Gerätekasten / Black Box) around functional groups | `label`, `x`, `y`, `width`, `height`, `lineStyle`, `color` |
| `update_device_box` | Modifies dimensions, label, or line style of an existing device box | `id`, `label`, `x`, `y`, `width`, `height`, `lineStyle` |

### C. Project & Page Management
| Tool Name | Description | Key Arguments |
|---|---|---|
| `get_project_info` | Returns project metadata, standard, author, company, and sheet statistics | — |
| `update_project_info` | Updates project name, description, author, company, or commission | `name`, `description`, `author`, `company`, `commission` |
| `list_pages` | Lists all sheets/pages in the project with IDs, titles, and types | — |
| `create_page` | Creates a new schematic, installation, or report sheet | `pageNumber`, `title`, `pageType`, `higherLevel`, `location` |
| `switch_page` | Switches the active viewport sheet in the browser canvas | `pageId` |
| `delete_page` | Deletes a sheet by ID (requires project to retain at least one page) | `pageId` |
| `update_page_info` | Updates title block and metadata for a specific sheet | `pageId`, `title`, `higherLevel`, `location`, `pageNumber` |

### D. Library Macros
| Tool Name | Description | Key Arguments |
|---|---|---|
| `list_macros` | Lists pre-configured circuit macros (reversing starters, power supplies, etc.) | `category`, `type` |
| `place_macro` | Instantiates a macro assembly onto the canvas at specified coordinates | `macroId`, `x`, `y` |

### E. Architectural Floor Plans
| Tool Name | Description | Key Arguments |
|---|---|---|
| `add_wall` | Draws an architectural wall on installation sheets | `startX`, `startY`, `endX`, `endY`, `thickness`, `isExterior` |
| `add_wall_opening` | Inserts a door, window, or opening into a wall | `kind`, `x`, `y`, `width`, `orientation`, `wallId` |
| `get_floor_plan_state` | Returns all architectural walls, openings, and scale settings | `pageId` (optional) |

### F. Reports & Canvas Viewport
| Tool Name | Description | Key Arguments |
|---|---|---|
| `get_parts_list` | Generates a structured BOM / parts list with quantities and manufacturer data | — |
| `get_terminal_diagram` | Generates a terminal report with internal/external wire targets | `terminalStripBmk` (optional) |
| `recalculate_cross_references` | Triggers a full recalculation of contactor, relay, and interruption cross-references | — |
| `export_pdf` | Exports the project or current sheet as a vector PDF document | `filename`, `allPages` |
| `zoom_canvas` | Adjusts the live canvas viewport zoom level | `action: 'fit' \| 'in' \| 'out' \| 'reset'` |

---

## 4. How It Works

```
┌─────────────────────────────────┐
│ External AI Agent               │
│ (Claude Desktop / Hermes)       │
└───────────────┬─────────────────┘
                │ stdio (JSON-RPC)
                ▼
┌─────────────────────────────────┐
│ Standalone Node.js MCP Bridge   │
│ bridge-server/index.mjs         │
└───────────────┬─────────────────┘
                │ WebSocket (ws://localhost:3333)
                ▼
┌─────────────────────────────────┐
│ Browser Tab: Schematico CAD     │
│ Universal MCP Tool Registry     │
│ └── Live CadCanvas State Update │
└─────────────────────────────────┘
```
