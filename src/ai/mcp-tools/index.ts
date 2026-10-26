import {DUPLICATE_SCHEMATIC_TOOL,handleDuplicateSchematic} from '../../layout/tools';
import { VALIDATE_LAYOUT_TOOL, OPTIMIZE_LAYOUT_TOOL, CREATE_DRAFT_TOOL, handleValidateLayout, handleOptimizeLayout, handleCreateDraft } from '../../layout/tools';
// src/ai/mcp-tools/index.ts
// Universal MCP Tool Registry and Execution Engine for Schematico

import {
  McpToolDefinition,
  SCHEMATICO_MCP_TOOLS,
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
  GET_PROJECT_INFO_TOOL,
  UPDATE_PROJECT_INFO_TOOL,
  LIST_PAGES_TOOL,
  CREATE_PAGE_TOOL,
  SWITCH_PAGE_TOOL,
  DELETE_PAGE_TOOL,
  UPDATE_PAGE_INFO_TOOL,
  ADD_TEXT_TOOL,
  UPDATE_TEXT_TOOL,
  ADD_DEVICE_BOX_TOOL,
  UPDATE_DEVICE_BOX_TOOL,
  LIST_MACROS_TOOL,
  PLACE_MACRO_TOOL,
  ADD_WALL_TOOL,
  ADD_WALL_OPENING_TOOL,
  GET_FLOOR_PLAN_STATE_TOOL,
  GET_PARTS_LIST_TOOL,
  GET_TERMINAL_DIAGRAM_TOOL,
  RECALCULATE_CROSS_REFERENCES_TOOL,
  EXPORT_PDF_TOOL,
  ZOOM_CANVAS_TOOL
} from './definitions';

import {
  CanvasStateManager,
  handleGetCanvasState,
  handleAddComponent,
  handleUpdateComponent,
  handleRotateElement,
  handleMoveElement,
  handleDistributeSheetLayout,
  handleDrawWire,
  handleUpdateWire,
  handleAddCable,
  handleListCables,
  handleDeleteElement,
  handleClearCanvas,
  handleSearchSymbols,
  handleGetProjectInfo,
  handleUpdateProjectInfo,
  handleListPages,
  handleCreatePage,
  handleSwitchPage,
  handleDeletePage,
  handleUpdatePageInfo,
  handleAddText,
  handleUpdateText,
  handleAddDeviceBox,
  handleUpdateDeviceBox,
  handleListMacros,
  handlePlaceMacro,
  handleAddWall,
  handleAddWallOpening,
  handleGetFloorPlanState,
  handleGetPartsList,
  handleGetTerminalDiagram,
  handleRecalculateCrossReferences,
  handleExportPdf,
  handleZoomCanvas,
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
    this.register(VALIDATE_LAYOUT_TOOL,handleValidateLayout);
    this.register(OPTIMIZE_LAYOUT_TOOL,handleOptimizeLayout);
    this.register(CREATE_DRAFT_TOOL,handleCreateDraft);
    this.register(DUPLICATE_SCHEMATIC_TOOL,handleDuplicateSchematic);
    // 1. Elements
    this.register(GET_CANVAS_STATE_TOOL, handleGetCanvasState);
    this.register(ADD_COMPONENT_TOOL, handleAddComponent);
    this.register(UPDATE_COMPONENT_TOOL, handleUpdateComponent);
    this.register(ROTATE_ELEMENT_TOOL, handleRotateElement);
    this.register(MOVE_ELEMENT_TOOL, handleMoveElement);
    this.register(DISTRIBUTE_SHEET_LAYOUT_TOOL, handleDistributeSheetLayout);
    this.register(DRAW_WIRE_TOOL, handleDrawWire);
    this.register(UPDATE_WIRE_TOOL, handleUpdateWire);
    this.register(ADD_CABLE_TOOL, handleAddCable);
    this.register(LIST_CABLES_TOOL, handleListCables);
    this.register(DELETE_ELEMENT_TOOL, handleDeleteElement);
    this.register(CLEAR_CANVAS_TOOL, handleClearCanvas);
    this.register(SEARCH_SYMBOLS_TOOL, handleSearchSymbols);

    // 2. Project & Pages
    this.register(GET_PROJECT_INFO_TOOL, handleGetProjectInfo);
    this.register(UPDATE_PROJECT_INFO_TOOL, handleUpdateProjectInfo);
    this.register(LIST_PAGES_TOOL, handleListPages);
    this.register(CREATE_PAGE_TOOL, handleCreatePage);
    this.register(SWITCH_PAGE_TOOL, handleSwitchPage);
    this.register(DELETE_PAGE_TOOL, handleDeletePage);
    this.register(UPDATE_PAGE_INFO_TOOL, handleUpdatePageInfo);

    // 3. Texts & Boxes
    this.register(ADD_TEXT_TOOL, handleAddText);
    this.register(UPDATE_TEXT_TOOL, handleUpdateText);
    this.register(ADD_DEVICE_BOX_TOOL, handleAddDeviceBox);
    this.register(UPDATE_DEVICE_BOX_TOOL, handleUpdateDeviceBox);

    // 4. Macros
    this.register(LIST_MACROS_TOOL, handleListMacros);
    this.register(PLACE_MACRO_TOOL, handlePlaceMacro);

    // 5. Floor Plan
    this.register(ADD_WALL_TOOL, handleAddWall);
    this.register(ADD_WALL_OPENING_TOOL, handleAddWallOpening);
    this.register(GET_FLOOR_PLAN_STATE_TOOL, handleGetFloorPlanState);

    // 6. Reports & Views
    this.register(GET_PARTS_LIST_TOOL, handleGetPartsList);
    this.register(GET_TERMINAL_DIAGRAM_TOOL, handleGetTerminalDiagram);
    this.register(RECALCULATE_CROSS_REFERENCES_TOOL, handleRecalculateCrossReferences);
    this.register(EXPORT_PDF_TOOL, handleExportPdf);
    this.register(ZOOM_CANVAS_TOOL, handleZoomCanvas);
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
