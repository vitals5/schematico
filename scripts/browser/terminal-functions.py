"""Real terminal placement, level editing and workbench apply/reload."""
import asyncio
import json
import pathlib
import sys
from playwright.async_api import async_playwright, expect

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1600,'height':1050},locale='de-DE')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('delete window.showSaveFilePicker')
  await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
  await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  p=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text());p['name']='Terminal functions check'
  await page.locator('#fileInput').set_input_files(dict(name='terminals.json',mimeType='application/json',buffer=json.dumps(p).encode()))
  await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='Terminal functions check'")
  await page.locator('#btnZoomFit').click()
  async def save():
   async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
   return json.loads(pathlib.Path(await (await event.value).path()).read_text())
  async def point(x,y):return await page.locator('#viewportTransform').evaluate('(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM()).toJSON()',dict(x=x,y=y))
  ids=['terminal_single','terminal_feed_3','terminal_feed_4','terminal_double','terminal_triple','terminal_installation_l_n_pe']
  for i,symbol_id in enumerate(ids):
   await page.locator('[data-tab="symbols"]').click()
   await page.locator('#symbolSearchInput').fill('')
   await page.locator(f'[data-symbol-id="{symbol_id}"]').click()
   pos=await point(100+100*i,180)
   await page.mouse.click(pos['x'],pos['y']);await page.keyboard.press('Escape')
  saved=await save();components=saved['pages'][0]['components']
  assert len(components)==6
  assert all(c['functionText']=='' for c in components)
  stock=components[4]
  pos=await point(stock['x']+6,stock['y']+10);await page.mouse.dblclick(pos['x'],pos['y'])
  dialog=page.locator('#propertiesModal');await expect(dialog).to_be_visible()
  await expect(dialog.locator('[data-terminal-level]')).to_have_count(0)
  await expect(dialog.locator('[data-manage-terminals]')).to_be_visible()
  # An unchanged properties visit must leave inferred terminal data absent.
  await dialog.locator('#btnSaveProp').click()
  saved=await save();stock=saved['pages'][0]['components'][4];assert 'terminal' not in stock
  pos=await point(stock['x']+6,stock['y']+10);await page.mouse.dblclick(pos['x'],pos['y'])
  await dialog.locator('#propFunctionText').fill('Global function')
  await dialog.locator('#btnSaveProp').click()
  saved=await save();stock=saved['pages'][0]['components'][4]
  assert stock['functionText']=='Global function' and 'terminal' not in stock
  pos=await point(stock['x']+6,stock['y']+10);await page.mouse.dblclick(pos['x'],pos['y'])
  await dialog.locator('#propFunctionText').fill('')
  await dialog.locator('[data-manage-terminals]').click()
  editor=page.locator('#terminalEditorDialog')
  await editor.locator('#terminal-strip').fill('-X4');await editor.locator('#terminal-number').fill('5')
  await editor.locator('#terminal-designation-2').fill('N-Load');await editor.locator('#terminal-text-2').fill('Load neutral')
  await editor.locator('[data-stage-function]').click();await editor.locator('[data-review]').click();await editor.locator('[data-apply]').click();await editor.locator('[data-close]').click()
  saved=await save();stock=saved['pages'][0]['components'][4]
  assert stock['bmk']=='-X4:5' and stock['terminal']['levels']['2']=={'designation':'N-Load','functionText':'Load neutral'}
  await expect(page.locator('#'+stock['id']+' [data-terminal-label="level-2"]')).to_have_text('N-Load')
  # Real workbench cards have distinct level keys and open the physical terminal.
  await page.locator('#menuProjectTrigger').click();await page.locator('#menuWiringWorkbench').click()
  root=page.locator('#wiringDialog')
  card=root.locator('[data-terminal-key]').filter(has_text='5/N-Load').first
  await card.click()
  await expect(editor).to_be_visible()
  await expect(editor.locator('[data-terminal-level]')).to_have_count(3)
  await editor.locator('#terminal-number').fill('6')
  await editor.locator('#terminal-text-2').fill('Changed neutral')
  await editor.locator('[data-stage-function]').click();await editor.locator('[data-review]').click();await editor.locator('[data-apply]').click();await editor.locator('[data-close]').click()
  await root.locator('[data-close]').click()
  saved=await save();stock=saved['pages'][0]['components'][4]
  assert stock['bmk']=='-X4:6' and stock['terminal']['levels']['2']['functionText']=='Changed neutral'
  pos=await point(stock['x']+6,stock['y']+10);await page.mouse.dblclick(pos['x'],pos['y'])
  await dialog.locator('[data-tab="display"]').click()
  await dialog.locator('#propPinVisible').uncheck();await dialog.locator('#propFnVisible').uncheck()
  await dialog.locator('#btnSaveProp').click()
  await expect(page.locator('#'+stock['id']+' [data-terminal-label]')).to_have_count(0)
  saved=await save();saved['name']='Terminal roundtrip'
  await page.locator('#fileInput').set_input_files(dict(name='terminal-roundtrip.json',mimeType='application/json',buffer=json.dumps(saved).encode()))
  await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='Terminal roundtrip'")
  await expect(page.locator('#'+stock['id']+' [data-terminal-label]')).to_have_count(0)
  await page.screenshot(path='/workspace/scratch/terminal-functions-editor.png')
  assert not errors,errors
  await browser.close()
  print('Terminal UI: blank real placement defaults, central level editor, unchanged data guard, edits, common workbench entry and atomic apply, label visibility and reload passed')

asyncio.run(main())
