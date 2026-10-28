import assert from 'node:assert/strict';
import { McpToolRegistry } from './mcp-tools';
import { fixture } from '../layout/testing/fixture';
import { clearDiagnostics, getDiagnostic, sanitizeDiagnostic, diagnosticSummary } from './Diagnostics';
import { GeminiChatClient } from './gemini/client';
const settings = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => settings.get(k) ?? null, setItem: (k: string, v: string) => settings.set(k, v), removeItem: (k: string) => settings.delete(k) };
const key = 'test-diagnostic-secret-value';
settings.set('schematico_ai_provider', 'openrouter');
settings.set('schematico_openrouter_api_key', key);
settings.set('schematico_openrouter_model', 'test/model');
const project = fixture();
(project as any).settings = { apiKey: key, access_token: 'unknown-token', nested: { Authorization: 'Bearer another-secret' } };
const original = JSON.stringify(project);
const manager: any = { getProject: () => project, getActivePage: () => project.pages[0], showLayoutPreview: () => { }, notifyModified: () => { throw Error('Unexpected mutation'); } };
const registry = new McpToolRegistry();
const args = { components: [{ id: 'bad', symbolId: 'not-a-symbol' }], connections: [] };
const failed = await registry.executeTool('create_schematic_draft', args, manager);
assert.equal(failed.success, false);
assert.match(failed.error, /not-a-symbol/);
assert(failed.diagnosticId);
const report = getDiagnostic(failed.diagnosticId)!;
assert.equal(report.schemaVersion, 1);
assert.equal(report.stage, 'draft_validation');
assert.equal(report.provider, 'openrouter');
assert.equal(report.model, 'test/model');
assert.deepEqual(report.args, args);
assert.equal((report.project as any).pages[0].id, 'p');
assert(report.error.stack);
assert.equal(JSON.stringify(project), original);
const exported = JSON.stringify(report);
assert(!exported.includes(key));
assert(!exported.includes('unknown-token'));
assert(!exported.includes('another-secret'));
assert(!('project' in failed), 'Provider receives a compact error, not a full project dump');
assert.match(diagnosticSummary(report), /not-a-symbol/);
// Repeated attempts have separate snapshots and remain downloadable after a successful retry.
const malformed = await registry.executeTool('create_schematic_draft', '{"components":', manager);
assert.notEqual(failed.diagnosticId, malformed.diagnosticId);
assert.equal(getDiagnostic(malformed.diagnosticId)!.stage, 'tool_arguments');
assert.equal(getDiagnostic(malformed.diagnosticId)!.args, '{"components":');
const pinError = await registry.executeTool('create_schematic_draft', { components: [{ id: 'a', symbolId: 'circuit_breaker_1p' }, { id: 'b', symbolId: 'circuit_breaker_1p' }], connections: [{ id: 'w', from: { componentId: 'a', pinId: 'missing' }, to: { componentId: 'b', pinId: '1' }, potential: 'L1' }] }, manager);
assert.match(pinError.error, /a:missing/);
assert.equal(getDiagnostic(pinError.diagnosticId)!.stage, 'draft_validation');
project.pages[0].plotFrame.width = 20;
project.pages[0].plotFrame.height = 20;
const invalid = await registry.executeTool('create_schematic_draft', { components: [{ id: 'm', symbolId: 'motor_3phase' }], connections: [] }, manager);
assert.equal(invalid.status, 'layout_invalid');
assert.equal(getDiagnostic(invalid.diagnosticId)!.stage, 'layout_validation');
assert((getDiagnostic(invalid.diagnosticId)!.result as any).issues.length);
project.pages[0].plotFrame.width = 840;
project.pages[0].plotFrame.height = 594;
// An invalid provider tool-argument string fails before tool execution, but still yields a report.
const oldFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'call-bad', function: { name: 'create_schematic_draft', arguments: '{"components":[' } }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
try {
  const client = new GeminiChatClient();
  await assert.rejects(client.sendMessage('Create circuit ' + key, manager), (error: any) => {
    const r = getDiagnostic(error.diagnosticId)!;
    assert(r);
    assert.equal(r.tool, 'create_schematic_draft');
    assert.equal(r.stage, 'tool_arguments');
    assert.equal(r.args, '{"components":[');
    assert(r.error.parseError);
    assert(!JSON.stringify(r).includes(key));
    return true;
  });
}
finally {
  globalThis.fetch = oldFetch;
}
const circular: any = { message: 'Bearer password-here', key: 'untouched', nested: { api_key: 'hidden' } };
circular.self = circular;
assert.doesNotThrow(() => JSON.stringify(sanitizeDiagnostic(circular)));
assert(!JSON.stringify(sanitizeDiagnostic(circular)).includes('password-here'));
clearDiagnostics();
assert.equal(getDiagnostic(failed.diagnosticId), undefined);
console.log('✓ Local reproducible diagnostics for draft, pin, JSON, layout and provider failures; credentials removed; no project mutation or provider snapshot leak');
