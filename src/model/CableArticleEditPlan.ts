import type { AssignedArticle } from "./ArticleTypes";
import type { Project } from "./types";
import {
  uniqueCable,
  validCableLength,
  validateCablePart,
  cablePartData,
  type CableAddress,
} from "./CableArticles";
import { projectRevision } from "../layout/types";
import { selectCircuitArticle } from "./CircuitArticleSelection";
import { catalogCircuitArticle } from "./DimensioningArticles";
import {
  withDimensioning,
  calculateDimensioning,
} from "./ElectricalDimensioning";
import { tr } from "../i18n";
import { inspectWiring, type WiringFinding } from "./WiringManagement";

export interface CableArticleEdit {
  article?: AssignedArticle;
  lengthM?: number;
  adoptSpecification: boolean;
  /** Explicitly selected circuit records; unchecked existing bindings are detached, never deleted. */
  circuitIds: string[];
  adoptCircuitValues: boolean;
  confirmFullLength: boolean;
}
export class CableArticleEditPlan {
  private readonly base: string;
  private readonly result: Project;
  readonly before: NonNullable<ReturnType<typeof uniqueCable>>;
  readonly after: NonNullable<ReturnType<typeof uniqueCable>>;
  readonly findings: WiringFinding[];
  readonly calculations: {
    before: NonNullable<Project["dimensioning"]>[number];
    after: NonNullable<Project["dimensioning"]>[number];
    result: ReturnType<typeof calculateDimensioning>;
  }[] = [];
  constructor(
    project: Project,
    readonly address: CableAddress,
    readonly edit: CableArticleEdit,
  ) {
    this.base = projectRevision(project);
    const cable = uniqueCable(project, address);
    if (!cable)
      throw Error(tr("Kabel ist nicht eindeutig.", "Cable is not unique."));
    if (edit.lengthM !== undefined && !validCableLength(edit.lengthM))
      throw Error(
        tr(
          "Reale Kabellänge muss eine nichtnegative Zahl sein.",
          "Real cable length must be a non-negative number.",
        ),
      );
    if (
      new Set(edit.circuitIds).size !== edit.circuitIds.length ||
      edit.circuitIds.some(
        (id) => project.dimensioning?.filter((r) => r.id === id).length !== 1,
      )
    )
      throw Error(
        tr(
          "Stromkreiszuordnung ist nicht eindeutig.",
          "Circuit assignment is not unique.",
        ),
      );
    this.before = structuredClone(cable);
    let next = structuredClone(project);
    const target = uniqueCable(next, address)!;
    target.article = edit.article ? validateCablePart(edit.article) : undefined;
    target.lengthM = edit.lengthM;
    const data = cablePartData(target.article);
    if (edit.adoptSpecification) {
      if (!data)
        throw Error(
          tr(
            "Dokumentierte Kabelkennwerte fehlen.",
            "Documented cable ratings are missing.",
          ),
        );
      if (data.cores !== undefined) target.coreCount = data.cores;
      if (data.sectionMm2 !== undefined)
        target.crossSection = String(data.sectionMm2);
    }
    if (edit.circuitIds.length && !target.article)
      throw Error(
        tr(
          "Zum Verknüpfen zuerst einen Kabelartikel auswählen.",
          "Select a cable part before linking circuits.",
        ),
      );
    for (const record of project.dimensioning ?? []) {
      const binding = record.articles?.cable?.cable;
      const wasBound =
        binding?.pageId === address.pageId &&
        binding.cableId === address.cableId;
      if (!wasBound && !edit.circuitIds.includes(record.id)) continue;
      let updated = structuredClone(record);
      if (edit.circuitIds.includes(record.id)) {
        if (edit.adoptCircuitValues) {
          if (!edit.confirmFullLength || !validCableLength(target.lengthM))
            throw Error(
              tr(
                "Vollständige Stromkreis-Leitungslänge angeben und bestätigen.",
                "Specify and confirm the full circuit conductor length.",
              ),
            );
          if (!catalogCircuitArticle(target.article!, "cable"))
            throw Error(
              tr(
                "Dokumentierte Kabelkennwerte fehlen.",
                "Documented cable ratings are missing.",
              ),
            );
          // Two physical length sources would otherwise contradict one another.
          if (record.reference?.importedValues)
            throw Error(
              tr(
                "Zuerst die übernommenen Leitungsdaten des bisherigen Planbezugs im Stromkreis lösen.",
                "First detach the adopted conductor data of the existing drawing reference in the circuit.",
              ),
            );
        }
        updated = selectCircuitArticle(
          updated,
          "cable",
          target.article!,
          edit.adoptCircuitValues,
        );
        delete updated.articles!.cable!.device;
        updated.articles!.cable!.cable = {
          ...address,
          ...(wasBound && binding?.adoptedLengthM !== undefined
            ? { adoptedLengthM: binding.adoptedLengthM }
            : {}),
        };
        if (edit.adoptCircuitValues) {
          updated.lengthM = target.lengthM;
          updated.articles!.cable!.cable!.adoptedLengthM = target.lengthM;
        }
      } else if (updated.articles?.cable) delete updated.articles.cable.cable;
      next = withDimensioning(next, updated);
      this.calculations.push({
        before: structuredClone(record),
        after: structuredClone(updated),
        result: calculateDimensioning(updated, next),
      });
    }
    this.after = structuredClone(target);
    this.findings = inspectWiring(next).filter(
      (i) => i.pageId === address.pageId && i.cableId === address.cableId,
    );
    this.result = next;
  }
  apply(project: Project): Project {
    if (projectRevision(project) !== this.base)
      throw Error(
        tr(
          "Projekt wurde geändert. Vorschau neu berechnen.",
          "Project has changed. Recompute the preview.",
        ),
      );
    return structuredClone(this.result);
  }
}
