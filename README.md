<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/branding/logo-dark.png">
    <img src="public/branding/logo.png" alt="Schematico" width="640">
  </picture>
</p>

# Schematico

Schematico is a professional, open-source electrical schematic and building installation CAD application for **Windows desktop and modern Web browsers**. Designed from the ground up for electrical engineers, panel builders, and electrical planners, Schematico combines multi-page industrial circuit diagramming with architectural electrical installation planning.

Designation structures, symbol definitions, and title blocks adhere strictly to international engineering standards:
- **DIN EN 81346-1 / DIN EN 81346-2:** Structuring principles and reference designations (BMK).
- **IEC 60617 / DIN EN 60617:** Graphical symbols for electrical diagrams.
- **DIN EN 60617-11:** Architectural installation diagrams and building services symbols.
- **DIN EN ISO 7200:** Title blocks and document header fields.

[Launch Web App](https://vitals5.github.io/schematico/) · [Windows Downloads](https://github.com/vitals5/schematico/releases/latest) · [Windows Build Workflow](https://github.com/vitals5/schematico/actions/workflows/build-windows.yml)

---

## Highlights & Features

### 1. Electrical Schematic & Wiring Diagrams
- **Component Placement & Snapping:** Place, rotate, and move components across standard 8 mm engineering grid increments with optional half-grid (4 mm) resolution.
- **Directional Ports & Autoconnect:** Electrical pins feature directional ray projection (`top`, `bottom`, `left`, `right`). Aligned pins automatically bridge upon placement or movement; orthogonal wire runs calculate detours with proper clearances.
- **Junctions & Routing:** Automatic T-junction nodes, crossing bridges without false connections, and manual orthogonal wire drafting.
- **Cable Definitions & Cores:** Map crossed wire runs to multi-conductor cables (e.g., `NYM-J 5x1.5`, `ÖLFLEX 4G2.5`) with independent core designations, shielding indicators, and voltage drop tracking.
- **Device Boxes & Location Frames:** Group components into physical enclosures, cabinets (`+S1`), or location frames with custom borders, dash patterns, and wrapped titles.

### 2. Architectural Floor Plans & Electrical Installation (DIN EN 60617-11)
Schematico features a dedicated **Installation Plan** page type tailored for residential, commercial, and industrial building planning:
- **Blueprint Image Import & Calibration:** Import floor plan sketches, scans, or architectural drawings (`PNG`, `JPEG`, `PDF`) onto the canvas. Calibrate the exact drawing scale interactively: click any two known reference points (such as an exterior wall), enter the real-world distance in meters, or select common architectural ratios (e.g., 1:50, 1:75, 1:100 for DIN A3).
- **Target Scale Rescaling:** Switch target scales at any time (e.g. from 1:75 to 1:50). Walls, doors, windows, openings, background blueprints, and text callouts automatically scale and center proportionally without distortion.
- **Wall & Opening CAD Tools:**
  - **Walls:** Draft interior and exterior walls with customizable physical thicknesses (e.g. 11.5 cm, 17.5 cm, 24 cm, 36.5 cm). Walls snap to orthogonal axes and existing corner vertices.
  - **Doors:** Configurable doors with clean wall-gap cutouts, jamb tick marks, door leaves, and dashed swing arcs following DIN Links and DIN Rechts swing geometry (`left_in`, `right_in`, `left_out`, `right_out`, or none/sliding).
  - **Windows:** Double-pane glass lines with jamb ticks.
  - **Wall Openings:** Clear passage gaps with boundary ticks.
  - **Sectional Garage Doors:** Overhead sectional slats with dashed ceiling guide tracks.
- **Standard Architectural Installation Symbols (DIN EN 60617-11):**
  Over 66 specialized, pinless architectural installation symbols with realistic insertion points:
  - **Sockets:** Single, double, triple, quad, and 5-fold horizontal and vertical socket outlets conforming to the standard DIN EN 60617-11 stem, horizontal tangent bar, downward arc, and diagonal tick notation. Includes IP44 wet-room, switched, and USB-integrated outlets.
  - **Switches:** Off/single-pole, two-way/changeover, intermediate/cross, series double-rocker, pushbuttons, and dimmers with 45° arms and 90° hooks.
  - **Smart Home & Building Automation:** Neutral bus symbols for 2-gang and 4-gang pushbutton sensors, room temperature controllers (RTR with LCD display), smart touch panels, 360° ceiling presence detectors, bus flush-mounted outlets, and magnetic reed window contacts. Fully compatible with KNX, BACnet, Modbus, DALI, Loxone, or wireless actuator systems.
  - **Lighting & Power:** Ceiling lamps, wall luminaires, downlights, fluorescent/LED strips, emergency lights, CEE 16A/32A power receptacles, sub-distribution boards, and meter cabinets.
  - **Telecommunications & Safety:** Network outlets (RJ45 Cat.6a/Cat.7), antenna sockets (Radio/TV/SAT), telephone (TAE), door intercom stations, bells/chimes, smoke detectors, and main equipotential bonding busbars (PAS).
- **Wall Snapping & Multi-Tier Stacking:** Installation devices snap automatically to the nearest wall surface, automatically aligning parallel or perpendicular. Stack multiple devices vertically (e.g., switch at 105 cm over a socket at 30 cm) or arrange them side-by-side along the wall.
- **Curved Installation Wiring (`arcWires`):** Connect switches, sockets, and distributors with smooth, curved installation runs (quadratic Bézier curves). Assign circuits (`F1 / W1`), phases (`L1`, `L2`, `L3`), cable types, and colors.
- **AI Floor Plan Vectorization (Optional):** Integrate with Google Gemini API to vectorize raster floor plans into CAD walls, doors, and windows automatically with sub-pixel alignment.

### 3. Bidirectional Cross-References & Interactive Navigation
- **In-App Jump Navigation (Ctrl + Click):** Hold **Ctrl** and click any symbol (relay coils, auxiliary contacts, interruption points, or linked installation points) to jump instantly to the referenced counterpart across pages.
- **Inspector Panel Links:** The properties inspector displays all referenced targets on other pages with dedicated jump buttons.
- **Interactive Vector PDF Hyperlinks:** Exported PDFs include native clickable PDF annotations (`doc.link(...)`). Clicking an interruption arrow or contact cross-reference in Adobe Acrobat, Chrome, or Apple Preview immediately jumps to the destination sheet.

### 4. Rich Standalone Text Elements & Callouts
- Place freeform text boxes on both schematic sheets and architectural floor plans.
- **Text Properties Inspector:**
  - Multi-line text input with live rendering.
  - Font size control with physical paper-unit scaling (guaranteeing exact 1:1 visual fidelity between screen and PDF export).
  - Bold and italic typography.
  - Text alignment: Left, Center, Right.
  - Rotation: 0°, 90°, 180°, and 270°.
  - Preset color swatches and hexadecimal color picker.
  - Accurate mm coordinate placement.
  - Clean CAD presentation without distracting dashed selection outlines.
  - Automatic migration and conversion of legacy text formats.

### 5. Multi-Page Project Management & Title Block Sync
- Organize multi-sheet projects with schematics, installation plans, terminal diagrams, parts lists, and cover pages.
- **Live Metadata Synchronization:** Project properties (Project Title, Commission, Company, Author, Date, Revision) automatically synchronize across all title blocks (DIN EN ISO 7200) and cover forms (such as Standard Form F01).
- Reorder pages via Move Up / Move Down with continuous sheet numbering.
- Centralized page deletion protection prevents accidental removal of active sheets.
- Export and import individual floor plan pages as standalone JSON files to reuse layouts across different projects.

### 6. High-Capacity Macro Library (100k+ Files)
- Connect local directories containing external macros with zero performance degradation. Tested to seamlessly scan and search libraries with over 5,000 to 100,000+ files.
- Search, preview, and place window macros (`.ema`), page macros (`.ems`), and enclosure contours (`.fp1`).
- Configure macro variables before placement or insert multi-page macros directly into your project.

### 7. Multilingual Architecture (German & English)
- **UI Language:** Switch between English and German in General Settings. Menus, dialogs, tooltips, and status bars update immediately and persist across sessions.
- **Project Language:** Project metadata, title blocks, cover sheets, terminal reports, and Bills of Materials dynamically translate to English or German according to project standards.

### 8. Production Vector PDF & BOM Reports
- Generate multi-page vector PDFs in DIN A3 and DIN A4 landscape/portrait.
- Choose between crisp full-color or high-contrast monochrome printing.
- Includes embedded raster backgrounds (with opacity), vector wall lines, openings, arc wires, and clickable cross-reference links.
- Automated Bill of Materials (BOM) report generation with manufacturer article numbers, component quantities, and device tags.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| **Ctrl + Click** | Canvas | Jump directly to cross-reference / linked counterpart |
| **Ctrl + A** | Canvas | Select all elements on active sheet |
| **Ctrl + G** / **Ctrl + Shift + G** | Canvas | Create permanent group / Dissolve group |
| **Ctrl + C** / **Ctrl + X** / **Ctrl + V** | Canvas | Copy / Cut / Paste selected elements |
| **Ctrl + D** | Canvas | Duplicate selection with automated BMK incrementation |
| **Ctrl + Z** / **Ctrl + Y** | Canvas | Undo / Redo history state |
| **Delete** / **Backspace** | Canvas | Delete selected components, wires, texts, or walls |
| **F2** / **Enter** | Canvas | Open full Properties modal or focus property panel |
| **R** | Canvas | Rotate selected element by 90° clockwise |
| **D** / **W** | Canvas | Switch to Wire Drafting mode |
| **Ins** | Canvas | Open Symbol Insertion Catalog |
| **F** | Canvas | Fit entire drawing sheet to screen |
| **H** | Canvas | Toggle between full grid (8 mm) and half grid (4 mm) |
| **Alt + 1..3, Alt + 0** | Canvas | Select grid snap presets (Fine, Normal, Coarse, None) |
| **Middle Click + Drag** | Canvas | Pan canvas |
| **Mouse Wheel** | Canvas | Zoom in / Zoom out relative to cursor |
| **Esc** | Canvas | Cancel active tool or clear current selection |

---

## Supported File Formats & Compatibility

### Import
- **Schematico Projects:** Native JSON format (`.json`).
- **Project Exchange XML:** Open exchange format (`.xml`).
- **Standard Backup Archives:** Unpack `.zw1`, `.zip`, and split multi-part archives (`.001`, `.002`) on-the-fly directly in the browser or desktop app via integrated WebAssembly 7-Zip engine.
- **Macros & Part Packages:** Window macros (`.ema`), page macros (`.ems`), parts packages (`.edz`), macro collections (`.emp`), and 2D panel contours (`.fp1`).
- **Floor Plan Templates:** High-resolution architectural drawings (`PNG`, `JPEG`, `WebP`).
- **Single Page Imports:** Import exported floor plan pages (`.json`) into any active project.

### Export
- **Printable Vector PDF:** Industry-standard DIN A3/A4 vector PDFs with clickable navigation links and bookmarks.
- **Native JSON Project:** Lossless native project file containing master symbol definitions, pages, floor plans, and netlists.
- **Compressed Archive:** Bundled `.zw1` backup archive.
- **Exchange XML:** Structured XML representation conforming to industrial documentation guidelines.
- **Macros:** Export selection as portable window macro (`.ema`) or active sheet as page macro (`.ems`).
- **Floor Plan Sheet:** Export standalone floor plan page as reusable JSON.

---

## Development & Testing

### Prerequisites
- **Node.js 22 or newer**
- **npm** (bundled with Node.js)

### Setup & Run

```bash
# Install dependencies
npm ci

# Start local development server with HMR
npm run dev
```

The web application runs locally at `http://localhost:5173`. To test touch interactions on smartphones or tablets, open the local network IP displayed under **Help → Open on Smartphone…**.

### Verification & Test Suite

Schematico includes a comprehensive automated test suite covering electrical netlists, autoconnect algorithms, floor plan vectorization, symbol libraries, and PDF export:

```bash
# Run all unit, integration, and geometry test suites
npm test

# Verify type safety and create optimized production web bundle
npm run build

# Preview production build locally
npm run preview

# Verify neutral documentation and check branding integrity
npm run check:branding
```

---

## Desktop Application (Windows)

Schematico runs as a native desktop application powered by Electron:

```bash
# Launch Electron desktop client in live development mode
npm run electron:dev

# Compile production bundle and package Windows installer & portable binary
npm run dist:win
```

Installers and standalone binaries are generated in the `release/` directory:
- **`Schematico-Setup-<version>.exe`**: Windows NSIS setup wizard with start menu and desktop shortcuts.
- **`Schematico-<version>.exe`**: Standalone portable executable requiring no administrative installation.

Automated continuous integration compiles and publishes Windows releases via GitHub Actions on every version tag push (`v*`).

---

## License

Schematico is open-source software licensed under the [MIT License](LICENSE).  
The bundled WebAssembly 7-Zip decompression library is licensed under the LGPL (see [public/licenses/7zip-wasm.txt](public/licenses/7zip-wasm.txt)).
