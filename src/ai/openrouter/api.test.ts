import assert from 'node:assert/strict';
import { cachedModels, refreshModels, routerRequest, routerChat } from './api';
import {
  writeSetting,
  getAiProvider,
  getAiModel,
  hasAiApiKey,
} from '../ProviderConfig';
import { GeminiChatClient } from '../gemini/client';
import { vectorizeFloorPlanWithGemini } from '../GeminiFloorPlanService';
import { McpToolRegistry } from '../mcp-tools';
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
  configurable: true,
});
const originalFetch = globalThis.fetch;
try {
  const requests: any[] = [];
  globalThis.fetch = async (url, init) => {
    requests.push({
      url,
      ...init,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Response.json({
      data: [
        {
          id: 'vendor/tool',
          name: 'Tools & Vision',
          supported_parameters: ['tools'],
          architecture: { input_modalities: ['text', 'image'] },
        },
        { id: 'vendor/plain', name: 'Plain', supported_parameters: [] },
      ],
    });
  };
  assert.equal(getAiProvider(), 'gemini');
  const models = await refreshModels('test-secret');
  assert.equal(models.length, 1);
  assert.equal(models[0].vision, true);
  assert.deepEqual(cachedModels(), models);
  globalThis.fetch = async () =>
    new Response('upstream test-secret', { status: 401 });
  await assert.rejects(refreshModels('test-secret'), /HTTP 401/);
  assert.deepEqual(cachedModels(), models);
  await assert.rejects(
    routerRequest('/key', 'test-secret'),
    (e) => !(e as Error).message.includes('test-secret'),
  );
  writeSetting('ai_provider', 'openrouter');
  writeSetting('openrouter_model', 'vendor/tool');
  writeSetting('openrouter_api_key', 'test-secret');
  assert.equal(getAiModel(), 'vendor/tool');
  assert(hasAiApiKey());
  const registry = new McpToolRegistry();
  let executed = 0;
  registry.register(
    {
      name: 'test_inspect',
      description: 'Inspect',
      inputSchema: { type: 'object', properties: {} },
    },
    async () => {
      executed++;
      return { success: true, value: 42 };
    },
  );
  let turn = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    assert.equal((init?.headers as any).Authorization, 'Bearer test-secret');
    assert.equal(body.model, 'vendor/tool');
    assert(
      body.tools.some((t: any) => t.function.name === 'create_schematic_draft'),
    );
    if (turn++ === 0)
      return Response.json({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              reasoning_details: [
                { type: 'reasoning.encrypted', data: 'opaque' },
              ],
              tool_calls: [
                {
                  id: 'call-123',
                  type: 'function',
                  function: { name: 'test_inspect', arguments: '{}' },
                },
              ],
            },
          },
        ],
      });
    const tool = body.messages.find((m: any) => m.role === 'tool');
    assert.equal(tool.tool_call_id, 'call-123');
    assert.equal(JSON.parse(tool.content).value, 42);
    assert.equal(
      body.messages.find((m: any) => m.tool_calls)?.reasoning_details[0].data,
      'opaque',
    );
    return Response.json({
      choices: [
        { message: { role: 'assistant', content: 'Bestand analysiert.' } },
      ],
    });
  };
  const client = new GeminiChatClient({ toolRegistry: registry });
  const message = await client.sendMessage('Analysiere', {} as any);
  assert.equal(message.text, 'Bestand analysiert.');
  assert.equal(executed, 1);
  assert(!client.isRunning());
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            tool_calls: [
              {
                id: 'bad',
                function: { name: 'test_inspect', arguments: 'invalid' },
              },
            ],
          },
        },
      ],
    });
  await assert.rejects(
    routerChat('test-secret', 'vendor/tool', [], '', [], undefined),
    /ungültige Werkzeugargumente/,
  );
  assert.equal(executed, 1);
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages[1].content[1].type, 'image_url');
    assert(body.messages[0].content.includes('scaleEstimate'));
    return Response.json({ choices: [{ message: { content: '```json\n' + JSON.stringify({ walls: [{ x1: 0, y1: 0, x2: 1000, y2: 0, isExterior: true }, { x1: 1000, y1: 0, x2: 1000, y2: 1000, isExterior: true }], openings: [], rooms: [] }) + '\n```' } }] });
  };
  const floor = await vectorizeFloorPlanWithGemini('data:image/png;base64,AAAA');
  assert(floor.walls.length > 0);
  writeSetting('openrouter_model', 'unknown/text');
  await assert.rejects(vectorizeFloorPlanWithGemini('data:image/png;base64,AAAA'), /Bildunterstützung/);
  writeSetting('openrouter_model', 'vendor/tool');
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, init) => {
    init?.signal?.throwIfAborted();
    return Response.json({});
  };
  await assert.rejects(
    routerRequest('/chat/completions', 'test-secret', {}, controller.signal),
    { name: 'AbortError' },
  );
  console.log(
    '✓ OpenRouter model refresh/cache, provider persistence, safe errors, tool-call IDs, reasoning replay, CAD loop and cancellation',
  );
} finally {
  globalThis.fetch = originalFetch;
}
