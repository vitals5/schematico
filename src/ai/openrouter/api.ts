import type { Content } from '@google/genai';
import type { McpToolDefinition } from '../mcp-tools/definitions';
import { readSetting, writeSetting } from '../ProviderConfig';
export interface RouterModel {
  id: string;
  name: string;
  vision: boolean;
}
const API = 'https://openrouter.ai/api/v1';
export function cachedModels(): RouterModel[] {
  try {
    const models = JSON.parse(readSetting('openrouter_models', '[]'));
    return Array.isArray(models)
      ? models.filter(
          (m) => typeof m.id === 'string' && typeof m.name === 'string',
        )
      : [];
  } catch {
    return [];
  }
}
export async function routerRequest(
  path: string,
  key: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<any> {
  const response = await fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(key ? { Authorization: 'Bearer ' + key } : {}),
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'Schematico',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal ?? AbortSignal.timeout(120000),
  });
  // Do not expose upstream response bodies: they may echo request content or credentials.
  if (!response.ok)
    throw new Error(
      `OpenRouter HTTP ${response.status}. ${response.status === 401 ? 'API-Schlüssel prüfen.' : response.status === 402 ? 'OpenRouter-Guthaben prüfen.' : response.status === 429 ? 'Anfragelimit erreicht. Später erneut versuchen.' : 'Anfrage konnte nicht ausgeführt werden.'}`,
    );
  const result = await response.json();
  if (result.error)
    throw new Error(
      'OpenRouter konnte die Anfrage nicht ausführen. Modell und Anbieter-Verfügbarkeit prüfen.',
    );
  return result;
}
export async function refreshModels(key: string): Promise<RouterModel[]> {
  const result = await routerRequest('/models', key);
  if (!Array.isArray(result.data))
    throw new Error('Ungültige OpenRouter-Modellliste.');
  const models: RouterModel[] = result.data
    .filter(
      (m: any) =>
        typeof m.id === 'string' && m.supported_parameters?.includes('tools'),
    )
    .map((m: any) => ({
      id: m.id,
      name: typeof m.name === 'string' ? m.name : m.id,
      vision: !!m.architecture?.input_modalities?.includes('image'),
    }))
    .sort((a: RouterModel, b: RouterModel) => a.name.localeCompare(b.name));
  if (!models.length)
    throw new Error(
      'Keine Modelle mit Werkzeugunterstützung gefunden. Vorhandene Liste bleibt erhalten.',
    );
  writeSetting('openrouter_models', JSON.stringify(models));
  writeSetting('openrouter_models_updated', new Date().toISOString());
  return models;
}
export function routerMessages(history: Content[], instruction: string): any[] {
  const messages: any[] = [{ role: 'system', content: instruction }];
  let pending: any[] = [];
  for (const content of history) {
    const raw = (content as any).openRouterMessage;
    if (raw) {
      messages.push(raw);
      pending = [...(raw.tool_calls ?? [])];
      continue;
    }
    const responses = content.parts?.filter((p) => p.functionResponse) ?? [];
    if (responses.length) {
      for (const part of responses) {
        const index = pending.findIndex(
          (c) => c.function.name === part.functionResponse!.name,
        );
        if (index < 0)
          throw new Error(
            'Unvollständiger Werkzeugverlauf. Bitte Chatverlauf leeren.',
          );
        const call = pending.splice(index, 1)[0];
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(part.functionResponse!.response),
        });
      }
    } else {
      // An interrupted turn can leave unexecuted calls. Explicitly close them before a new user turn.
      for (const call of pending)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({
            success: false,
            error:
              'Ausführung abgebrochen; keine Ausführung dieses Aufrufs bestätigt.',
          }),
        });
      pending = [];
      messages.push({
        role: content.role === 'model' ? 'assistant' : 'user',
        content: content.parts?.map((p) => p.text ?? '').join('') ?? '',
      });
    }
  }
  return messages;
}
export async function routerChat(
  key: string,
  model: string,
  history: Content[],
  instruction: string,
  tools: McpToolDefinition[],
  signal?: AbortSignal,
) {
  if (!model)
    throw new Error(
      'Bitte ein OpenRouter-Modell in den KI-Einstellungen auswählen.',
    );
  const response = await routerRequest(
    '/chat/completions',
    key,
    {
      model,
      messages: routerMessages(history, instruction),
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      })),
      tool_choice: 'auto',
      provider: { require_parameters: true },
    },
    signal,
  );
  const message = response.choices?.[0]?.message;
  if (!message || (!message.content && !message.tool_calls?.length))
    throw new Error('OpenRouter hat keine verwendbare Antwort geliefert.');
  const calls = (message.tool_calls ?? []).map((c: any) => {
    if (!c.id || !c.function?.name)
      throw new Error('Ungültiger OpenRouter-Werkzeugaufruf.');
    try {
      return {
        name: c.function.name,
        args: JSON.parse(c.function.arguments || '{}'),
      };
    } catch {
      throw new Error(
        'Das Modell lieferte ungültige Werkzeugargumente. Bitte erneut versuchen.',
      );
    }
  });
  return {
    text: message.content ?? '',
    functionCalls: calls,
    candidates: [
      { content: { role: 'model', parts: [], openRouterMessage: message } },
    ],
  };
}
