"""Distributed terminal functions through the real properties/preview flow."""
import asyncio
import json
import pathlib
import sys
from playwright.async_api import async_playwright, expect

def fixture(symbol_id,name):
 p=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text())
 p['name']=name;p['symbolGeometryRevision']=1
 p['pages'][0]['components']=[dict(id='subject',symbolId=symbol_id,bmk='-X1:7',functionText='',x=140,y=140,rotation=0,pins={},
   terminal=dict(strip='-X1',number='7',level='',pinSides={}),articleNumber='TERM-3',manufacturer='Synthetic',
   articleAssignment=dict(mode='manual',items=[dict(articleNumber='TERM-3',manufacturer='Synthetic',variant='',quantity=1,role='main')]))]
 second=json.loads(json.dumps(p['pages'][0]));second.update(id='p2',pageNumber='2',title='Other sheet',components=[],wires=[],location='+OTHER')
 p['pages'].append(second)
 return p

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1600,'height':1050},locale='de-DE')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('delete window.showSaveFilePicker')
  await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
  await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  async def load(p):
   await page.locator('#fileInput').set_input_files(dict(name='terminal-functions.json',mimeType='application/json',buffer=json.dumps(p).encode()))
   await page.wait_for_function('name=>document.querySelector("#headerProjectName")?.textContent===name',arg=p['name'])
   await page.locator('#btnZoomFit').click()
  async def save():
   async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
   return json.loads(pathlib.Path(await (await event.value).path()).read_text())
  async def open_properties(c,dx=6,dy=10):
   await page.locator('#btnZoomFit').click()
   await page.wait_for_timeout(150)
   point=await page.locator('#viewportTransform').evaluate('(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM()).toJSON()',dict(x=c['x']+dx,y=c['y']+dy))

   await page.mouse.dblclick(point['x'],point['y']);await expect(page.locator('#propertiesModal')).to_be_visible()
  p=fixture('terminal_triple','Distributed levels');await load(p)
  await open_properties(p['pages'][0]['components'][0]);await page.locator('#propertiesModal [data-manage-terminals]').click()
  root=page.locator('#terminalFunctionDialog');await expect(root).to_be_visible()
  await root.locator('[data-split-main]').select_option('3');await root.locator('[data-split-levels]').click()
  await expect(root.locator('[data-preview]')).to_be_visible()
  await expect(page.locator('#componentsLayer > .component')).to_have_count(1)
  await root.locator('[data-apply]').click();await expect(page.locator('#componentsLayer > .component')).to_have_count(3)
  await root.locator('[data-close]').click()
  await page.keyboard.press('Control+z');await expect(page.locator('#componentsLayer > .component')).to_have_count(1)
  await page.keyboard.press('Control+y');await expect(page.locator('#componentsLayer > .component')).to_have_count(3)
  saved=await save();members=saved['pages'][0]['components'];assert len(saved['physicalDevices'])==1
  main=next(c for c in members if c['id']=='subject');assert main['terminal']['level']=='3'
  secondary=next(c for c in members if c['terminal']['level']=='1')
  await open_properties(secondary)
  properties=page.locator('#propertiesModal');await properties.locator('[data-tab="part"]').click()
  await expect(properties.locator('#propArticleNumber')).to_have_count(0)
  await properties.locator('[data-open-terminal-main]').click()
  await properties.locator('[data-tab="part"]').click();await expect(properties.locator('#propArticleNumber')).to_have_value('TERM-3')
  await properties.locator('[data-tab="symbol"]').click();await properties.locator('[data-manage-terminals]').click()
  await root.locator('[data-main-target]').select_option(json.dumps(dict(pageId='p',componentId=secondary['id']),separators=(',',':')))
  await root.locator('[data-main]').click();await root.locator('[data-apply]').click()
  await root.locator('[data-target-page]').select_option('p2');await root.locator('[data-target-x]').fill('240');await root.locator('[data-target-y]').fill('220')
  await root.locator('[data-move]').click();await root.locator('[data-apply]').click();await root.locator('[data-close]').click()
  saved=await save();assert saved['physicalDevices'][0]['main']['componentId']==secondary['id']
  assert len(saved['pages'][0]['components'])==2 and len(saved['pages'][1]['components'])==1
  assert saved['pages'][1]['components'][0]['id']=='subject'
  assert next(c for c in saved['pages'][0]['components'] if c['id']==secondary['id'])['articleNumber']=='TERM-3'
  p=fixture('terminal_feed_4','Partial terminals');await load(p)
  await open_properties(p['pages'][0]['components'][0],8,8);await properties.locator('[data-manage-terminals]').click()
  await root.locator('[data-split-parts]').click();await root.locator('[data-apply]').click()
  await expect(page.locator('#componentsLayer > .component')).to_have_count(4)
  await root.locator('[data-target-page]').select_option('p2');await root.locator('[data-target-x]').fill('200');await root.locator('[data-target-y]').fill('180')
  await root.locator('[data-move]').click();await root.locator('[data-apply]').click();await root.locator('[data-close]').click()
  saved=await save();assert len(saved['distributedTerminalFunctions'])==1
  assert len(saved['distributedTerminalFunctions'][0]['placements'])==4
  assert saved['physicalDevices'][0]['main']['pageId']=='p2'
  assert len(saved['pages'][0]['components'])==3 and len(saved['pages'][1]['components'])==1
  saved['name']='Partial terminal roundtrip';await load(saved)
  await page.screenshot(path='/workspace/scratch/distributed-terminals-editor.png')
  assert not errors,errors
  await browser.close()
  print('Distributed terminal UI: real preview/apply and undo/redo, separate functions, main-only article editing, main reassignment, cross-sheet move, explicit partial links and persistence passed')

asyncio.run(main())
