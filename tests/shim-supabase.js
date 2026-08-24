// Minimal supabase-js shim for access-scheme e2e.
(function () {
  window.SUPABASE_URL = window.SUPABASE_URL || 'http://shim.local';
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'shim-key';
  var FIX = window.__FIX || { rpc: {} };
  window.__FIX = FIX;
  var SESSION = typeof window.__SESSION !== 'undefined' ? window.__SESSION : null;
  window.__oauthCalls = [];
  function ok(data) {
    return Promise.resolve({ data: data, error: null, status: 200 });
  }
  var client = {
    rpc: function (name) {
      var data = FIX.rpc && name in FIX.rpc ? FIX.rpc[name] : null;
      return ok(data);
    },
    auth: {
      getSession: function () {
        return Promise.resolve({ data: { session: SESSION }, error: null });
      },
      signInWithOAuth: function (opts) {
        window.__oauthCalls.push(opts);
        return Promise.resolve({ data: { url: 'http://shim.local/oauth' }, error: null });
      },
      signInWithPassword: function () {
        return Promise.resolve({ data: { session: SESSION, user: SESSION && SESSION.user }, error: SESSION ? null : { message: 'shim: no auth' } });
      },
      signUp: function () {
        return Promise.resolve({ data: { session: SESSION }, error: null });
      },
      signOut: function () {
        return Promise.resolve({ error: null });
      },
      resetPasswordForEmail: function () {
        return Promise.resolve({ data: {}, error: null });
      }
    }
  };
  window.supabase = { createClient: function () { return client; } };
})();
