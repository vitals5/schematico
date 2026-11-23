"""Terminal structure conversion; optionally test an untracked imported project."""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright, expect

def fixture():
 p=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text());p['name']='Terminal import structure';pg=p['pages'][0];pg['components']=[];pg['wires']=[]
 sid='native:IEC_symbol:30:0';p['symbolLibrary']=[dict(id=sid,name='IEC_symbol / X [30:0]',category='terminals',standard='DIN EN 60617',defaultBmkPrefix='',defaultFunctionText='',width=4,height=10,description='Synthetic',source=dict(library='IEC_symbol',number=30,variant=0),pins=[dict(id='0',name='1',x=2,y=0,direction='top'),dict(id='1',name='2',x=2,y=10,direction='bottom')],svgContent='<circle cx="2" cy="5" r="2" stroke="currentColor" fill="none"/>')]
 for i,(tag,num) in enumerate([('-X1','1'),('-X1','N'),('-X1','PE'),('-X2','1'),('-X2','1'),('-X3','')]):pg['components'].append(dict(id='t'+str(i),symbolId=sid,bmk=tag,deviceTag=num,functionText='',x=80+i*40,y=100,rotation=0,pins={'0':{},'1':{}},source=dict(format='NATIVE_CAD',objectType=17,objectId=i+1)))
 return p
async def main():
 real=len(sys.argv)>2;data=json.loads(pathlib.Path(sys.argv[2]).read_text()) if real else fixture();expected=321 if real else 3;strips=70 if real else 1
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox']);page=await browser.new_page(viewport={'width':1600,'height':1100},locale='de-DE');page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('delete window.showSaveFilePicker');await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle');await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  await page.locator('#fileInput').set_input_files(dict(name='terminals.json',mimeType='application/json',buffer=json.dumps(data).encode()));await page.wait_for_function('name=>document.querySelector("#headerProjectName")?.textContent===name',arg=data['name'])
  async def save():
   async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
   return json.loads(pathlib.Path(await (await event.value).path()).read_text())
  async def cleanup():
   await page.locator('#menuProjectTrigger').click();await page.locator('#menuImportCleanup').click();root=page.locator('#importCleanupDialog');await expect(root.locator('[data-apply]')).to_be_enabled();return root
  baseline=await save();root=await cleanup();await expect(root.locator('[data-terminal-structure]')).to_be_checked();await expect(root.locator('[data-terminal-summary]')).to_contain_text(str(expected)+' werden übernommen')
  async with page.expect_download() as event:await root.locator('[data-report]').click()
  report=json.loads(pathlib.Path(await (await event.value).path()).read_text());assert report['terminalStructure']['converted']==expected and report['terminalStructure']['createdStrips']==strips
  await root.locator('[data-filter]').select_option('terminal_structure');await expect(root.locator('[data-findings]')).to_contain_text('Nummer mehrfach vorhanden');await expect(root.locator('[data-terminal]').first).to_be_visible()
  await page.screenshot(path='/workspace/scratch/imported-terminal-structure-ui.png');drawing=await page.locator('#componentsLayer').inner_html();await root.locator('[data-close]').click();assert (await save()).get('terminalStrips')==baseline.get('terminalStrips'),'Preview changed project'
  root=await cleanup();await root.locator('[data-apply]').click();editor=page.locator('#terminalEditorDialog');await expect(editor).to_be_visible();await editor.locator('[data-close]').click();changed=await save();assert len(changed['terminalStrips'])==strips
  assert await page.locator('#componentsLayer').inner_html()==drawing,'Symbol rendering changed'
  stripped=json.loads(json.dumps(changed['pages']));converted=0
  for pg in stripped:
   for c in pg['components']:
    if 'terminal' in c:converted+=1;del c['terminal']
  assert converted==expected;assert stripped==baseline['pages'],'Drawing, text, wire or pin data changed'
  for key in ['symbolLibrary','logicalConnections','cabinetLayouts','physicalDevices']:assert changed.get(key)==baseline.get(key),key+' changed'
  await page.keyboard.press('Control+z');assert (await save()).get('terminalStrips')==baseline.get('terminalStrips');await page.keyboard.press('Control+y');assert len((await save())['terminalStrips'])==strips
  root=await cleanup();await expect(root.locator('[data-terminal-summary]')).to_contain_text('0 werden übernommen');await root.locator('[data-close]').click();assert (await save())['terminalStrips']==changed['terminalStrips'];assert not errors,errors
  print(json.dumps(dict(converted=converted,strips=strips,reviewTasks=len(report['terminalStructure']['issues']),unchangedDrawing=True,unchangedSource=True,undoRedo=True,idempotent=True,editorOpened=True)))
  await browser.close()
asyncio.run(main())
