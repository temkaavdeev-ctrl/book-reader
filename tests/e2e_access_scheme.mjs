#!/usr/bin/env node
// Guest/login surfaces against the real HTML + shim. Requires playwright.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

function mime(p) {
  return TYPES[extname(p)] || 'application/octet-stream';
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/landing.html';
  if (rel === '/vendor/supabase.min.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
    res.end(readFileSync(join(ROOT, 'tests/shim-supabase.js')));
    return;
  }
  const file = join(ROOT, rel.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mime(file) });
  res.end(readFileSync(file));
});

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    try { playwright = await import('playwright-core'); }
    catch (e2) {
      console.log('e2e_access_scheme: skip (no playwright)');
      process.exit(0);
    }
  }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const browser = await playwright.chromium.launch({ args: ['--no-sandbox'], channel: 'chrome' }).catch(() =>
    playwright.chromium.launch({ args: ['--no-sandbox'] })
  );
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript({ path: join(ROOT, 'tests/shim-supabase.js') });
  await ctx.addInitScript(() => {
    window.__FIX = { rpc: { invite_info: { valid: false, reason: 'notfound' }, is_member: false } };
    window.__SESSION = null;
  });

  const fails = [];
  async function check(path, expect) {
    const page = await ctx.newPage();
    await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const text = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
    for (const needle of expect) {
      if (!text.includes(needle)) fails.push(`${path} missing «${needle}»`);
    }
    if (/auth\/v1\/authorize/.test(await page.content())) fails.push(`${path} leaked raw authorize URL`);
    await page.close();
    return text;
  }

  await check('/landing.html', ['Войти', 'Фундамент']);
  const loginText = await check('/access.html?view=login', ['Войти через ar1adna']);
  if (/Войти по почте/.test(loginText) && !/Почта, если аккаунт уже заведён/.test(loginText)) {
    fails.push('email path should be collapsed behind details');
  }
  await check('/access.html', ['Доступ по приглашению']);
  await check('/personal.html', ['листаете как гость', 'Войти']);

  const oauthPage = await ctx.newPage();
  await oauthPage.goto(origin + '/access.html?view=login', { waitUntil: 'domcontentloaded' });
  await oauthPage.waitForTimeout(800);
  await oauthPage.click('#doOidc');
  const calls = await oauthPage.evaluate(() => window.__oauthCalls || []);
  if (!calls.length || calls[0].provider !== 'custom:authelia') {
    fails.push('OIDC button did not call signInWithOAuth(custom:authelia)');
  }
  await oauthPage.close();

  const memberCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await memberCtx.addInitScript({ path: join(ROOT, 'tests/shim-supabase.js') });
  await memberCtx.addInitScript(() => {
    window.__SESSION = { user: { email: 'reader@example.com', user_metadata: { name: 'Рид' } } };
    window.__FIX = { rpc: { is_member: false, my_access: { signed_in: true, member: false, email: 'reader@example.com', name: 'Рид' }, invite_info: { valid: false }, membership_after_auth: { ok: true, member: false } } };
  });
  const p = await memberCtx.newPage();
  await p.goto(origin + '/personal.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  const signed = await p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));
  if (!signed.includes('членство книги')) fails.push('signed-in-not-member should not look like a member');
  if (signed.includes('Сообщество') && /Личное[\s\S]*Сообщество/.test(signed)) {
    fails.push('community row visible without membership');
  }
  await p.close();
  await memberCtx.close();

  await browser.close();
  server.close();
  if (fails.length) {
    console.error(fails.join('\n'));
    process.exit(1);
  }
  console.log('e2e_access_scheme: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
