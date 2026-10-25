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

## 3. Available MCP Tools

| Tool Name | Description | Key Arguments |
|---|---|---|
| `get_canvas_state` | Returns placed components, pins, coordinates, and wires on the active sheet | `pageId` (optional) |
| `add_component` | Places an electrical or installation component | `symbolId`, `symbolName`, `x`, `y`, `rotation`, `bmk`, `functionText` |
| `draw_wire` | Connects two component pins or coordinates with electrical wire | `fromComponentId`, `toComponentId`, `fromPinId`, `toPinId`, `potential`, `color` |
| `delete_element` | Deletes a component or wire by ID | `id` |
| `clear_canvas` | Clears all components and wires on the active sheet | `confirm: true` |
| `search_symbols` | Searches the Schematico symbol library (~500+ standard symbols) | `query`, `category`, `limit` |

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
