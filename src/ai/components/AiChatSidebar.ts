import { getDiagnostic, clearDiagnostics, diagnosticSummary, sanitizeDiagnostic } from '../Diagnostics';
import { getAiProvider, getAiModel, hasAiApiKey } from '../ProviderConfig';
import { showProviderSettings } from './ProviderSettings';
// src/ai/components/AiChatSidebar.ts
// Native Gemini Chat Sidebar & MCP Bridge Console for Schematico (Vanilla TypeScript)

import { GeminiChatClient, ChatMessage, ToolCallExecution } from '../gemini/client';
import { getGeminiThinkingLevel, setGeminiThinkingLevel, type GeminiThinkingLevel } from '../GeminiConfig';
import { defaultBridgeClient, BridgeConnectionStatus } from '../bridge/bridgeClient';
import { CanvasStateManager } from '../mcp-tools';

export interface AiChatSidebarOptions {
  stateManager: CanvasStateManager;
  onClose?: () => void;
  onApiKeyUpdated?: () => void;
}

export class AiChatSidebar {
  private provider = getAiProvider();
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
    this.refreshConfig();
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

  public refreshConfig(): void {
    const model = getAiModel();
    if (model !== this.geminiClient.getModel() || this.provider !== getAiProvider()) { this.geminiClient.abort(); this.geminiClient.clearHistory(); }
    this.provider = getAiProvider();
    this.geminiClient.setModel(model);
    let thinking = getGeminiThinkingLevel();
    if (model === 'gemini-4-argon' && thinking === 'minimal') {
      thinking = 'low';
      setGeminiThinkingLevel('low');
    }
    this.geminiClient.setThinkingLevel(thinking);
    this.updateModelTag();
    this.renderApiKeyBanner();
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

  private formatModelName(model: string): string {
    if (getAiProvider() === 'openrouter') return 'OpenRouter · ' + (model || 'Modell auswählen');
    if (model === 'gemini-4-argon') return 'Gemini 4 Argon';
    return 'Gemini 3.8 Flash';
  }

  private updateModelTag(): void {
    const tag = this.container.querySelector('#aiChatModelTag');
    if (tag) {
      const modelName = this.formatModelName(this.geminiClient.getModel());
      tag.textContent = getAiProvider() === 'openrouter' ? `${modelName} • BYOK` : `${modelName} (${this.formatThinkingLevel(this.geminiClient.getThinkingLevel())}) • BYOK`;
    }
  }

  private render(): void {
    const currentModel = this.formatModelName(this.geminiClient.getModel());
    const currentThinking = this.formatThinkingLevel(this.geminiClient.getThinkingLevel());
    this.container.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title-group">
          <span class="ai-chat-icon">🪄</span>
          <div class="ai-chat-title-info">
            <span class="ai-chat-title">Schematico AI</span>
            <span class="ai-chat-model-tag" id="aiChatModelTag" title="Klicken für Modell-, Thinking- & API-Key-Einstellungen">${this.escapeHtml(currentModel)}${getAiProvider() === 'gemini' ? ` (${currentThinking})` : ''} • BYOK</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <div id="aiSidebarBridgeStatus" class="ai-sidebar-bridge-pill" title="Status der lokalen MCP Bridge"></div>
          <button type="button" class="ai-header-btn" id="btnAiDistribute" title="Geprüfte Layoutvorschau berechnen; Änderungen erst nach Übernehmen">📐</button>
          <button type="button" class="ai-header-btn" id="btnAiSettings" title="KI-Anbieter, API-Schlüssel und Modell verwalten">⚙️</button>
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
      clearDiagnostics();
      const messagesContainer = this.container.querySelector('#aiChatMessages');
      if (messagesContainer) messagesContainer.innerHTML = '';
      const welcome = this.container.querySelector<HTMLElement>('#aiChatWelcome');
      if (welcome) welcome.style.display = 'block';
    });

    const btnSettings = this.container.querySelector('#btnAiSettings');
    btnSettings?.addEventListener('click', () => this.showApiKeyModal());

