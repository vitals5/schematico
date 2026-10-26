import type { Project, Page } from "../model/types";
import { MacroManager } from "../model/MacroManager";
import { getDrawingUnitsPerMm } from "../model/symbols";
import { clone } from "./types";
/** Exact additional schematic representation. Never replace native masters with generic devices. */
export function duplicateSchematicPage(
  project: Project,
  pageId: string,
  title?: string,
  pageNumber?: string,
): { project: Project; page: Page } {
  const source = project.pages.find((p) => p.id === pageId);
  if (!source || source.floorPlan || source.pageType !== "schematic")
    throw new Error("Eine vorhandene Stromlaufplanseite muss gewählt werden.");
  if (
    pageNumber !== undefined &&
    (!pageNumber.trim() ||
      project.pages.some(
        (p) =>
          p.pageNumber === pageNumber &&
          p.higherLevel === source.higherLevel &&
          p.location === source.location,
      ))
  )
    throw new Error("Blattnummer ist leer oder bereits belegt.");
  const result = clone(project),
    page = MacroManager.instantiatePageMacro(
      {
        id: "copy",
        name: source.title,
        type: "ems",
        category: "",
        description: "",
        page: source,
        unitsPerMm: getDrawingUnitsPerMm(project),
      },
      result,
    );
  const ids = new Map<string, string>();
  for (const key of [
    "components",
    "wires",
    "images",
    "boxes",
    "texts",
    "cables",
  ] as const)
    (source[key] ?? []).forEach((obj, i) => ids.set(obj.id, page[key]![i].id));
  // Macro placement drops singleton layout groups; an exact page copy must retain them.
  for (const group of source.groups ?? []) ids.set(group.id, 'group_' + crypto.randomUUID());
  page.groups = source.groups?.map(group => ({
    ...clone(group), id: ids.get(group.id)!,
    members: group.members.map(member => ({ ...member, id: ids.get(member.id) ?? member.id })),
  }));
  if (source.layoutConstraints)
    page.layoutConstraints = {
      ...clone(source.layoutConstraints),
      lockedIds: source.layoutConstraints.lockedIds?.map(
        (id) => ids.get(id) ?? id,
      ),
      containerMembers: source.layoutConstraints.containerMembers
        ? Object.fromEntries(
            Object.entries(source.layoutConstraints.containerMembers).map(
              ([id, members]) => [
                ids.get(id) ?? id,
                members.map((id) => ids.get(id) ?? id),
              ],
            ),
          )
        : undefined,
    };
  page.suppressedAutoconnections = source.suppressedAutoconnections?.map(
    (connection) =>
      connection
        .split("|")
        .map((endpoint) => {
          const separator = endpoint.lastIndexOf(":");
          return (
            (ids.get(endpoint.slice(0, separator)) ??
              endpoint.slice(0, separator)) + endpoint.slice(separator)
          );
        })
        .join("|"),
  );
  if (title !== undefined) page.title = title;
  if (pageNumber !== undefined) page.pageNumber = pageNumber;
  page.plotFrame.titleBlock.sheetNumber = page.pageNumber;
  page.plotFrame.titleBlock.date = source.plotFrame.titleBlock.date;
  const logical = (project.logicalConnections ?? [])
    .filter((w) => ids.has(w.from.componentId) && ids.has(w.to.componentId))
    .map((w) => ({
      ...clone(w),
      id: "logical_" + crypto.randomUUID(),
      from: { ...w.from, componentId: ids.get(w.from.componentId)! },
      to: { ...w.to, componentId: ids.get(w.to.componentId)! },
    }));
  if (logical.length) (result.logicalConnections ??= []).push(...logical);
  result.pages.push(page);
  result.activePageId = page.id;
  for (const p of result.pages)
    p.plotFrame.titleBlock.totalSheets = String(result.pages.length);
  return { project: result, page };
}
