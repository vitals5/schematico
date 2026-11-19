import type { Project, SymbolDefinition } from "./types";
import type { CircuitDimensioning } from "./ElectricalDimensioning";
import {
  calculateDimensioning,
  withDimensioning,
} from "./ElectricalDimensioning";
import { getSymbolById, getDrawingUnitsPerMm } from "./symbols";
import { buildDraft } from "../layout/tools";
import { setArticleAssignment } from "./ArticleAssignments";
import { circuitDesignCandidate } from "./CircuitDesign";
import { tr } from "../i18n";
/** Explicit supported terminal layouts, not inference from a manufacturer's description. */
export function circuitSchematicPorts(
  protection: SymbolDefinition,
  load: SymbolDefinition,
  system: CircuitDimensioning["system"],
) {
  if (system === "dc")
    throw Error(
      tr(
        "Die Planvorlagen unterstützen zunächst ein- und dreiphasige AC-Abgänge. DC kann berechnet werden.",
        "Drawing templates currently support single- and three-phase AC feeders. DC calculations remain available.",
      ),
    );
  const neutral = (p: { name: string; id: string }) =>
    /^N(?:[-_]?(?:in|out))?$/i.test(p.name) ||
    /^N(?:[-_]?(?:in|out))?$/i.test(p.id);
  const top = protection.pins
      .filter((p) => p.direction === "top")
      .sort((a, b) => a.x - b.x),
    bottom = protection.pins
      .filter((p) => p.direction === "bottom")
      .sort((a, b) => a.x - b.x);
  const phases = system === "ac1" ? 1 : 3;
  if (
    protection.pins.length !== top.length + bottom.length ||
    new Set(protection.pins.map((p) => p.id)).size !== protection.pins.length ||
    top.length !== bottom.length ||
    top.length < phases ||
    top.length > phases + 1 ||
    top.some(
      (p, i) => p.x !== bottom[i].x || neutral(p) !== neutral(bottom[i]),
    ) ||
    top.filter((p) => !neutral(p)).length !== phases
  )
    throw Error(
      tr(
        "Das Schutzgerätesymbol besitzt keine unterstützte eindeutige Polanordnung. Symbol im Artikel prüfen.",
        "The protective symbol has no supported unambiguous pole arrangement. Check the part symbol.",
      ),
    );
  if (system === "ac3" && top.some(neutral))
    throw Error(
      tr(
        "Die Motorvorlage benötigt ein dreipoliges Schutzgerätesymbol ohne Neutralleiterpol.",
        "The motor template requires a three-pole protective symbol without a neutral pole.",
      ),
    );
  const names = system === "ac1" ? ["L", "N", "PE"] : ["L1", "L2", "L3", "PE"];
  const motorNames = ["U1", "V1", "W1"];
  const loadPins = names.map((name, i) => {
    const matches = load.pins.filter(
      (p) =>
        p.name.toUpperCase() === name ||
        p.id.toUpperCase() === name ||
        (system === "ac3" && i < 3 && p.name.toUpperCase() === motorNames[i]) ||
        (system === "ac1" &&
          i === 0 &&
          load.id === "socket_schuko" &&
          p.id === "1"),
    );
    if (matches.length !== 1)
      throw Error(
        tr(
          "Verbrauchersymbol hat keine eindeutigen Anschlüsse für diese Vorlage.",
          "Load symbol has no unambiguous terminals for this template.",
        ),
      );
    return matches[0].id;
  });
  if (
    load.pins.length !== names.length ||
    new Set(loadPins).size !== names.length
  )
    throw Error(
      tr(
        "Verbrauchersymbol benötigt eine andere Schaltungsvorlage.",
        "Load symbol requires a different circuit template.",
      ),
    );
  return {
    phaseIn: top.filter((p) => !neutral(p)).map((p) => p.id),
    phaseOut: bottom.filter((p) => !neutral(p)).map((p) => p.id),
    neutralIn: top.find(neutral)?.id,
    neutralOut: bottom.find(neutral)?.id,
    loadPins,
    names,
  };
}
/** Build a portable draft on a fresh sheet. No edits to the source project. */
export function circuitSchematicDraft(
  project: Project,
  record: CircuitDimensioning,
  loadSymbolId: string,
) {
  const cable = record.articles?.cable?.article,
    protect = record.articles?.protection?.article;
  if (!cable || !protect)
    throw Error(
      tr(
        "Zuerst Leitung und Schutzgerät auswählen.",
        "Select cable and protective device first.",
      ),
    );
  const check = circuitDesignCandidate(record, cable, protect, project);
  if (
    check.issues.length ||
    record.verifyAmpacity !== true ||
    calculateDimensioning(record, project).status !== "checked"
  )
    throw Error(
      tr(
        "Zuerst fehlende Angaben und Grenzwertverletzungen der Auslegung beheben.",
        "Resolve missing design inputs and exceeded limits first.",
      ),
    );
  const protectionId = protect.snapshot?.symbolId;
  const loadArticle = record.articles?.load?.article;
  if (loadArticle && !loadArticle.snapshot?.symbolId)
    throw Error(
      tr(
        "Der Verbraucherartikel benötigt ein hinterlegtes Bibliothekssymbol.",
        "The load part requires an assigned library symbol.",
      ),
    );
  const loadId = loadArticle?.snapshot?.symbolId || loadSymbolId;
  const protection = protectionId && getSymbolById(protectionId, project),
    load = getSymbolById(loadId, project);
  if (!protection || !load)
    throw Error(
      tr(
        "Schutzgerät und Verbraucher benötigen verfügbare Bibliothekssymbole.",
        "Protective device and load require available library symbols.",
      ),
    );
  const ports = circuitSchematicPorts(protection, load, record.system);
  if (
    protect.snapshot!.electrical!.poles !==
    ports.phaseIn.length + (ports.neutralIn ? 1 : 0)
  )
    throw Error(
      tr(
        "Artikelpolzahl und Symbol stimmen nicht überein.",
        "Part pole count and symbol do not match.",
      ),
    );
  const source =
    project.pages.find((p) => p.id === project.activePageId) ??
    project.pages[0];
  if (!source) throw Error(tr("Projektseite fehlt.", "Project page missing."));
  const copy = structuredClone(project),
    id = "circuit-" + crypto.randomUUID();
  let number = 1;
  while (copy.pages.some((p) => p.pageNumber === String(number))) number++;
  const frame = structuredClone(source.plotFrame),
    u = getDrawingUnitsPerMm(project);
  frame.type = "DIN_A3_LANDSCAPE";
  frame.width = 420 * u;
  frame.height = 297 * u;
  frame.titleBlock.sheetNumber = String(number);
  copy.pages.push({
    id,
    pageNumber: String(number),
    pageType: "schematic",
    title: record.name,
    higherLevel: source.higherLevel,
    location: source.location,
    components: [],
    wires: [],
    plotFrame: frame,
  });
  copy.activePageId = id;
  const prefix = "circuit_" + crypto.randomUUID().replaceAll("-", ""),
    pid = prefix + "_protection",
    lid = prefix + "_load";
  const components = [
    { id: pid, symbolId: protection.id },
    { id: lid, symbolId: load.id, functionText: record.name },
  ];
  const connections: {
    id: string;
    from: { componentId: string; pinId: string };
    to: { componentId: string; pinId: string };
    potential: string;
  }[] = [];
  const connect = (
    from: string,
    fp: string,
    to: string,
    tp: string,
    potential: string,
  ) =>
    connections.push({
      id: prefix + "_wire_" + connections.length,
      from: { componentId: from, pinId: fp },
      to: { componentId: to, pinId: tp },
      potential,
    });
  const feed = getSymbolById("potential_arrow_down", project)!;
  const feedPin = feed.pins.find((p) => p.direction === "bottom");
  if (!feedPin) throw Error("Feed symbol missing");
  for (let i = 0; i < ports.names.length; i++) {
    const potential = ports.names[i],
      fid = prefix + "_feed_" + i;
    components.push({ id: fid, symbolId: feed.id, functionText: potential });
    if (i < ports.phaseIn.length) {
      connect(fid, feedPin.id, pid, ports.phaseIn[i], potential);
      connect(pid, ports.phaseOut[i], lid, ports.loadPins[i], potential);
    } else if (potential === "N" && ports.neutralIn && ports.neutralOut) {
      connect(fid, feedPin.id, pid, ports.neutralIn, potential);
      connect(pid, ports.neutralOut, lid, ports.loadPins[i], potential);
    } else connect(fid, feedPin.id, lid, ports.loadPins[i], potential);
  }
  const draft = buildDraft(copy, id, {
    components,
    connections,
    preferAutoconnect: true,
    constructionOnly: true,
  });
  const page = draft.pages.find((p) => p.id === id)!;
  const next = structuredClone(record);
  next.id = crypto.randomUUID();
  delete next.reference;
  // The new circuit does not inherit bindings to existing physical devices.
  for (const selection of Object.values(next.articles ?? {}))
    if (selection) delete selection.device;
  for (const [role, inputId, article] of [
    ["protection", pid, protect],
    ["load", lid, loadArticle],
  ] as const) {
    if (!article) continue;
    const c = page.components.find((c) => c.id === "ai-" + inputId)!;
    setArticleAssignment(c, [
      { ...structuredClone(article), role: "main", quantity: 1 },
    ]);
    next.articles![role]!.device = { pageId: id, componentId: c.id };
  }
  // A cable is documented once in the calculation; geometrical segments are not real cable lengths.
  for (const wire of page.wires) wire.crossSection = String(record.sectionMm2);
  const result = withDimensioning(draft, next);
  for (const p of result.pages)
    p.plotFrame.titleBlock.totalSheets = String(result.pages.length);
  return { draft: result, pageId: id, record: next };
}
