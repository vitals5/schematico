// src/ai/GeminiConfig.ts
// Configuration and persistence for Google Gemini API key

const STORAGE_KEY = 'schematico_gemini_api_key';

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
export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { success: false, message: 'API-Key darf nicht leer sein.' };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: key });

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Ping',
    });

    if (response && response.text) {
      return { success: true, message: 'Verbindung zu Gemini API erfolgreich hergestellt!' };
    }
    return { success: false, message: 'Keine Antwort von Gemini API erhalten.' };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Fehler beim Verbindungsaufbau zur Gemini API.'
    };
  }
}
