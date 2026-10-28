import { version } from '../../package.json';
import { getAiProvider, getAiModel, getOpenRouterKey } from './ProviderConfig';
import { getGeminiApiKey } from './GeminiConfig';
/** Reports are local session data. Never send the project snapshot back to the model. */
export interface AiDiagnostic {
  schema: 'schematico-ai-diagnostic';
  schemaVersion: 1;
  id: string;
  createdAt: string;
  appVersion: string;
  provider: string;
  model: string;
  tool: string;
  stage: string;
  durationMs?: number;
  error: {
    name: string;
    message: string;
    stack?: string;
    status?: number;
    parseError?: string;
  };
  args?: unknown;
  result?: unknown;
  project?: unknown;
  prompt?: string;
  recentCalls?: unknown;
}
const reports = new Map<string, AiDiagnostic>();
export function sanitizeDiagnostic(value: unknown): any {
  const secrets = [getOpenRouterKey(), getGeminiApiKey()].filter(s => s.length >= 8);
  const seen = new WeakSet<object>();
  const text = (s: string) => {
    for (const secret of secrets)
      s = s.split(secret).join('[REDACTED]');
    return s.replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
      .replace(/\b(?:sk-or-v1-|sk-|ghp_|github_pat_|AIza)[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
      .replace(/([?&](?:key|api_key|token|access_token)=)[^&\s"']+/gi, '$1[REDACTED]');
  };
  const walk = (v: any): any => {
    if (typeof v === 'string')
      return text(v);
    if (v === null || typeof v === 'number' || typeof v === 'boolean')
      return v;
    if (typeof v !== 'object')
      return v === undefined ? undefined : String(v);
    if (seen.has(v))
      return '[Circular]';
    seen.add(v);
    const result = Array.isArray(v) ? v.map(walk) : Object.fromEntries(Object.entries(v).map(([k, x]) => [text(k), /^(?:.*api[_-]?key|authorization|proxy-authorization|password|secret|clientSecret|access[_-]?token|refresh[_-]?token|token|cookie|set-cookie|credentials|headers|key)$/i.test(k) ? '[REDACTED]' : walk(x)]));
    seen.delete(v);
    return result;
  };
  return walk(value);
}
export function rememberDiagnostic(input: {
  tool: string;
  stage: string;
  error?: any;
  args?: unknown;
  result?: unknown;
  project?: unknown;
  durationMs?: number;
  prompt?: string;
  recentCalls?: unknown;
  provider?: string;
  model?: string;
}): string {
  const error = input.error;
  const id = 'ai-error-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  const report: AiDiagnostic = sanitizeDiagnostic({
    schema: 'schematico-ai-diagnostic', schemaVersion: 1, id, createdAt: new Date().toISOString(), appVersion: version,
    provider: input.provider ?? getAiProvider(), model: input.model ?? getAiModel(),
    tool: input.tool, stage: input.stage, durationMs: input.durationMs,
    error: { name: error?.name ?? 'ToolError', message: error?.message ?? (input.result && ((input.result as any).error ?? (input.result as any).message)) ?? 'Aktion fehlgeschlagen.', stack: error?.stack, status: error?.status, parseError: error?.parseError },
    args: input.args, result: input.result, project: input.project, prompt: input.prompt, recentCalls: input.recentCalls,
  });
  reports.set(id, report);
  while (reports.size > 12)
    reports.delete(reports.keys().next().value!);
  return id;
}
export function getDiagnostic(id: string): AiDiagnostic | undefined { return reports.get(id); }
export function enrichDiagnostic(id: string, context: {
  prompt: string;
  provider: string;
  model: string;
  recentCalls: unknown;
}): void {
  const report = reports.get(id);
  if (report)
    Object.assign(report, sanitizeDiagnostic(context));
}
export function clearDiagnostics(): void { reports.clear(); }
export function diagnosticSummary(report: AiDiagnostic): string {
  const result = report.result as any;
  const brief = result ? { status: result.status, message: result.message, issueCount: result.issues?.length, issues: result.issues?.slice(0, 12) } : undefined;
  return `${report.appVersion} · ${report.provider} / ${report.model}\nAktion: ${report.tool}\nPhase: ${report.stage}\nZeitpunkt: ${report.createdAt}\nFehler: ${report.error.message}` + (report.error.parseError ? '\nJSON: ' + report.error.parseError : '') + (brief ? '\n\nErgebnis (Auszug):\n' + JSON.stringify(brief, null, 2) : '');
}
