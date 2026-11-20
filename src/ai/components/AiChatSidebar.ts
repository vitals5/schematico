import {sessionDiagnostics,createSessionArchive} from '../SessionDiagnostics';
import { readAttachments, assertAttachmentModel, ATTACHMENT_ACCEPT, type AiAttachment } from '../Attachments';
import { cachedModels } from '../openrouter/api';
import { getDiagnostic, clearDiagnostics, diagnosticSummary, sanitizeDiagnostic } from '../Diagnostics';
import { getAiProvider, getAiModel, hasAiApiKey } from '../ProviderConfig';
import { showProviderSettings } from './ProviderSettings';
// src/ai/components/AiChatSidebar.ts
// Native Gemini Chat Sidebar & MCP Bridge Console for Schematico (Vanilla TypeScript)

import { GeminiChatClient, ChatMessage, ToolCallExecution } from '../gemini/client';
import { getGeminiThinkingLevel, setGeminiThinkingLevel, type GeminiThinkingLevel } from '../GeminiConfig';
import { defaultBridgeClient, BridgeConnectionStatus } from '../bridge/bridgeClient';
import { CanvasStateManager } from '../mcp-tools';
import { tr, onLanguageChange } from '../../i18n';

export interface AiChatSidebarOptions {
  stateManager: CanvasStateManager;
  onClose?: () => void;
  onApiKeyUpdated?: () => void;
  onGenerationSettled?: () => void;
}

export class AiChatSidebar {
  private provider = getAiProvider();
  private container: HTMLElement;
  private stateManager: CanvasStateManager;
  private geminiClient: GeminiChatClient;
  private isOpenState: boolean = false;
  private isGenerating: boolean = false;
  private attachments: AiAttachment[] = [];
  private readingAttachments = false;
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

