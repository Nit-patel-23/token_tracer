const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));
  
  await page.goto('http://localhost:3000/admin');
  
  if (await page.$('#login-username')) {
    await page.fill('#login-username', 'superadmin');
    await page.fill('#login-password', 'Super@123');
    await page.click('#login-submit');
    await page.waitForNavigation();
  }
  
  await page.waitForSelector('.impersonate-btn');
  
  page.on('dialog', async dialog => {
    logs.push(`[DIALOG] ${dialog.message()}`);
    await dialog.accept();
  });
  
  await page.click('.impersonate-btn:first-of-type');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');
  logs.push(`Redirected to: ${page.url()}`);
  
  // Check if banner exists and is visible
  const banner = await page.$('#impersonation-banner');
  const isHidden = await banner.evaluate(node => node.hidden);
  logs.push(`Banner hidden attribute: ${isHidden}`);
  
  // Wait a bit to ensure impersonation.js runs
  await page.waitForTimeout(2000);
  
  const isHiddenAfter = await banner.evaluate(node => node.hidden);
  logs.push(`Banner hidden attribute after wait: ${isHiddenAfter}`);
  
  if (!isHiddenAfter) {
    logs.push(`Clicking return button`);
    await page.click('#impersonation-back-btn');
    await page.waitForURL('**/admin', { timeout: 5000 }).catch(e => logs.push(`Return timeout: ${e.message}`));
    logs.push(`Final URL after return: ${page.url()}`);
  }
  
  console.log('Logs:\\n', logs.join('\\n'));
  
  await browser.close();
})();
