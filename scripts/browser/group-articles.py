"""Regression for assembly article coverage in the actual inspection dialog."""
import asyncio
import copy
import json
import pathlib
import sys
from playwright.async_api import async_playwright, expect


def fixture():
    p=json.loads(pathlib.Path(__file__).with_name('cabinet-workspace.fixture.json').read_text())
    p['name']='Group article inspection'
    for i in ['a','b','outside']:
        p['pages'][0]['components'].append(dict(id=i,symbolId='circuit_breaker_1p',bmk='-'+i,
            functionText='',x=80+len(p['pages'][0]['components'])*90,y=100,rotation=0,pins={},articleRequirement='required'))
    p['pages'][0]['groups']=[dict(id='assembly',bmk='-A1',members=[dict(kind='component',id='a'),dict(kind='component',id='b')],
        articleAssignment=dict(mode='manual',items=[dict(articleNumber='ASSEMBLY-1',manufacturer='Synthetic',variant='',quantity=1,role='main')]))]
    return p


async def main():
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1500,'height':1050},locale='de-DE')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4198',wait_until='networkidle')
        await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
        async def open_report():
            await page.locator('#menuDataTrigger').click()
            await page.locator('#menuPlausibility').click()
            root=page.locator('#plausibilityModal')
            await expect(root.locator('#reviewRule')).to_be_visible()
            async with page.expect_download() as event:await root.locator('#btnExportPlaus').click()
            report=json.loads(pathlib.Path(await (await event.value).path()).read_text())
            return root,report
        async def inspect(p):
            await page.locator('#fileInput').set_input_files(dict(name='group-article-test.json',mimeType='application/json',buffer=json.dumps(p).encode()))
            await page.wait_for_function("name=>document.querySelector('#headerProjectName')?.textContent===name",arg=p['name'])
            return await open_report()
        p=fixture();root,report=await inspect(p)
        missing=[m['componentId'] for m in report['messages'] if m['ruleId']=='missing_article']
        assert missing==['outside'],missing
        inherited=[m for m in report['messages'] if m.get('componentId') in ['a','b']]
        assert inherited and all(m['articleData']['inheritedFromGroupId']=='assembly' for m in inherited)
        assert 'Artikel über Baugruppe -A1' in await root.inner_text()
        await root.locator('#reviewRule').select_option('missing_article')
        await expect(root.locator('.plaus-row[data-comp-id="a"]')).to_have_count(0)
        await expect(root.locator('.plaus-row[data-comp-id="outside"]')).to_have_count(1)
        await page.keyboard.press('Escape')
        unassigned=copy.deepcopy(p);unassigned['name']='Graphical group inspection'
        del unassigned['pages'][0]['groups'][0]['articleAssignment']
        del unassigned['pages'][0]['groups'][0]['bmk']
        root,report=await inspect(unassigned)
        missing=[m for m in report['messages'] if m['ruleId']=='missing_article']
        assert len(missing)==2
        group=next(m for m in missing if m.get('groupId')=='assembly')
        assert set(l['componentId'] for l in group['relatedLocations'])=={'a','b'}
        await root.locator('#reviewRule').select_option('missing_article')
        await expect(root.locator('.plaus-row[data-group-id="assembly"]')).to_have_count(1)
        await expect(root.locator('.plaus-row[data-comp-id="a"]')).to_have_count(0)
        await root.locator('[data-edit-group]').click()
        properties=page.locator('#propertiesModal')
        await expect(properties).to_be_visible()
        await expect(properties.locator('#propBmk')).to_have_value('')
        await properties.locator('[data-tab="part"]').click()
        await properties.locator('#propArticleNumber').fill('ASSEMBLY-NEW')
        await properties.locator('#btnSaveProp').click()
        root,report=await open_report()
        assert [m['componentId'] for m in report['messages'] if m['ruleId']=='missing_article']==['outside']
        assert not errors,errors
        await browser.close()
        print('Group inspection UI: assigned assembly coverage, unassigned group aggregation, preserved member evidence, direct group properties, article assignment and successful reinspection passed')


asyncio.run(main())
