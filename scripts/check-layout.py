"""Layout check on phone, tablet and computer, for every page of the demo.

Serves public/ locally, opens each page at three sizes in headless Chrome and reports:
  - horizontal overflow (the page wider than the screen) and the elements that cause it,
  - script errors.
It also saves screenshots and one contact sheet per page into a folder (default /tmp/layout).

Run before every change to the look:  python3 scripts/check-layout.py [out_dir]
Needs: python3 with playwright and Pillow, and Google Chrome (or set CHROME=/path).
"""
import asyncio, os, sys, subprocess, time
from playwright.async_api import async_playwright
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/layout'
PORT = 8799
SIZES = [('phone', 375, 812, True), ('tablet', 820, 1180, True), ('desktop', 1440, 900, False)]
THEMES = [('opal', 'mta'), ('amber', 'terasa'), ('cobalt', 'zghva'), ('alba', 'dzveli'), ('jade', 'nino')]
PAGES = [('home', 'index.html?lang=ka'), ('owners', 'owners.html?lang=ka'), ('privacy', 'privacy.html?lang=ka'), ('terms', 'terms.html?lang=ru')] + \
        [(f'hotel-{t}', f'hotel.html?h={h}&theme={t}') for t, h in THEMES] + [('admin', 'admin.html?h=mta')] + \
        [('home-ru', 'index.html?lang=ru'), ('owners-ru', 'owners.html?lang=ru')] + \
        [(f'long-{t}', f'hotel.html?h=test-long&theme={t}&lang=ru') for t, _ in THEMES]  # longest names, Russian

OVERFLOW_JS = """() => {
  const W = document.documentElement.clientWidth, out = [];
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || cs.position === 'fixed' || e.closest('[hidden]')) continue;
    if (r.right > W + 1 || r.left < -1) {
      let p = e.parentElement, clipped = false;
      while (p) { const s = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  }
  return { over: document.documentElement.scrollWidth - W, items: [...new Set(out)].slice(0, 6) };
}"""


async def main():
    os.makedirs(OUT, exist_ok=True)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    problems = 0
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'))
            for name, url in PAGES:
                shots = []
                for size, w, h, mobile in SIZES:
                    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile)
                    pg = await ctx.new_page(); errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    await pg.goto(f'http://localhost:{PORT}/{url}', wait_until='load')
                    await pg.wait_for_timeout(700)
                    if name == 'admin':
                        # the browser preview opens the admin directly; a PIN screen only if one is shown
                        await pg.wait_for_timeout(900)
                        if await pg.is_visible('#pin'):
                            await pg.fill('#pin', '1234'); await pg.click('#gateBtn'); await pg.wait_for_timeout(900)
                    await pg.add_style_tag(content='.demo{display:none!important}')
                    r = await pg.evaluate(OVERFLOW_JS)
                    path = f'{OUT}/{name}-{size}.png'
                    await pg.screenshot(path=path)
                    shots.append(path)
                    bad = r['over'] > 0 or r['items'] or errs
                    problems += bool(bad)
                    print(f"{'✗' if bad else '✓'} {name:16} {size:8} overflow {r['over']:>4}px  {'; '.join(r['items'])}  {'; '.join(errs)}")
                    await ctx.close()
                # contact sheet: the three sizes side by side, same height
                ims = [Image.open(s) for s in shots]
                H = 900
                ims = [im.resize((int(im.width * H / im.height), H)) for im in ims]
                sheet = Image.new('RGB', (sum(i.width for i in ims) + 20 * (len(ims) - 1), H), 'white')
                x = 0
                for im in ims: sheet.paste(im, (x, 0)); x += im.width + 20
                sheet.save(f'{OUT}/sheet-{name}.png')
            await b.close()
    finally:
        srv.terminate()
    print(f'\n{problems} problem(s). Screenshots and sheets in {OUT}')
    sys.exit(1 if problems else 0)

asyncio.run(main())
