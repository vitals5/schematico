"""Straight terminal rows, concise printed labels and existing-row repair."""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright,expect
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox']);page=await browser.new_page(viewport={'width':1680,'height':1050},locale='de-DE');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.add_init_script('delete window.showSaveFilePicker');await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle');await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  project=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text());project['name']='Horizontal row check';project['symbolGeometryRevision']=1;project['pages'][0]['components']=[]
  async def load(p):
   await page.locator('#fileInput').set_input_files(dict(name='terminals.json',mimeType='application/json',buffer=json.dumps(p).encode()));await page.wait_for_function('name=>document.querySelector("#headerProjectName")?.textContent===name',arg=p['name'])
  async def save():
   async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
   return json.loads(pathlib.Path(await (await event.value).path()).read_text())
  async def editor():await page.locator('#menuProjectTrigger').click();await page.locator('#menuTerminalEditor').click()
  await load(project);await editor();root=page.locator('#terminalEditorDialog');await root.locator('.te-nav [data-create-row]').click();await root.locator('[data-row-field="count"]').fill('18');await root.locator('[data-stage-row]').click();await root.locator('[data-apply]').click();await root.locator('[data-close]').click()
  result=await save();row=next(p for p in result['pages'] if p['components']);assert len(row['components'])==18;assert len(set(c['y'] for c in row['components']))==1;assert [c['bmk'] for c in row['components']]==['-X1:'+str(i) for i in range(1,19)]
  await expect(page.locator('#componentsLayer [data-label="bmkPosition"]')).to_have_text(['-X1']+[str(i) for i in range(2,19)])
  await expect(page.locator('#componentsLayer [data-terminal-label="terminal-number"]')).to_have_text(['1'])
  point=await page.locator('#viewportTransform').evaluate('(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM()).toJSON()',dict(x=sum(c['x'] for c in row['components'])/18,y=row['components'][0]['y']+10));await page.mouse.move(point['x'],point['y']);await page.mouse.wheel(0,-800);await page.wait_for_timeout(150);await page.screenshot(path='/workspace/scratch/horizontal-terminal-row.png')
  await editor();await root.locator('.te-toolbar [data-add-terminals]').click();await root.locator('[data-row-field="count"]').fill('3');await root.locator('[data-stage-row]').click();await root.locator('[data-apply]').click();await root.locator('[data-close]').click();result=await save();row=next(p for p in result['pages'] if p['components']);assert len(row['components'])==21 and len(set(c['y'] for c in row['components']))==1;assert sum(c['terminal']['rowDisplay']=='start' for c in row['components'])==1
  legacy=json.loads(json.dumps(project));legacy['name']='Repair horizontal row';legacy['pages'][0]['components']=[dict(id='old'+str(i),symbolId='terminal_single',bmk='-X2:'+str(i+1),functionText='',x=120+(i%4)*90+(i//4)*8,y=160+(i//4)*120,rotation=0,pins={},terminal=dict(strip='-X2',number=str(i+1),level='',pinSides={})) for i in range(8)]
  await load(legacy);await editor();await root.locator('[data-tab="device"]').click();await root.locator('[data-align-row]').click();await expect(root.locator('[data-preview]')).to_be_visible();await root.locator('[data-apply]').click();await root.locator('[data-close]').click();aligned=await save();assert len(set(c['y'] for c in aligned['pages'][0]['components']))==1;await expect(page.locator('#componentsLayer [data-label="bmkPosition"]')).to_have_text(['-X2']+[str(i) for i in range(2,9)])
  await page.keyboard.press('Control+z');restored=await save();assert len(set(c['y'] for c in restored['pages'][0]['components']))==2
  assert not errors,errors;await browser.close();print('Horizontal row UI: 18 aligned library terminals, first-only strip heading and all numbers, rightward extension, complete stored identifiers, explicit legacy-row repair and application undo passed')
asyncio.run(main())
