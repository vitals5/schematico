# Saved native groups: bounded evidence, 2026-10-18

REA workflow reuses retained evidence `ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b` and verified supplied split archive digest `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`. No connected REA analysis tools are available; probes use the existing bounded typed EOD decoder and JSZip. The grouping decoder and UI were subsequently implemented against these findings.

## Observed

- Project `Instance.eod` fixed slots are 215 bytes, typed EOX index. Existing `readEodTable` yields 5,041 active identities including **155 type 26 group containers** and 12 separate type 37 macro frames.
- O26 ownership is explicit: property **EBF1 = parent type u16 + object id u32**, payload little endian. EBF2 has the same typed-reference payload for page. Group containers themselves can be children of another group. There are **23 nested O26** rows.
- Children may be in **Function**, **IPoint**, **Potential**, or **Instance** tables; restricting membership to Instance loses electrical devices. Existing groups contain electrical Function type17 and graphical31/32/34/89 members.
- Example group26:617 has page4:13, direct subgroups26:618 and26:620. Subgroup618 owns graphical line31:619 **and Function17:114**; subgroup620 owns31:621,31:622,31:623,31:624,32:625,31:626. Result is one8-element top group and two nested2-/6-element subgroups on Einspeisung.
- Example Server group26:155849 page4:789 owns21 native members; all21 match existing imported editable components.
- Against `scratch/device-element-native.json`, **129 containers have >=2 imported descendants**, including **16 on Einspeisung and17 on Server**. All grouped electrical Function17 members map. There are no singleton imported descendant groups in this snapshot.
- 26 containers have no imported editable descendants: 19 on page76, 4 on page95, 3 source-empty on pages912/958/974. Pages76/95 are nonstandard table/cover drawing content not mapped to normal components in this baseline. Do not create empty selectable groups or claim those omitted objects were recovered.
- Some grouped graphical native records are not rendered by the existing importer (types31/32/34/89). Group membership cannot recover unsupported geometry; retain only real editable element IDs.
- `Relation.eod`, inspected with observed86-byte slots/untyped EOX, yields888 active type11 rows. Both endpoint types are18 (connection) throughout; no group ownership found in this bounded table.
- O37 A683 is a macro content list, not ordinary user grouping: fixture `contactor_simple.ema` has O37:5188 A683="42/5187;17/5189" with child S109x692 references. Project O37 have macro path metadata via type255 ED1A ref37:id. Do not convert these frames into visible components or infer ordinary grouping just from A683.

## Exact byte examples

- Container26:617 prefix `61ea1a0069020000f1eb04000d000000f2eb04000d000000`.
- Nested26:618 prefix `61ea1a006a020000f1eb1a0069020000f2eb04000d000000`.
- Member31:619 prefix `61ea1f006b020000f1eb1a006a020000f2eb04000d000000`.
- Device17:114 has ownership tags later within its bounded record: `f1eb1a006a020000f2eb04000d000000`; never assume fixed property offset.

## Reproduction

Run `npx tsx scratch/native-group-probe.ts`, then `npx tsx scratch/native-group-summary.ts`. Detailed result is `scratch/native-group-evidence.json`. Optional Relation crosscheck `npx tsx scratch/native-group-crosscheck.ts`.

## Confidence and boundaries

High confidence for typed parent relations and hierarchy in this supplied archive, supported by cross-table identity validation and independently matching XML O26 nesting. No original proprietary runtime was executed. Counts reflect the existing import snapshot, not a guarantee for arbitrary future format versions or all native objects. No native binary export/writeback semantics established.

## Implementation and verification

`NativeGroups.ts` resolves O26 ownership across all existing native tables after editable components/cables/images are created. Only real page objects become members; empty or single-member containers dissolve. `ElementGroups.ts` expands selection to outer groups, preserves nested ownership on dissolve, and remaps IDs for independent macro insertion. No grouping is inferred from BMK, geometry or O37 metadata.

`NativeGroups.test.ts` reopens both supplied archive parts and checks all 129 imported groups, the exact 617/618/620 hierarchy, the electrical member from Function.eod, reversible movement and outer-layer dissolve. `ElementGroups.test.ts` covers mixed members, nested selection, history, deletion cleanup, JSON/XML/archive roundtrips and macro identities. XML macro tests verify that formerly flattened graphic groups now retain separately editable drawing members. Browser checks cover marquee selection, modifier clicks, all three command entry points, shared label sizes, mouse/touch movement, save/reload, undo/redo, and original native group selection.

The PDF cannot establish saved grouping. Grouping compatibility is based on the supplied typed source records and checked app behavior, not an execution trace of the source application.
