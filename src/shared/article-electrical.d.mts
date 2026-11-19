import type {
  ArticleElectricalData,
  ElectricalRatingKey,
} from "../model/ArticleElectrical";
export const electricalFields: Record<
  ElectricalRatingKey,
  {
    kinds: ArticleElectricalData["kind"][];
    de: string;
    en: string;
    positive?: boolean;
    integer?: boolean;
    max?: number;
  }
>;
export function validateElectricalData(raw: unknown): ArticleElectricalData;
