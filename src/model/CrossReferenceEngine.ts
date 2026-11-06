import { functionType } from './FunctionDefinitions';
// src/model/CrossReferenceEngine.ts
// Calculates automatic cross-references (Kontaktspiegel & Querverweise) according to DIN EN 81346 logic

import { Project, PlacedComponent, Page, SymbolDefinition } from './types';
import { getSymbolForComponent } from './symbols';
import { componentInsertionPoint } from './SymbolGeometry';
import { ProjectIndex } from './ProjectIndex';
import { isInterruptionSymbol } from './ConnectionSymbols';

export interface ContactMirrorItem {
  type: 'PowerNO' | 'NO' | 'NC' | 'Changeover';
  pinNames: string;
  targetPageNumber: string;
  targetPageId?: string;
  targetCol: number;
  slaveId: string;
}

export interface MasterCrossReferenceInfo {
  masterId: string;
  bmk: string;
  contacts: ContactMirrorItem[];
}

export class CrossReferenceEngine {
  /**
   * Calculates path/column (0..9) based on X coordinate within standard DIN A3 frame
   */
  public static calculatePath(x: number, frameWidth = 1000): number {
    // 10 columns across page width: 0 to 9
    const leftMargin = 50;
    const rightMargin = 50;
    const usableWidth = frameWidth - leftMargin - rightMargin;
    const colWidth = usableWidth / 10;

    if (x < leftMargin) return 0;
    if (x >= frameWidth - rightMargin) return 9;
    const col = Math.floor((x - leftMargin) / colWidth);
    return Math.max(0, Math.min(9, col));
  }

  public static componentPath(
    comp: PlacedComponent,
    page: Page,
    project: Project,
  ): number {
    const symbol = getSymbolForComponent(comp, project);
    const x = symbol ? componentInsertionPoint(comp, symbol).x : comp.x;
    return comp.source?.format === 'NATIVE_CAD'
      ? Math.max(
          0,
          Math.min(
            page.plotFrame.columns - 1,
            Math.floor(x / (page.plotFrame.width / page.plotFrame.columns)),
          ),
        )
      : this.calculatePath(x, page.plotFrame.width);
  }

  /**
   * Recalculates all cross-references across all pages in the project
   */
  public static updateProjectCrossReferences(project: Project): void {
    const index = new ProjectIndex(project);
    const processed = this.updateDeviceCrossReferences(project, index);
    const bmkGroups = new Map(
      [...index.referenceGroups].map(([key, entries]) => [
        key,
        entries
          .filter((entry) => !processed.has(entry.component))
          .map((entry) => ({
            comp: entry.component,
            page: entry.page,
            col: this.componentPath(entry.component, entry.page, project),
          })),
      ]),
    );
    for (const entry of index.components)
      if (!entry.referenceKey && !entry.nativeRepresentation)
        entry.component.crossRef = '';

    // Process each BMK group (e.g. all components named "-K1")
    for (const items of bmkGroups.values()) {
      if (!items.length) continue;
      // Find masters (e.g. coils) and slaves (e.g. contacts)
      const masters = items.filter((i) => {
        const sym = getSymbolForComponent(i.comp, project);
        return sym?.isMaster === true;
      });

      const slaves = items.filter((i) => {
        const sym = getSymbolForComponent(i.comp, project);
        return sym?.isContact === true;
      });

      if (masters.length > 1) {
        for (const item of items)
          if (!index.entry(item.comp)?.nativeRepresentation)
            item.comp.crossRef = '';
        continue; // Identity is ambiguous; do not choose an arbitrary coil.
      }
      if (masters.length > 0) {
        const primaryMaster = masters[0];

        // Update cross-reference string on each slave contact pointing to master
        for (const slave of slaves) {
          slave.comp.crossRef = `/${primaryMaster.page.pageNumber}.${primaryMaster.col}`;
        }

        // Calculate contact mirror items for master
        const mirrorItems: ContactMirrorItem[] = [];
        for (const slave of slaves) {
          const sym = getSymbolForComponent(slave.comp, project);
          const pinNames = sym?.pins
            .map((p) => slave.comp.pins[p.id]?.customLabel ?? p.name)
            .join('-');

          mirrorItems.push({
            type: sym?.contactType || 'NO',
            pinNames: pinNames || '13-14',
            targetPageNumber: slave.page.pageNumber,
            targetCol: slave.col,
            slaveId: slave.comp.id,
          });
        }

        // Store formatted summary on master component
        primaryMaster.comp.crossRef =
          mirrorItems.length > 0
            ? mirrorItems
                .map(
                  (m) => `${m.pinNames}: /${m.targetPageNumber}.${m.targetCol}`,
                )
                .join(' | ')
            : '';
      } else if (items.length > 1) {
        // Multiple native CAD placements can be pins/parts of one device, not contact pairs.
        // Retain explicit source references until main/aux semantics are established.
        // Adding a generic representation must not turn native pins/graphics into dozens of references.
        const nativeParts = items.filter((i) => {
          const symbol = getSymbolForComponent(i.comp, project);
          return (
            i.comp.source?.format === 'NATIVE_CAD' ||
            !!(symbol?.source && symbol.importedGraphics)
          );
        });
        const interruptionGroup = items.every((i) => {
          const symbol = getSymbolForComponent(i.comp, project);
          return symbol && isInterruptionSymbol(symbol);
        });
        if (
          nativeParts.length &&
          (nativeParts.length === items.length || !interruptionGroup)
        )
          continue;
        // Pairs / multiple components with same BMK without explicit master
        // Terminals in the same strip do not cross-reference each other
        const isTerminalGroup = items.every((i) => {
          const sym = getSymbolForComponent(i.comp, project);
          return sym?.category === 'terminals';
        });

        if (!isTerminalGroup) {
          for (let i = 0; i < items.length; i++) {
            const others = items.filter((_, idx) => idx !== i);
            items[i].comp.crossRef = others
              .map((o) => `/${o.page.pageNumber}.${o.col}`)
              .join(', ');
          }
        } else {
          for (const item of items) {
            item.comp.crossRef = '';
          }
        }
      } else {
        if (!index.entry(items[0].comp)?.nativeRepresentation)
          items[0].comp.crossRef = '';
      }
    }
  }

