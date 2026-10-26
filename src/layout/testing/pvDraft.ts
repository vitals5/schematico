import { fixture } from "./fixture";
import { buildDraft } from "../tools";
/** Representative 24-object PV case; not an engineering-verified installation or a copied user project. */
export function pvDraft() {
  const project = fixture();
  const components = [
    {
      id: "pvs1",
      symbolId: "generator_dc",
      bmk: "-PVS1",
      functionText: "PV-String 1",
      technicalCharacteristics: "4,6 kWp",
    },
    {
      id: "pvs2",
      symbolId: "generator_dc",
      bmk: "-PVS2",
      functionText: "PV-String 2",
      technicalCharacteristics: "4,6 kWp",
    },
    {
      id: "f_pv1",
      symbolId: "fuse_1p",
      bmk: "-F1",
      functionText: "PV-Sicherung String 1+",
      technicalCharacteristics: "gPV 15A 1000V",
    },
    {
      id: "f_pv2",
      symbolId: "fuse_1p",
      bmk: "-F2",
      functionText: "PV-Sicherung String 2+",
      technicalCharacteristics: "gPV 15A 1000V",
    },
    {
      id: "spd_dc",
      symbolId: "surge_arrester_spd",
      bmk: "-F0",
      functionText: "DC-Überspannungsschutz",
      technicalCharacteristics: "Typ 2 1000V DC",
    },
    {
      id: "hak",
      symbolId: "main_switch_4p",
      bmk: "-HAK1",
      functionText: "GAK / DC-Freischalter",
      technicalCharacteristics: "1000V DC 32A",
    },
    ...[1, 2, 3, 4].map((i) => ({
      id: "x_dc" + i,
      symbolId: "terminal_single",
      bmk: "-X1:" + i,
      functionText: "DC String " + Math.ceil(i / 2) + (i % 2 ? "+" : "-"),
    })),
    {
      id: "inv",
      symbolId: "power_inverter",
      bmk: "-TB1",
      functionText: "Wechselrichter + Speicher",
      technicalCharacteristics: "15 kW / 16 kWh",
    },
    {
      id: "ls",
      symbolId: "circuit_breaker_3p",
      bmk: "-F3",
      functionText: "LS-Schalter PV-Einspeisung",
      technicalCharacteristics: "B25A 3P",
    },
    {
      id: "rcd",
      symbolId: "rcd_4p",
      bmk: "-F4",
      functionText: "FI-Schutzschalter PV",
      technicalCharacteristics: "40A / 300mA Typ B",
    },
    {
      id: "meter",
      symbolId: "energy_meter_3p",
      bmk: "-U71",
      functionText: "Smartmeter",
      technicalCharacteristics: "3x230/400V Modbus",
    },
    {
      id: "qbu",
      symbolId: "changeover_switch_4p",
      bmk: "-Q2",
      functionText: "Netz- / Notstromumschalter",
      technicalCharacteristics: "4P 40A",
    },
    ...["l1", "l2", "l3", "n", "bu_l1", "bu_l2", "bu_l3", "bu_n"].map(
      (id, i) => ({
        id: "arrow_" + id,
        symbolId: "potential_arrow_down",
        functionText:
          i < 4
            ? "PV." + id.toUpperCase()
            : id.replace("bu_", "").toUpperCase() + "BU",
      }),
    ),
    {
      id: "pe",
      symbolId: "earth_ground",
      bmk: "-PE",
      functionText: "Potentialausgleich / Erdung",
    },
  ];
  const connections: Parameters<typeof buildDraft>[2]["connections"] = [];
  const wire = (
    id: string,
    a: string,
    ap: string,
    b: string,
    bp: string,
    potential: string,
  ) =>
    connections.push({
      id,
      from: { componentId: a, pinId: ap },
      to: { componentId: b, pinId: bp },
      potential,
    });
  for (const i of [1, 2]) {
    wire("pv" + i + "_f", "pvs" + i, "+", "f_pv" + i, "1", "DC+");
    wire("pv" + i + "_p", "f_pv" + i, "2", "hak", String(i * 4 - 3), "DC+");
    wire("pv" + i + "_m", "pvs" + i, "-", "hak", String(i * 4 - 1), "DC-");
  }
  for (let i = 1; i <= 4; i++)
    wire(
      "hak_x" + i,
      "hak",
      String(i * 2),
      "x_dc" + i,
      "1",
      i % 2 ? "DC+" : "DC-",
    );
  wire("dc_inv_p", "x_dc1", "2", "inv", "+", "DC+");
  wire("dc_inv_m", "x_dc2", "2", "inv", "-", "DC-");
  wire("spd_p", "spd_dc", "L1", "hak", "1", "DC+");
  wire("spd_m", "spd_dc", "N", "hak", "3", "DC-");
  wire("spd_pe", "spd_dc", "PE", "pe", "PE", "PE");
  for (let i = 1; i <= 3; i++) {
    wire("ls_rcd" + i, "ls", String(2 * i), "rcd", String(2 * i - 1), "L" + i);
    wire("rcd_meter" + i, "rcd", String(2 * i), "meter", "L" + i, "L" + i);
    wire("meter_pv" + i, "meter", String(i), "arrow_l" + i, "1", "L" + i);
    wire("qbu" + i, "qbu", String(2 * i), "arrow_bu_l" + i, "1", "L" + i);
  }
  wire("inv_ls", "inv", "L", "ls", "1", "L1");
  wire("meter_n", "meter", "N", "arrow_n", "1", "N");
  wire("qbu_n", "qbu", "8", "arrow_bu_n", "1", "N");
  const groups = [
    {
      id: "grp_dc",
      members: [
        "pvs1",
        "pvs2",
        "f_pv1",
        "f_pv2",
        "spd_dc",
        "hak",
        "x_dc1",
        "x_dc2",
        "x_dc3",
        "x_dc4",
      ],
    },
    { id: "grp_inv", members: ["inv"] },
    { id: "grp_ac", members: ["ls", "rcd"] },
    { id: "grp_meter", members: ["meter"] },
    { id: "grp_bu", members: ["qbu"] },
    {
      id: "grp_pot",
      members: [
        ...components.filter((c) => c.id.startsWith("arrow")).map((c) => c.id),
        "pe",
      ],
    },
  ];
  return {
    project,
    draft: buildDraft(project, "p", { components, connections, groups }),
  };
}
