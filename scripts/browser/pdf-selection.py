"""Optional Chromium PDF selection regression; pass a dev or deployment URL."""
import asyncio
import copy
import json
import pathlib
import re
import sys
import zlib

from playwright.async_api import async_playwright, expect


def fixture():
    project = json.loads(pathlib.Path(__file__).with_name("cabinet-workspace.fixture.json").read_text())
    project['name'] = 'PDF selection regression'
    original = project['pages'][0]
    project['pages'] = []
    for kind in ['schematic', 'parts_list', 'terminal_diagram']:
        page = copy.deepcopy(original)
        page.update(id=kind, pageNumber=str(len(project['pages']) + 1),
                    title=kind, pageType=kind)
        if kind == 'parts_list':
            # Legacy imports stored BOM graphics as an ordinary schematic page.
            page.update(pageType='schematic', title='Artikelstückliste',
                        importedDrawing=dict(source='NATIVE_CAD', graphics=[], diagnostics=[]))
        page['texts'] = [dict(id=kind, text='SOURCE_' + kind, x=100, y=100,
                              fontSize=10, fontColor='#000000', fontWeight='normal',
                              fontStyle='normal', align='start', rotation=0)]
        project['pages'].append(page)
    project['activePageId'] = 'schematic'
    return project


def pdf_content(data):
    raw = data.decode('latin1')
    streams = []
    for obj in re.findall(r'\d+ 0 obj\s*(.*?)\s*endobj', raw, re.S):
        stream = re.search(r'stream\r?\n(.*?)\r?\nendstream', obj, re.S)
        if stream:
            content = stream[1].encode('latin1')
            streams.append((zlib.decompress(content) if '/FlateDecode' in obj else content).decode('latin1'))
    return len(re.findall(r'/Type /Page\b', raw)), '\n'.join(streams)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=['--no-sandbox'])
        page = await browser.new_page(viewport={'width': 1400, 'height': 1050})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4198', wait_until='networkidle')
        await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
        await page.locator('#fileInput').set_input_files(dict(
            name='pdf-selection.json', mimeType='application/json', buffer=json.dumps(fixture()).encode()))
        await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='PDF selection regression'")

        async def open_export():
            await page.locator('#btnExportPdf').click()
            root = page.locator('#pdfExportDialog')
            await root.locator('[data-pdf-none]').click()
            await root.locator('#chkPartsList').uncheck()
            await root.locator('#chkTerminalDiagram').uncheck()
            await expect(root.locator('#pdfExportSelection')).to_contain_text('1 project sheets and 0 additional sections')
            return root

        async def download(root):
            async with page.expect_download() as event:
                await root.locator('#btnPdfDoExport').click()
            return pdf_content(pathlib.Path(await (await event.value).path()).read_bytes())

        root = await open_export()
        count, content = await download(root)
        assert count == 1 and 'SOURCE_schematic' in content, (count, content)
        assert 'SOURCE_parts_list' not in content and 'SOURCE_terminal_diagram' not in content

        root = await open_export()
        await root.locator('#chkPartsList').check()
        await expect(root.locator('#pdfExportSelection')).to_contain_text('2 project sheets and 1 additional sections')
        count, content = await download(root)
        assert count >= 2 and 'SOURCE_parts_list' in content and 'SOURCE_terminal_diagram' not in content

        root = await open_export()
        await root.locator('#chkTerminalDiagram').check()
        await expect(root.locator('#pdfExportSelection')).to_contain_text('2 project sheets and 1 additional sections')
        count, content = await download(root)
        assert count >= 2 and 'SOURCE_terminal_diagram' in content and 'SOURCE_parts_list' not in content

        root = await open_export()
        await root.locator('#chkPdfDrawings').uncheck()
        await expect(root.locator('#pdfExportSelection')).to_contain_text('0 project sheets and 0 additional sections')
        await root.locator('#btnPdfDoExport').click()
        await expect(root.locator('[data-pdf-error]')).not_to_be_empty()
        assert not errors, errors
        await browser.close()
        print('PDF export UI: live selection, imported report exclusion, selective report inclusion, actual PDF content and empty-selection error passed')


asyncio.run(main())
