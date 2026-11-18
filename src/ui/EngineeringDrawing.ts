import type { Project } from "../model/types";
export interface DrawingTarget {
  pageId: string;
  componentId: string;
  label: string;
}
export interface DrawingAccess {
  project: () => Project;
  navigate: (pageId: string, componentId: string) => void;
  targets?: (id: string) => DrawingTarget[];
}
/** Resolve saved identities only. No inferred BMK matches, network rebuilds or project writes. */
export function visualDrawingTargets(
  project: Project,
  id: string,
): DrawingTarget[] {
  const result: DrawingTarget[] = [];
  const add = (pageId?: string, componentId?: string) => {
    if (!pageId || !componentId || result.length >= 32) return;
    const pages = project.pages.filter((p) => p.id === pageId);
    if (pages.length !== 1) return;
    const matches = pages[0].components.filter((c) => c.id === componentId);
    if (
      matches.length !== 1 ||
      project.pages.reduce(
        (n, p) => n + p.components.filter((c) => c.id === componentId).length,
        0,
      ) !== 1
    )
      return;
    if (
      !result.some((r) => r.pageId === pageId && r.componentId === componentId)
    )
      result.push({
        pageId,
        componentId,
        label: pages[0].pageNumber + " · " + (matches[0].bmk || componentId),
      });
  };
  const address = (a?: { pageId: string; componentId: string }) =>
    a && add(a.pageId, a.componentId);
  const wire = (pageId: string, wireId: string) => {
    const page = project.pages.find((p) => p.id === pageId),
      ws = page?.wires.filter((w) => w.id === wireId);
    if (ws?.length === 1)
      for (const ep of [ws[0].from, ws[0].to]) add(pageId, ep.componentId);
  };
  try {
    const [kind, a, b] = JSON.parse(id);
    if (kind === "terminal") {
      const [p, c] = JSON.parse(a);
      add(p, c);
    } else if (kind === "contact") {
      const shells = project.connectorAssemblies?.filter((c) => c.id === a);
      const contacts =
        shells?.length === 1
          ? shells[0].contacts.filter((c) => c.position === b)
          : [];
      if (contacts?.length === 1) address(contacts[0].binding);
    } else if (kind === "wire") {
      const [p, w] = JSON.parse(a);
      wire(p, w);
    } else if (kind === "core" || kind === "cable") {
      const [p, c, k] = JSON.parse(a),
        cs = project.pages
          .find((page) => page.id === p)
          ?.cables?.filter((cable) => cable.id === c);
      if (cs?.length === 1) {
        const cores =
          kind === "core"
            ? cs[0].cores.filter((core) => core.id === k)
            : cs[0].cores;
        if (kind === "core" && cores.length !== 1) return [];
        for (const core of cores)
          for (const w of core.wireIds ?? []) wire(p, w);
      }
    } else if (kind === "assembly") {
      const strips = project.terminalStrips?.filter((s) => s.id === a),
        positions =
          strips?.length === 1
            ? strips[0].positions.filter((p) => p.id === b)
            : [];
      if (positions?.length === 1 && positions[0].kind === "terminal")
        for (const member of positions[0].members) address(member);
    } else if (kind === "automation") {
      const data = project.automation;
      if (!data) return [];
      if (a === "channels") {
        const rows = data.channels.filter((r) => r.id === b);
        if (rows.length === 1)
          for (const r of [rows[0].signal, rows[0].supply, rows[0].common])
            address(r);
      } else if (a === "nodes") {
        const nodes = data.nodes.filter((n) => n.id === b);
        if (nodes.length === 1) address(nodes[0].binding);
      } else if (a === "knxObjects") {
        const objects = data.knxObjects.filter((o) => o.id === b);
        if (objects.length === 1) {
          const nodes = data.nodes.filter((n) => n.id === objects[0].nodeId);
          if (nodes.length === 1) address(nodes[0].binding);
        }
      }
    }
  } catch {
    return [];
  }
  return result;
}
