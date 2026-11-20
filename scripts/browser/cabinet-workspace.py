"""Optional end-to-end smoke test: pip install playwright; playwright install chromium.
Run against the development or deployed app: python scripts/browser/cabinet-workspace.py URL
"""
import asyncio, json, pathlib, sys, tempfile
from playwright.async_api import async_playwright, expect

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1600,'height':1050},locale='de-DE')
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  await page.add_init_script('delete window.showSaveFilePicker')
  await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
  await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(el=>el.remove())")
  await page.locator('#fileInput').set_input_files(str(pathlib.Path(__file__).with_suffix('.fixture.json')))
  await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='Cabinet library check'")
  await page.locator('#btnCabinetWorkspace').click()
  editor=page.locator('#cabinetLayoutDialog')
  await expect(editor.locator('[role=region]')).to_be_visible()
  await expect(page.locator('#canvasContainer')).to_be_hidden()
  await expect(page.locator('.modal-backdrop')).to_have_count(0)
  await editor.locator('[data-add-rail]').click()
  await expect(page.locator('#btnUndo')).to_be_enabled()
  await page.locator('#btnUndo').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(0)
  await page.locator('#btnRedo').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(1)
  rail=editor.locator('[data-cabinet-item]').first
  await rail.click();old_x=await editor.locator('[data-item="x"]').input_value()
  bounds=await rail.bounding_box();x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']/2
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+18,y+10,steps=5);await page.mouse.up()
  assert await editor.locator('[data-item="x"]').input_value()!=old_x
  await page.locator('#btnUndo').click();await expect(editor.locator('[data-item="x"]')).to_have_value(old_x)
  # Keep an unapplied draft when the user declines leaving the workspace.
  page.once('dialog',lambda d:asyncio.create_task(d.dismiss()))
  await editor.locator('[data-workspace-drawing]').click();await expect(editor).to_be_visible()
  # Project save flushes a valid cabinet draft, including while typing into a field.
  await editor.locator('[data-library-search]').focus()
  async with page.expect_download() as event:await page.keyboard.press('Control+s')
  saved=json.loads(await (await event.value).failure() or pathlib.Path(await (await event.value).path()).read_text())
  assert len(saved['cabinetLayouts'][0]['items'])==1
  await editor.locator('[data-workspace-drawing]').click();await expect(page.locator('#canvasContainer')).to_be_visible()
  await page.locator('#btnCabinetWorkspace').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(1)
  # Undoing a committed project change refreshes the visible cabinet editor.
  await page.locator('#btnUndo').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(0)
  await page.locator('#btnRedo').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(1)
  # Direct exports continue to use the cabinet renderer.
  async with page.expect_download() as event:await editor.locator('[data-pdf]').click()
  assert pathlib.Path(await (await event.value).path()).read_bytes().startswith(b'%PDF')
  await page.set_viewport_size({'width':600,'height':900})
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await editor.locator('[data-workspace-drawing]').click()
  assert not errors,errors
  await browser.close()
  print('Cabinet workspace: embedded surface, safe exit, local/global history, Ctrl+S, persistence, export and responsive layout passed')
asyncio.run(main())
