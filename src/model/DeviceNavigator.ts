import type { AssignedArticle, ComponentAddress } from './ArticleTypes';
import type { Project } from './types';
import {
  DeviceRegistry,
  addressKey,
  componentAddress,
  designationContext,
} from './DeviceRegistry';
import {
  effectiveArticles,
  setArticleAssignment,
  validateAssignments,
} from './ArticleAssignments';
import { projectRevision } from '../layout/types';
export interface PlannedDevice {
  id: string;
  plant: string;
  location: string;
  bmk: string;
  description: string;
  items: AssignedArticle[];
  placement?: ComponentAddress;
}
export function deviceNavigator(
  project: Project,
  registry = new DeviceRegistry(project),
) {
  const linked = new Set<string>();
  const entries = [...registry.valid.values()].map((d) => {
    d.members.forEach((a) => linked.add(addressKey(a)));
    const e = registry.placement(d.main)!;
    return {
      id: d.id,
      state: 'verified' as string,
      designation: JSON.parse(designationContext(e.page, e.component)).join(
        ' ',
      ),
      description: e.component.functionText,
      items: effectiveArticles(e.component, project),
      members: d.members,
      main: d.main,
    };
  });
  for (const page of project.pages)
    for (const c of page.components) {
      const a = componentAddress(page, c);
      if (!linked.has(addressKey(a)))
        entries.push({
          id: addressKey(a),
          state: 'placement',
          designation: JSON.parse(designationContext(page, c)).join(' '),
          description: c.functionText,
          items: effectiveArticles(c, project),
          members: [a],
          main: a,
        });
    }
  for (const d of project.plannedDevices ?? []) {
    if (d.placement && registry.placement(d.placement)) continue;
    entries.push({
      id: d.id,
      state: d.placement ? 'missing_placement' : 'unplaced',
      designation: [d.plant, d.location, d.bmk].join(' '),
      description: d.description,
      items: d.items,
      members: [],
      main: undefined as any,
    });
  }
  return entries;
}
export class DeviceNavigatorPlan {
  readonly #revision: string;
  readonly #result: Project;
  constructor(
    project: Project,
    action:
      | { kind: 'save'; device: PlannedDevice }
      | { kind: 'delete'; id: string }
      | {
          kind: 'allocate';
          id: string;
          target: ComponentAddress;
          expected?: PlannedDevice;
        },
  ) {
    this.#revision = projectRevision(project);
    const result = structuredClone(project),
      records = (result.plannedDevices ??= []);
    if (action.kind === 'save') {
      const d = structuredClone(action.device);
      if (
        !d.bmk.trim() ||
        !d.id ||
        records.filter((r) => r.id === d.id).length > 1
      )
        throw new Error('deviceInvalid');
      d.bmk = d.bmk.trim();
      d.plant = d.plant.trim().replace(/^=+/, '');
      d.location = d.location.trim().replace(/^\++/, '');
      d.items = validateAssignments(d.items);
      const existing = records.findIndex((r) => r.id === d.id);
      if (
        existing >= 0 &&
        records[existing].placement &&
        new DeviceRegistry(result).placement(records[existing].placement!)
      )
        throw new Error('deviceAlreadyPlaced');
      if (
        records.some(
          (r) =>
            r.id !== d.id &&
            JSON.stringify([r.plant, r.location, r.bmk]) ===
              JSON.stringify([d.plant, d.location, d.bmk]),
        )
      )
        throw new Error('deviceDuplicate');
      if (existing < 0) records.push(d);
      else records[existing] = d;
    } else {
      const found = records.filter((r) => r.id === action.id);
      if (found.length !== 1) throw new Error('deviceInvalid');
      const d = found[0];
      if (action.kind === 'delete')
        result.plannedDevices = records.filter((r) => r.id !== d.id);
      else {
        if (
          action.expected &&
          JSON.stringify(action.expected) !== JSON.stringify(d)
        )
          throw new Error('deviceSaveFirst');
        if (d.placement && new DeviceRegistry(result).placement(d.placement))
          throw new Error('deviceAlreadyPlaced');
        const registry = new DeviceRegistry(result),
          e = registry.placement(action.target);
        if (!e || registry.forComponent(action.target))
          throw new Error('deviceInvalid');
        const context = JSON.stringify([d.plant, d.location, d.bmk]);
        if (
          result.pages.some((p) =>
            p.components.some(
              (c) => c !== e.component && designationContext(p, c) === context,
            ),
          )
        )
          throw new Error('deviceDuplicate');
        e.component.bmk = d.bmk;
        e.component.higherLevelFunction = d.plant;
        e.component.mountingLocation = d.location;
        e.component.functionText = d.description;
        setArticleAssignment(e.component, d.items);
        d.placement = structuredClone(action.target);
      }
    }
    this.#result = result;
  }
  apply(project: Project) {
    if (projectRevision(project) !== this.#revision)
      throw new Error('articlesProjectStale');
    const result = structuredClone(this.#result);
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