    const btnDistribute = this.container.querySelector<HTMLButtonElement>('#btnAiDistribute');
    btnDistribute?.addEventListener('click', async () => {
      btnDistribute.disabled=true;
      try {
        const { defaultToolRegistry } = await import('../mcp-tools');
        const res = await defaultToolRegistry.executeTool('distribute_sheet_layout', {}, this.stateManager);
        if (res?.success) {
          this.appendModelResponse({
            id: 'distribute_' + Date.now(),
            role: 'model',
            text: `📐 **Layoutvorschau:** ${res.message}`,
            timestamp: Date.now()
          });
        } else {
          this.appendErrorMessage(res?.message || res?.error || 'Layoutvorschau konnte nicht berechnet werden.');
        }
      } catch (err: any) {
        this.appendErrorMessage(`Fehler bei Layout-Optimierung: ${err?.message || err}`);
      } finally {
        btnDistribute.disabled=false;
      }
    });

    const modelTag = this.container.querySelector<HTMLElement>('#aiChatModelTag');
    modelTag?.addEventListener('click', () => {
      this.showApiKeyModal();
    });

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

    if (!hasAiApiKey()) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="ai-banner-content">
          <span>⚠️ <strong>API-Schlüssel fehlt.</strong> Hinterlegen Sie den Schlüssel des gewählten KI-Anbieters (BYOK), um CAD-Aktionen auszuführen.</span>
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

    if (!hasAiApiKey()) {
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
      this.appendErrorMessage(sanitizeDiagnostic(err?.message || 'Fehler bei der Kommunikation mit der KI-API.'));
      if(err?.diagnosticId){const list=this.container.querySelector<HTMLElement>('#aiChatMessages');if(list)this.appendDiagnostic(list,err.diagnosticId);}
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

    const badges = [...list.querySelectorAll<HTMLElement>('.ai-tool-badge')].filter(b=>b.dataset.toolName===toolName);
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
    if(isError&&result?.diagnosticId){badge.style.flexWrap='wrap';this.appendDiagnostic(badge,result.diagnosticId);}
    this.scrollToBottom();
  }

  private appendDiagnostic(parent:HTMLElement,id:string): void {
    const report=getDiagnostic(id);if(!report)return;
    const box=document.createElement('div');box.className='ai-diagnostic';
    box.style.cssText='flex-basis:100%;box-sizing:border-box;margin:6px 0;padding:8px;border:1px solid #9b5353;border-radius:6px;max-width:100%;overflow:hidden';
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent='Fehlerdetails anzeigen';summary.style.cursor='pointer';
    const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:260px;overflow:auto;user-select:text';
    pre.textContent=diagnosticSummary(report);details.append(summary,pre);
    const download=document.createElement('button');download.className='btn btn-sm';download.textContent='Fehlerbericht herunterladen';download.type='button';
    download.addEventListener('click',()=>{
      const data=getDiagnostic(id);if(!data){download.textContent='Bericht nicht mehr verfügbar';download.disabled=true;return;}
      const blob=new Blob([JSON.stringify(sanitizeDiagnostic(data),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='schematico-ki-fehler-'+id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    const copy=document.createElement('button');copy.className='btn btn-sm';copy.textContent='Kurzbericht kopieren';copy.type='button';
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.textContent??'');copy.textContent='Kopiert';}catch{copy.textContent='Bitte Fehlertext oben markieren';details.open=true;}});
    const hint=document.createElement('small');hint.textContent='Die Datei enthält Projekt- und Entwurfsdaten. Vor dem Teilen prüfen. API-Schlüssel werden entfernt.';hint.style.cssText='display:block;margin-top:6px;line-height:1.4';
    box.append(details,download,copy,hint);parent.append(box);
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
      case 'distribute_sheet_layout':
        return `Layout auf DIN A3 Vollblatt optimiert (${result?.columns ?? '…'} Spalten)`;
      case 'recalculate_cross_references':
        return `Kontaktspiegel neu berechnet`;
      case 'export_pdf':
        return `PDF-Export generiert`;
      case 'zoom_canvas':
        return `Zoom angepasst: ${args?.action}`;
      default:
        return `Aktion: ${this.escapeHtml(name)}`;
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
    if (this.isGenerating) return;
    showProviderSettings(() => { this.refreshConfig(); this.options.onApiKeyUpdated?.(); });
  }
}
