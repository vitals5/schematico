"""Real Chromium pointer regression. Run against a running dev/preview server.

python -m pip install playwright && python -m playwright install chromium
python scripts/test-cabinet-pointer.py --url http://127.0.0.1:5173

CDP touch gestures exercise native scroll arbitration; synthetic PointerEvents
alone cannot detect the pointercancel bug this test guards against.
"""
import argparse
import asyncio
import json
from playwright.async_api import async_playwright, expect


def fixture():
    def item(id, kind, x, y, w, h, **extra):
        return dict(id=id, kind=kind, label=id, x=x, y=y, widthMm=w,
                    heightMm=h, rotation=0, clearanceMm=0, **extra)
    return dict(
        id='cabinet-pointer', name='Cabinet pointer regression', description='',
        standard='DIN EN 81346-2 / IEC 60617', version='1', created='', modified='',
        author='', company='', drawingUnitsPerMm=2, activePageId='p',
        pages=[dict(id='p', pageNumber='1', pageType='schematic', title='Circuit',
                    higherLevel='', location='', wires=[], components=[dict(
                        id='source', symbolId='contactor_coil', bmk='-K1',
                        functionText='', x=30, y=30, rotation=0,
                        pins={'A1': {'wireIds': []}, 'A2': {'wireIds': []}})],
                    plotFrame=dict(type='DIN_A3_LANDSCAPE', width=840, height=594,
                                   columns=10, rows=['A'], titleBlock=dict(
                                       projectTitle='', commission='', company='',
                                       author='', date='', revision='', sheetNumber='1', totalSheets='1')))],
        cabinetLayouts=[dict(schemaVersion=1, id='plate', name='Pointer test',
                             widthMm=600, heightMm=800, marginMm=10, gridMm=5, items=[
                                 item('rail', 'rail', 60, 150, 480, 35),
                                 item('duct', 'duct', 10, 10, 40, 780),
                                 item('free', 'standard', 300, 250, 72, 90,
                                      standardId='rcd-4p', sizeOrigin='standard'),
                                 item('mounted', 'standard', 80, 122.5, 18, 90,
                                      standardId='mcb-1p', sizeOrigin='standard', railId='rail'),
                                 item('linked', 'device', 140, 122.5, 36, 90,
                                      source={'pageId': 'p', 'componentId': 'source'},
                                      sizeOrigin='manual', railId='rail')])])


