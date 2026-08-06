const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));
  
  await page.goto('http://localhost:3000/admin');
  
  // Login if needed
  if (await page.$('#login-username')) {
    await page.fill('#login-username', 'superadmin');
    await page.fill('#login-password', 'Super@123');
    await page.click('#login-submit');
    await page.waitForNavigation();
  }
  
  // Wait for the table to populate
  await page.waitForSelector('.impersonate-btn');
  
  // Accept the dialog automatically
  page.on('dialog', async dialog => {
    logs.push(`[DIALOG] ${dialog.message()}`);
    await dialog.accept();
  });
  
  // Click the first impersonate button
  await page.click('.impersonate-btn:first-of-type');
  
  // Wait for potential redirect or network activity
  await page.waitForTimeout(3000);
  
  console.log('Final URL:', page.url());
  console.log('Logs:\\n', logs.join('\\n'));
  
  await browser.close();
})();
