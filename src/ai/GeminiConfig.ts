// src/ai/GeminiConfig.ts
// Configuration and persistence for Google Gemini API key

const STORAGE_KEY = 'schematico_gemini_api_key';
const THINKING_LEVEL_STORAGE_KEY = 'schematico_gemini_thinking_level';
const MODEL_STORAGE_KEY = 'schematico_gemini_model';

export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';
export type GeminiModelId = 'gemini-3.8-flash' | 'gemini-4-argon';

export const GEMINI_AVAILABLE_MODELS: { id: GeminiModelId; name: string; description: string; badge: string }[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Schnell & reaktionsstark (Standard)',
    badge: 'Flash'
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    description: 'Flaggschiff-Reasoning (1M Context, komplexe CAD-Pläne)',
    badge: 'Argon'
  }
];

export function getGeminiModel(): GeminiModelId {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      if (stored && (stored === 'gemini-3.8-flash' || stored === 'gemini-4-argon')) {
        return stored as GeminiModelId;
      }
    }
  } catch {
    // Ignore localStorage access errors
  }
  return 'gemini-3.8-flash';
}

export function setGeminiModel(model: GeminiModelId): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    }
  } catch {
    // Ignore localStorage access errors
  }
}

export function getGeminiThinkingLevel(): GeminiThinkingLevel {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THINKING_LEVEL_STORAGE_KEY);
      if (stored && ['minimal', 'low', 'medium', 'high'].includes(stored)) {
        return stored as GeminiThinkingLevel;
      }
    }
  } catch {
    // Ignore localStorage access errors
  }
  return 'medium';
}

export function setGeminiThinkingLevel(level: GeminiThinkingLevel): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THINKING_LEVEL_STORAGE_KEY, level);
    }
  } catch {
    // Ignore localStorage access errors
  }
}

export function getGeminiApiKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }
  } catch {
    // Ignore localStorage access errors
  }

  // Check process.env (Node / Vite / Electron environment)
  try {
    if (typeof process !== 'undefined' && process.env) {
      const envKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (envKey && envKey.trim().length > 0) {
        return envKey.trim();
      }
    }
  } catch {
    // Ignore environment errors
  }

  return '';
}

export function setGeminiApiKey(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const trimmed = key.trim();
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Ignore localStorage access errors
  }
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0;
}

/**
 * Validates a Gemini API key by performing a lightweight model query.
 */
export async function testGeminiApiKey(apiKey: string, model: string = getGeminiModel()): Promise<{ success: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { success: false, message: 'API-Key darf nicht leer sein.' };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: key });

    const response = await client.models.generateContent({
      model: model || 'gemini-3.8-flash',
      contents: 'Ping',
    });

    if (response && response.text) {
      return { success: true, message: `Verbindung zu Gemini API (${model}) erfolgreich hergestellt!` };
    }
    return { success: false, message: 'Keine Antwort von Gemini API erhalten.' };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Fehler beim Verbindungsaufbau zur Gemini API.'
    };
  }
}
