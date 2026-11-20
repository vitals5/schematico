"""Real Chromium regression for cabinet zoom. Pass a dev or deployment URL."""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright, expect


async def exercise(browser, url, width, height):
    page = await browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.add_init_script("delete window.showSaveFilePicker")
    await page.goto(url, wait_until="networkidle")
    await page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove())")
    await page.locator("#fileInput").set_input_files(str(
        pathlib.Path(__file__).with_name("cabinet-workspace.fixture.json")))
    await page.wait_for_function("document.querySelector('#headerProjectName')?.textContent==='Cabinet library check'")
    await page.locator("#btnCabinetWorkspace").click()
    root = page.locator("#cabinetLayoutDialog")
    svg = root.locator(".cb-svg")
    canvas = root.locator(".cb-canvas")

    async def size():
        return await svg.evaluate("e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})")

    async def fitted():
        await root.locator("[data-lens-fit]").click()
        await page.wait_for_timeout(80)
        result = await canvas.evaluate("""e=>{
          const s=e.querySelector('svg').getBoundingClientRect();
          return {width:s.width,height:s.height,availableWidth:e.clientWidth-24,
            availableHeight:e.clientHeight-24,x:e.scrollLeft,y:e.scrollTop};
        }""")
        assert result['width'] <= result['availableWidth'] + 1, result
        assert result['height'] <= result['availableHeight'] + 1, result
        assert result['x'] == result['y'] == 0, result

    # Even an empty sheet must fit; object-only bounds cannot implement this.
    await fitted()
    await root.locator("[data-meter-open]").click()
    await root.locator("[data-meter-fields]").select_option("7")
    await root.locator("[data-meter-create]").click()
    await root.locator("[data-apply]").click()
    await expect(svg).to_have_attribute("viewBox", "0 0 1800 1100")
    await root.locator("[data-lens-reset]").click()
    original = await size()
    await root.locator("[data-lens-in]").click()
    await expect(root.locator("[data-lens-scale]")).to_have_text("150%")
    bigger = await size()
    assert abs(bigger['width'] / original['width'] - 1.5) < .01, (original, bigger)
    await root.locator("[data-lens-out]").click()
    assert abs((await size())['width'] - original['width']) < 1

    # Real wheel zoom must keep the sheet point under the pointer, also with Ctrl.
    await root.locator("[data-lens-in]").click()
    await root.locator("[data-lens-in]").click()
    await canvas.scroll_into_view_if_needed()
    await canvas.evaluate("e=>{e.scrollLeft=100;e.scrollTop=60}")
    box = await canvas.bounding_box()
    pointer = dict(x=box['x'] + min(160, box['width']/2),
                   y=box['y'] + min(130, box['height']/2))
    async def sheet_point():
        return await svg.evaluate("(e,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM().inverse());return {x:q.x,y:q.y}}", pointer)
    await page.mouse.move(**pointer)
    for ctrl in [False, True]:
        before = await sheet_point()
        previous = await size()
        if ctrl:
            await page.keyboard.down("Control")
        await page.mouse.wheel(0, -120)
        await page.wait_for_timeout(120)
        if ctrl:
            await page.keyboard.up("Control")
        after = await sheet_point()
        assert (await size())['width'] > previous['width'], (ctrl, previous, await size())
        assert abs(before['x'] - after['x']) < 2 and abs(before['y'] - after['y']) < 2, (ctrl, before, after)
    # Selecting/editing rebuilds the SVG and must retain its actual magnification.
    zoomed = await size()
    await root.locator("[data-add-duct]").click()
    assert abs((await size())['width'] - zoomed['width']) < 1
    await root.locator("[data-undo]").click()
    await fitted()
    await fitted()  # repeat fit must be stable
    await root.locator("[data-lens-reset]").click()
    assert abs((await size())['width'] - original['width']) < 1
    async with page.expect_download() as event:
        await root.locator("[data-svg]").click()
    exported = pathlib.Path(await (await event.value).path()).read_text()
    assert 'width="1800mm"' in exported and 'height="1100mm"' in exported
    assert not errors, errors
    await page.close()
    print(f"Cabinet zoom {width}x{height}: actual geometry, wheel anchor, fit empty/full sheet, rerender, reset and export passed", flush=True)


async def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4198"
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            await exercise(browser, url, 1600, 1050)
            await exercise(browser, url, 600, 900)
        finally:
            await browser.close()


asyncio.run(main())
