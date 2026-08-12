import { chromium } from 'playwright';
const TOKEN = "eyJ1c2VySWQiOiJzdXBlcmFkbWluIiwidXNlcm5hbWUiOiJzdXBlcmFkbWluIiwiZGlzcGxheU5hbWUiOiJTdXBlciBBZG1pbiIsInJvbGUiOiJzdXBlcmFkbWluIiwibWVtYmVySWQiOm51bGwsInRlYW1JZCI6bnVsbCwiaXNzdWVkQXQiOjE3ODY1MTcwMDY1Njl9.Gw2y1QZab9yr7SECvnJB1liGlzGNlG6qdkTijJQpOgA";
const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies([{ name: 'app_session', value: TOKEN, domain: 'localhost', path: '/' }]);
const page = await context.newPage();
await page.goto('http://localhost:3999/admin/research', { waitUntil: 'networkidle' });
const info = await page.evaluate(() => {
  const header = document.querySelector('header');
  const nav = document.querySelector('nav');
  const outer = document.querySelector('header')?.parentElement;
  const rects = {};
  for (const [name, el] of [['header', header], ['nav', nav], ['outer', outer]]) {
    if (!el) { rects[name] = 'MISSING'; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    rects[name] = { rect: {top:r.top,bottom:r.bottom,height:r.height}, className: el.className, position: cs.position, display: cs.display, minHeight: cs.minHeight, height: cs.height };
  }
  return rects;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
