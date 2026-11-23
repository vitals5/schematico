"""Create empty/populated terminal strips and extend them without the palette."""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright,expect
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox']);page=await browser.new_page(viewport={'width':1600,'height':1050},locale='de-DE');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('delete window.showSaveFilePicker');await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle');await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  project=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text());project['name']='Create terminal rows';project['symbolGeometryRevision']=1;project['pages'][0]['components']=[]
  await page.locator('#fileInput').set_input_files(dict(name='empty.json',mimeType='application/json',buffer=json.dumps(project).encode()));await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='Create terminal rows'")
  root=page.locator('#terminalEditorDialog')
  async def open_editor():await page.locator('#menuProjectTrigger').click();await page.locator('#menuTerminalEditor').click();await expect(root).to_be_visible()
  async def save():
   async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
   return json.loads(pathlib.Path(await (await event.value).path()).read_text())
  async def f(name):return root.locator(f'[data-row-field="{name}"]')
  await open_editor();await expect(root.locator('[data-grid]')).to_contain_text('Ihre erste Klemmenreihe');await root.locator('.te-nav [data-create-row]').click()
  await expect(await f('strip')).to_have_value('-X1');await (await f('count')).fill('5');await (await f('startNumber')).fill('12')
  await expect(root.locator('[data-row-range]')).to_contain_text('12 … 16');await page.screenshot(path='/workspace/scratch/terminal-row-creation-form.png')
  await root.locator('[data-stage-row]').click();await expect(root.locator('tr[data-address]')).to_have_count(5);await expect(root.locator('[data-preview]')).to_contain_text('Klemmenreihe');await expect(root.locator('[data-apply]')).to_be_enabled();await expect(page.locator('#componentsLayer > .component')).to_have_count(0)
  await root.locator('[data-apply]').click();await expect(page.locator('#componentsLayer > .component')).to_have_count(5);await root.locator('[data-close]').click();saved=await save()
  assert len(saved['pages'])==2 and len(saved['terminalStrips'])==1;row=next(p for p in saved['pages'] if len(p['components'])==5);assert saved['activePageId']==row['id'];assert [c['bmk'] for c in row['components']]==['-X1:'+str(i) for i in range(12,17)];assert not row['wires'];assert all(c['functionText']=='' for c in row['components'])
  await page.keyboard.press('Control+z');await expect(page.locator('#componentsLayer > .component')).to_have_count(0);await page.keyboard.press('Control+y');await expect(page.locator('#componentsLayer > .component')).to_have_count(5)
  await open_editor();await root.locator('.te-toolbar [data-add-terminals]').click();await expect(await f('startNumber')).to_have_value('17');await expect(await f('strip')).to_have_attribute('readonly','')
  await (await f('count')).fill('2');await (await f('startNumber')).fill('14');await root.locator('[data-stage-row]').click();await expect(root.locator('[data-editor-error]')).to_contain_text('bereits vergeben');await expect(page.locator('#componentsLayer > .component')).to_have_count(5)
  await (await f('startNumber')).fill('17');await (await f('symbolId')).select_option('terminal_pe');await root.locator('[data-stage-row]').click();await expect(root.locator('tr[data-address]')).to_have_count(7);await root.locator('[data-apply]').click();await root.locator('[data-close]').click();saved=await save();assert len(saved['pages'])==2 and len(saved['terminalStrips'][0]['positions'])==7;assert not any(p['wires'] for p in saved['pages'])
  await open_editor();await root.locator('.te-nav [data-create-row]').click();await expect(await f('strip')).to_have_value('-X2');await root.locator('[data-row-empty]').check();await expect(await f('count')).to_be_disabled();await root.locator('[data-stage-row]').click();await expect(root.locator('[data-grid]')).to_contain_text('noch leer');await root.locator('[data-apply]').click();await root.locator('[data-close]').click();saved=await save();assert len(saved['pages'])==2 and len(saved['terminalStrips'])==2;assert any(s['strip']=='-X2' and not s['positions'] for s in saved['terminalStrips'])
  await open_editor();await root.locator('[data-strip-key]').filter(has_text='-X2').click();await root.locator('.te-toolbar [data-add-terminals]').click();await (await f('count')).fill('2');await (await f('symbolId')).select_option('terminal_double');await root.locator('[data-stage-row]').click();await root.locator('[data-apply]').click();await root.locator('[data-close]').click();saved=await save();assert len(saved['pages'])==3
  created=[c for p in saved['pages'] for c in p['components'] if c['bmk'].startswith('-X2:')];assert len(created)==2 and all(c['symbolId']=='terminal_double' for c in created)
  # Cancellation discards the form; closing a staged draft can discard all additions.
  await open_editor();await root.locator('.te-nav [data-create-row]').click();await (await f('strip')).fill('-X99');await root.locator('[data-cancel-row]').click();await root.locator('[data-close]').click();unchanged=await save();assert not any(s['strip']=='-X99' for s in unchanged['terminalStrips'])
  await open_editor();await root.locator('.te-nav [data-create-row]').click();await (await f('strip')).fill('-X99');await root.locator('[data-stage-row]').click();await root.locator('[data-close]').click();await root.locator('[data-discard-close]').click();unchanged=await save();assert len(unchanged['pages'])==3 and not any(s['strip']=='-X99' for s in unchanged['terminalStrips'])
  # The creation form stays usable on narrow screens.
  await open_editor();await root.locator('.te-nav [data-create-row]').click();await page.set_viewport_size({'width':390,'height':900});await expect(root.locator('[data-stage-row]')).to_be_in_viewport();box=await root.locator('.te-shell').bounding_box();assert box['width']<=390;await page.screenshot(path='/workspace/scratch/terminal-row-creation-mobile.png')
  assert not errors,errors;await browser.close();print('Terminal row creation UI: obvious empty-state entry, normal/empty creation, duplicate guards, suggested append numbering, shared-sheet extension, type selection, automatic drawings, single undo/redo, cancel/discard and narrow-screen layout passed')
asyncio.run(main())