  public static updateDeviceCrossReferences(
    project: Project,
    index = new ProjectIndex(project),
  ) {
    const processed = new Set<PlacedComponent>();
    for (const entry of index.components) {
      const c = entry.component;
      if (c.deviceReference && !index.hasDeviceRecord(c)) {
        if (c.deviceReference.originalCrossRef === undefined) delete c.crossRef;
        else c.crossRef = c.deviceReference.originalCrossRef;
        delete c.deviceReference;
      }
    }
    for (const device of index.devices.valid.values()) {
      const members = device.members.map(
          (a) => index.component(a.componentId, a.pageId)!,
        ),
        main = index.component(device.main.componentId, device.main.pageId)!,
        others = members.filter((e) => e !== main);
      const assign = (
        entry: typeof main,
        text: string,
        targets: typeof members,
      ) => {
        entry.component.deviceReference = {
          deviceId: device.id,
          originalCrossRef: entry.component.deviceReference
            ? entry.component.deviceReference.originalCrossRef
            : entry.component.crossRef,
          generatedText: text,
          targets: targets.map((e) => ({
            pageId: e.page.id,
            componentId: e.component.id,
          })),
        };
        entry.component.crossRef = text;
        processed.add(entry.component);
      };
      for (const e of others)
        assign(
          e,
          `/${main.page.pageNumber}.${this.componentPath(main.component, main.page, project)}`,
          [main],
        );
      assign(
        main,
        others
          .map((e) => {
            const pins =
              this.contactKind(e.component, e.symbol) && e.symbol
                ? e.symbol.pins
                    .map((p) => e.component.pins[p.id]?.customLabel ?? p.name)
                    .join('-')
                : '';
            return `${pins ? pins + ': ' : ''}/${e.page.pageNumber}.${this.componentPath(e.component, e.page, project)}`;
          })
          .join(' | '),
        others,
      );
    }
    for (const entry of index.components)
      if (
        index.hasDeviceRecord(entry.component) &&
        !processed.has(entry.component)
      ) {
        const c = entry.component;
        if (!c.deviceReference)
          c.deviceReference = {
            deviceId:
              (project.physicalDevices ?? []).find((d) =>
                d.members.some((a) => a.componentId === c.id),
              )?.id ?? '',
            originalCrossRef: c.crossRef,
            generatedText: '',
            targets: [],
          };
        c.crossRef = '';
        processed.add(c);
      }
    return processed;
  }

  /**
   * Retrieves detailed contact mirror items for rendering under a contactor coil
   */
  private static contactKind(
    comp: PlacedComponent,
    symbol: SymbolDefinition | undefined,
  ): ContactMirrorItem['type'] | undefined {
    if (symbol?.isContact) return symbol.contactType ?? 'NO';
    const type = comp.articleFunctionType ?? (symbol && functionType(symbol));
    switch (type) {
      case 'contact_no':
        return 'NO';
      case 'contact_nc':
        return 'NC';
      case 'contact_changeover':
        return 'Changeover';
      case 'power_contact_3p':
        return 'PowerNO';
      default:
        return undefined;
    }
  }

  public static getContactMirror(
    masterComp: PlacedComponent,
    project: Project,
  ): ContactMirrorItem[] {
    const sym = getSymbolForComponent(masterComp, project);
    const index = new ProjectIndex(project),
      device = index.confirmedDeviceFor(masterComp);
    if (
      index.hasDeviceRecord(masterComp)
        ? !device || device.main.componentId !== masterComp.id
        : !sym?.isMaster
    )
      return [];

    const mirror: ContactMirrorItem[] = [];

    const peers = index.referencesFor(masterComp);
    if (!device && peers.filter((e) => e.symbol?.isMaster).length !== 1)
      return [];
    for (const entry of peers) {
      const { component: comp, page, symbol: compSym } = entry;
      const type = this.contactKind(comp, compSym);
      if (comp.id === masterComp.id || !type || !compSym) continue;
      mirror.push({
        type,
        pinNames: compSym.pins
          .map((p) => comp.pins[p.id]?.customLabel ?? p.name)
          .join('-'),
        targetPageNumber: page.pageNumber,
        targetPageId: page.id,
        targetCol: this.componentPath(comp, page, project),
        slaveId: comp.id,
      });
    }

    return mirror;
  }
}
