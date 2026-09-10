#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GMAIL = 'temka.avdeev@gmail.com';
const AR1ADNA = 'artem@ar1adna.com';

function src(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

const ctx = { window: {}, global: {} };
ctx.window = ctx;
vm.runInNewContext(src('mc-auth.js'), ctx);
const McAuth = ctx.McAuth;
assert.ok(McAuth, 'mc-auth.js exports McAuth');
assert.ok(McAuth.ADMINS && McAuth.ADMINS.length === 2, 'ADMINS has both owner emails');
assert.ok(McAuth.ADMINS.indexOf(GMAIL) >= 0 && McAuth.ADMINS.indexOf(AR1ADNA) >= 0, 'both owner emails are admins');
assert.ok(McAuth.isAdminEmail(GMAIL));
assert.ok(McAuth.isAdminEmail(AR1ADNA));
assert.ok(McAuth.isAdminEmail('Artem@ar1adna.com'), 'admin email is case-insensitive');
assert.ok(!McAuth.isAdminEmail('reader@example.com'));
assert.ok(McAuth.isAdmin({ email: AR1ADNA }));
assert.ok(!McAuth.isAdmin({ email: 'guest@ar1adna.com' }));
assert.ok(!McAuth.isAdmin(null));

const personal = src('personal.html');
assert.ok(personal.includes("isBooksAdmin()"), 'Моё uses isBooksAdmin, not a single hardcoded gmail');
assert.ok(personal.includes(AR1ADNA), 'Моё fallback list includes artem@ar1adna.com');
assert.ok(personal.includes('Всё созвездие видно. Открытые идеи зажигаются на вашей карте.'), 'admin empty map is a visible sky, not fog');
assert.ok(personal.includes('Карта пока в тумане. Откройте первую идею — она ляжет на вашу карту.'), 'member empty map still uses fog');
assert.ok(!/STATE\.member && \(STATE\.email\|\|''\)\.toLowerCase\(\)==='temka\.avdeev@gmail\.com'/.test(personal), 'admin menu is not gmail-only');

const explore = src('explore.html');
assert.ok(/var fog=MEMBER && !ADMIN && !opened/.test(explore), 'sky fog is for members, not admin');
assert.ok(/MEMBER && !ADMIN && lit===0/.test(explore), 'admin does not get the fog hint');
assert.ok(explore.includes("load('mc-auth.js'"), 'explore loads McAuth to know admin');
assert.ok(/ADMIN=!!\(user && \(\(window\.McAuth&&McAuth\.isAdmin\(user\)\)/.test(explore), 'explore sets ADMIN from McAuth with email fallback');
assert.ok(!/if\(MEMBER && !lit\)/.test(explore), 'explore no longer fogs every unvisited member star');

function hasBothEmails(text, file) {
  assert.ok(text.includes(GMAIL), file + ' keeps gmail admin');
  assert.ok(text.includes(AR1ADNA), file + ' adds artem@ar1adna.com as admin');
}
hasBothEmails(src('mc-auth.js'), 'mc-auth.js');
hasBothEmails(src('index.html'), 'index.html');
hasBothEmails(src('index-admin.html'), 'index-admin.html');
hasBothEmails(personal, 'personal.html');

console.log('admin-sky.test.js: ok');
