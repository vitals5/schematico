"""Chromium cleanup workflow. Pass URL and optionally a private project JSON path.
No uploaded project data is stored in this repository.
"""
import asyncio
import json
import pathlib
import sys
from playwright.async_api import async_playwright, expect


def fixture():
    p=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text())
    p['name']='Import cleanup regression'
    page=p['pages'][0]
    p['symbolLibrary']=[]
    for id,name,category,library,number,pins in [
        ('graphic','Projektgrafik','controls','SPECIAL',0,0),
        ('port','SPECIAL / DCP [17:0]','terminals','SPECIAL',17,1),
        ('terminal','IEC_symbol / X [30:0]','terminals','IEC_symbol',30,1),
        ('socket','IEC_symbol / XU [1169:0]','terminals','IEC_symbol',1169,1),
        ('box','Gerätekasten','structure','SPECIAL',0,0),
    ]:
        sid='native:graphic:test' if id=='graphic' else 'native:'+library+':'+str(number)+':0'
        p['symbolLibrary'].append(dict(id=sid,name=name,category=category,description='Synthetic',
            source=dict(library=library,number=number,variant=0),standard='DIN EN 60617',
            defaultBmkPrefix='',defaultFunctionText='',width=20,height=20,
            pins=[dict(id='0',name='1',x=10,y=0,direction='top')] if pins else [],
            svgContent='<rect width="20" height="20" fill="none" stroke="currentColor"/>',
            deviceBox=True if id=='box' else False))
        if id=='graphic':
            p['symbolLibrary'][-1]['importedGraphics']=[dict(kind='rect',x=0,y=0,width=20,height=20,color='currentColor',lineWidth=1)]
        page['components'].append(dict(id=id,symbolId=sid,x=50+len(page['components'])*60,y=100,
            rotation=0,bmk='-Q1' if id in ['port','box'] else '-X1' if id=='terminal' else '-X2' if id=='socket' else '',
            functionText='',source=dict(format='NATIVE_CAD',objectType=31 if id=='graphic' else 17,objectId=len(page['components'])+1),
            pins={'0':{'wireIds':[]}} if pins else {}))
    page['wires']=[
        {'id':'native_run_pair','from':{'componentId':'port','pinId':'0'},'to':{'componentId':'terminal','pinId':'0'},'potential':'Signal'}]
    p['logicalConnections']=[dict(page['wires'][0],id='native_logical_pair')]
    p['cabinetLayouts']=[dict(schemaVersion=1,id='cab'+str(i),name='Keep '+str(i),widthMm=300,heightMm=950,marginMm=10,gridMm=1,items=[]) for i in range(2)]
    return p


async def main():
    data=json.loads(pathlib.Path(sys.argv[2]).read_text()) if len(sys.argv)>2 else fixture()
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1550,'height':1050},locale='de-DE')
        page.set_default_timeout(120000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.add_init_script('delete window.showSaveFilePicker')
        await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
        await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
        await page.locator('#fileInput').set_input_files(dict(name='cleanup-regression.json',mimeType='application/json',buffer=json.dumps(data).encode()))
        await page.wait_for_function("name=>document.querySelector('#headerProjectName')?.textContent===name",arg=data['name'])
        async def saved():
            async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
            return json.loads(pathlib.Path(await (await event.value).path()).read_text())
        baseline=await saved()
        drawing=await page.locator('#canvasContainer > svg').evaluate('e=>e.innerHTML')
        async def open_cleanup():
            await page.locator('#menuProjectTrigger').click()
            await page.locator('#menuImportCleanup').click()
            root=page.locator('#importCleanupDialog')
            await expect(root.locator('[data-apply]')).to_be_enabled()
            return root
        root=await open_cleanup()
        await page.screenshot(path='/tmp/schematico-import-cleanup.png')
        assert await root.locator('[data-findings] tr').count()<=50
        async with page.expect_download() as event:await root.locator('[data-report]').click()
        report=json.loads(pathlib.Path(await (await event.value).path()).read_text())
        assert report['after']['navigator']<report['before']['navigator']
        assert report['after']['terminals']<report['before']['terminals']
        assert report['after']['connections']<report['before']['connections']
        assert report['source']['cabinets']==2
        await root.locator('[data-option="nativeRoles"]').uncheck()
        await expect(root.locator('[data-apply]')).to_be_disabled()
        await root.locator('[data-option="nativeRoles"]').check()
        await root.locator('[data-compute]').click()
        await expect(root.locator('[data-apply]')).to_be_enabled()
        await root.locator('[data-apply]').click()
        changed=await saved()
        for key in ['pages','symbolLibrary','logicalConnections','cabinetLayouts']:
            assert changed.get(key)==baseline.get(key),key+' changed during cleanup'
        assert changed['dataInterpretation']==report['profile']
        assert await page.locator('#canvasContainer > svg').evaluate('e=>e.innerHTML')==drawing,'Drawing SVG changed'
        await page.locator('#btnUndo').click()
        assert (await saved()).get('dataInterpretation')==baseline.get('dataInterpretation')
        await page.locator('#btnRedo').click()
        assert (await saved())['dataInterpretation']==report['profile']
        root=await open_cleanup()
        await root.locator('[data-filter]').select_option('device_candidate')
        if await root.locator('[data-articles]').count():
            await root.locator('[data-articles]').first.click()
            await expect(page.locator('#articleWorkbenchDialog')).to_be_visible()
            await page.keyboard.press('Escape')
        else:
            await root.locator('[data-close]').click()
        await page.locator('#menuProjectTrigger').click()
        await page.locator('#menuArticles').click()
        await expect(page.locator('#articleWorkbenchDialog [data-technical]')).to_be_visible()
        await page.locator('#articleWorkbenchDialog [data-technical]').check()
        await page.keyboard.press('Escape')
        root=await open_cleanup()
        cable_issues=[i for i in report['issues'] if i['kind']=='cable_core_count']
        if cable_issues:
            await root.locator('[data-filter]').select_option('cable_core_count')
            await root.locator('[data-cable]').first.click()
            await expect(page.locator('#wiringDialog [data-cable]')).to_have_value(
                json.dumps([cable_issues[0]['pageId'],cable_issues[0]['cableId']],separators=(',',':')))
        else:
            await root.locator('[data-wiring]').click()
        await expect(page.locator('#wiringDialog [data-terminal] option')).to_have_count(report['after']['terminals']+1)
        assert not errors,errors
        print(json.dumps(dict(before=report['before'],after=report['after'],cabinetItems=report['source']['cabinetItems'],
            preview=True,apply=True,unchangedDrawing=True,preservedSource=True,undoRedo=True,assignmentNavigation=True,technicalView=True,terminalEditor=True,cableNavigation=bool(cable_issues))))
        await browser.close()


asyncio.run(main())