async def exercise(browser, url, mobile):
    page = await browser.new_page(viewport={'width': 430 if mobile else 1680,
                                          'height': 920 if mobile else 1100},
                                  has_touch=True, locale='de-DE')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.route('https://raw.githubusercontent.com/**', lambda r: r.abort())
    await page.goto(url, wait_until='networkidle')
    await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
    await page.locator('#fileInput').set_input_files(dict(
        name='cabinet-pointer.json', mimeType='application/json',
        buffer=json.dumps(fixture()).encode()))
    await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent.includes('Cabinet pointer regression')")

    async def open_board():
        if not await page.locator('#menuProjectTrigger').is_visible():
            await page.locator('#btnCompactMenu').click()
        await page.locator('#menuProjectTrigger').click()
        await page.locator('#menuCabinetLayout').click()
        return page.locator('#cabinetLayoutDialog')

    root = await open_board()
    cdp = await page.context.new_cdp_session(page)
    await page.evaluate("""() => {
      window.__cabinetPointers=[];
      for(const name of ['pointerdown','pointercancel','pointerup'])
        document.addEventListener(name,e=>{
          if(e.target.closest?.('.cb-svg')) window.__cabinetPointers.push({name,type:e.pointerType,id:e.pointerId});
        },true);
    }""")

    async def value(key):
        return float(await root.locator('[data-item="'+key+'"]').input_value())

    async def position(x, y):
        await expect(root.locator('[data-item="x"]')).to_have_value(str(x))
        await expect(root.locator('[data-item="y"]')).to_have_value(str(y))

    async def view():
        return await root.locator('.cb-canvas').evaluate('(e)=>({x:e.scrollLeft,y:e.scrollTop})')

    async def start(id, mode):
        node = root.locator('[data-cabinet-item="'+id+'"]')
        await node.scroll_into_view_if_needed()
        point = await node.evaluate("""el => {
          const body=el.querySelector(':scope > rect'), b=body.getBoundingClientRect();
          let left=b.left,right=b.right,top=b.top,bottom=b.bottom;
          for(let p=el.parentElement;p;p=p.parentElement) {
            const s=getComputedStyle(p),r=p.getBoundingClientRect();
            if(/auto|scroll|hidden/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}
            if(/auto|scroll|hidden/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}
          }
          return {x:el.dataset.cabinetItem==='rail'?right-15:(left+right)/2,y:(top+bottom)/2,
                  scale:b.width/Number(body.getAttribute('width'))};
        }""")
        await page.evaluate('window.__cabinetPointers=[]')
        x, y = point['x'], point['y']
        if mode == 'touch':
            await cdp.send('Input.dispatchTouchEvent', dict(type='touchStart', touchPoints=[dict(x=x, y=y)]))
        elif mode == 'pen':
            await cdp.send('Input.dispatchMouseEvent', dict(type='mousePressed',x=x,y=y,button='left',buttons=1,pointerType='pen'))
        else:
            await page.mouse.move(x, y)
            await page.mouse.down(button='middle' if mode=='middle' else 'left')
        return point

    async def move(point, dx, dy, mode):
        for step in range(1, 6):
            x, y = point['x']+dx*step/5, point['y']+dy*step/5
            if mode == 'touch':
                await cdp.send('Input.dispatchTouchEvent', dict(type='touchMove', touchPoints=[dict(x=x, y=y)]))
            elif mode == 'pen':
                await cdp.send('Input.dispatchMouseEvent', dict(type='mouseMoved',x=x,y=y,buttons=1,pointerType='pen'))
                await page.evaluate('(p)=>{window.__penX=p.x;window.__penY=p.y}',dict(x=x,y=y))
            else:
                await page.mouse.move(x, y)
            await page.wait_for_timeout(20)

    async def end(mode):
        if mode == 'touch':
            await cdp.send('Input.dispatchTouchEvent', dict(type='touchEnd', touchPoints=[]))
        elif mode == 'pen':
            point=await page.evaluate('({x:window.__penX,y:window.__penY})')
            await cdp.send('Input.dispatchMouseEvent', dict(type='mouseReleased',**point,button='left',buttons=0,pointerType='pen'))
        else:
            await page.mouse.up(button='middle' if mode=='middle' else 'left')

    for mode in ['mouse', 'touch', 'pen']:
        for id, x, y, dx, dy in [('free',300,250,20,20), ('mounted',80,122.5,20,20),
                                ('linked',140,122.5,20,20), ('rail',60,150,10,20),
                                ('duct',10,10,5,0)]:
            point = await start(id, mode)
            await move(point, dx*point['scale'], dy*point['scale'], mode)
            await end(mode)
            await position(x+dx, y if id in ['mounted','linked'] else y+dy)
            events = await page.evaluate('window.__cabinetPointers')
            assert not any(e['name']=='pointercancel' for e in events), (mode,id,events)
            assert any(e['name']=='pointerup' and e['type']==mode for e in events), (mode,id,events)
            await expect(root.locator('[data-apply]')).to_be_enabled()
            if id=='rail':
                await root.locator('[data-cabinet-item="mounted"]').click()
                await position(90,142.5)
                await root.locator('[data-cabinet-item="linked"]').click()
                await position(150,142.5)
            await root.locator('[data-undo]').click()
            await expect(root.locator('[data-undo]')).to_be_disabled()

    # A cancelled system gesture must not commit the visual preview.
    point = await start('free','touch')
    await move(point,20,20,'touch')
    await cdp.send('Input.dispatchTouchEvent',dict(type='touchCancel',touchPoints=[]))
    await position(300,250)
    await expect(root.locator('[data-undo]')).to_be_disabled()

    # Losing capture (e.g. leaving the window) must discard the unfinished drag.
    point = await start('free','mouse')
    await move(point,10,10,'mouse')
    await root.locator('.cb-svg').evaluate('(e)=>e.releasePointerCapture(window.__cabinetPointers[0].id)')
    await page.mouse.move(point['x']+12,point['y']+12)
    await end('mouse')
    await position(300,250)
    await expect(root.locator('[data-undo]')).to_be_disabled()

    # Real scrolling must survive lens updates and drag-end DOM reconstruction.
    await root.locator('[data-lens-in]').click()
    await root.locator('[data-lens-in]').click()
    await expect(root.locator('[data-lens-scale]')).to_have_text('200%')
    await root.locator('.cb-canvas').evaluate('(e)=>{e.scrollLeft=100;e.scrollTop=100}')
    await page.wait_for_timeout(250)
    assert await view()=={'x':100,'y':100}, await view()
    for mode in ['mouse','touch']:
        point=await start('free',mode)
        previous=await view()
        await move(point,20*point['scale'],20*point['scale'],mode)
        await end(mode)
        await position(320,270)
        await page.wait_for_timeout(150)
        assert await view()==previous, (mode,previous,await view())
        await root.locator('[data-undo]').click()

    # Blank-sheet touch panning stays available without changing objects/history.
    await root.locator('.cb-canvas').scroll_into_view_if_needed()
    await root.locator('.cb-canvas').evaluate('(e)=>{e.scrollLeft=100;e.scrollTop=100}')
    blank=await root.locator('.cb-canvas').evaluate("""el=>{
      const b=el.getBoundingClientRect();
      for(let y=Math.max(0,b.top)+25;y<Math.min(innerHeight,b.bottom)-25;y+=20)
        for(let x=Math.max(0,b.left)+25;x<Math.min(innerWidth,b.right)-25;x+=20) {
          const n=document.elementFromPoint(x,y);
          if(n?.closest('.cb-svg')&&!n.closest('[data-cabinet-item]'))return {x,y};
        }
      throw Error('No visible blank sheet position');
    }""")
    await cdp.send('Input.dispatchTouchEvent',dict(type='touchStart',touchPoints=[blank]))
    await move(blank,25,25,'touch')
    await end('touch')
    assert (await view())['x']<100 and (await view())['y']<100, await view()
    await expect(root.locator('[data-undo]')).to_be_disabled()

    point=await start('free','middle')
    previous=await view()
    await move(point,20,20,'middle')
    await end('middle')
    assert await view()!=previous, (previous,await view())
    await expect(root.locator('[data-undo]')).to_be_disabled()

    # Save and reopen through the public app UI; global undo restores the board.
    point=await start('free','touch')
    await move(point,20*point['scale'],20*point['scale'],'touch')
    await end('touch')
    await position(320,270)
    await root.locator('[data-apply]').click()
    await root.locator('[data-close]').click()
    root=await open_board()
    await root.locator('[data-cabinet-item="free"]').click()
    await position(320,270)
    await root.locator('[data-close]').click()
    await page.keyboard.press('Control+z')
    root=await open_board()
    await root.locator('[data-cabinet-item="free"]').click()
    await position(300,250)
    assert not errors, errors
    print(json.dumps(dict(mobile=mobile,mouse=True,touch=True,pen=True,allObjectKinds=True,
                         railChildren=True,cancelAndCaptureLoss=True,zoomScroll=True,
                         blankPanning=True,saveUndo=True,errors=errors)),flush=True)
    await page.close()


async def main():
    args=argparse.ArgumentParser()
    args.add_argument('--url',default='http://127.0.0.1:5173')
    url=args.parse_args().url
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
        try:
            await exercise(browser,url,False)
            await exercise(browser,url,True)
        finally:
            await browser.close()

if __name__=='__main__':
    asyncio.run(main())
