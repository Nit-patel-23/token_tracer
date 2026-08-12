import { chromium } from 'playwright';

const TOKEN = "eyJ1c2VySWQiOiJzdXBlcmFkbWluIiwidXNlcm5hbWUiOiJzdXBlcmFkbWluIiwiZGlzcGxheU5hbWUiOiJTdXBlciBBZG1pbiIsInJvbGUiOiJzdXBlcmFkbWluIiwibWVtYmVySWQiOm51bGwsInRlYW1JZCI6bnVsbCwiaXNzdWVkQXQiOjE3ODY1MTcwMDY1Njl9.Gw2y1QZab9yr7SECvnJB1liGlzGNlG6qdkTijJQpOgA";

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies([{ name: 'app_session', value: TOKEN, domain: 'localhost', path: '/' }]);
const page = await context.newPage();
page.on('console', msg => console.log('CONSOLE', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGEERROR', err.message));
await page.goto('http://localhost:3999/admin/research', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const mainHTML = await page.evaluate(() => document.querySelector('main')?.outerHTML?.slice(0, 500));
const mainVisible = await page.evaluate(() => {
  const m = document.querySelector('main');
  if (!m) return 'NO MAIN';
  const rect = m.getBoundingClientRect();
  const style = getComputedStyle(m);
  return JSON.stringify({ rect, display: style.display, visibility: style.visibility, opacity: style.opacity, color: style.color, bg: style.backgroundColor, childCount: m.children.length });
});
console.log('MAIN HTML:', mainHTML);
console.log('MAIN VISIBLE INFO:', mainVisible);
await page.screenshot({ path: '/private/tmp/claude-501/-Users-nitpatel-Coding-Paymore-tokens-tracking--agentvis-next/1ba31861-d331-4f71-971f-26ad6e413891/scratchpad/shot.png', fullPage: true });
await browser.close();
