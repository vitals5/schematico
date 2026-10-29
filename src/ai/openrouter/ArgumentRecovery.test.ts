import assert from 'node:assert/strict';
import { routerChat } from './api';
import { rememberDiagnostic, getDiagnostic, diagnosticSummary } from '../Diagnostics';
const originalFetch = globalThis.fetch;
const call = (id: string, args: string) => ({ id, type: 'function', function: { name: 'create_schematic_draft', arguments: args } });
const reply = (calls: any[], finish = 'tool_calls') => Response.json({ choices: [{ finish_reason: finish, native_finish_reason: finish === 'length' ? 'max_tokens' : 'stop',
    message: { role: 'assistant', content: null, reasoning_details: [{ type: 'reasoning.encrypted', data: 'opaque' }], tool_calls: calls } }] });
const history: any[] = [{ role: 'user', parts: [{ text: 'Erstelle die Schaltung' }] }];
const source = JSON.stringify(history);
const truncated = '{"components":' + JSON.stringify(Array.from({ length: 19 }, (_, i) => ({ id: 'X' + i, symbolId: 'terminal_single' })));
try {
    let requests: any[] = [];
    globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body)); requests.push(body);
        if (requests.length === 1) return reply([call('incomplete', truncated), call('other', '{"components":[]}')]);
        const messages = body.messages;
        assert.equal(messages.filter((m: any) => m.role === 'tool').length, 2, 'Every discarded call must be closed without execution');
        assert(messages.filter((m: any) => m.role === 'tool').every((m: any) => JSON.parse(m.content).success === false));
        assert.equal(messages.find((m: any) => m.tool_calls)?.reasoning_details[0].data, 'opaque');
        return reply([call('corrected', '{"components":[{"id":"X0"}],"connections":[]}')]);
    };
    const recovered = await routerChat('test-key', 'vendor/tool', history, '', []);
    assert.equal(requests.length, 2);
    assert.equal(recovered.functionCalls.length, 1);
    assert.equal(recovered.functionCalls[0].args.components[0].id, 'X0');
    assert.equal((recovered.candidates[0].content.openRouterMessage as any).tool_calls[0].id, 'corrected');
    assert.equal(JSON.stringify(history), source);
    for (const invalid of [truncated, 'null', '[]', '42']) {
        let count = 0;
        globalThis.fetch = async () => { count++; return reply([call('bad', invalid)], 'length'); };
        let failure: any;
        try { await routerChat('test-key', 'vendor/tool', history, '', []); } catch (e) { failure = e; }
        assert(failure); assert.equal(count, 2, 'Only one corrective request is permitted');
        assert.equal(failure.diagnosticStage, 'tool_arguments');
        assert.equal(failure.argumentAttempts.length, 2);
        assert.equal(failure.argumentAttempts[0].args, invalid);
        assert.equal(failure.argumentAttempts[0].finishReason, 'length');
        const id = rememberDiagnostic({ tool: failure.toolName, stage: failure.diagnosticStage, error: failure, args: failure.toolArguments });
        assert.equal(getDiagnostic(id)!.error.argumentAttempts![1].nativeFinishReason, 'max_tokens');
        assert(diagnosticSummary(getDiagnostic(id)!).includes('length → length'));
    }
    const secret = 'sk-or-v1-123456789012345678901234567890';
    const redacted = rememberDiagnostic({ tool: 'create_schematic_draft', stage: 'tool_arguments', error: {
        message: 'Invalid', argumentAttempts: [{ tool: 'create_schematic_draft', args: secret, parseError: secret, finishReason: 'length' }],
    } });
    assert(!JSON.stringify(getDiagnostic(redacted)).includes(secret), 'Correction history must also redact credentials');
    // Even syntactically complete JSON is unsafe when the provider reports truncation.
    let count = 0;
    globalThis.fetch = async () => ++count === 1 ? reply([call('cut', '{}')], 'length') : reply([call('good', '{}')]);
    await routerChat('test-key', 'vendor/tool', history, '', []); assert.equal(count, 2);
    count = 0;
    globalThis.fetch = async () => ++count === 1 ? reply([call('bad', truncated)]) : Response.json({ choices: [{ message: { content: 'Fertig!' } }] });
    await assert.rejects(routerChat('test-key', 'vendor/tool', history, '', []), /keinen korrigierten Werkzeugaufruf/);
    const controller = new AbortController(); count = 0;
    globalThis.fetch = async () => { count++; controller.abort(); return reply([call('bad', truncated)]); };
    await assert.rejects(routerChat('test-key', 'vendor/tool', history, '', [], controller.signal), { name: 'AbortError' });
    assert.equal(count, 1, 'Cancellation prevents a correction request');
    console.log('✓ Truncated tool argument recovery, atomic batch discard, reasoning replay, bounded retries, provider finish diagnostics, no false success and cancellation');
} finally { globalThis.fetch = originalFetch; }
