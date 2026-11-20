import assert from "node:assert/strict";
import {
  createMeterCabinet,
  meterCabinetHeights,
  type MeterFieldKind,
} from "./MeterCabinetTemplates";
import {
  cabinetSchemaValid,
  inspectCabinet,
  CabinetLayoutEdit,
  insertCabinetStandard,
  railCapacity,
  moveCabinetItem,
} from "./CabinetLayout";
import { fixture } from "../layout/testing/fixture";
import { cabinetSvg, cabinetPdf } from "../ui/CabinetDrawing";
import { ProjectHistory } from "./ProjectHistory";
import { PartsListGenerator } from "../reports/PartsList";
import { setUiLanguage } from "../i18n";
const p = fixture(),
  kinds: MeterFieldKind[] = ["meter", "distribution", "reserve"];
let checked = 0;
for (let count = 1; count <= 5; count++)
  for (const heightMm of meterCabinetHeights) {
    for (let mask = 0; mask < 3 ** count; mask++) {
      const fields = Array.from(
        { length: count },
        (_, i) => kinds[Math.floor(mask / 3 ** i) % 3],
      );
      const board = createMeterCabinet({ heightMm, fields });
      assert.equal(board.widthMm, count * 250 + 50);
      assert.equal(board.heightMm, heightMm);
      assert(cabinetSchemaValid(board));
      assert.deepEqual(inspectCabinet(p, board), []);
      assert.equal(
        new Set(board.items.map((i) => i.id)).size,
        board.items.length,
      );
      for (const section of board.sections!)
        for (const rail of board.items) {
          if (
            /Zählerfeld|Meter field|Reservefeld|Spare field/.test(section.label)
          )
            assert(
              !(
                rail.x < section.x + section.widthMm &&
                rail.x + rail.widthMm > section.x &&
                rail.y < section.y + section.heightMm &&
                rail.y + rail.heightMm > section.y
              ),
              "Meter and spare regions remain clear",
            );
        }
      checked++;
    }
  }
assert.equal(checked, 1452);
assert.throws(() => createMeterCabinet({ heightMm: 999, fields: ["meter"] }));
assert.throws(() => createMeterCabinet({ heightMm: 1100, fields: [] }));
assert.throws(() =>
  createMeterCabinet({ heightMm: 1100, fields: Array(6).fill("meter") }),
);
assert.throws(() =>
  createMeterCabinet({ heightMm: 1100, fields: ["unknown" as MeterFieldKind] }),
);
setUiLanguage("en");
const board = createMeterCabinet({
  heightMm: 1400,
  fields: ["meter", "distribution", "reserve"],
});
assert(board.name.includes("3 fields"));
assert(board.sections!.some((z) => z.label.includes("Meter field")));
const rail = board.items.find((i) => i.label.startsWith("F2"))!;
const populated = insertCabinetStandard(board, "mcb-1p", rail.id, 12);
assert.deepEqual(inspectCabinet(p, populated), []);
assert.equal(railCapacity(populated, rail.id)!.free, 0);
assert.throws(() => insertCabinetStandard(populated, "mcb-1p", rail.id));
const moved = moveCabinetItem(populated, rail.id, rail.x + 1, rail.y);
assert.equal(
  moved.items.find((i) => i.railId === rail.id)!.x,
  populated.items.find((i) => i.railId === rail.id)!.x + 1,
);
assert.deepEqual(board.sections, moved.sections);
const svg = cabinetSvg(board, new Map());
assert.equal(
  (svg.match(/class="cb-section"/g) ?? []).length,
  board.sections!.length,
);
assert(svg.includes("Meter field"));
const pdf = cabinetPdf(board, new Map(), "Template test");
assert(pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight());
assert(pdf.output().includes("Meter field"));
const existing = {
  ...p,
  cabinetLayouts: [
    createMeterCabinet({ heightMm: 950, fields: ["distribution"] }),
  ],
};
const next = new CabinetLayoutEdit(existing, board).apply(existing);
assert.equal(next.cabinetLayouts!.length, 2);
assert.deepEqual(next.cabinetLayouts![0], existing.cabinetLayouts[0]);
assert.deepEqual(
  PartsListGenerator.generatePartsList(next),
  PartsListGenerator.generatePartsList(existing),
  "Template guide and rail geometry is not a manufacturer order list",
);
const history = new ProjectHistory();
history.reset(existing);
history.record(next);
assert.deepEqual(history.undo(), existing);
assert.deepEqual(history.redo(), next);
assert.deepEqual(JSON.parse(JSON.stringify(board)), board);
const malformed = structuredClone(board);
malformed.sections![0].widthMm = 99999;
assert(!cabinetSchemaValid(malformed));
setUiLanguage("de");
console.log(
  "Meter cabinet templates: 1–5 fields, four heights, all 1452 field combinations, clear meter zones, full 12-module rails, editing, guides, landscape PDF, persistence and undo passed",
);
