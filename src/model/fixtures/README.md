`2_P_Circuit_Breaker.ems` contains the original seven drawing records from the
reported import failure. Unrelated customer/project properties, source paths
and author metadata have been removed. The window type, variant reference
point and grouped rectangle/line coordinates are unchanged.

Source geometry in millimetres (Y up): outer rectangle `(68,48)`–`(101,144)`,
two narrow rectangles at Y 124–128 and 64–68, horizontal lines at Y 112 and 84,
handle rectangle `(78,96)`–`(90,102)` and diagonal `(80,96)`–`(88,102)`.
Reference point: `(68,100)`. There are no symbol instances or electrical pins.

`changeover.ems` and `contactor_simple.ema` retain the drawing, object identity,
library reference, placement, pin designation and variant records from the two
subsequent reports. Unrelated project/customer metadata and local source paths
were removed. The former contains three representation types with variant ID 0;
the default schematic contains a 24 × 44 mm device box and four directional ports.
The latter contains a coil, a T junction and a macro definition frame (metadata).

`../NativeMacroSymbols.json` holds the five referenced standard definitions
decoded from the previously supplied sample archive using the existing indexed
symbol-library reader: SPECIAL 1:0, 13:1, 13:3, 65:0 and IEC_symbol 20:0.
Geometry and physical ports are normalized to two drawing units per millimetre.
The single PLC port labels retain property 20038, horizontal placement, alignment
20 and the source layer 432 nominal text height of 1.8 mm. No glyph or pin was
inferred from either uploaded filename or its device tag. Custom project master
data can override or extend these original library identities.
