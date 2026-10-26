// src/ai/gemini/client.ts
// Native Gemini Chat Client with BYOK and Function Calling Loop for Schematico

import { GoogleGenAI, Content, Part } from '@google/genai';
import { getGeminiApiKey } from '../GeminiConfig';
import { McpToolRegistry, defaultToolRegistry, CanvasStateManager } from '../mcp-tools';
import { mcpToolsToGeminiFunctions } from './mapper';

export interface ToolCallExecution {
  name: string;
  args: any;
  result?: any;
  status: 'running' | 'done' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  toolCalls?: ToolCallExecution[];
}

export interface GeminiChatOptions {
  model?: string;
  systemInstruction?: string;
  toolRegistry?: McpToolRegistry;
  onToolStart?: (name: string, args: any) => void;
  onToolComplete?: (name: string, args: any, result: any) => void;
  onStatusUpdate?: (status: string) => void;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are Schematico AI, an expert electrical CAD engineer assisting the user with Schematico (IEC 81346 / DIN EN 60617 standards).
You have full programmatic control over Schematico to create, inspect, wire, modify, and analyze electrical schematics, installation floor plans, and project reports using function calling tools.

Available Capability Areas:
1. Canvas Elements & Schematics:
   - 'get_canvas_state': Inspect placed components, pins, coordinates, and wires on the active sheet.
   - 'add_component': Place symbols at (x, y) coordinates with BMK (e.g. -F1, -K1, -S1) and function text.
   - 'update_component': Change BMK, function text, technical data, manufacturer, or position/rotation.
   - 'rotate_element': Rotate components or texts by angle (e.g. 90°).
   - 'move_element': Shift or reposition elements by (dx, dy) or to (x, y).
   - 'draw_wire': Wire components together between pins or coordinates.
   - 'update_wire': Change potential, color, cross-section, or wire number.
   - 'add_cable': Define multi-core cables (e.g. NYM-J 5x2.5, ÖLFLEX 4G1.5) with BMK (-W1).
   - 'delete_element': Remove components, wires, texts, boxes, or cables by ID.
   - 'clear_canvas': Reset the active sheet.
   - 'search_symbols': Look up symbols in the library (~540+ IEC/DIN symbols).

2. Annotations & Structure:
   - 'add_text' / 'update_text': Add commentary, path titles, or warnings.
   - 'add_device_box' / 'update_device_box': Enclose functional units in dashed/solid device frames (Gerätekästen / Black Boxes).

3. Project & Page Management:
   - 'get_project_info' / 'update_project_info': Read and update project metadata.
   - 'list_pages' / 'switch_page': Navigate between pages.
   - 'create_page' / 'delete_page' / 'update_page_info': Manage sheets, titles, and title block data.

4. Library Macros:
   - 'list_macros' / 'place_macro': Instantiate pre-configured multi-symbol assemblies (e.g. DOL starters, reversing contactors, power supplies).

5. Architectural Installation (Gebäudetechnik):
   - 'add_wall', 'add_wall_opening', 'get_floor_plan_state': Draw architectural floor plans, doors, windows, and installation symbols.

6. Engineering Reports & Viewport:
   - 'get_parts_list': Generate Bill of Materials (Stückliste / BOM).
   - 'get_terminal_diagram': Generate Terminal strip plan (Klemmenplan) with internal/external targets.
   - 'recalculate_cross_references': Update contact mirrors and interruption points.
   - 'export_pdf': Trigger vector PDF generation.
   - 'zoom_canvas': Fit to screen or zoom in/out.

Electrical Standards & Layout Rules:
- Standard DIN A3 landscape drawing size is approximately 420 mm wide by 297 mm high.
- Schematics are organized in vertical circuit paths/columns (e.g. Path 1 at x=80, Path 2 at x=130, Path 3 at x=180, etc.).
- Power rails (L1, L2, L3, +24V) are at the top (y=40..60).
- Neutral (N) / Ground (PE) / 0V rails are at the bottom (y=240..270).
- Protective elements (Fuses -F, Breakers -Q/-F) are placed below power rails (y=80..110).
- Control devices (Switches -S, Pushbuttons -S, Contacts -K) are placed in the middle (y=130..170).
- Actuators / Loads (Coils -K, Lamps -H, Motors -M) are near the bottom (y=190..230).
- Standard BMK Prefixes according to IEC 81346:
  * -F: Fuses, Circuit Breakers, Motor Protection
  * -K: Relays, Contactor Coils, Auxiliary Contacts
  * -S: Pushbuttons, Switches, Sensors
  * -H: Signal Lamps, Indicators
  * -M: Motors
  * -X: Terminals / Terminal Blocks
  * -G / -U: Power Supplies, Rectifiers, Inverters
  * -W: Cables

When executing multi-step tasks, execute function calls systematically, and provide a clear, concise summary of changes made in the user's language (German or English).`;

export class GeminiChatClient {
  private history: Content[] = [];
  private messages: ChatMessage[] = [];
  private toolRegistry: McpToolRegistry;
  private model: string;
  private systemInstruction: string;

