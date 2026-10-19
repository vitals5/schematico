<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/branding/logo-dark.png">
    <img src="public/branding/logo.png" alt="Schematico" width="640">
  </picture>
</p>

# Schematico

Schematico is an electrical schematic and wiring diagram editor for **Windows and the Web browser**. Projects consist of editable library symbols, electrical wires, text callouts, drawings, device boxes, and structured page forms. The designation structures, symbol models, and title blocks follow DIN EN 81346, IEC 60617, and DIN EN ISO 7200.

[Launch Web App](https://vitals5.github.io/schematico/) · [Windows Downloads](https://github.com/vitals5/schematico/releases/latest) · [Windows Build Workflow](https://github.com/vitals5/schematico/actions/workflows/build-windows.yml)

## Features

- **Draw & Wire:** Place, move, and rotate library components; directional connection ports, grid snap, orthogonal wiring, T-junctions, connection nodes, and intelligent autoconnecting.
- **Multilingual Support:**
  - **Program / UI Language:** Switch seamlessly between English and German in General Settings. The user interface (menus, toolbars, sidebars, status bar, and dialogs) updates dynamically and persists via local storage in both Web and Desktop versions. Initial selection defaults to your system/browser language.
  - **Project Language:** Configure the project language (English or German) in Project Settings. Cover sheets, title blocks / plot frames, Bills of Materials (BOM / parts lists), terminal diagrams, and report headers automatically adapt to the chosen project language.
- **Multi-Page Management:** Create, reorder (move up/down), renumber, and delete project pages. Centralized page toolbar prevents accidental deletion of the last page. Title and cover pages display live project metadata and page counts.
- **Symbol Library:** Rich generic templates for protection devices, contactors, relays, terminals, power supply, sensors, automation, drives, and control cabinets. Imported projects retain and use their own symbol definitions.
- **Component Labelling:** Device tags (BMK), function texts, device descriptions, technical specifications, and engraving texts with customizable positions, font sizes, alignments, text angles, and visibility toggles.
- **Selection & Grouping:** Multi-select with selection box or Shift/Ctrl click. Edit shared properties simultaneously. Create or dissolve permanent and nested groups.
- **Device Boxes & Images:** Edit device boxes and location frames as regular elements with custom line styles and dimensions. Insert, scale, position, and organize images.
- **Cross-References:** Clickable cross-references between interruption points, coils, and contacts across different pages. Automatic calculation of contact mirrors and interruption references conforming to DIN EN 81346.
- **Undo / Redo:** Full history tracking across objects, wiring, properties, and pages.
- **Macros:** Search, preview, and place window macros (`.ema`), page macros (`.ems`), external macro packages, and contour files (`.fp1`). Configure macro variables prior to placement or add entire page macros as new project sheets.
- **Reports & Vector PDF Export:** Project validation, terminal diagrams, and Bills of Materials (BOM). Clean multi-page vector PDF generation in DIN A3/A4 formats (color or monochrome) with interactive clickable cross-reference links, bookmarked pages, and automatic text wrapping.
- **Touch & Mobile Support:** Touch dragging, placement, pinch-to-zoom, and collapsible panels for tablets and smartphones.

## Keyboard Shortcuts

The main menu bar provides access to **Project**, **Edit**, **Insert**, **View**, **Evaluate**, and **Help**, complemented by a compact action toolbar.

| Action | Shortcut / Operation |
| --- | --- |
| Multi-selection | Drag selection box; Ctrl/Shift+Click to toggle items |
| Select All | Ctrl+A |
| Group / Ungroup | Ctrl+G / Ctrl+Shift+G |
| Undo / Redo | Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z |
| Properties Inspector | F2, Enter, or Double-click |
| Insert Symbol / Wire | Ins / D or W |
| Cut / Copy / Paste | Ctrl+X / Ctrl+C / Ctrl+V |
| Rotate / Duplicate / Delete | R / Ctrl+D / Del |
| Fit to Screen / Pan Canvas | F / Arrow keys or middle-mouse drag |
| Grid Snap Modes | Alt+1, Alt+2, Alt+3, Alt+0; H toggles half-/full-grid |
| Cancel Action | Esc |

## File Formats & Compatibility

Open projects via **Project → Open Project…**:
- Native Schematico JSON projects (`.json`)
- Project XML files (`.xml`)
- Project backup archives (`.zw1`, `.zip`, and split archive parts `.001`/`.002`). Uncompressed on-the-fly without requiring third-party extraction tools.
- Macro packages and symbol packages (`.edz`, `.ema`, `.ems`, `.emp`, `.fp1`).

Export your project as:
- Native JSON project
- Printable vector PDF (A3 / A4)
- Compressed project archive (`.zw1`)
- Standard exchange XML (`.xml`)
- Page macro (`.ems`) or window macro (`.ema`)

## Development

Prerequisites: **Node.js 22 or newer** and `npm`.

```bash
npm ci
npm run dev
```

The preview server runs at `http://localhost:5173`. Open on other devices on your local network using the IP shown under **Help → Open on Smartphone…**.

```bash
npm test            # Automated unit and integration test suite
npm run build       # TypeScript verification and production web build in dist/
npm run preview     # Preview production build locally
npm run check:branding # Verify brand-neutral documentation and source tokens
```

## Desktop Build (Windows)

```bash
npm run electron:dev   # Desktop app with live development server
npm run dist:win       # Package Windows installer and portable EXE
```

Release builds are generated in `release/` under the name **Schematico**. The GitHub Actions workflow automatically builds the web app and Windows executable on pushes to `main`.

## License

Licensed under the MIT License. The bundled 7z-wasm unpacker is licensed under LGPL with unRAR restriction (see [public/licenses/7zip-wasm.txt](public/licenses/7zip-wasm.txt)).
