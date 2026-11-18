import assert from "node:assert/strict";
import {
  cabinetStandardLibrary,
  cabinetLibraryCategories,
  cabinetStandard,
  findCabinetStandards,
} from "./CabinetLibrary";
import {
  insertCabinetStandard,
  inspectCabinet,
  moveCabinetItem,
  railCapacity,
  CabinetLayoutEdit,
  cabinetLayouts,
  type CabinetLayout,
} from "./CabinetLayout";
import { fixture } from "../layout/testing/fixture";
import { PartsListGenerator } from "../reports/PartsList";
import { ProjectHistory } from "./ProjectHistory";
const p = fixture(),
  board: CabinetLayout = {
    schemaVersion: 1,
    id: "generic",
    name: "Generic",
    widthMm: 600,
    heightMm: 800,
    marginMm: 10,
    gridMm: 1,
    items: [
      {
        id: "rail",
        kind: "rail",
        label: "Rail",
        x: 60,
        y: 150,
        widthMm: 480,
        heightMm: 35,
        rotation: 0,
        clearanceMm: 0,
      },
    ],
  };
assert(cabinetStandardLibrary.length >= 100);
assert.equal(
  new Set(cabinetStandardLibrary.map((d) => d.id)).size,
  cabinetStandardLibrary.length,
);
for (const category of cabinetLibraryCategories)
  assert(cabinetStandardLibrary.some((d) => d.category === category));
for (const d of cabinetStandardLibrary) {
  assert(d.name.de && d.name.en);
  assert(d.widthMm > 0 && d.heightMm > 0);
  assert(d.poles >= 1 && d.poles <= 8);
  if (d.modules) assert.equal(d.widthMm, d.modules * 18);
  const l = insertCabinetStandard(
    board,
    d.id,
    d.railMount ? "rail" : undefined,
  );
  assert.deepEqual(
    inspectCabinet(p, l),
    [],
    d.id + " fits without a circuit device",
  );
  assert.equal(l.items.at(-1)!.standardId, d.id);
}
assert(
  findCabinetStandards("FI 4-polig", "protection").some(
    (d) => d.id === "rcd-4p",
  ),
);
assert(findCabinetStandards("residual current").some((d) => d.id === "rcd-2p"));
assert(findCabinetStandards("Neozed").length >= 4);
assert(findCabinetStandards("KNX", "automation").length >= 7);
assert.equal(findCabinetStandards("nonexistent").length, 0);
const before = structuredClone(board),
  bom = PartsListGenerator.generatePartsList(p);
let layout = insertCabinetStandard(board, "rcd-4p", "rail");
layout = insertCabinetStandard(layout, "mcb-1p", "rail", 5);
layout = insertCabinetStandard(layout, "terminal-pe", "rail", 10);
assert.equal(layout.items.length, 17);
assert.deepEqual(inspectCabinet(p, layout), []);
assert.equal(layout.items[1].label, "-F1");
assert.equal(layout.items[2].label, "-F2");
assert.equal(
  new Set(layout.items.map((i) => i.label)).size,
  layout.items.length,
);
assert(Math.abs(railCapacity(layout, "rail")!.used - 224) < 1e-8);
const moved = moveCabinetItem(layout, "rail", 70, 170);
assert.equal(moved.items[1].x, layout.items[1].x + 10);
assert.equal(moved.items[1].y, layout.items[1].y + 20);
const dragged = moveCabinetItem(layout, layout.items[1].id, 61, 600);
assert.equal(
  dragged.items[1].y,
  122.5,
  "standard device keeps its rail centre",
);
const committed = new CabinetLayoutEdit(p, layout).apply(p);
assert.deepEqual(committed.pages, p.pages);
assert.deepEqual(PartsListGenerator.generatePartsList(committed), bom);
assert.equal(
  cabinetLayouts(JSON.parse(JSON.stringify(committed)))[0].items.length,
  17,
);
const history = new ProjectHistory();
history.reset(p);
history.record(committed);
assert.equal(history.undo()!.cabinetLayouts, undefined);
assert.deepEqual(history.redo()!.cabinetLayouts, [layout]);
assert.deepEqual(board, before);
const small = {
  ...board,
  widthMm: 150,
  items: [{ ...board.items[0], x: 10, widthMm: 130 }],
};
assert.throws(
  () => insertCabinetStandard(small, "rcd-4p", "rail", 2),
  /cabinetNoSpace/,
);
assert.equal(small.items.length, 1, "failed batch inserts nothing");
for (const count of [0, 25, 1.2, NaN])
  assert.throws(
    () => insertCabinetStandard(board, "mcb-1p", "rail", count),
    /cabinetInvalid/,
  );
assert.throws(() => insertCabinetStandard(board, "unknown"), /cabinetInvalid/);
assert.throws(
  () => insertCabinetStandard(board, "fuse-nh00", "rail"),
  /cabinetRailInvalid/,
);
const invalid = structuredClone(layout);
invalid.items[1].source = { pageId: "p", componentId: "injected" };
assert(inspectCabinet(p, invalid).some((i) => i.code === "cabinetInvalid"));
const unknown = structuredClone(layout);
unknown.items[1].standardId = "deleted";
assert(inspectCabinet(p, unknown).some((i) => i.code === "cabinetInvalid"));
const copy = { ...structuredClone(layout), id: "other" };
assert.deepEqual(
  inspectCabinet(committed, copy),
  [],
  "generic parts are repeatable, not duplicate physical circuit devices",
);
console.log(
  `✓ ${cabinetStandardLibrary.length} cabinet forms: categories, bilingual search, nominal modules, all default placements, atomic batches, rail movement/capacity, roundtrip/undo and unchanged electrical/BOM data`,
);
