import type { CabinetLayout } from "./CabinetLayout";
import { tr } from "../i18n";

export const meterCabinetFields = [1, 2, 3, 4, 5, 6, 7] as const;
export const meterCabinetHeights = [950, 1100, 1250, 1400] as const;
export type MeterFieldKind = "meter" | "distribution" | "reserve";
export const meterFieldLabel = (kind: MeterFieldKind) =>
  ({
    meter: tr("Zählerfeld", "Meter field"),
    distribution: tr("Verteilerfeld", "Distribution field"),
    reserve: tr("Reservefeld", "Spare field"),
  })[kind];
export interface MeterCabinetOptions {
  heightMm: number;
  fields: MeterFieldKind[];
}
/** Generic 250-mm field pitch with 25-mm edge zones and 12-module TH35 rails.
 * Zones describe planning space, never electrical functions or manufacturer approvals. */
export function createMeterCabinet(
  options: MeterCabinetOptions,
): CabinetLayout {
  if (
    !meterCabinetHeights.some((h) => h === options.heightMm) ||
    options.fields.length < 1 ||
    options.fields.length > meterCabinetFields.length ||
    options.fields.some(
      (f) => !["meter", "distribution", "reserve"].includes(f),
    )
  )
    throw Error(
      tr("Ungültige Zählerschrankvorlage.", "Invalid meter cabinet template."),
    );
  const height = options.heightMm,
    layout: CabinetLayout = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      name: `${tr("Zählerschrank", "Meter cabinet")} · ${options.fields.length} ${options.fields.length === 1 ? tr("Feld", "field") : tr("Felder", "fields")} · ${height} mm`,
      widthMm: options.fields.length * 250 + 50,
      heightMm: height,
      marginMm: 25,
      gridMm: 1,
      items: [],
      sections: [],
    };
  const zone = (field: number, y: number, h: number, label: string) =>
    layout.sections!.push({
      id: crypto.randomUUID(),
      label: `F${field + 1} · ${label}`,
      x: 25 + field * 250,
      y,
      widthMm: 250,
      heightMm: h,
    });
  const rail = (field: number, y: number, label: string) =>
    layout.items.push({
      id: crypto.randomUUID(),
      kind: "rail",
      label: `F${field + 1} · ${label}`,
      x: 40 + field * 250,
      y,
      widthMm: 216,
      heightMm: 35,
      rotation: 0,
      clearanceMm: 0,
    });
  for (const [field, kind] of options.fields.entries()) {
    if (kind === "reserve") {
      zone(field, 25, height - 50, meterFieldLabel(kind));
      continue;
    }
    if (kind === "distribution") {
      zone(field, 25, height - 50, meterFieldLabel(kind));
      for (let row = 0; row < (height - 50) / 150; row++)
        rail(
          field,
          80 + row * 150,
          `${tr("Reihe", "Row")} ${row + 1} · TH35 · 12 TE`,
        );
      continue;
    }
    const upper = height - 800;
    zone(
      field,
      25,
      upper,
      tr("Oberer Anschlussraum", "Upper connection space"),
    );
    zone(field, 25 + upper, 450, meterFieldLabel(kind));
    zone(
      field,
      25 + upper + 450,
      300,
      tr("Unterer Anschlussraum", "Lower connection space"),
    );
    for (let row = 0; row < upper / 150; row++)
      rail(
        field,
        80 + row * 150,
        `${tr("Oben", "Upper")} ${row + 1} · TH35 · 12 TE`,
      );
    for (let row = 0; row < 2; row++)
      rail(
        field,
        80 + upper + 450 + row * 150,
        `${tr("Unten", "Lower")} ${row + 1} · TH35 · 12 TE`,
      );
  }
  return layout;
}