  public isBusy(): boolean {
    return this.isGenerating || this.readingAttachments;
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
    if (getAiProvider() === 'openrouter') return 'OpenRouter · ' + (model || tr('Modell auswählen', 'Select model'));
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
            <span class="ai-chat-model-tag" id="aiChatModelTag" title="${this.escapeHtml(tr('Klicken für Modell-, Thinking- & API-Key-Einstellungen', 'Click for Model, Thinking & API Key Settings'))}">${this.escapeHtml(currentModel)}${getAiProvider() === 'gemini' ? ` (${currentThinking})` : ''} • BYOK</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <div id="aiSidebarBridgeStatus" class="ai-sidebar-bridge-pill" title="${this.escapeHtml(tr('Status der lokalen MCP Bridge', 'Local MCP Bridge Status'))}"></div>
          <button type="button" class="ai-header-btn" id="btnAiDistribute" title="${this.escapeHtml(tr('Geprüfte Layoutvorschau berechnen; Änderungen erst nach Übernehmen', 'Compute validated layout preview; changes apply on confirm'))}">📐</button>
          <button type="button" class="ai-header-btn" id="btnAiExportSession" title="${this.escapeHtml(tr('Session-Diagnose als ZIP exportieren: enthält Chat, Werkzeugaufrufe und Projektdaten; Zugangsdaten und Anhanginhalte werden entfernt', 'Export session diagnostics as ZIP: includes chat, tool calls, and project data; credentials and attachment contents are redacted'))}" aria-label="${this.escapeHtml(tr('Session-Diagnose exportieren', 'Export Session Diagnostics'))}">⇩</button>
          <button type="button" class="ai-header-btn" id="btnAiSettings" title="${this.escapeHtml(tr('KI-Anbieter, API-Schlüssel und Modell verwalten', 'Manage AI Provider, API Key & Model'))}">⚙️</button>
          <button type="button" class="ai-header-btn" id="btnAiClearHistory" title="${this.escapeHtml(tr('Chatverlauf leeren', 'Clear Chat History'))}">🗑️</button>
          <button type="button" class="ai-header-btn" id="btnAiClose" title="${this.escapeHtml(tr('Schließen (✕)', 'Close (✕)'))}">✕</button>
        </div>
      </div>

      <div class="ai-api-key-banner" id="aiApiKeyBanner" style="display: none;"></div>

      <div class="ai-chat-body" id="aiChatBody">
        <div class="ai-chat-welcome" id="aiChatWelcome">
          <div class="ai-welcome-badge">⚡ ${this.escapeHtml(tr('Schaltplan-Assistent & MCP Agent', 'Schematic Assistant & MCP Agent'))}</div>
          <h3 class="ai-welcome-title">${this.escapeHtml(tr('Wie kann ich beim Schaltplan helfen?', 'How can I help with your schematic?'))}</h3>
          <p class="ai-welcome-subtitle">
            ${this.escapeHtml(tr('Geben Sie elektrotechnische Anweisungen in natürlicher Sprache ein. Ich platziere Bauteile, ziehe Verbindungen und befolge DIN EN 60617 / IEC 81346.', 'Enter electrical engineering instructions in natural language. I place components, route connections, and follow DIN EN 60617 / IEC 81346.'))}
          </p>

          <div class="ai-prompt-chips">
            <button type="button" class="ai-chip" data-prompt="${this.escapeHtml(tr('Zeichne eine 230V Beleuchtungsschaltung mit Schutzschalter -F1, Taster -S1, Stromstoßschalter -K1 und Meldeleuchte -H1.', 'Draw a 230V lighting circuit with circuit breaker -F1, pushbutton -S1, impulse relay -K1, and indicator lamp -H1.'))}">
              💡 ${this.escapeHtml(tr('230V Stromstoßschaltung', '230V Impulse Relay Circuit'))}
            </button>
            <button type="button" class="ai-chip" data-prompt="${this.escapeHtml(tr('Zeichne eine Motor-Direkteinschaltung mit 3-phasiger Einspeisung, Motorschutzschalter, Hauptschütz und Drehstrommotor.', 'Draw a direct-on-line motor starter with 3-phase supply, motor circuit breaker, main contactor, and three-phase motor.'))}">
              ⚡ ${this.escapeHtml(tr('Motor-Direktstarter (DOL)', 'Direct-On-Line Starter (DOL)'))}
            </button>
            <button type="button" class="ai-chip" data-prompt="${this.escapeHtml(tr('Zeichne ein 24V DC Schaltnetzteil mit 230V Absicherung primär, Netzteil und 24V Meldeleuchte sekundär.', 'Draw a 24V DC power supply circuit with primary 230V fuse protection, PSU, and secondary 24V indicator lamp.'))}">
              🔌 ${this.escapeHtml(tr('24V Steuerspannung', '24V Control Power Supply'))}
            </button>
            <button type="button" class="ai-chip" data-prompt="${this.escapeHtml(tr('Was befindet sich aktuell auf dieser Schaltplanseite? Führe eine Analyse des aktuellen Bestands durch.', 'What is currently on this schematic sheet? Analyze the current components and connections.'))}">
              📊 ${this.escapeHtml(tr('Blattinhalt analysieren', 'Analyze Sheet Contents'))}
            </button>
          </div>
        </div>
        <div class="ai-chat-messages" id="aiChatMessages"></div>
        <div class="ai-chat-loading" id="aiChatLoading" style="display: none;">
          <div class="ai-loading-spinner"></div>
          <span class="ai-loading-text" id="aiLoadingStatusText" style="flex: 1;">${this.escapeHtml(tr('Denke nach...', 'Thinking...'))}</span>
          <button type="button" class="ai-stop-btn" id="btnAiStop" title="${this.escapeHtml(tr('Ausführung abbrechen', 'Cancel Execution'))}">
            <span style="font-size: 11px;">⏹</span> ${this.escapeHtml(tr('Stoppen', 'Stop'))}
          </button>
        </div>
      </div>

      <div class="ai-chat-footer">
        <div id="aiAttachments" class="ai-attachments" aria-label="${this.escapeHtml(tr('Dateianhänge', 'Attachments'))}"></div>
        <input id="aiAttachmentInput" type="file" accept="${ATTACHMENT_ACCEPT}" multiple hidden>
        <div id="aiAttachmentStatus" role="status" class="ai-footer-note"></div>
        <div class="ai-input-wrap">
          <button type="button" class="ai-header-btn" id="btnAiAttach" title="${this.escapeHtml(tr('Bilder oder PDFs anhängen', 'Attach images or PDFs'))}" aria-label="${this.escapeHtml(tr('Dateien anhängen', 'Attach files'))}">📎</button>
          <textarea
            id="aiPromptInput"
            class="ai-prompt-input"
            rows="1"
            placeholder="${this.escapeHtml(tr("Schaltplan-Anweisung eingeben... (z.B. 'Füge einen Schütz K1 bei x=120, y=160 hinzu')", "Enter schematic instruction... (e.g. 'Add contactor K1 at x=120, y=160' )"))}"
          ></textarea>
          <button type="button" class="ai-send-btn" id="btnAiSend" title="${this.escapeHtml(tr('Senden (Enter)', 'Send (Enter)'))}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="ai-footer-note">
          ${this.escapeHtml(tr('Session-Diagnose: ⇩ oben · enthält Chat und Projekt. Vor Neuladen exportieren; Anhanginhalte werden nicht mitgegeben.', 'Session Diagnostics: ⇩ above · includes chat and project. Export before reloading; attachment contents are omitted.'))}<br>${this.escapeHtml(tr('PNG, JPEG, WebP, PDF · max. 4 Dateien, je 10 MB, zusammen 14 MB. Anhänge gehen beim Senden an den gewählten KI-Anbieter.', 'PNG, JPEG, WebP, PDF · max 4 files, 10 MB each, 14 MB total. Attachments are sent to the selected AI provider.'))}
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
      if(this.isGenerating||this.readingAttachments)return;
      this.attachments=[];this.renderAttachments();
      this.geminiClient.clearHistory();
      clearDiagnostics();
      sessionDiagnostics.clear();
      const messagesContainer = this.container.querySelector('#aiChatMessages');
      if (messagesContainer) messagesContainer.innerHTML = '';
      const welcome = this.container.querySelector<HTMLElement>('#aiChatWelcome');
      if (welcome) welcome.style.display = 'block';
    });

    const exportSession=this.container.querySelector<HTMLButtonElement>('#btnAiExportSession');
    exportSession?.addEventListener('click',async()=>{
      exportSession.disabled=true;exportSession.setAttribute('aria-busy','true');
      try {
        const report=sessionDiagnostics.export({project:this.stateManager.getProject(),chat:this.geminiClient.getMessages(),environment:{userAgent:navigator.userAgent,language:navigator.language,viewport:{width:window.innerWidth,height:window.innerHeight},desktop:!!(window as any).electronAPI},pendingAttachments:this.attachments.map(({name,mimeType,size})=>({name,mimeType,size})),generating:this.isGenerating});
        const archive=await createSessionArchive(report);
        const url=URL.createObjectURL(new Blob([new Uint8Array(archive.bytes).buffer],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=archive.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch(error) {
        const message=error instanceof Error?error.message:String(error);
        sessionDiagnostics.record('session_export_error',{message});
        alert('Session-Diagnose konnte nicht exportiert werden: '+message);
      } finally {exportSession.disabled=false;exportSession.removeAttribute('aria-busy');}
    });
    const btnSettings = this.container.querySelector('#btnAiSettings');
    btnSettings?.addEventListener('click', () => this.showApiKeyModal());

    const btnDistribute = this.container.querySelector<HTMLButtonElement>('#btnAiDistribute');
    btnDistribute?.addEventListener('click', async () => {
      if (this.isGenerating || this.readingAttachments) return;
      if (document.getElementById('layoutPreviewModal')?.dataset.hasDraftComponents === 'true') {
        const activePage = this.stateManager.getActivePage();
        if (
          !activePage.components.length &&
          !activePage.texts?.length &&
          !activePage.boxes?.length &&
          !activePage.images?.length &&
          !activePage.cables?.length
        ) {
          return;
        }
      }
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
        btnDistribute.disabled = this.isGenerating || this.readingAttachments;
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

    const fileInput=this.container.querySelector<HTMLInputElement>('#aiAttachmentInput')!;
    this.container.querySelector('#btnAiAttach')?.addEventListener('click',()=>fileInput.click());
    fileInput.addEventListener('change',async()=>{
      const files=Array.from(fileInput.files??[]);fileInput.value='';
      await this.processIncomingFiles(files);
    });

    // Input auto-grow, paste and submit
    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');
    const sendBtn = this.container.querySelector<HTMLButtonElement>('#btnAiSend');

    input?.addEventListener('paste', async (e: ClipboardEvent) => {
      const clipboardFiles: File[] = [];
      if (e.clipboardData?.files?.length) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const file = e.clipboardData.files[i];
          if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            clipboardFiles.push(file);
          }
        }
      } else if (e.clipboardData?.items?.length) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
              clipboardFiles.push(file);
            }
          }
        }
      }
      if (clipboardFiles.length > 0) {
        await this.processIncomingFiles(clipboardFiles);
      }
    });

    const dropZone = this.container.querySelector<HTMLElement>('.ai-chat-footer') ?? this.container;
    dropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('ai-dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('ai-dragover');
    });
    dropZone.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      dropZone.classList.remove('ai-dragover');
      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      if (files.length > 0) {
        await this.processIncomingFiles(files);
      }
    });

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
    this.setLoadingStatus(tr('Ausführung wird abgebrochen...', 'Cancelling execution...'));
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
      ? tr('Lokaler WebSocket MCP Server (ws://localhost:3333) ist aktiv.', 'Local WebSocket MCP server (ws://localhost:3333) is active.')
      : tr('MCP Bridge Offline (Klicken zum erneuten Verbinden). Server starten mit: node bridge-server/index.mjs', 'MCP Bridge Offline (Click to reconnect). Start server with: node bridge-server/index.mjs');
  }

  private renderApiKeyBanner(): void {
    const banner = this.container.querySelector<HTMLElement>('#aiApiKeyBanner');
    if (!banner) return;

    if (!hasAiApiKey()) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="ai-banner-content">
          <span>⚠️ <strong>${this.escapeHtml(tr('API-Schlüssel fehlt.', 'API key missing.'))}</strong> ${this.escapeHtml(tr('Hinterlegen Sie den Schlüssel des gewählten KI-Anbieters (BYOK), um CAD-Aktionen auszuführen.', 'Configure the API key of the selected AI provider (BYOK) to run CAD actions.'))}</span>
          <button type="button" class="btn btn-primary btn-sm" id="btnBannerSetKey">${this.escapeHtml(tr('Key hinterlegen', 'Set API Key'))}</button>
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
    if (this.isGenerating || this.readingAttachments) return;

    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');
    if (!input) return;

    const prompt = input.value.trim() || (this.attachments.length ? tr('Analysiere die angehängten Referenzdateien.', 'Analyze the attached reference files.') : '');
    if (!prompt) return;
    try{if(getAiProvider()==='openrouter')assertAttachmentModel(this.attachments,cachedModels().find(m=>m.id===this.geminiClient.getModel()));}
    catch(error){this.appendErrorMessage(error instanceof Error?error.message:String(error));return;}

    if (!hasAiApiKey()) {
      this.showApiKeyModal();
      return;
    }

    const attachments=this.attachments;this.attachments=[];this.renderAttachments();
    input.value = '';
    input.style.height = 'auto';

    // Hide welcome screen
    const welcome = this.container.querySelector<HTMLElement>('#aiChatWelcome');
    if (welcome) welcome.style.display = 'none';

    // Render user message in UI
    const userMessage=this.appendUserMessage(prompt, attachments);

    // Show loading state
    this.setGenerating(true, tr('Analysiere CAD-Anweisung...', 'Analyzing CAD instruction...'));
    const historyLength=this.geminiClient.getMessages().length;

    try {
      const response = await this.geminiClient.sendMessage(prompt, this.stateManager, {
        attachments,
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
      sessionDiagnostics.record('chat_error',{message:err?.message,stack:err?.stack,diagnosticId:err?.diagnosticId});
      if(this.geminiClient.getMessages().length===historyLength){this.attachments=attachments;this.renderAttachments();input.value=prompt;userMessage?.remove();}
      this.appendErrorMessage(sanitizeDiagnostic(err?.message || tr('Fehler bei der Kommunikation mit der KI-API.', 'Error communicating with AI API.')));
      if(err?.diagnosticId){const list=this.container.querySelector<HTMLElement>('#aiChatMessages');if(list)this.appendDiagnostic(list,err.diagnosticId);}
    } finally {
      this.setGenerating(false);
      this.options.onGenerationSettled?.();
    }
  }

  private setGenerating(isGen: boolean, statusText = tr('Bereit', 'Ready')): void {
    this.isGenerating = isGen;
    this.renderAttachments();
    const loading = this.container.querySelector<HTMLElement>('#aiChatLoading');
    const sendBtn = this.container.querySelector<HTMLButtonElement>('#btnAiSend');
    const input = this.container.querySelector<HTMLTextAreaElement>('#aiPromptInput');

    if (loading) loading.style.display = isGen ? 'flex' : 'none';

    if (sendBtn) {
      sendBtn.disabled = false;
      if (isGen) {
        sendBtn.classList.add('ai-btn-abort');
        sendBtn.title = tr('Ausführung abbrechen (⏹)', 'Cancel execution (⏹)');
        sendBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" ry="2"></rect>
          </svg>
        `;
      } else {
        sendBtn.classList.remove('ai-btn-abort');
        sendBtn.title = tr('Senden (Enter)', 'Send (Enter)');
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
        input.placeholder = tr('Schaltplan wird gezeichnet... (⏹ Klick zum Abbrechen)', 'Drawing schematic... (⏹ Click to cancel)');
      } else {
        input.placeholder = tr("Schaltplan-Anweisung eingeben... (z.B. 'Füge einen Schütz K1 bei x=120, y=160 hinzu')", "Enter schematic instruction... (e.g. 'Add contactor K1 at x=120, y=160')");
      }
    }

    this.setLoadingStatus(statusText);
    this.scrollToBottom();
  }

  private async processIncomingFiles(incomingFiles: File[]): Promise<void> {
    if (this.isGenerating || this.readingAttachments || !incomingFiles.length) return;
    const files = incomingFiles.map((f, index) => {
      if (!f.name.includes('.')) {
        const ext = f.type === 'image/jpeg' ? '.jpg' : f.type === 'image/webp' ? '.webp' : f.type === 'application/pdf' ? '.pdf' : '.png';
        return new File([f], `screenshot-${Date.now()}-${index + 1}${ext}`, { type: f.type });
      }
      return f;
    });
    this.readingAttachments = true;
    this.renderAttachments();
    try {
      this.attachments.push(...(await readAttachments(files, this.attachments)));
    } catch (error) {
      this.appendErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      this.readingAttachments = false;
      this.renderAttachments();
    }
  }

  private renderAttachments(): void {
    const list=this.container.querySelector<HTMLElement>('#aiAttachments');if(!list)return;
    list.replaceChildren();
    const busy=this.readingAttachments||this.isGenerating;
    for(const a of this.attachments){
      const chip=document.createElement('div');chip.className='ai-attachment';
      if(a.mimeType.startsWith('image/')){const img=document.createElement('img');img.src=`data:${a.mimeType};base64,${a.data}`;img.alt=a.name;chip.append(img);}
      const label=document.createElement('span');label.textContent=`${a.name} (${Math.ceil(a.size/1024)} KB)`;chip.append(label);
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Anhang entfernen: '+a.name;remove.setAttribute('aria-label',remove.title);remove.disabled=busy;
      remove.addEventListener('click',()=>{this.attachments=this.attachments.filter(f=>f.id!==a.id);this.renderAttachments();});chip.append(remove);list.append(chip);
    }
    this.container.querySelector<HTMLButtonElement>('#btnAiAttach')!.disabled=busy;
    this.container.querySelector<HTMLButtonElement>('#btnAiClearHistory')!.disabled=busy;
    const btnDist = this.container.querySelector<HTMLButtonElement>('#btnAiDistribute');
    if (btnDist) btnDist.disabled = busy;
    this.container.querySelector<HTMLButtonElement>('#btnAiSend')!.disabled=this.readingAttachments;
    this.container.querySelector<HTMLElement>('#aiAttachmentStatus')!.textContent=this.readingAttachments?'Dateien werden eingelesen …':'';
  }

  private setLoadingStatus(statusText: string): void {
    const el = this.container.querySelector<HTMLElement>('#aiLoadingStatusText');
    if (el) el.textContent = statusText;
  }

  private appendUserMessage(text: string, attachments: AiAttachment[] = []): HTMLElement | undefined {
    const list = this.container.querySelector<HTMLElement>('#aiChatMessages');
    if (!list) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg ai-msg-user';
    msgEl.innerHTML = `
      <div class="ai-msg-bubble">${this.escapeHtml(text)}${attachments.map(a=>`<div class="ai-sent-attachment">📎 ${this.escapeHtml(a.name)}</div>`).join('')}</div>
    `;
    list.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
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
    summary.textContent=tr('Fehlerdetails anzeigen', 'Show Error Details');summary.style.cursor='pointer';
    const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:260px;overflow:auto;user-select:text';
    pre.textContent=diagnosticSummary(report);details.append(summary,pre);
    const download=document.createElement('button');download.className='btn btn-sm';download.textContent=tr('Fehlerbericht herunterladen', 'Download Error Report');download.type='button';
    download.addEventListener('click',()=>{
      const data=getDiagnostic(id);if(!data){download.textContent=tr('Bericht nicht mehr verfügbar', 'Report no longer available');download.disabled=true;return;}
      const blob=new Blob([JSON.stringify(sanitizeDiagnostic(data),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='schematico-ki-fehler-'+id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    const copy=document.createElement('button');copy.className='btn btn-sm';copy.textContent=tr('Kurzbericht kopieren', 'Copy Summary');copy.type='button';
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.textContent??'');copy.textContent=tr('Kopiert', 'Copied');}catch{copy.textContent=tr('Bitte Fehlertext oben markieren', 'Please select error text above');details.open=true;}});
    const hint=document.createElement('small');hint.textContent=tr('Die Datei enthält Projekt- und Entwurfsdaten. Vor dem Teilen prüfen. API-Schlüssel werden entfernt.', 'File contains project and draft data. Review before sharing. API keys are removed.');hint.style.cssText='display:block;margin-top:6px;line-height:1.4';
    box.append(details,download,copy,hint);parent.append(box);
  }

  private formatToolBadgeText(name: string, args: any, result?: any): string {
    switch (name) {
      case 'add_component':
        const bmk = result?.component?.bmk || args?.bmk || tr('Bauteil', 'Component');
        const sym = result?.component?.symbolName || args?.symbolName || args?.symbolId || '';
        return `${tr('Platziert:', 'Placed:')} <strong>${bmk}</strong> (${sym}) ${tr('bei', 'at')} (${args?.x}, ${args?.y})`;
      case 'update_component':
        return `${tr('Aktualisiert: Bauteil', 'Updated: Component')} <strong>${args?.id}</strong>${args?.bmk ? ` (${args.bmk})` : ''}`;
      case 'rotate_element':
        return `${tr('Gedreht:', 'Rotated:')} <strong>${args?.id}</strong> (${result?.rotation ?? 90}°)`;
      case 'move_element':
        return `${tr('Verschoben:', 'Moved:')} <strong>${args?.id}</strong>`;
      case 'draw_wire':
        const pot = args?.potential || 'L1';
        if (args?.fromComponentId && args?.toComponentId) {
          return `${tr('Verdrahtet:', 'Wired:')} <strong>${pot}</strong> ${tr('von', 'from')} ${args.fromComponentId} ${tr('nach', 'to')} ${args.toComponentId}`;
        }
        return `${tr('Verbindung gezogen:', 'Connection drawn:')} <strong>${pot}</strong>`;
      case 'update_wire':
        return `${tr('Leitung aktualisiert:', 'Wire updated:')} <strong>${args?.id}</strong> (${args?.potential || ''})`;
      case 'add_cable':
        const cableBmk = result?.cable?.bmk || args?.bmk || '-W1';
        return `${tr('Kabel definiert:', 'Cable defined:')} <strong>${cableBmk}</strong> (${args?.cableType || tr('Kabel', 'Cable')})`;
      case 'list_cables':
        return `${tr('Kabel aufgelistet', 'Cables listed')} (${result?.total ?? 0} ${tr('Kabel', 'cables')})`;
      case 'delete_element':
        return `${tr('Gelöscht: Element', 'Deleted: Element')} <strong>${args?.id}</strong>`;
      case 'clear_canvas':
        return `${tr('Schaltplan-Blatt geleert', 'Schematic sheet cleared')} (${result?.clearedComponents || 0} ${tr('Bauteile entfernt', 'components removed')})`;
      case 'get_canvas_state':
        return `${tr('Schaltplan-Status analysiert', 'Schematic state analyzed')} (${result?.stats?.totalComponents ?? '…'} ${tr('Bauteile', 'components')})`;
      case 'search_symbols':
        return `${tr('Symbolkatalog durchsucht:', 'Symbol catalog searched:')} "${args?.query}" (${result?.returned || 0} ${tr('Treffer', 'matches')})`;
      case 'get_project_info':
        return `${tr('Projektdaten abgefragt:', 'Project info queried:')} "${result?.project?.name || ''}"`;
      case 'update_project_info':
        return `${tr('Projektdaten aktualisiert:', 'Project info updated:')} "${args?.name || ''}"`;
      case 'list_pages':
        return `${tr('Seiten aufgelistet', 'Pages listed')} (${result?.total ?? 0} ${tr('Seiten', 'pages')})`;
      case 'create_page':
        return `${tr('Neue Seite erstellt:', 'New page created:')} <strong>${result?.page?.title || args?.title || tr('Seite', 'Page')}</strong>`;
      case 'switch_page':
        return `${tr('Zur Seite gewechselt:', 'Switched to page:')} <strong>${result?.activePage?.title || args?.pageNumber || args?.pageId}</strong>`;
      case 'delete_page':
        return `${tr('Seite gelöscht:', 'Page deleted:')} <strong>${args?.pageId}</strong>`;
      case 'update_page_info':
        return `${tr('Seitendaten aktualisiert:', 'Page info updated:')} <strong>${args?.title || ''}</strong>`;
      case 'add_text':
        return `${tr('Text platziert:', 'Text placed:')} "${(args?.text || '').slice(0, 24)}..." ${tr('bei', 'at')} (${args?.x}, ${args?.y})`;
      case 'update_text':
        return `${tr('Text aktualisiert:', 'Text updated:')} "${(args?.text || '').slice(0, 24)}..."`;
      case 'add_device_box':
        return `${tr('Gerätekasten platziert:', 'Device box placed:')} <strong>${args?.bmk || args?.label || tr('Kasten', 'Box')}</strong>`;
      case 'update_device_box':
        return `${tr('Gerätekasten aktualisiert:', 'Device box updated:')} <strong>${args?.id}</strong>`;
      case 'list_macros':
        return `${tr('Makros aufgelistet', 'Macros listed')} (${result?.total ?? 0} ${tr('Makros', 'macros')})`;
      case 'place_macro':
        return `${tr('Makro platziert:', 'Macro placed:')} <strong>${result?.macroName || args?.macroName || tr('Makro', 'Macro')}</strong> ${tr('bei', 'at')} (${args?.x}, ${args?.y})`;
      case 'add_wall':
        return `${tr('Wand gezeichnet von', 'Wall drawn from')} (${args?.startX}, ${args?.startY}) ${tr('nach', 'to')} (${args?.endX}, ${args?.endY})`;
      case 'add_wall_opening':
        return `${tr('Wandöffnung platziert', 'Wall opening placed')} (${args?.kind}) ${tr('bei', 'at')} (${args?.x}, ${args?.y})`;
      case 'get_floor_plan_state':
        return tr('Grundriss-Daten analysiert', 'Floor plan data analyzed');
      case 'get_parts_list':
        return `${tr('Stückliste (BOM) generiert', 'Bill of Materials (BOM) generated')} (${result?.totalEntries ?? 0} ${tr('Positionen', 'items')})`;
      case 'get_terminal_diagram':
        return `${tr('Klemmenplan generiert', 'Terminal diagram generated')} (${result?.stripsCount ?? 0} ${tr('Klemmleisten', 'terminal strips')})`;
      case 'distribute_sheet_layout':
        return `${tr('Layout auf DIN A3 Vollblatt optimiert', 'Layout optimized on DIN A3 sheet')} (${result?.columns ?? '…'} ${tr('Spalten', 'columns')})`;
      case 'recalculate_cross_references':
        return tr('Kontaktspiegel neu berechnet', 'Contact cross-references recalculated');
      case 'export_pdf':
        return tr('PDF-Export generiert', 'PDF export generated');
      case 'zoom_canvas':
        return `${tr('Zoom angepasst:', 'Zoom adjusted:')} ${args?.action}`;
      case 'get_electrical_dimensioning':
        return `${tr('Elektrische Dimensionierung abgefragt', 'Queried electrical dimensioning')} (${result?.matchingCases ?? 0} ${tr('Stromkreise', 'circuits')})`;
      case 'calculate_circuit_dimensioning':
        return `${tr('Stromkreis berechnet:', 'Calculated circuit:')} <strong>${args?.name || result?.record?.name || ''}</strong> (${result?.calculation?.status ?? ''})`;
      case 'draft_circuit_schematic':
        return `${tr('Stromkreis-Schaltplan entworfen:', 'Drafted circuit schematic:')} <strong>${result?.circuitName || args?.circuitId}</strong>`;
      case 'get_protection_coordination':
        return `${tr('Schutzkoordination analysiert:', 'Analyzed protection coordination:')} <strong>${result?.name || args?.circuitId}</strong>`;
      case 'get_cable_articles':
        return `${tr('Kabelartikel & Meterware abgefragt', 'Queried cable parts & meterware')} (${result?.totalCables ?? 0} ${tr('Kabel', 'cables')})`;
      case 'assign_cable_article':
        return `${tr('Kabelartikel zugeordnet:', 'Assigned cable part:')} <strong>${args?.cableId}</strong> (${args?.lengthM ? args.lengthM + ' m' : ''})`;
      case 'analyze_change_impact':
        return `${tr('Änderungsfolgen analysiert', 'Analyzed change impacts')} (${result?.totalRows ?? 0} ${tr('Aufgaben', 'tasks')})`;
      case 'review_change_impact':
        return `${tr('Änderungsfolge bewertet:', 'Reviewed change impact:')} ${args?.status} (${args?.rowKeys?.length ?? 0} ${tr('Aufgaben', 'tasks')})`;
      case 'apply_change_impact_proposals':
        return `${tr('Änderungsvorschläge übernommen', 'Applied change proposals')} (${result?.appliedProposalsCount ?? 0} ${tr('Positionen', 'items')})`;
      case 'list_project_revisions':
        return `${tr('Projektstände aufgelistet', 'Listed project revisions')} (${result?.count ?? 0} ${tr('Revisionen', 'revisions')})`;
      case 'create_project_revision':
        return `${tr('Projektstand gespeichert:', 'Saved project revision:')} <strong>${result?.revision?.name || args?.name || ''}</strong>`;
      case 'complete_article_data':
        return `${tr('Artikeldaten mit KI vervollständigt:', 'Completed article data with AI:')} <strong>${args?.article?.manufacturer || ''} ${args?.article?.articleNumber || ''}</strong> (${result?.enrichedFields?.join(', ') || tr('keine fehlenden Felder', 'no missing fields')})`;
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
