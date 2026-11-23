"""Central terminal workspace: staged assembly/parts/bridges and one live commit."""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright,expect

def fixture(symbol_id,name):
 p=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text());p['name']=name;p['symbolGeometryRevision']=1
 p['pages'][0]['components']=[dict(id='subject',symbolId=symbol_id,bmk='-X1:7',functionText='',x=140,y=140,rotation=0,pins={},terminal=dict(strip='-X1',number='7',level='',pinSides={}),articleNumber='TERM-3',manufacturer='Synthetic',articleAssignment=dict(mode='manual',items=[dict(articleNumber='TERM-3',manufacturer='Synthetic',variant='',quantity=1,role='main')]))]
 second=json.loads(json.dumps(p['pages'][0]));second.update(id='p2',pageNumber='2',title='Other sheet',components=[],wires=[],location='+OTHER');p['pages'].append(second);return p

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox']);page=await browser.new_page(viewport={'width':1680,'height':1050},locale='de-DE');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('delete window.showSaveFilePicker');await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle');await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  root=page.locator('#terminalEditorDialog')
  async def load(p):
   await page.locator('#fileInput').set_input_files(dict(name='terminals.json',mimeType='application/json',buffer=json.dumps(p).encode()));await page.wait_for_function('name=>document.querySelector("#headerProjectName")?.textContent===name',arg=p['name']);await page.locator('#btnZoomFit').click()
  async def save():
   async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
   return json.loads(pathlib.Path(await (await event.value).path()).read_text())
  async def props(c):
   await page.locator('#btnZoomFit').click();await page.wait_for_timeout(150)
   pt=await page.locator('#viewportTransform').evaluate('(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM()).toJSON()',dict(x=c['x']+6,y=c['y']+10));await page.mouse.dblclick(pt['x'],pt['y']);await expect(page.locator('#propertiesModal')).to_be_visible()
  async def open_editor(c):
   await props(c);await page.locator('#propertiesModal [data-manage-terminals]').click();await expect(root).to_be_visible()
  async def apply():
   await root.locator('[data-review]').click();await expect(root.locator('[data-preview]')).to_be_visible();await root.locator('[data-apply]').click();await expect(root.locator('[data-apply]')).to_be_disabled()
  p=fixture('terminal_triple','Central distributed levels');await load(p);await open_editor(p['pages'][0]['components'][0])
  await expect(root.locator('[data-terminal-level]')).to_have_count(3)
  await root.locator('#terminal-number').fill('8');await root.locator('[data-tab="device"]').click()
  await expect(root.locator('[data-tab="function"]')).to_have_attribute('aria-selected','true');await expect(root.locator('[data-editor-error]')).to_contain_text('vormerken')
  await root.locator('[data-stage-function]').click();await root.locator('[data-tab="device"]').click();await root.locator('[data-split-main]').select_option('3');await root.locator('[data-split-levels]').click()
  await expect(root.locator('tr[data-address]')).to_have_count(3);await expect(page.locator('#componentsLayer > .component')).to_have_count(1)
  await root.locator('[data-undo]').click();await expect(root.locator('tr[data-address]')).to_have_count(1);await root.locator('[data-redo]').click();await expect(root.locator('tr[data-address]')).to_have_count(3)
  await page.screenshot(path='/workspace/scratch/terminal-editor-assembly.png')
  await apply();await expect(page.locator('#componentsLayer > .component')).to_have_count(3);await root.locator('[data-close]').click()
  saved=await save();main=next(c for c in saved['pages'][0]['components'] if c['id']=='subject');secondary=next(c for c in saved['pages'][0]['components'] if c['terminal']['level']=='1');assert main['bmk']=='-X1:8'
  await page.keyboard.press('Control+z');await expect(page.locator('#componentsLayer > .component')).to_have_count(1);await page.keyboard.press('Control+y');await expect(page.locator('#componentsLayer > .component')).to_have_count(3)
  # Parts from any secondary use the same central editor and shared article owner.
  await props(secondary);await page.locator('#propertiesModal [data-tab="part"]').click();await expect(page.locator('#propertiesModal #propArticleNumber')).to_have_count(0);await page.locator('#propertiesModal [data-manage-articles]').click();await expect(root.locator('[data-tab="article"]')).to_have_attribute('aria-selected','true');await expect(root.locator('.te-details')).to_contain_text('TERM-3')
  await root.locator('[data-article-quantity="0"]').fill('2');await root.locator('[data-stage-quantities]').click();await expect(root.locator('[data-article-quantity="0"]')).to_have_value('2');await root.locator('[data-undo]').click();await expect(root.locator('[data-article-quantity="0"]')).to_have_value('1')
  await root.locator('[data-tab="device"]').click();await root.locator('[data-main-target]').select_option(json.dumps(['p',secondary['id']],separators=(',',':')));await root.locator('[data-main]').click()
  await root.locator('summary').filter(has_text='anderes Blatt').click();await root.locator('[data-target-page]').select_option('p2');await root.locator('[data-field="target-x"]').fill('240');await root.locator('[data-field="target-y"]').fill('220');await root.locator('[data-move]').click();await apply();await root.locator('[data-close]').click()
  saved=await save();assert len(saved['pages'][1]['components'])==1 and saved['pages'][1]['components'][0]['id']==secondary['id'];assert saved['physicalDevices'][0]['main']['pageId']=='p2'
  # Closing a changed draft requires an explicit discard, and never changes live CAD.
  p=fixture('terminal_feed_4','Central partials');await load(p);await open_editor(p['pages'][0]['components'][0]);await root.locator('[data-tab="device"]').click();await root.locator('[data-split-parts]').click();await root.locator('[data-close]').click();await expect(root.locator('[data-discard-close]')).to_be_visible();await root.locator('[data-keep]').click();await expect(page.locator('#componentsLayer > .component')).to_have_count(1);await apply();await expect(page.locator('#componentsLayer > .component')).to_have_count(4);await root.locator('[data-close]').click()
  saved=await save();assert len(saved['distributedTerminalFunctions'][0]['placements'])==4;assert len(saved['physicalDevices'])==1
  # Dirty inputs survive a denied close, including cancel-without-saving.
  await open_editor(saved['pages'][0]['components'][0]);await root.locator('#terminal-number').fill('99');await root.locator('[data-close]').click();await root.locator('[data-keep]').click();await expect(root.locator('#terminal-number')).to_have_value('99');await root.locator('[data-close]').click();await root.locator('[data-discard-close]').click();check=await save();assert all(c['bmk']=='-X1:7' for c in check['pages'][0]['components'])
  # Bridges and physical accessory positions share the same staged draft.
  p=fixture('terminal_single','Central bridges and accessories');other=dict(p['pages'][0]['components'][0]);other.update(id='other',bmk='-X1:8',x=300,terminal=dict(strip='-X1',number='8',level='',pinSides={}));p['pages'][0]['components'].append(other)
  await load(p);await page.locator('#menuProjectTrigger').click();await page.locator('#menuTerminalEditor').click();await expect(root).to_be_visible()
  await root.locator('[data-tab="bridges"]').click()
  await root.locator('[data-bridge-from]').select_option(json.dumps(dict(pageId='p',componentId='subject',pinId='2'),separators=(',',':')))
  await root.locator('[data-bridge-to]').select_option(json.dumps(dict(pageId='p',componentId='other',pinId='1'),separators=(',',':')))
  await root.locator('[data-stage-bridge]').click();await expect(root.locator('[data-remove-bridge]')).to_have_count(1)
  await root.locator('[data-tab="device"]').click();await root.locator('summary').filter(has_text='Zubehör hinzufügen').click()
  for name,value in [('accessory-description','End bracket'),('accessory-number','END-1'),('accessory-manufacturer','Synthetic'),('accessory-quantity','2')]:await root.locator(f'[data-field="{name}"]').fill(value)
  await root.locator('[data-stage-accessory]').click();await root.locator('[data-rail-position]').filter(has_text='End bracket').click()
  await expect(root.locator('.te-context')).to_contain_text('End bracket');await expect(root.locator('[data-tab="function"]')).to_be_disabled()
  await root.locator('[data-review]').click();await expect(root.locator('[data-preview]')).to_contain_text('Brücke');await expect(root.locator('[data-preview]')).to_contain_text('END-1')
  async with page.expect_download() as event:await root.locator('[data-export]').click()
  exported=pathlib.Path(await (await event.value).path()).read_text();assert 'END-1' in exported and 'quantity' in exported
  await root.locator('[data-apply]').click();await root.locator('[data-close]').click();saved=await save()
  assert len(saved['logicalConnections'])==1 and saved['logicalConnections'][0]['terminalBridge']=='plug'
  assert saved['terminalStrips'][0]['positions'][-1]['article']['quantity']==2
  # A large strip is paged, but search still reaches every terminal.
  large=fixture('terminal_single','Large central strip');base=large['pages'][0]['components'][0];large['pages'][0]['components']=[]
  for i in range(220):
   c=json.loads(json.dumps(base));c.update(id='t'+str(i),bmk='-X1:'+str(i+1),terminal=dict(strip='-X1',number=str(i+1),level='',pinSides={}));large['pages'][0]['components'].append(c)
  await load(large);await page.locator('#menuProjectTrigger').click();await page.locator('#menuTerminalEditor').click();await expect(root.locator('tr[data-address]')).to_have_count(100)
  await root.locator('[data-search]').fill('-X1:220');await expect(root.locator('tr[data-address]')).to_have_count(1);await expect(root.locator('[data-grid]')).to_contain_text('220')
  checkbox=root.locator('[data-grid] input[data-check]');await checkbox.focus();await page.keyboard.press('Space');await expect(root.locator('[data-grid] input[data-check]')).to_be_checked();await expect(root.locator('[data-tab="device"]')).to_have_attribute('aria-selected','true')
  await root.locator('[data-close]').click()
  assert not errors,errors;await browser.close();print('Central terminal UI: common entry points, dirty-edit guard, composed preview, local and application undo, main-owned parts, cross-sheet movement, partial functions, explicit discard and persistence passed')
asyncio.run(main())
