// src/ai/components/AiChatSidebar.ts
// Native Gemini Chat Sidebar & MCP Bridge Console for Schematico (Vanilla TypeScript)

import { GeminiChatClient, ChatMessage, ToolCallExecution } from '../gemini/client';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  hasGeminiApiKey,
  testGeminiApiKey,
  getGeminiThinkingLevel,
  setGeminiThinkingLevel,
  GeminiThinkingLevel
} from '../GeminiConfig';
import { defaultBridgeClient, BridgeConnectionStatus } from '../bridge/bridgeClient';
import { CanvasStateManager } from '../mcp-tools';

export interface AiChatSidebarOptions {
  stateManager: CanvasStateManager;
  onClose?: () => void;
  onApiKeyUpdated?: () => void;
}

export class AiChatSidebar {
  private container: HTMLElement;
  private stateManager: CanvasStateManager;
  private geminiClient: GeminiChatClient;
  private isOpenState: boolean = false;
  private isGenerating: boolean = false;
  private currentStatusText: string = 'Bereit';
  private options: AiChatSidebarOptions;
  private unsubscribeBridge?: () => void;

  constructor(options: AiChatSidebarOptions) {
    this.options = options;
    this.stateManager = options.stateManager;
    this.geminiClient = new GeminiChatClient();

    this.container = document.createElement('aside');
    this.container.className = 'ai-chat-sidebar';
    this.container.id = 'aiChatSidebar';
    this.container.style.display = 'none';

    this.render();
    this.initEvents();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public open(): void {
    this.isOpenState = true;
    this.container.style.display = 'flex';
    this.container.classList.add('open');
    this.renderApiKeyBanner();
    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }

  public close(): void {
    this.isOpenState = false;
    this.container.style.display = 'none';
    this.container.classList.remove('open');
    this.options.onClose?.();
  }

  public toggle(): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open();
    }
  }

  private initEvents(): void {
    this.unsubscribeBridge = defaultBridgeClient.onStatusChange(() => {
      this.updateBridgeBadge();
    });
  }

  public destroy(): void {
    if (this.unsubscribeBridge) {
      this.unsubscribeBridge();
    }
  }

  private formatThinkingLevel(level: GeminiThinkingLevel): string {
    switch (level) {
      case 'minimal': return 'Minimal';
      case 'low': return 'Low';
      case 'medium': return 'Medium';
      case 'high': return 'High';
      default: return 'Medium';
    }
  }

  private updateModelTag(): void {
    const tag = this.container.querySelector('#aiChatModelTag');
    if (tag) {
      tag.textContent = `Gemini 3.8 Flash (${this.formatThinkingLevel(this.geminiClient.getThinkingLevel())}) • BYOK`;
    }
  }

  private render(): void {
    const currentThinking = this.formatThinkingLevel(this.geminiClient.getThinkingLevel());
    this.container.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title-group">
          <span class="ai-chat-icon">🪄</span>
          <div class="ai-chat-title-info">
            <span class="ai-chat-title">Schematico AI</span>
            <span class="ai-chat-model-tag" id="aiChatModelTag">Gemini 3.8 Flash (${currentThinking}) • BYOK</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <div id="aiSidebarBridgeStatus" class="ai-sidebar-bridge-pill" title="Status der lokalen MCP Bridge"></div>
          <button type="button" class="ai-header-btn" id="btnAiSettings" title="Gemini API-Key & Thinking-Modus verwalten">⚙️</button>
          <button type="button" class="ai-header-btn" id="btnAiClearHistory" title="Chatverlauf leeren">🗑️</button>
          <button type="button" class="ai-header-btn" id="btnAiClose" title="Schließen (✕)">✕</button>
        </div>
      </div>

      <div class="ai-api-key-banner" id="aiApiKeyBanner" style="display: none;"></div>

      <div class="ai-chat-body" id="aiChatBody">
        <div class="ai-chat-welcome" id="aiChatWelcome">
          <div class="ai-welcome-badge">⚡ Schaltplan-Assistent & MCP Agent</div>
          <h3 class="ai-welcome-title">Wie kann ich beim Schaltplan helfen?</h3>
          <p class="ai-welcome-subtitle">
            Geben Sie elektrotechnische Anweisungen in natürlicher Sprache ein. Ich platziere Bauteile, ziehe Verbindungen und befolge DIN EN 60617 / IEC 81346.
          </p>

          <div class="ai-prompt-chips">
            <button type="button" class="ai-chip" data-prompt="Zeichne eine 230V Beleuchtungsschaltung mit Schutzschalter -F1, Taster -S1, Stromstoßschalter -K1 und Meldeleuchte -H1.">
              💡 230V Stromstoßschaltung
            </button>
            <button type="button" class="ai-chip" data-prompt="Zeichne eine Motor-Direkteinschaltung mit 3-phasiger Einspeisung, Motorschutzschalter, Hauptschütz und Drehstrommotor.">
              ⚡ Motor-Direktstarter (DOL)
            </button>
            <button type="button" class="ai-chip" data-prompt="Zeichne ein 24V DC Schaltnetzteil mit 230V Absicherung primär, Netzteil und 24V Meldeleuchte sekundär.">
              🔌 24V Steuerspannung
            </button>
            <button type="button" class="ai-chip" data-prompt="Was befindet sich aktuell auf dieser Schaltplanseite? Führe eine Analyse des aktuellen Bestands durch.">
              📊 Blattinhalt analysieren
            </button>
          </div>
        </div>
        <div class="ai-chat-messages" id="aiChatMessages"></div>
        <div class="ai-chat-loading" id="aiChatLoading" style="display: none;">
          <div class="ai-loading-spinner"></div>
          <span class="ai-loading-text" id="aiLoadingStatusText" style="flex: 1;">Denke nach...</span>
          <button type="button" class="ai-stop-btn" id="btnAiStop" title="Ausführung abbrechen">
            <span style="font-size: 11px;">⏹</span> Stoppen
          </button>
        </div>
      </div>

      <div class="ai-chat-footer">
        <div class="ai-input-wrap">
          <textarea
            id="aiPromptInput"
            class="ai-prompt-input"
            rows="1"
            placeholder="Schaltplan-Anweisung eingeben... (z.B. 'Füge einen Schütz K1 bei x=120, y=160 hinzu')"
          ></textarea>
          <button type="button" class="ai-send-btn" id="btnAiSend" title="Senden (Enter)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="ai-footer-note">
          Tipp: Shift+Enter für Zeilenumbruch • Vollständig MCP-kompatibel
        </div>
      </div>
    `;

    this.bindDomEvents();
    this.updateBridgeBadge();
    this.renderApiKeyBanner();
  }

  private bindDomEvents(): void {
    const btnClose = this.container.querySelector('#btnAiClose');
    btnClose?.addEventListener('click', () => this.close());

    const btnClear = this.container.querySelector('#btnAiClearHistory');
    btnClear?.addEventListener('click', () => {
      this.geminiClient.clearHistory();
      const messagesContainer = this.container.querySelector('#aiChatMessages');
      if (messagesContainer) messagesContainer.innerHTML = '';
      const welcome = this.container.querySelector<HTMLElement>('#aiChatWelcome');
      if (welcome) welcome.style.display = 'block';
    });

    const btnSettings = this.container.querySelector('#btnAiSettings');
    btnSettings?.addEventListener('click', () => this.showApiKeyModal());

    // Chips
    const chips = this.container.querySelectorAll<HTMLButtonElement>('.ai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');
          if (input) {
            input.value = prompt;
            this.handleSend();
          }
        }
      });
    });

    // Input auto-grow and submit
    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');
    const sendBtn = this.container.querySelector<HTMLButtonElement>('#btnAiSend');

    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    sendBtn?.addEventListener('click', () => {
      if (this.isGenerating) {
        this.handleStop();
      } else {
        this.handleSend();
      }
    });

    const btnStop = this.container.querySelector('#btnAiStop');
    btnStop?.addEventListener('click', () => this.handleStop());

    const bridgePill = this.container.querySelector('#aiSidebarBridgeStatus');
    bridgePill?.addEventListener('click', () => {
      defaultBridgeClient.connect(true);
    });
  }

  public handleStop(): void {
    if (!this.isGenerating) return;
    this.setLoadingStatus('Ausführung wird abgebrochen...');
    this.geminiClient.abort();
  }

  private updateBridgeBadge(): void {
    const el = this.container.querySelector<HTMLElement>('#aiSidebarBridgeStatus');
    if (!el) return;

    const status = defaultBridgeClient.getStatus();
    const isConnected = status === 'connected';
    const color = isConnected ? '#48bb78' : '#fc8181';
    const label = isConnected ? 'Bridge Active' : 'Bridge Offline';

    el.innerHTML = `
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}"></span>
      <span style="font-size:10px;font-weight:600;color:#cbd5e0;">${label}</span>
    `;
    el.title = isConnected
      ? 'Lokaler WebSocket MCP Server (ws://localhost:3333) ist aktiv.'
      : 'MCP Bridge Offline (Klicken zum erneuten Verbinden). Server starten mit: node bridge-server/index.mjs';
  }

  private renderApiKeyBanner(): void {
    const banner = this.container.querySelector<HTMLElement>('#aiApiKeyBanner');
    if (!banner) return;

    if (!hasGeminiApiKey()) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="ai-banner-content">
          <span>⚠️ <strong>Gemini API-Key fehlt.</strong> Hinterlegen Sie Ihren Google AI Studio API-Key (BYOK), um CAD-Aktionen auszuführen.</span>
          <button type="button" class="btn btn-primary btn-sm" id="btnBannerSetKey">Key hinterlegen</button>
        </div>
      `;
      banner.querySelector('#btnBannerSetKey')?.addEventListener('click', () => {
        this.showApiKeyModal();
      });
    } else {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }
  }

  private async handleSend(): Promise<void> {
    if (this.isGenerating) return;

    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');
    if (!input) return;

    const prompt = input.value.trim();
    if (!prompt) return;

    if (!hasGeminiApiKey()) {
      this.showApiKeyModal();
      return;
    }

    input.value = '';
    input.style.height = 'auto';

    // Hide welcome screen
    const welcome = this.container.querySelector<HTMLElement>('#aiChatWelcome');
    if (welcome) welcome.style.display = 'none';

    // Render user message in UI
    this.appendUserMessage(prompt);

    // Show loading state
    this.setGenerating(true, 'Analysiere CAD-Anweisung...');

    try {
      const response = await this.geminiClient.sendMessage(prompt, this.stateManager, {
        onStatusUpdate: (status) => {
          this.setLoadingStatus(status);
        },
        onToolStart: (name, args) => {
          this.appendToolBadge(name, args, 'running');
        },
        onToolComplete: (name, args, result) => {
          this.updateToolBadge(name, args, result);
        }
      });

      this.appendModelResponse(response);
    } catch (err: any) {
      this.appendErrorMessage(err?.message || 'Fehler bei der Kommunikation mit der Gemini API.');
    } finally {
      this.setGenerating(false);
    }
  }

  private setGenerating(isGen: boolean, statusText = 'Bereit'): void {
    this.isGenerating = isGen;
    const loading = this.container.querySelector<HTMLElement>('#aiChatLoading');
    const sendBtn = this.container.querySelector<HTMLButtonElement>('#btnAiSend');
    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');

    if (loading) loading.style.display = isGen ? 'flex' : 'none';

    if (sendBtn) {
      sendBtn.disabled = false;
      if (isGen) {
        sendBtn.classList.add('ai-btn-abort');
        sendBtn.title = 'Ausführung abbrechen (⏹)';
        sendBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" ry="2"></rect>
          </svg>
        `;
      } else {
        sendBtn.classList.remove('ai-btn-abort');
        sendBtn.title = 'Senden (Enter)';
        sendBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        `;
      }
    }

    if (input) {
      input.disabled = isGen;
      if (isGen) {
        input.placeholder = 'Schaltplan wird gezeichnet... (⏹ Klick zum Abbrechen)';
      } else {
        input.placeholder = "Schaltplan-Anweisung eingeben... (z.B. 'Füge einen Schütz K1 bei x=120, y=160 hinzu')";
      }
    }

    this.setLoadingStatus(statusText);
    this.scrollToBottom();
  }

  private setLoadingStatus(statusText: string): void {
    const el = this.container.querySelector<HTMLElement>('#aiLoadingStatusText');
    if (el) el.textContent = statusText;
  }

  private appendUserMessage(text: string): void {
    const list = this.container.querySelector<HTMLElement>('#aiChatMessages');
    if (!list) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg ai-msg-user';
    msgEl.innerHTML = `
      <div class="ai-msg-bubble">${this.escapeHtml(text)}</div>
    `;
    list.appendChild(msgEl);
    this.scrollToBottom();
  }

  private appendModelResponse(response: ChatMessage): void {
    const list = this.container.querySelector<HTMLElement>('#aiChatMessages');
    if (!list) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg ai-msg-model';

    let formattedText = this.formatMarkdown(response.text);

    msgEl.innerHTML = `
      <div class="ai-msg-avatar">🪄</div>
      <div class="ai-msg-content">
        <div class="ai-msg-bubble">${formattedText}</div>
      </div>
    `;
    list.appendChild(msgEl);
    this.scrollToBottom();
  }

  private appendErrorMessage(errorText: string): void {
    const list = this.container.querySelector<HTMLElement>('#aiChatMessages');
    if (!list) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg ai-msg-error';
    msgEl.innerHTML = `
      <div class="ai-msg-avatar">⚠️</div>
      <div class="ai-msg-bubble ai-error-bubble">
        <strong>Fehler:</strong> ${this.escapeHtml(errorText)}
      </div>
    `;
    list.appendChild(msgEl);
    this.scrollToBottom();
  }

  private appendToolBadge(toolName: string, args: any, status: 'running' | 'done' | 'error'): void {
    const list = this.container.querySelector<HTMLElement>('#aiChatMessages');
    if (!list) return;

    const badge = document.createElement('div');
    badge.className = `ai-tool-badge ai-tool-${status}`;
    badge.setAttribute('data-tool-name', toolName);

    const label = this.formatToolBadgeText(toolName, args);
    badge.innerHTML = `
      <span class="ai-tool-icon">${status === 'running' ? '⏳' : status === 'done' ? '⚡' : '❌'}</span>
      <span class="ai-tool-text">${label}</span>
    `;

    list.appendChild(badge);
    this.scrollToBottom();
  }

  private updateToolBadge(toolName: string, args: any, result: any): void {
    const list = this.container.querySelector<HTMLElement>('#aiChatMessages');
    if (!list) return;

    const badges = list.querySelectorAll<HTMLElement>(`.ai-tool-badge[data-tool-name="${toolName}"]`);
    const badge = badges[badges.length - 1];
    if (!badge) return;

    const isError = result?.success === false;
    badge.className = `ai-tool-badge ${isError ? 'ai-tool-error' : 'ai-tool-done'}`;
    const icon = isError ? '❌' : '⚡';
    const label = this.formatToolBadgeText(toolName, args, result);

    badge.innerHTML = `
      <span class="ai-tool-icon">${icon}</span>
      <span class="ai-tool-text">${label}</span>
    `;
    this.scrollToBottom();
  }

  private formatToolBadgeText(name: string, args: any, result?: any): string {
    switch (name) {
      case 'add_component':
        const bmk = result?.component?.bmk || args?.bmk || 'Bauteil';
        const sym = result?.component?.symbolName || args?.symbolName || args?.symbolId || '';
        return `Platziert: <strong>${bmk}</strong> (${sym}) bei (${args?.x}, ${args?.y})`;
      case 'update_component':
        return `Aktualisiert: Bauteil <strong>${args?.id}</strong>${args?.bmk ? ` (${args.bmk})` : ''}`;
      case 'rotate_element':
        return `Gedreht: <strong>${args?.id}</strong> (${result?.rotation ?? 90}°)`;
      case 'move_element':
        return `Verschoben: <strong>${args?.id}</strong>`;
      case 'draw_wire':
        const pot = args?.potential || 'L1';
        if (args?.fromComponentId && args?.toComponentId) {
          return `Verdrahtet: <strong>${pot}</strong> von ${args.fromComponentId} nach ${args.toComponentId}`;
        }
        return `Verbindung gezogen: <strong>${pot}</strong>`;
      case 'update_wire':
        return `Leitung aktualisiert: <strong>${args?.id}</strong> (${args?.potential || ''})`;
      case 'add_cable':
        const cableBmk = result?.cable?.bmk || args?.bmk || '-W1';
        return `Kabel definiert: <strong>${cableBmk}</strong> (${args?.cableType || 'Kabel'})`;
      case 'list_cables':
        return `Kabel aufgelistet (${result?.total ?? 0} Kabel)`;
      case 'delete_element':
        return `Gelöscht: Element <strong>${args?.id}</strong>`;
      case 'clear_canvas':
        return `Schaltplan-Blatt geleert (${result?.clearedComponents || 0} Bauteile entfernt)`;
      case 'get_canvas_state':
        return `Schaltplan-Status analysiert (${result?.stats?.totalComponents ?? '…'} Bauteile)`;
      case 'search_symbols':
        return `Symbolkatalog durchsucht: "${args?.query}" (${result?.returned || 0} Treffer)`;
      case 'get_project_info':
        return `Projektdaten abgefragt: "${result?.project?.name || ''}"`;
      case 'update_project_info':
        return `Projektdaten aktualisiert: "${args?.name || ''}"`;
      case 'list_pages':
        return `Seiten aufgelistet (${result?.total ?? 0} Seiten)`;
      case 'create_page':
        return `Neue Seite erstellt: <strong>${result?.page?.title || args?.title || 'Seite'}</strong>`;
      case 'switch_page':
        return `Zur Seite gewechselt: <strong>${result?.activePage?.title || args?.pageNumber || args?.pageId}</strong>`;
      case 'delete_page':
        return `Seite gelöscht: <strong>${args?.pageId}</strong>`;
      case 'update_page_info':
        return `Seitendaten aktualisiert: <strong>${args?.title || ''}</strong>`;
      case 'add_text':
        return `Text platziert: "${(args?.text || '').slice(0, 24)}..." bei (${args?.x}, ${args?.y})`;
      case 'update_text':
        return `Text aktualisiert: "${(args?.text || '').slice(0, 24)}..."`;
      case 'add_device_box':
        return `Gerätekasten platziert: <strong>${args?.bmk || args?.label || 'Kasten'}</strong>`;
      case 'update_device_box':
        return `Gerätekasten aktualisiert: <strong>${args?.id}</strong>`;
      case 'list_macros':
        return `Makros aufgelistet (${result?.total ?? 0} Makros)`;
      case 'place_macro':
        return `Makro platziert: <strong>${result?.macroName || args?.macroName || 'Makro'}</strong> bei (${args?.x}, ${args?.y})`;
      case 'add_wall':
        return `Wand gezeichnet von (${args?.startX}, ${args?.startY}) nach (${args?.endX}, ${args?.endY})`;
      case 'add_wall_opening':
        return `Wandöffnung platziert (${args?.kind}) bei (${args?.x}, ${args?.y})`;
      case 'get_floor_plan_state':
        return `Grundriss-Daten analysiert`;
      case 'get_parts_list':
        return `Stückliste (BOM) generiert (${result?.totalEntries ?? 0} Positionen)`;
      case 'get_terminal_diagram':
        return `Klemmenplan generiert (${result?.stripsCount ?? 0} Klemmleisten)`;
      case 'recalculate_cross_references':
        return `Kontaktspiegel neu berechnet`;
      case 'export_pdf':
        return `PDF-Export generiert`;
      case 'zoom_canvas':
        return `Zoom angepasst: ${args?.action}`;
      default:
        return `Aktion: ${name}`;
    }
  }

  private scrollToBottom(): void {
    const body = this.container.querySelector<HTMLElement>('#aiChatBody');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatMarkdown(raw: string): string {
    if (!raw) return '';
    let html = this.escapeHtml(raw);

    // Code blocks: ```...```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code: `...`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **...**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Bullet lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks to <br> outside <pre>
    const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i].replace(/\n/g, '<br>');
    }

    return parts.join('');
  }

  /**
   * Opens the API Key configuration modal for Gemini BYOK.
   */
  public showApiKeyModal(): void {
    const existingModal = document.getElementById('aiApiKeyModal');
    if (existingModal) existingModal.remove();

    const currentKey = getGeminiApiKey();
    const currentThinking = getGeminiThinkingLevel();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'aiApiKeyModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="modal-dialog" style="
        background: #1a202c; border: 1px solid #4a5568; border-radius: 8px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.8); width: 92%; max-width: 520px;
        color: #e2e8f0; padding: 24px; font-family: system-ui, sans-serif;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:18px; display:flex; align-items:center; gap:8px;">
            <span>🔑</span> Gemini API & Thinking Einstellungen
          </h3>
          <button type="button" class="btn" id="btnModalClose" style="padding:4px 8px; font-size:14px;">✕</button>
        </div>

        <p style="font-size:13px; color:#a0aec0; margin-bottom:16px; line-height:1.5;">
          Schematico verwendet das Prinzip <strong>Bring Your Own Key (BYOK)</strong>. Ihr Schlüssel wird ausschließlich lokal im Browser gespeichert und direkt für die Kommunikation mit der Google Gemini API (Modell <code>gemini-3.8-flash</code>) verwendet.
        </p>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:6px; color:#cbd5e0;">
            Google Gemini API-Key:
          </label>
          <input
            type="password"
            id="inputModalApiKey"
            value="${this.escapeHtml(currentKey)}"
            placeholder="AIzaSy..."
            style="
              width:100%; box-sizing:border-box; padding:10px 12px;
              background:#2d3748; border:1px solid #4a5568; border-radius:6px;
              color:#fff; font-family:monospace; font-size:13px;
            "
          />
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:6px; color:#cbd5e0;">
            Thinking-Modus (Reasoning-Tiefe):
          </label>
          <select id="selectModalThinkingLevel" style="
            width:100%; box-sizing:border-box; padding:10px 12px;
            background:#2d3748; border:1px solid #4a5568; border-radius:6px;
            color:#fff; font-size:13px; outline:none;
          ">
            <option value="minimal" ${currentThinking === 'minimal' ? 'selected' : ''}>Minimal (Schnellste Antworten)</option>
            <option value="low" ${currentThinking === 'low' ? 'selected' : ''}>Niedrig (Kurze Denkzeit)</option>
            <option value="medium" ${currentThinking === 'medium' ? 'selected' : ''}>Mittel / Medium (Empfohlen für CAD-Planung)</option>
            <option value="high" ${currentThinking === 'high' ? 'selected' : ''}>Hoch (Maximales Reasoning)</option>
          </select>
          <div style="font-size:11px; color:#a0aec0; margin-top:4px;">
            Standard ist <strong>Medium</strong> für eine optimale Balance aus Überlegungszeit und schneller CAD-Ausführung.
          </div>
        </div>

        <div id="apiKeyTestResult" style="margin-bottom:16px; font-size:12px; min-height:20px;"></div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #2d3748; padding-top:16px;">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="font-size:12px; color:#63b3ed; text-decoration:none;">
            Kostenlosen API-Key bei Google AI Studio erstellen ↗
          </a>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn" id="btnTestKey">Verbindung testen</button>
            <button type="button" class="btn btn-primary" id="btnSaveKey">Speichern</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector<HTMLInputElement>('#inputModalApiKey');
    const selectThinking = modal.querySelector<HTMLSelectElement>('#selectModalThinkingLevel');
    const resultDiv = modal.querySelector<HTMLElement>('#apiKeyTestResult')!;
    const btnClose = modal.querySelector<HTMLButtonElement>('#btnModalClose')!;
    const btnTest = modal.querySelector<HTMLButtonElement>('#btnTestKey')!;
    const btnSave = modal.querySelector<HTMLButtonElement>('#btnSaveKey')!;

    btnClose.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    btnTest.addEventListener('click', async () => {
      const key = input?.value.trim() || '';
      if (!key) {
        resultDiv.innerHTML = '<span style="color:#fc8181;">Bitte geben Sie einen API-Key ein.</span>';
        return;
      }
      btnTest.disabled = true;
      resultDiv.innerHTML = '<span style="color:#ecc94b;">Teste Verbindung zur Gemini API...</span>';

      const res = await testGeminiApiKey(key);
      btnTest.disabled = false;
      if (res.success) {
        resultDiv.innerHTML = `<span style="color:#48bb78;">✓ ${res.message}</span>`;
      } else {
        resultDiv.innerHTML = `<span style="color:#fc8181;">✗ ${res.message}</span>`;
      }
    });

    btnSave.addEventListener('click', () => {
      const key = input?.value.trim() || '';
      setGeminiApiKey(key);

      const thinking = (selectThinking?.value as GeminiThinkingLevel) || 'medium';
      setGeminiThinkingLevel(thinking);
      this.geminiClient.setThinkingLevel(thinking);
      this.updateModelTag();

      this.renderApiKeyBanner();
      this.options.onApiKeyUpdated?.();
      modal.remove();
    });
  }
}
