// src/ai/mcp-tools/index.ts
// Universal MCP Tool Registry and Execution Engine for Schematico

import {
  McpToolDefinition,
  SCHEMATICO_MCP_TOOLS,
  GET_CANVAS_STATE_TOOL,
  ADD_COMPONENT_TOOL,
  DRAW_WIRE_TOOL,
  DELETE_ELEMENT_TOOL,
  CLEAR_CANVAS_TOOL,
  SEARCH_SYMBOLS_TOOL
} from './definitions';

import {
  CanvasStateManager,
  handleGetCanvasState,
  handleAddComponent,
  handleDrawWire,
  handleDeleteElement,
  handleClearCanvas,
  handleSearchSymbols,
  resolveSymbol
} from './handlers';

export * from './definitions';
export * from './handlers';

export type ToolHandler = (args: any, manager: CanvasStateManager) => Promise<any>;

export interface RegisteredTool {
  definition: McpToolDefinition;
  handler: ToolHandler;
}

export class McpToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(GET_CANVAS_STATE_TOOL, handleGetCanvasState);
    this.register(ADD_COMPONENT_TOOL, handleAddComponent);
    this.register(DRAW_WIRE_TOOL, handleDrawWire);
    this.register(DELETE_ELEMENT_TOOL, handleDeleteElement);
    this.register(CLEAR_CANVAS_TOOL, handleClearCanvas);
    this.register(SEARCH_SYMBOLS_TOOL, handleSearchSymbols);
  }

  public register(definition: McpToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  public get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  public getToolDefinitions(): McpToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * Executes a tool by name with arguments against a CanvasStateManager.
   * Never throws uncaught errors — always returns an object with success boolean.
   */
  public async executeTool(
    name: string,
    args: any,
    manager: CanvasStateManager
  ): Promise<any> {
    const entry = this.tools.get(name);
    if (!entry) {
      const available = Array.from(this.tools.keys()).join(', ');
      return {
        success: false,
        error: `Tool "${name}" is not registered. Available tools: ${available}`
      };
    }

    try {
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {});
      const result = await entry.handler(parsedArgs, manager);
      return result;
    } catch (err: any) {
      return {
        success: false,
        error: `Execution of tool "${name}" failed: ${err?.message || String(err)}`
      };
    }
  }
}

/** Global default registry instance */
export const defaultToolRegistry = new McpToolRegistry();
