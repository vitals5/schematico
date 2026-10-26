// src/ai/components/StatusBadge.ts
// Connection Status Badge for Local MCP Bridge and Gemini BYOK API Key

import { hasGeminiApiKey } from '../GeminiConfig';
import { BridgeConnectionStatus, defaultBridgeClient } from '../bridge/bridgeClient';

export interface StatusBadgeOptions {
  onClick?: () => void;
  onApiKeyClick?: () => void;
}

export class StatusBadge {
  private element: HTMLElement;
  private bridgeStatus: BridgeConnectionStatus = 'disconnected';
  private hasKey: boolean = false;
  private options: StatusBadgeOptions;
  private unsubscribeBridge?: () => void;

  constructor(options: StatusBadgeOptions = {}) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.className = 'schematico-ai-status-badge';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', 'AI & MCP Status');

    this.init();
  }

  private init(): void {
    this.hasKey = hasGeminiApiKey();

    this.unsubscribeBridge = defaultBridgeClient.onStatusChange((status) => {
      this.bridgeStatus = status;
      this.render();
    });

    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.badge-key-pill') && this.options.onApiKeyClick) {
        e.stopPropagation();
        this.options.onApiKeyClick();
      } else if (target.closest('.badge-bridge-pill')) {
        e.stopPropagation();
        defaultBridgeClient.connect(true);
      } else if (this.options.onClick) {
        this.options.onClick();
      }
    });

    this.render();
  }

  public refresh(): void {
    this.hasKey = hasGeminiApiKey();
    this.bridgeStatus = defaultBridgeClient.getStatus();
    this.render();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public destroy(): void {
    if (this.unsubscribeBridge) {
      this.unsubscribeBridge();
    }
  }

  private render(): void {
    const isBridgeConnected = this.bridgeStatus === 'connected';

    const bridgeDotColor = isBridgeConnected ? '#48bb78' : '#fc8181';
    const bridgeText = isBridgeConnected ? 'MCP Bridge Active' : 'MCP Offline';
    const bridgeTitle = isBridgeConnected
      ? 'Lokaler WebSocket MCP Server (ws://localhost:3333) verbunden'
      : 'MCP Bridge Offline (Klicken zum erneuten Verbindungsversuch; Bridge starten mit: node bridge-server/index.mjs)';

    const keyIcon = this.hasKey ? '🔑' : '⚠️';
    const keyText = this.hasKey ? 'Gemini BYOK' : 'API-Key fehlt';
    const keyColor = this.hasKey ? '#90cdf4' : '#f6ad55';

    this.element.innerHTML = `
      <div class="ai-status-pill badge-bridge-pill" title="${bridgeTitle}" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
        background: rgba(26, 32, 44, 0.7);
        border: 1px solid rgba(74, 85, 104, 0.6);
        color: #e2e8f0;
        cursor: pointer;
        user-select: none;
      ">
        <span style="
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${bridgeDotColor};
          box-shadow: 0 0 6px ${bridgeDotColor};
          display: inline-block;
        "></span>
        <span>${bridgeText}</span>
      </div>

      <div class="ai-status-pill badge-key-pill" title="${this.hasKey ? 'Gemini API-Key ist konfiguriert (Klick zum Ändern)' : 'Kein Gemini API-Key hinterlegt (Klick zum Hinterlegen)'}" style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
        background: rgba(26, 32, 44, 0.7);
        border: 1px solid rgba(74, 85, 104, 0.6);
        color: ${keyColor};
        cursor: pointer;
        user-select: none;
      ">
        <span>${keyIcon}</span>
        <span>${keyText}</span>
      </div>
    `;
  }
}
