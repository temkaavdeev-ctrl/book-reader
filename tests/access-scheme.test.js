#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const access = fs.readFileSync(path.join(ROOT, 'access.html'), 'utf8');
const personal = fs.readFileSync(path.join(ROOT, 'personal.html'), 'utf8');
const landing = fs.readFileSync(path.join(ROOT, 'landing.html'), 'utf8');
const sql = fs.readFileSync(path.join(ROOT, 'sql/membership_after_auth.sql'), 'utf8');

function refute(re, text, msg) {
  assert.ok(!re.test(text), msg || String(re));
}
function has(re, text, msg) {
  assert.ok(re.test(text), msg || String(re));
}

// Door: PKCE via supabase-js, never a raw authorize URL.
refute(/auth\/v1\/authorize/i, access, 'access.html must not use raw authorize URL');
refute(/auth\/v1\/authorize/i, landing, 'landing.html must not use raw authorize URL');
refute(/auth\/v1\/authorize/i, personal, 'personal.html must not use raw authorize URL');
has(/signInWithOAuth/, access, 'access.html starts Authelia via signInWithOAuth');
has(/custom:authelia/, access, 'access.html uses custom:authelia');
has(/membership_after_auth/, access, 'access.html redeems via membership_after_auth');
has(/HOME='path\.html'/, access, 'post-auth home is path.html');
refute(/location\.(href|replace)\(['"]solve-home\.html/, access, 'access.html must not send login to solve-home');

// Landing / Моё only point at the one door.
has(/access\.html\?view=login/, landing, 'landing Войти → access.html?view=login');
has(/access\.html\?view=login/, personal, 'guest Моё → access.html?view=login');
refute(/signInWithOAuth/, landing, 'landing does not start OAuth');
refute(/signInWithOAuth/, personal, 'personal does not start OAuth');

// Identity ≠ membership on Моё.
has(/STATE=\{signedIn:false,\s*member:false/, personal, 'STATE has signedIn and member');
has(/rpc\('is_member'\)/, personal, 'membership comes from is_member RPC');
has(/Вы вошли, но членство книги/, personal, 'signed-in-not-member copy');
refute(/STATE\.member=!!sess/, personal, 'session must not become member');
refute(/mcLikelyMember/, personal, 'token presence is signed-in, not member');

// SQL snapshot matches the live contract.
has(/CREATE OR REPLACE FUNCTION public\.membership_after_auth/, sql);
has(/GRANT EXECUTE ON FUNCTION public\.membership_after_auth\(text, text\) TO authenticated/, sql);
has(/REVOKE ALL ON FUNCTION public\.membership_after_auth\(text, text\) FROM anon/, sql);
has(/invite_redeem/, sql);

console.log('access-scheme.test.js: ok');
