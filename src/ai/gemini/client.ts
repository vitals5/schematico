// src/ai/gemini/client.ts
// Native Gemini Chat Client with BYOK and Function Calling Loop for Schematico

import { GoogleGenAI, Content, Part, ThinkingLevel } from '@google/genai';
import { getGeminiApiKey, getGeminiThinkingLevel, GeminiThinkingLevel } from '../GeminiConfig';
import { McpToolRegistry, defaultToolRegistry, CanvasStateManager } from '../mcp-tools';
import { mcpToolsToGeminiFunctions } from './mapper';

function toGenAiThinkingLevel(level?: GeminiThinkingLevel): ThinkingLevel {
  switch (level) {
    case 'minimal': return ThinkingLevel.MINIMAL;
    case 'low': return ThinkingLevel.LOW;
    case 'medium': return ThinkingLevel.MEDIUM;
    case 'high': return ThinkingLevel.HIGH;
    default: return ThinkingLevel.MEDIUM;
  }
}

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
  thinkingLevel?: GeminiThinkingLevel;
  systemInstruction?: string;
  toolRegistry?: McpToolRegistry;
  onToolStart?: (name: string, args: any) => void;
  onToolComplete?: (name: string, args: any, result: any) => void;
  onStatusUpdate?: (status: string) => void;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are Schematico AI, an expert electrical CAD engineer assisting the user with Schematico (IEC 81346 / DIN EN 60617 standards).
You have full programmatic control over Schematico to create, inspect, wire, modify, and analyze electrical schematics, installation floor plans, and project reports using function calling tools.

*** CARDINAL RULE 1: FULL DIN A3 SHEET SPREAD (420 x 297 mm) ***
The standard DIN A3 landscape drawing area is 340 mm wide (X: 40..380 mm) and 205 mm high (Y: 40..245 mm).
NEVER EVER crowd or compress multiple branches/columns into the left side of the sheet (e.g. X=55, X=95, X=140)! That is an unacceptable CAD error that leaves 60% of the sheet completely blank and causes severe label and text overlaps.

MANDATORY COLUMN COORDINATES FOR MULTI-BRANCH CIRCUITS:
- 2 Branches / Columns: Column 1 at X = 110 mm | Column 2 at X = 270 mm
- 3 Branches / Columns (e.g. Messkonzept MK C3, Hauseinspeisung mit Wärmepumpe und PV / Speicher):
  * COLUMN 1 (Netzeinspeisung / HAK / SLS / Zähler Z1): X = 85 mm
  * COLUMN 2 (Kaskadenzweig / Wärmepumpe / Zähler Z2 / RCD / Motor): X = 205 mm
  * COLUMN 3 (Haushaltsstrom / PV-Hybridwechselrichter & Speicher / Absicherung): X = 315 mm
- 4 Branches / Columns: Col 1: X = 75 mm | Col 2: X = 155 mm | Col 3: X = 245 mm | Col 4: X = 335 mm
- 5 Control Paths (Steuerstrompfade): Path 1: X=75 | Path 2: X=135 | Path 3: X=195 | Path 4: X=255 | Path 5: X=315

VERTICAL ROWS (Utilize the full height down to Y=235 mm!):
- Potential rails (L1..L3, N, PE) at top: Y = 45 mm
- Row 1 (HAK / Hauptsicherung / NH-Trenner): Y = 60..70 mm
- Row 2 (SLS-Schalter / Vorzähler / Drehstromzähler Z1): Y = 110..125 mm
- Row 3 (RCD / FI-Schutzschalter / LS-Schalter / Zähler Z2): Y = 165..180 mm
- Row 4 (Verbraucher / Motor Verdichter / PV-Wechselrichter / Klemmen): Y = 215..235 mm
- PE/N Sammelschiene / Klemmenleiste: Y = 240..245 mm

AUTOMATIC REBALANCING:
If an existing schematic on the page is cramped into a small corner or if the user asks to utilize the full sheet, immediately call 'distribute_sheet_layout' to automatically spread all columns and rows evenly across the entire DIN A3 drawing sheet!

