# Standalone CAD file converter

This separate program converts local DWG files into the standard DXF file format.
It is useful independently of Schematico: open index.html through a local web
server and download the resulting DXF for any supporting CAD program.

The converter program (index.html, converter.js, worker.js) is GPL-3.0-only.
LibreDWG and its JavaScript/WebAssembly binding are GPL-3.0; see COPYING.
The Schematico application does not import or link the DWG decoder. The optional
converter has its own document, worker and npm dependency tree. The integration
protocol transfers files in standard DXF format, plus an unchanged optional
original file. It does not exchange application-internal electrical objects.

## Corresponding source and build

Pinned decoder: @mlightcad/libredwg-web 0.8.7, upstream tag v0.8.7,
commit 82bf45777635942e5eb9b68c15a2ee75bbaf64ab:
https://github.com/mlightcad/libredwg-web/tree/82bf45777635942e5eb9b68c15a2ee75bbaf64ab

The complete upstream source, including C decoder and WebAssembly build scripts,
is supplied alongside the converter as source/libredwg-source.tar.gz. The
upstream WebAssembly build instructions are in bindings/javascript/README.md
inside that archive. Preserve its notices, licenses and build instructions.
The wrapper's published distribution is installed from the exact version in
package-lock.json. To prepare the standalone distributable, run
`node scripts/prepare-cad-converter.mjs` from the Schematico source checkout.
The preparation helper is MIT-licensed (Schematico-MIT-LICENSE.txt); the converter's source files/package lock
are also supplied under source/. The Schematico main application's MIT code is
separate from this GPL program. Redistributors must preserve the supplied source
and notices for the converter rather than describing the whole bundle as MIT.

Source archive SHA-256:
5587e5d92629cba0de37d99448517110c2f292fa59d0ab9ddf3cb26dc736cf0a

No server-side file processing, supplier login or unofficial supplier API is used.

To prepare the standalone tool directly from the supplied `source/` directory:

```sh
npm ci --ignore-scripts
mkdir -p ../vendor/dist ../vendor/wasm
cp node_modules/@mlightcad/libredwg-web/dist/libredwg-web.js ../vendor/dist/
cp node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.js ../vendor/wasm/
cp node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm ../vendor/wasm/
cp index.html converter.js worker.js COPYING ../
```

Serve the parent directory using a static web server. To rebuild the decoder
itself, extract libredwg-source.tar.gz and follow its JavaScript binding's build
instructions. The upstream jsmn submodule is used only for optional JSON support;
the published WASM build disables JSON. Its repository and submodule reference
are retained in the upstream source archive.