  constructor(options: GeminiChatOptions = {}) {
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;
    this.model = options.model || 'gemini-3.8-flash';
    this.systemInstruction = options.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public clearHistory(): void {
    this.history = [];
    this.messages = [];
  }

  /**
   * Sends a user prompt to Gemini, handling any function calls iteratively.
   */
  public async sendMessage(
    prompt: string,
    stateManager: CanvasStateManager,
    options?: {
      onToolStart?: (name: string, args: any) => void;
      onToolComplete?: (name: string, args: any, result: any) => void;
      onStatusUpdate?: (status: string) => void;
    }
  ): Promise<ChatMessage> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error(
        'Kein Gemini API-Key hinterlegt. Bitte hinterlegen Sie Ihren API-Key in den Einstellungen (BYOK).'
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Record user message
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_u',
      role: 'user',
      text: prompt,
      timestamp: Date.now()
    };
    this.messages.push(userMsg);

    const toolDeclarations = mcpToolsToGeminiFunctions(this.toolRegistry.getToolDefinitions());

    // Prepare contents array
    this.history.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const currentToolCalls: ToolCallExecution[] = [];
    const modelMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_m',
      role: 'model',
      text: '',
      timestamp: Date.now(),
      toolCalls: currentToolCalls
    };
    this.messages.push(modelMsg);

    const MAX_TOOL_ITERATIONS = 20;
    let iteration = 0;
    let finalText = '';

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;
      options?.onStatusUpdate?.(
        iteration === 1 ? 'Analysiere Anfrage...' : `Führe Schaltplan-Aktionen aus (Schritt ${iteration})...`
      );

      const response = await ai.models.generateContent({
        model: this.model,
        contents: this.history,
        config: {
          systemInstruction: this.systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }]
        }
      });

      // Append model response to conversation history
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        this.history.push(candidateContent);
      }

      // Check if model returned function calls
      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        // Model provided final text
        finalText = response.text || '';
        break;
      }

      // Execute each function call
      const functionResponseParts: Part[] = [];

      for (const fc of functionCalls) {
        const toolName = fc.name || 'unknown_tool';
        const toolExecution: ToolCallExecution = {
          name: toolName,
          args: fc.args,
          status: 'running'
        };
        currentToolCalls.push(toolExecution);
        options?.onToolStart?.(toolName, fc.args);
        options?.onStatusUpdate?.(`⚡ Führe Aktion aus: ${toolName}...`);

        let result: any;
        try {
          result = await this.toolRegistry.executeTool(toolName, fc.args, stateManager);
          toolExecution.result = result;
          toolExecution.status = result?.success === false ? 'error' : 'done';
        } catch (err: any) {
          result = { success: false, error: err?.message || String(err) };
          toolExecution.result = result;
          toolExecution.status = 'error';
        }

        options?.onToolComplete?.(toolName, fc.args, result);

        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: result
          }
        });
      }

      // Push function responses as user turn
      this.history.push({
        role: 'user',
        parts: functionResponseParts
      });
    }

    modelMsg.text = finalText;
    options?.onStatusUpdate?.('Bereit');
    return modelMsg;
  }
}
