"""Import an external native backup through the actual browser worker and editor.
Usage: python scripts/browser/native-backup-import.py URL BACKUP [EXPECTED_JSON]
Private backups and expected project data are never stored in the repository.
"""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright,expect
async def main():
 backup=pathlib.Path(sys.argv[2]);expected=json.loads(pathlib.Path(sys.argv[3]).read_text()) if len(sys.argv)>3 else None
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--no-sandbox']);page=await browser.new_page(viewport={'width':1600,'height':1100},locale='de-DE');page.set_default_timeout(180000);errors=[];dialogs=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def dialog(d):dialogs.append(d.message);await d.accept()
  page.on('dialog',dialog);await page.add_init_script('delete window.showSaveFilePicker');await page.goto(sys.argv[1],wait_until='networkidle');await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
  await page.locator('#fileInput').set_input_files(backup)
  await page.wait_for_function("document.querySelectorAll('#componentsLayer .component').length>0",timeout=180000)
  assert not dialogs,dialogs
  await page.screenshot(path='/workspace/scratch/native-backup-import.png')
  async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
  project=json.loads(pathlib.Path(await (await event.value).path()).read_text());symbols={s['id']:s for s in project['symbolLibrary']};active=next(p for p in project['pages'] if p['id']==project['activePageId'])
  assert active['components'],'Import opened an empty report page'
  assert not any(s.get('unresolved') for s in symbols.values()),'Embedded symbols were not resolved'
  for p in project['pages']:
   cs={c['id']:c for c in p['components']};assert len(cs)==len(p['components'])
   for c in cs.values():assert c['symbolId'] in symbols
   for w in p['wires']:
    for a in [w['from'],w['to']]:assert a['componentId'] in cs and a['pinId'] in cs[a['componentId']]['pins'] and any(pin['id']==a['pinId'] for pin in symbols[cs[a['componentId']]['symbolId']]['pins'])
  if expected:
   assert len(project['pages'])==len(expected['pages']);assert len(symbols)==len(expected['symbolLibrary'])
   assert sum(len(p['components']) for p in project['pages'])==sum(len(p['components']) for p in expected['pages'])
   assert sum(len(p['wires']) for p in project['pages'])==sum(len(p['wires']) for p in expected['pages'])
  await page.locator('#componentsLayer .component:visible').first.dblclick(force=True);await expect(page.locator('#propertiesModal')).to_be_visible();await page.keyboard.press('Escape');assert not errors,errors
  print(json.dumps(dict(pages=len(project['pages']),components=sum(len(p['components']) for p in project['pages']),wires=sum(len(p['wires']) for p in project['pages']),library=len(symbols),articles=len(project.get('importedArticleLibrary',[])),active=active['title'],browserWorker=True,validEndpoints=True,editable=True,noConsoleErrors=True)))
  await browser.close()
asyncio.run(main())
