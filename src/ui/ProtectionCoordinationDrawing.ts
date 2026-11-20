import type { DrawingPrimitive } from "../model/types";
import type { ProtectionCoordination } from "../model/ProtectionCoordination";
import { tr as translate, getUiLanguage, type Language } from "../i18n";
export const protectionColors = { protection: "#1769aa", upstream: "#b45516" };
export const protectionNumber = (
  v: number,
  language: Language = getUiLanguage(),
) =>
  v >= 10000 || v < 0.001
    ? Number(v.toPrecision(6)).toExponential()
    : Number(v.toPrecision(6)).toLocaleString(
        language === "en" ? "en-US" : "de-DE",
        {
          maximumSignificantDigits: 6,
        },
      );
export function logDomain(values: number[]): [number, number] {
  const logs = values
    .filter((v) => Number.isFinite(v) && v > 0)
    .map(Math.log10);
  if (!logs.length) return [0, 1];
  const lower = Math.log10(Number.MIN_VALUE),
    upper = Math.log10(Number.MAX_VALUE),
    min = Math.max(lower, Math.floor(Math.min(...logs))),
    max = Math.min(upper, Math.ceil(Math.max(...logs)));
  return [min, max > min ? max : Math.min(upper, min + 1)];
}
export function protectionCoordinationDrawing(
  data: ProtectionCoordination,
  width = 900,
  height = 560,
  currentA?: number,
) {
  const tr = (de: string, en: string) => translate(de, en, data.language);
  const graphics: DrawingPrimitive[] = [],
    area = { left: 78, right: width - 22, top: 30, bottom: height - 58 };
  const points: {
    role: "protection" | "upstream";
    currentA: number;
    x: number;
    y: number;
  }[] = [];
  const currents = data.curves
    .flatMap((c) => c.points.map((p) => p.currentA))
    .concat(
      data.markers.filter((m) => m.axis === "current").map((m) => m.value),
    );
  const times = data.curves
    .flatMap((c) => c.points.flatMap((p) => [p.timeMinS, p.timeMaxS]))
    .concat(data.markers.filter((m) => m.axis === "time").map((m) => m.value));
  const xd = logDomain(currents),
    yd = logDomain(times);
  const x = (v: number) =>
      area.left +
      ((Math.log10(v) - xd[0]) / (xd[1] - xd[0])) * (area.right - area.left),
    y = (v: number) =>
      area.bottom -
      ((Math.log10(v) - yd[0]) / (yd[1] - yd[0])) * (area.bottom - area.top);
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 1,
    dash?: number[],
  ) =>
    graphics.push({
      kind: "line",
      x1,
      y1,
      x2,
      y2,
      color,
      width,
      ...(dash ? { dash } : {}),
    });
  const text = (
    value: string,
    px: number,
    py: number,
    size = 14,
    anchor: "start" | "middle" | "end" = "start",
  ) =>
    graphics.push({
      kind: "text",
      text: value,
      x: px,
      y: py,
      size,
      color: "#233047",
      anchor,
    });
  const grid = (domain: [number, number], horizontal: boolean) => {
    const step = Math.max(1, Math.ceil((domain[1] - domain[0]) / 8));
    for (
      let exponent = Math.ceil(domain[0]);
      exponent <= domain[1];
      exponent += step
    ) {
      const value = 10 ** exponent,
        pos = horizontal ? x(value) : y(value);
      if (horizontal) {
        line(pos, area.top, pos, area.bottom, "#bac4d2", 0.7);
        text(
          protectionNumber(value, data.language),
          pos,
          area.bottom + 22,
          13,
          "middle",
        );
      } else {
        line(area.left, pos, area.right, pos, "#bac4d2", 0.7);
        text(
          protectionNumber(value, data.language),
          area.left - 10,
          pos + 4,
          13,
          "end",
        );
      }
    }
  };
  if (data.curves.length) {
    grid(xd, true);
    grid(yd, false);
    line(area.left, area.top, area.left, area.bottom, "#233047", 1.2);
    line(area.left, area.bottom, area.right, area.bottom, "#233047", 1.2);
    text(
      tr("Zeit t [s] · logarithmisch", "Time t [s] · logarithmic"),
      area.left,
      18,
      15,
    );
    text(
      tr("Strom I [A] · logarithmisch", "Current I [A] · logarithmic"),
      (area.left + area.right) / 2,
      height - 10,
      15,
      "middle",
    );
  }
  for (const marker of data.markers) {
    if (marker.axis === "current")
      line(
        x(marker.value),
        area.top,
        x(marker.value),
        area.bottom,
        "#747082",
        1,
        [5, 5],
      );
    else
      line(
        area.left,
        y(marker.value),
        area.right,
        y(marker.value),
        "#747082",
        1,
        [5, 5],
      );
  }
  for (const curve of data.curves) {
    const color = protectionColors[curve.role];
    curve.points.forEach((p, i) => {
      const px = x(p.currentA),
        lo = y(p.timeMinS),
        hi = y(p.timeMaxS);
      line(px, lo, px, hi, color, 0.8);
      if (i) {
        const before = curve.points[i - 1];
        line(
          x(before.currentA),
          y(before.timeMaxS),
          px,
          hi,
          color,
          2.3,
          curve.role === "upstream" ? [9, 4] : undefined,
        );
        line(
          x(before.currentA),
          y(before.timeMinS),
          px,
          lo,
          color,
          1.2,
          [2, 4],
        );
      }
      for (const py of [lo, hi]) {
        if (curve.role === "upstream")
          graphics.push({
            kind: "rect",
            x: px - 3,
            y: py - 3,
            width: 6,
            height: 6,
            color,
            lineWidth: 1.4,
          });
        else
          graphics.push({
            kind: "circle",
            x: px,
            y: py,
            radius: 3,
            color,
            width: 1.3,
          });
        points.push({ role: curve.role, currentA: p.currentA, x: px, y: py });
      }
    });
  }
  if (currentA !== undefined && currents.includes(currentA))
    line(
      x(currentA),
      area.top,
      x(currentA),
      area.bottom,
      "#283c56",
      1.5,
      [2, 3],
    );
  return { graphics, points, area, xd, yd, x, y };
}
