import type { ComponentAddress } from './ArticleTypes';
import type { Project } from './types';
import { DeviceRegistry } from './DeviceRegistry';
import { effectiveArticles, primaryArticle } from './ArticleAssignments';
import { getSymbolForComponent } from './symbols';
export type CompatibilityCode =
  | 'missing_specification'
  | 'unverified_specification'
  | 'unknown_symbol'
  | 'unknown_function'
  | 'unknown_pins'
  | 'pin_count'
  | 'pin_labels'
  | 'function_type'
  | 'ambiguous_function'
  | 'function_not_found';
export interface ArticleCompatibility {
  status: 'compatible' | 'incompatible' | 'unknown' | 'unassigned';
  issues: {
    code: CompatibilityCode;
    componentId: string;
    expected?: string;
    actual?: string;
  }[];
}
export function articleCompatibility(
  project: Project,
  address: ComponentAddress,
  registry = new DeviceRegistry(project),
): ArticleCompatibility {
  const owner = registry.owner(address);
  if (!owner)
    return {
      status: 'unknown',
      issues: [{ code: 'unknown_symbol', componentId: address.componentId }],
    };
  const primary = primaryArticle(effectiveArticles(owner.component, project));
  if (!primary) return { status: 'unassigned', issues: [] };
  const issues: ArticleCompatibility['issues'] = [],
    spec = primary.snapshot;
  const add = (
    code: CompatibilityCode,
    componentId = address.componentId,
    expected?: string,
    actual?: string,
  ) => issues.push({ code, componentId, expected, actual });
  if (!spec?.functions?.length) {
    add('missing_specification');
    return { status: 'unknown', issues };
  }
  if (spec.verification !== 'user_checked') add('unverified_specification');
  const group = registry.forComponent(address),
    members = group?.members ?? [address];
  for (const member of members) {
    const e = registry.placement(member);
    if (!e) {
      add('unknown_symbol', member.componentId);
      continue;
    }
    const c = e.component,
      s = getSymbolForComponent(c, project);
    if (!s || s.unresolved) {
      add('unknown_symbol', c.id);
      continue;
    }
    const labels = s.pins
        .map((p) => c.pins[p.id]?.customLabel ?? p.name)
        .map((n) => n.trim())
        .sort(),
      type = c.articleFunctionType ?? s.functionDefinition;
    const candidates = c.articleFunctionId
      ? spec.functions.filter((f) => f.id === c.articleFunctionId)
      : spec.functions.length === 1
        ? spec.functions
        : spec.functions.filter(
            (f) =>
              type &&
              f.type === type &&
              JSON.stringify([...f.pins].sort()) === JSON.stringify(labels),
          );
    if (candidates.length !== 1) {
      add(
        candidates.length
          ? 'ambiguous_function'
          : c.articleFunctionId
            ? 'function_not_found'
            : 'unknown_function',
        c.id,
      );
      continue;
    }
    const f = candidates[0];
    if (!type) add('unknown_function', c.id);
    else if (type !== f.type) add('function_type', c.id, f.type, type);
    if (labels.some((n) => !n) || !labels.length) add('unknown_pins', c.id);
    else {
      if (labels.length !== f.pins.length)
        add('pin_count', c.id, String(f.pins.length), String(labels.length));
      if (JSON.stringify(labels) !== JSON.stringify([...f.pins].sort()))
        add(
          'pin_labels',
          c.id,
          [...f.pins].sort().join(', '),
          labels.join(', '),
        );
    }
  }
  const incompatible = issues.some((i) =>
    ['pin_count', 'pin_labels', 'function_type', 'function_not_found'].includes(
      i.code,
    ),
  );
  return {
    status: incompatible
      ? 'incompatible'
      : issues.length
        ? 'unknown'
        : 'compatible',
    issues,
  };
}
