import { wiringWorkspaceFixture } from "./WiringWorkspaceFixture";
import { terminalCableWorkspaceFixture } from "./TerminalCableWorkspaceFixture";
import { automationWorkspaceFixture } from "./AutomationWorkspaceFixture";
import { defaultReportTemplate } from "../../reports/ManufacturingReports";
/** Public synthetic records for combined PDF and browser regression checks. */
export function projectDocumentationFixture() {
  const p = wiringWorkspaceFixture(),
    term = terminalCableWorkspaceFixture(),
    auto = automationWorkspaceFixture();
  p.name = "Documentation fixture";
  p.language = "de";
  term.pages[0].id = "term";
  term.pages[0].pageNumber = "2";
  auto.pages[0].id = "auto";
  auto.pages[0].pageNumber = "3";
  for (const c of auto.automation!.channels)
    for (const b of [c.signal, c.supply, c.common]) if (b) b.pageId = "auto";
  for (const n of auto.automation!.nodes)
    if (n.binding) n.binding.pageId = "auto";
  p.pages.push(...term.pages, ...auto.pages);
  p.automation = auto.automation;
  p.logicalConnections = term.logicalConnections;
  p.pages[0].components[0].articleNumber = "PART-001";
  p.pages[0].components[0].manufacturer = "Synthetic";
  p.manufacturingReportTemplates = [
    {
      ...defaultReportTemplate("terminals"),
      title: "TERMINAL_PROJECT",
      paper: "a4",
      orientation: "portrait",
      sortBy: "c1",
      descending: true,
    },
    {
      ...defaultReportTemplate("connections"),
      id: "custom-wiring",
      title: "CUSTOM_WIRING",
      paper: "a4",
      orientation: "portrait",
      columns: [
        { id: "c1", label: "Source sheet", weight: 1 },
        { id: "c11", label: "Inspection details", weight: 4 },
        { id: "c0", label: "Wire number", weight: 1 },
      ],
    },
  ];
  p.cabinetLayouts = [
    {
      schemaVersion: 1,
      id: "cab-main",
      name: "CABINET_MAIN",
      widthMm: 600,
      heightMm: 800,
      marginMm: 10,
      gridMm: 5,
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
        {
          id: "fi",
          kind: "standard",
          label: "-F1",
          standardId: "rcd-4p",
          sizeOrigin: "standard",
          x: 60,
          y: 122.5,
          widthMm: 72,
          heightMm: 90,
          rotation: 0,
          clearanceMm: 0,
          railId: "rail",
        },
        {
          id: "ls",
          kind: "standard",
          label: "-F2",
          standardId: "mcb-1p",
          sizeOrigin: "standard",
          x: 140,
          y: 122.5,
          widthMm: 18,
          heightMm: 90,
          rotation: 0,
          clearanceMm: 0,
          railId: "rail",
        },
        {
          id: "source",
          kind: "device",
          label: "Stale tag",
          source: { pageId: "p", componentId: "cabinet-0" },
          sizeOrigin: "manual",
          x: 180,
          y: 122.5,
          widthMm: 18,
          heightMm: 90,
          rotation: 0,
          clearanceMm: 0,
          railId: "rail",
        },
        {
          id: "duct",
          kind: "duct",
          label: "Wiring duct",
          x: 10,
          y: 10,
          widthMm: 40,
          heightMm: 780,
          rotation: 0,
          clearanceMm: 0,
        },
      ],
    },
  ];
  return p;
}
