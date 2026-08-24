// Minimal supabase-js shim for access-scheme e2e.
(function () {
  window.SUPABASE_URL = window.SUPABASE_URL || 'http://shim.local';
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'shim-key';
  var FIX = window.__FIX || { rpc: {} };
  window.__FIX = FIX;
  window.__oauthCalls = [];
  function ok(data) {
    return Promise.resolve({ data: data, error: null, status: 200 });
  }
  function session() {
    return typeof window.__SESSION !== 'undefined' ? window.__SESSION : null;
  }
  var client = {
    rpc: function (name) {
      var data = (window.__FIX && window.__FIX.rpc && name in window.__FIX.rpc) ? window.__FIX.rpc[name] : null;
      return ok(data);
    },
    auth: {
      getSession: function () {
        return Promise.resolve({ data: { session: session() }, error: null });
      },
      signInWithOAuth: function (opts) {
        window.__oauthCalls.push(opts);
        return Promise.resolve({ data: { url: 'http://shim.local/oauth' }, error: null });
      },
      signInWithPassword: function () {
        var s = session();
        return Promise.resolve({ data: { session: s, user: s && s.user }, error: s ? null : { message: 'shim: no auth' } });
      },
      signUp: function () {
        return Promise.resolve({ data: { session: session() }, error: null });
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