Available Capability Areas:
1. Canvas Elements & Schematics:
   - 'get_canvas_state': Inspect placed components, pins, coordinates, and wires on the active sheet.
   - 'add_component': Place symbols at (x, y) coordinates with BMK (e.g. -F1, -K1, -S1) and function text.
   - 'update_component': Change BMK, function text, technical data, manufacturer, or position/rotation.
   - 'rotate_element': Rotate components or texts by angle (e.g. 90°).
   - 'move_element': Shift or reposition elements by (dx, dy) or to (x, y).
   - 'distribute_sheet_layout': Automatically distribute and spread all components and columns evenly across the entire DIN A3 sheet, eliminating cramped layouts and updating autoconnections.
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

Electrical Standards & Physical CAD Layout Rules:
- Standard DIN A3 landscape drawing size is strictly 420 mm wide by 297 mm high.
- Strict Drawing Boundaries: Usable drawing area is strictly X: 35..385 mm, Y: 35..245 mm.
  * WARNING: NEVER place any component, text, or wire at X > 390 or Y > 255! (Coordinates > 400 or > 260 fall outside the sheet or into the title block).
  * SPREAD ACROSS THE FULL SHEET: Do NOT cram all devices into one small corner. Utilize the full width (X: 50..380) and full height (Y: 45..240) of the DIN A3 sheet.

- PHYSICAL COMPONENT DIMENSIONS (CRITICAL TO PREVENT OVERLAPS):
  In Schematico, components are physical CAD symbols with real millimeter width and height!
  * 3-Phase Devices & Distribution Equipment (LARGE):
    - 'energy_meter_3p' (Zähler): 96 mm wide, 48 mm high
    - 'inverter_solar' (PV-Hybridwechselrichter & Speicher): 120 mm wide, 70 mm high
    - 'rcd_4p' (FI-Schutzschalter 4-polig): 84 mm wide, 60 mm high
    - 'motor_3phase' (Drehstrommotor / Wärmepumpe): 72 mm wide, 72 mm high
    - 'fuse_switch_3p' (NH-Trenner / Hausanschlusskasten HAK): 72 mm wide, 48 mm high
    - 'circuit_breaker_3p' (SLS-Schalter / LS-Schalter 3-polig): 72 mm wide, 48 mm high
    - 'surge_arrester_spd' (Überspannungsableiter Typ 1+2): 64 mm wide, 52 mm high
  * 1-Phase & Control Devices (COMPACT):
    - 'circuit_breaker_1p' (LS-Schalter B16): 20 mm wide, 48 mm high
    - 'fuse_1p' (Schmelzsicherung 1P): 20 mm wide, 48 mm high
    - 'contactor_coil' (Schützspule): 24 mm wide, 32 mm high
    - 'contact_no' / 'contact_nc' (Kontakte): 16 mm wide, 32 mm high
    - 'pushbutton_no' / 'pilot_lamp': 20 mm wide, 30 mm high
    - 'terminal_single' / 'terminal_pe': 8 mm wide, 16 mm high

