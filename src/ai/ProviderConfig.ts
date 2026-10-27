import { getGeminiApiKey, getGeminiModel } from './GeminiConfig';
export type AiProvider = 'gemini' | 'openrouter';
export function readSetting(key: string, fallback = ''): string {
  try {
    return localStorage.getItem('schematico_' + key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeSetting(key: string, value: string): void {
  if (value) localStorage.setItem('schematico_' + key, value);
  else localStorage.removeItem('schematico_' + key);
}
export function getAiProvider(): AiProvider {
  return readSetting('ai_provider') === 'openrouter' ? 'openrouter' : 'gemini';
}
export function getOpenRouterKey(): string {
  return readSetting('openrouter_api_key').trim();
}
export function getOpenRouterModel(): string {
  return readSetting('openrouter_model');
}
export function getAiModel(): string {
  return getAiProvider() === 'openrouter'
    ? getOpenRouterModel()
    : getGeminiModel();
}
export function hasAiApiKey(): boolean {
  return !!(getAiProvider() === 'openrouter'
    ? getOpenRouterKey()
    : getGeminiApiKey());
}
