export type ElectricalRatingKey =
  | "ratedVoltageV"
  | "poles"
  | "protectiveCurrentA"
  | "conventionalTripA"
  | "breakingCapacityA"
  | "residualCurrentA"
  | "sectionMm2"
  | "cores"
  | "resistance20OhmKm"
  | "reactanceOhmKm"
  | "ampacityA"
  | "adiabaticK"
  | "currentA"
  | "outputPowerW"
  | "efficiency"
  | "cosPhi";
export interface ArticleElectricalData extends Partial<
  Record<ElectricalRatingKey, number>
> {
  version: 1;
  kind: "cable" | "protection" | "load";
  source: string;
  /** Installation/table conditions, voltage/current type and curve test conditions. */
  conditions?: string;
  currentType?: "ac" | "dc" | "ac_dc";
  material?: "copper" | "aluminium";
  characteristic?: string;
  /** Explicit current quantity; unknown legacy points are never assumed to be overcurrent curves. */
  curveKind?: "overcurrent" | "residual";
  /** Manufacturer points only; no interpolation or inferred disconnection proof. */
  curve?: { currentA: number; timeMinS: number; timeMaxS: number }[];
}
export {
  electricalFields,
  validateElectricalData,
} from "../shared/article-electrical.mjs";