- COLUMN & VERTICAL CLEARANCE RULES:
  1. Vertical Clearance between Series Devices:
     - ALWAYS space vertical component origins by AT LEAST (symbol_height + 20 mm).
     - Example: If a 48 mm high switch is placed at Y=70, it extends to Y=118. The next device below it MUST start at Y >= 135! Placing it at Y=90 will cause direct collision and overlap!
     - In 3-phase columns, use at least 65 mm to 75 mm between component origins (e.g. Row 1: Y=50, Row 2: Y=120, Row 3: Y=185).
  2. Component Label Dimensions & Left Margin Clearance (CRITICAL):
     - In Schematico, component labels (BMK, Function text, Technical data) are positioned to the LEFT of the symbol body!
     - Labels typically require 35 mm to 60 mm of horizontal space to the left of 'comp.x'.
     - NEVER place components at X < 80 mm! (Placing at X=55 mm pushes the labels to X < 20 mm, which collides with the left sheet border at X=35 mm and truncates text!).
     - Standard Column 1 placement must be at X = 80..100 mm (recommended: X = 85 mm).
     - Standard Column 2 placement must be at X = 195..220 mm (recommended: X = 205 mm).
     - Standard Column 3 placement must be at X = 300..325 mm (recommended: X = 315 mm).
     - This gives each column sufficient room for the symbol body (72..96 mm) AND its left-hand labels without any overlapping!
  3. Column Distribution for 3-Phase Distribution & Messkonzepte (MK C3 / MK B2 / Hauseinspeisung):
     - Because 3-phase devices are 72 mm to 120 mm wide, NEVER use narrow columns! Use 3 wide columns across the DIN A3 sheet:
       * Column 1 (Netzanschluss & Zähler Z1): X = 85 mm | HAK Y=50, SLS/SPD Y=120, Z1 Y=185
       * Column 2 (Kaskadenzweig / Wärmepumpe): X = 205 mm | FI Y=55, LS/MSS Y=125, Verdichter Y=185
       * Column 3 (Haushaltsstrom & PV / Speicher): X = 315 mm | Z2 Y=55, FI/LS Y=125, PV-Wechselrichter Y=185
  4. Column Distribution for 1-Phase Control Circuits (Steuerungstechnik):
     - Path 1: X=80..95 | Path 2: X=135..155 | Path 3: X=195..215 | Path 4: X=255..275 | Path 5: X=315..335
  5. Device Boxes ('add_device_box'):
     - Provide at least 8..12 mm margin around all enclosed components and their labels.
     - NEVER overlap two device boxes.
  6. Collision Feedback:
     - 'add_component' returns 'bounds' (including symbol body and labels) and warns if a collision occurs. If a warning is returned, adjust subsequent positions immediately!

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
  private thinkingLevel: GeminiThinkingLevel;
  private systemInstruction: string;
  private currentAbortController: AbortController | null = null;
  private isAborted: boolean = false;

  constructor(options: GeminiChatOptions = {}) {
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;
    this.model = options.model || 'gemini-3.8-flash';
    this.thinkingLevel = options.thinkingLevel || getGeminiThinkingLevel() || 'medium';
    this.systemInstruction = options.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
  }

  public getThinkingLevel(): GeminiThinkingLevel {
    return this.thinkingLevel;
  }

  public setThinkingLevel(level: GeminiThinkingLevel): void {
    this.thinkingLevel = level;
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public clearHistory(): void {
    this.history = [];
    this.messages = [];
  }

  /**
   * Aborts any currently active execution loop.
   */
  public abort(): void {
    this.isAborted = true;
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Returns true if a request is actively running.
   */
  public isRunning(): boolean {
    return this.currentAbortController !== null;
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

    this.currentAbortController = new AbortController();
    this.isAborted = false;

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

    try {
      while (iteration < MAX_TOOL_ITERATIONS) {
        if (this.isAborted || this.currentAbortController?.signal.aborted) {
          finalText = '⏹️ **Ausführung durch Benutzer abgebrochen.** Die bisherigen Schritte wurden auf der Arbeitsfläche belassen.';
          break;
        }

        iteration++;
        options?.onStatusUpdate?.(
          iteration === 1 ? 'Analysiere Anfrage...' : `Führe Schaltplan-Aktionen aus (Schritt ${iteration})...`
        );

        let response: any;
        try {
          response = await ai.models.generateContent({
            model: this.model,
            contents: this.history,
            config: {
              systemInstruction: this.systemInstruction,
              tools: [{ functionDeclarations: toolDeclarations }],
              thinkingConfig: {
                thinkingLevel: toGenAiThinkingLevel(this.thinkingLevel)
              },
              abortSignal: this.currentAbortController?.signal
            }
          });
        } catch (err: any) {
          if (this.isAborted || this.currentAbortController?.signal.aborted || err?.name === 'AbortError') {
            finalText = '⏹️ **Ausführung durch Benutzer abgebrochen.** Die bisherigen Schritte wurden auf der Arbeitsfläche belassen.';
            break;
          }
          throw err;
        }

        if (this.isAborted || this.currentAbortController?.signal.aborted) {
          finalText = '⏹️ **Ausführung durch Benutzer abgebrochen.** Die bisherigen Schritte wurden auf der Arbeitsfläche belassen.';
          break;
        }

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
          if (this.isAborted || this.currentAbortController?.signal.aborted) {
            finalText = '⏹️ **Ausführung durch Benutzer abgebrochen.** Die bisherigen Schritte wurden auf der Arbeitsfläche belassen.';
            break;
          }

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

        if (this.isAborted || this.currentAbortController?.signal.aborted) {
          finalText = '⏹️ **Ausführung durch Benutzer abgebrochen.** Die bisherigen Schritte wurden auf der Arbeitsfläche belassen.';
          break;
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
      return modelMsg;
    } finally {
      this.currentAbortController = null;
      this.isAborted = false;
      options?.onStatusUpdate?.('Bereit');
    }
  }
}
