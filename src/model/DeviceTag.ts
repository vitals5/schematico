import type { Project } from './types';

/** Reserve a free sequence number across variants sharing the same BMK prefix. */
export function nextDeviceTag(project: Project, prefix: string): string {
  if (!prefix) return '';
  const used = new Set(project.pages.flatMap(page => [...page.components.map(component => component.bmk), ...(page.boxes ?? []).map(box => box.bmk)]));
  let number = 1;
  while (used.has(prefix + number)) number++;
  return prefix + number;
}
