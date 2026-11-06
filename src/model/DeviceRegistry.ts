import type { ComponentAddress, PhysicalDevice } from './ArticleTypes';
import type { Page, PlacedComponent, Project } from './types';
import { articleSignature, effectiveArticles } from './ArticleAssignments';
export const addressKey = (a: ComponentAddress) =>
  JSON.stringify([a.pageId, a.componentId]);
export const componentAddress = (
  page: Page,
  c: PlacedComponent,
): ComponentAddress => ({ pageId: page.id, componentId: c.id });
export function designationContext(page: Page, c: PlacedComponent) {
  return JSON.stringify([
    (c.higherLevelFunction ?? page.higherLevel ?? '')
      .trim()
      .replace(/^=+/, '')
      .trim(),
    (c.mountingLocation ?? page.location ?? '')
      .trim()
      .replace(/^\++/, '')
      .trim(),
    c.bmk.trim(),
  ]);
}
export interface DeviceIssue {
  deviceId: string;
  code:
    | 'duplicate_id'
    | 'missing_member'
    | 'duplicate_member'
    | 'missing_main'
    | 'empty_designation'
    | 'different_designation'
    | 'conflicting_articles'
    | 'unconfirmed';
  members: ComponentAddress[];
}
export class DeviceRegistry {
  readonly issues: DeviceIssue[] = [];
  readonly valid = new Map<string, PhysicalDevice>();
  private byMember = new Map<string, PhysicalDevice>();
  private placements = new Map<
    string,
    { page: Page; component: PlacedComponent }[]
  >();
  constructor(readonly project: Project) {
    for (const page of project.pages)
      for (const component of page.components) {
        const key = addressKey(componentAddress(page, component));
        this.placements.set(key, [
          ...(this.placements.get(key) ?? []),
          { page, component },
        ]);
      }
    const membership = new Map<string, number>(),
      ids = new Map<string, number>();
    for (const d of project.physicalDevices ?? []) {
      ids.set(d.id, (ids.get(d.id) ?? 0) + 1);
      for (const a of d.members)
        membership.set(addressKey(a), (membership.get(addressKey(a)) ?? 0) + 1);
    }
    for (const d of project.physicalDevices ?? []) {
      const errors = new Set<DeviceIssue['code']>(),
        main = this.placement(d.main);
      if (ids.get(d.id) !== 1) errors.add('duplicate_id');
      if (d.verification !== 'user_confirmed') errors.add('unconfirmed');
      if (!main || !d.members.some((a) => addressKey(a) === addressKey(d.main)))
        errors.add('missing_main');
      if (main && !main.component.bmk.trim()) errors.add('empty_designation');
      for (const member of d.members) {
        const e = this.placement(member);
        if (!e) {
          errors.add('missing_member');
          continue;
        }
        if (membership.get(addressKey(member)) !== 1)
          errors.add('duplicate_member');
        if (
          main &&
          designationContext(e.page, e.component) !==
            designationContext(main.page, main.component)
        )
          errors.add('different_designation');
        if (
          main &&
          addressKey(member) !== addressKey(d.main) &&
          effectiveArticles(e.component, project).length &&
          articleSignature(e.component, project) !==
            articleSignature(main.component, project)
        )
          errors.add('conflicting_articles');
      }
      if (errors.size)
        for (const code of errors)
          this.issues.push({ deviceId: d.id, code, members: d.members });
      else {
        this.valid.set(d.id, d);
        for (const a of d.members) this.byMember.set(addressKey(a), d);
      }
    }
  }
  placement(a: ComponentAddress) {
    const matches = this.placements.get(addressKey(a));
    return matches?.length === 1 ? matches[0] : undefined;
  }
  forComponent(a: ComponentAddress) {
    return this.byMember.get(addressKey(a));
  }
  owner(a: ComponentAddress) {
    return this.placement(this.forComponent(a)?.main ?? a);
  }
}
export function linkPhysicalDevice(
  project: Project,
  members: ComponentAddress[],
  main: ComponentAddress,
): void {
  if (
    members.length < 2 ||
    new Set(members.map(addressKey)).size !== members.length
  )
    throw new Error('articlesDeviceInvalid');
  const current = new DeviceRegistry(project);
  if (
    members.some(
      (a) =>
        current.forComponent(a) ||
        (project.physicalDevices ?? []).some((d) =>
          d.members.some((m) => addressKey(a) === addressKey(m)),
        ),
    )
  )
    throw new Error('articlesDeviceOverlap');
  const device: PhysicalDevice = {
    id: crypto.randomUUID(),
    main: structuredClone(main),
    members: structuredClone(members),
    verification: 'user_confirmed',
  };
  const test = {
      ...project,
      physicalDevices: [...(project.physicalDevices ?? []), device],
    },
    registry = new DeviceRegistry(test);
  if (!registry.valid.has(device.id)) throw new Error('articlesDeviceInvalid');
  project.physicalDevices = test.physicalDevices;
}
