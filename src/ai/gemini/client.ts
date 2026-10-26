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
- Standard DIN A3 landscape drawing size is strictly 420 mm wide by 297 mm high.
- Strict Drawing Boundaries: X must be between 35 mm and 385 mm; Y must be between 35 mm and 245 mm.
- WARNING: NEVER place any component, text, or wire at X > 390 or Y > 255! (Coordinates > 400 or > 260 fall outside the sheet or into the title block).
- Path Distribution: Schematics are organized in vertical circuit paths/columns across the sheet:
  * Path 1: x=60..90
  * Path 2: x=130..160
  * Path 3: x=200..230
  * Path 4: x=270..300
  * Path 5: x=340..370
- Power rails (L1, L2, L3, +24V) are at the top (y=40..60).
- Neutral (N) / Ground (PE) / 0V rails are at the bottom (y=220..245).
- Protective elements (Fuses -F, Breakers -Q/-F) are placed below power rails (y=75..105).
- Control devices (Switches -S, Pushbuttons -S, Contacts -K) are placed in the middle (y=120..160).
- Actuators / Loads (Coils -K, Lamps -H, Motors -M) are near the bottom (y=175..215).

Direct Symbol Catalog (Use these IDs directly in 'add_component', avoid search calls):
- Energy & Power Distribution:
  * 'fuse_switch_3p': NH-Sicherungslasttrennschalter / Hausanschlusskasten (HAK)
  * 'circuit_breaker_3p': Leitungsschutzschalter 3-polig / SLS-Schalter (-Q0, -Q1)
  * 'circuit_breaker_1p': Leitungsschutzschalter 1-polig (B16)
  * 'rcd_4p': FI-Schutzschalter 4-polig (40A / 30mA, -F1)
  * 'rcd_2p': FI-Schutzschalter 2-polig
  * 'rcbo_1p_n': FI/LS-Kombischalter 1P+N
  * 'surge_arrester_spd': Überspannungsableiter Typ 1+2 / SPD (-F_SPD)
  * 'energy_meter_3p': Drehstromzähler elektronisch (-Z1 Gesamtzähler, -Z2 Kaskadenzähler)
  * 'energy_meter_1p': Wechselstromzähler (1-phasig)
  * 'inverter_solar': PV-Hybridwechselrichter & Batteriespeicher (-G1 / -TB1)
  * 'power_inverter': Wechselrichter (DC/AC)
  * 'power_supply_dc': Schaltnetzteil 24V DC (-T1 / -G1)
  * 'main_switch_4p': Hauptschalter / Lasttrennschalter 4-polig
- Drives & Industrial Controls:
  * 'motor_3phase': Drehstrommotor (3~) / Wärmepumpe Verdichter (-M1)
  * 'motor_protective_switch': Motorschutzschalter 3-polig (-Q1)
  * 'contactor_power_3p': Leistungsschaltglieder 3-polig (-K1)
  * 'contactor_coil': Schützspule (-K1)
  * 'contact_no': Schließerkontakt
  * 'contact_nc': Öffnerkontakt
  * 'pushbutton_no': Taster Schließer (-S1)
  * 'pushbutton_emergency_stop': Not-Aus Taster (-S0)
  * 'pilot_lamp': Signalleuchte (-H1)
  * 'terminal_single': Durchgangsklemme (-X1)
  * 'terminal_pe': Schutzleiterklemme (-X1:PE)
- Potentials:
  * 'potential_l1', 'potential_l2', 'potential_l3', 'potential_n', 'potential_pe'

Workflow & Best Practices:
1. Do NOT make repetitive 'search_symbols' calls when you can use the direct IDs above.
2. Plan the circuit mentally first, then execute tool calls systematically.
3. Do NOT call 'get_canvas_state' after every single component placement. You know where you placed them.
4. Do NOT call 'clear_canvas' unless explicitly requested by the user.
5. ALWAYS finish the circuit by drawing electrical wires ('draw_wire') between the components! An unwired circuit is incomplete.
6. Provide a concise, professional engineering summary in the user's language (German or English).`;

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

    const MAX_TOOL_ITERATIONS = 60;
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

    if (iteration >= MAX_TOOL_ITERATIONS && !finalText) {
      finalText = `⚠️ **Aktionslimit erreicht:** Die Schaltung wurde bis zu Schritt ${iteration} aufgebaut. Bitte antworte kurz mit **"Fahre fort und verdrahte die Schaltung"**, damit ich die noch ausstehenden Verbindungen und Schritte fertigstelle.`;
    }

    modelMsg.text = finalText;
    options?.onStatusUpdate?.('Bereit');
    return modelMsg;
  }
}
