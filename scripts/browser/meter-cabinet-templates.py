"""Optional Playwright smoke test for cabinet templates; pass a dev or deployment URL."""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright,expect
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1660,'height':1100},locale='de-DE');errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('delete window.showSaveFilePicker')
  await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
  await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  await page.locator('#fileInput').set_input_files(str(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json')))
  await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='Cabinet library check'")
  await page.locator('#btnCabinetWorkspace').click();editor=page.locator('#cabinetLayoutDialog')
  await expect(editor.locator('.cb-svg')).to_have_attribute('data-cabinet-theme','dark')
  await editor.locator('[data-add-rail]').click();await editor.locator('[data-apply]').click()
  await editor.locator('[data-meter-open]').click()
  await expect(editor.locator('[data-meter-fields] option')).to_have_count(5)
  await expect(editor.locator('[data-meter-height] option')).to_have_count(4)
  await editor.locator('[data-meter-fields]').select_option('3');await editor.locator('[data-meter-height]').select_option('1400');await editor.locator('[data-meter-kind="2"]').select_option('reserve')
  await editor.locator('[data-meter-create]').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(15);await expect(editor.locator('.cb-section')).to_have_count(5)
  await editor.locator('[data-undo]').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(1)
  await editor.locator('[data-redo]').click();await expect(editor.locator('[data-cabinet-item]')).to_have_count(15)
  await editor.locator('[data-apply]').click();await expect(editor.locator('[data-layout] option')).to_have_count(2)
  rail=await editor.locator('[data-cabinet-item]').first.get_attribute('data-cabinet-item')
  await editor.locator('[data-library-tab="standard"]').click();await editor.locator('[data-standard="mcb-1p"]').click();await editor.locator('[data-standard-rail]').select_option(rail);await editor.locator('[data-standard-quantity]').fill('12');await editor.locator('[data-standard-place]').click()
  await expect(editor.locator('[data-cabinet-item]')).to_have_count(27);await expect(editor.locator('[data-apply]')).to_be_enabled()
  async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
  project=json.loads(pathlib.Path(await (await event.value).path()).read_text());assert len(project['cabinetLayouts'])==2
  template=project['cabinetLayouts'][-1];assert template['widthMm']==800 and template['heightMm']==1400;assert len(template['sections'])==5;assert len(template['items'])==27
  await editor.locator('[data-meter-remove-guides]').click();await expect(editor.locator('.cb-section')).to_have_count(0);await expect(editor.locator('[data-cabinet-item]')).to_have_count(27);await editor.locator('[data-undo]').click();await expect(editor.locator('.cb-section')).to_have_count(5)
  async with page.expect_download() as event:await editor.locator('[data-svg]').click()
  svg=pathlib.Path(await (await event.value).path()).read_text();assert svg.count('class="cb-section"')==5 and 'Zählerfeld' in svg
  assert 'data-cabinet-theme="light"' in svg and 'fill="#fcfdff"' in svg and 'fill="#12161f"' not in svg
  async with page.expect_download() as event:await editor.locator('[data-pdf]').click()
  assert pathlib.Path(await (await event.value).path()).read_bytes().startswith(b'%PDF')
  await page.screenshot(path='/tmp/schematico-meter-template.png')
  assert not errors,errors
  await browser.close();print('Meter cabinet UI: field/height/role selection, new-board isolation, full 12-module rails, editable guides, undo, project save, SVG and PDF passed')
asyncio.run(main())
