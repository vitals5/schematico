"""Compact terminal placement and historical geometry in the actual editor."""
import asyncio
import json
import pathlib
import sys
from playwright.async_api import async_playwright, expect


def fixture(name):
    project=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text())
    project['name']=name
    return project


async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1600,'height':1050},locale='de-DE')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.add_init_script('delete window.showSaveFilePicker')
        await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
        await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")

        async def load(project):
            await page.locator('#fileInput').set_input_files(dict(name='terminals.json',mimeType='application/json',buffer=json.dumps(project).encode()))
            await page.wait_for_function('name=>document.querySelector("#headerProjectName")?.textContent===name',arg=project['name'])
            await page.locator('#btnZoomFit').click()

        async def save():
            async with page.expect_download() as event:await page.locator('#btnSaveJson').click()
            return json.loads(pathlib.Path(await (await event.value).path()).read_text())

        async def place(symbol_id,x,y):
            await page.locator('[data-tab="symbols"]').click()
            card=page.locator(f'[data-symbol-id="{symbol_id}"]')
            await expect(card).to_have_count(1)
            await expect(card.locator('svg')).to_have_attribute('viewBox','0 0 12 20')
            await card.click()
            point=await page.locator('#viewportTransform').evaluate('(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM()).toJSON()',dict(x=x,y=y))
            await page.mouse.click(point['x'],point['y'])
            await page.keyboard.press('Escape')

        await load(fixture('Compact terminals'))
        await place('terminal_single',160,120)
        await place('terminal_pe',240,120)
        components=page.locator('#componentsLayer > .component')
        await expect(components).to_have_count(2)
        for i in range(2):
            await expect(components.nth(i).locator('.selection-rect')).to_have_attribute('width','16')
            await expect(components.nth(i).locator('.selection-rect')).to_have_attribute('height','24')
        current=await save()
        assert current['symbolGeometryRevision']==1
        assert {c['symbolId'] for c in current['pages'][0]['components']}=={'terminal_single','terminal_pe'}
        assert all(c.get('scale',1)==1 for c in current['pages'][0]['components'])
        # A file round trip must not reclassify new compact terminals as old ones.
        current['name']='Compact roundtrip';await load(current)
        await expect(page.locator('#componentsLayer > .component .selection-rect').first).to_have_attribute('width','16')

        old=fixture('Historical terminals')
        for i,symbol_id in enumerate(['terminal_single','terminal_pe']):
            old['pages'][0]['components'].append(dict(id='old'+str(i),symbolId=symbol_id,bmk='-X1:'+str(i+1),functionText='',x=160+80*i,y=160,rotation=0,pins={},scale=[1,.5][i]))
        await load(old)
        await expect(page.locator('#old0 .selection-rect')).to_have_attribute('width','28')
        await expect(page.locator('#old0 .selection-rect')).to_have_attribute('height','44')
        await expect(page.locator('#old1 .selection-rect')).to_have_attribute('width','16')
        await expect(page.locator('#old1 .selection-rect')).to_have_attribute('height','24')
        # The old single terminal still has concealed pin labels and its special
        # terminal designation, rather than changing to generic-device labels.
        assert await page.locator('#old0 .pin text').count()==0
        await place('terminal_single',320,160)
        mixed=await save()
        assert all(':legacy-geometry' in c['symbolId'] for c in mixed['pages'][0]['components'][:2])
        assert [c['scale'] for c in mixed['pages'][0]['components'][:2]]==[1,.5]
        new=mixed['pages'][0]['components'][2]
        assert new['symbolId']=='terminal_single' and new.get('scale',1)==1
        await expect(page.locator('#'+new['id']+' .selection-rect')).to_have_attribute('width','16')
        # The old fabricated "1" must disappear for empty terminals. A real
        # designation must also obey the actual properties dialog checkbox.
        visibility=fixture('Terminal label visibility');visibility['symbolGeometryRevision']=1
        for i,field in enumerate(['functionText','deviceTag','technicalCharacteristics',None]):
            c=dict(id='label'+str(i),symbolId='terminal_single',bmk='',functionText='',x=160+80*i,y=160,rotation=0,pins={})
            if field:c[field]='1'
            visibility['pages'][0]['components'].append(c)
        await load(visibility)
        await expect(page.locator('#label3 text')).to_have_count(0)
        for i in range(3):await expect(page.locator(f'#label{i} [data-label="terminalDesignation"]')).to_have_text('1')
        for i,checkbox in [(0,'propFnVisible'),(1,'propTechVisible'),(2,'propTechVisible')]:
            point=await page.locator('#viewportTransform').evaluate('(e,p)=>new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM()).toJSON()',dict(x=166+80*i,y=170))
            await page.mouse.dblclick(point['x'],point['y'])
            dialog=page.locator('#propertiesModal')
            await expect(dialog).to_be_visible()
            await dialog.locator('[data-tab="display"]').click()
            await dialog.locator('#'+checkbox).uncheck()
            await dialog.locator('#btnSaveProp').click()
            await expect(page.locator(f'#label{i} [data-label="terminalDesignation"]')).to_have_count(0)
        await page.screenshot(path='/workspace/scratch/compact-terminals-editor.png')
        assert not errors,errors
        await browser.close()
        print('Compact terminals: 100% palette placement, roundtrip, preserved historical geometry and concealed pins; no invented 1, actual function/device/technical visibility controls passed')


asyncio.run(main())
