/* mc-auth.js — единая логика доступа к books:
 * 1) гость — только публичный слой;
 * 2) сессия ≠ доступ: членство = whitelist (или admin);
 * 3) инвайт: access.html?invite=CODE → регистрация/вход → invite_redeem → whitelist.
 */
(function(global){
  var ADMIN='temka.avdeev@gmail.com';

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  function parseInviteCode(){
    try{
      var qs=new URLSearchParams(location.search);
      var code=qs.get('invite')||qs.get('join');
      if(code) return code;
      var m=(location.hash||'').match(/^#\/join\/([^/?&#]+)/);
      return m?decodeURIComponent(m[1]):null;
    }catch(e){ return null; }
  }

  function inviteUrl(code){
    var p=location.pathname||'/';
    var dir=p.replace(/[^/]*$/,'');
    var base=(dir&&dir!=='/')?(location.origin+dir):(location.origin+'/');
    return base+'access.html?invite='+encodeURIComponent(code);
  }

  function redirectLegacyJoin(){
    try{
      if(/access\.html/.test(location.pathname||'')) return false;
      var m=(location.hash||'').match(/^#\/join\/([^/?&#]+)/);
      if(m){
        location.replace('access.html?invite='+encodeURIComponent(decodeURIComponent(m[1])));
        return true;
      }
    }catch(e){}
    return false;
  }

  function authErr(m){
    m=String(m||'');
    if(/Invalid login credentials|Invalid login/i.test(m)) return 'Неверный email или пароль.';
    if(/Email not confirmed/i.test(m)) return 'Email не подтверждён. Обратитесь к администратору.';
    if(/already registered/i.test(m)) return 'Этот email уже зарегистрирован — войдите.';
    if(/expired|invalid.*code|not found/i.test(m)) return 'Приглашение недействительно или истекло.';
    if(/rate limit|Too many|For security/i.test(m)) return 'Слишком много попыток, подождите минуту.';
    if(/Failed to fetch|NetworkError|timeout|timed out/i.test(m)) return 'Не удаётся связаться с сервером.';
    return m||'Не удалось выполнить вход. Попробуйте ещё раз.';
  }

  function mcLikelySession(){
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k&&k.indexOf('sb-')===0&&k.indexOf('-auth-token')>0){
          var v=localStorage.getItem(k);
          if(v&&v.length>20) return true;
        }
      }
    }catch(e){}
    return false;
  }

  function isAdmin(user){ return !!user && (user.email||'').toLowerCase()===ADMIN; }
  function memberCacheKey(uid){ return 'bp_member:'+uid; }
  function roleCacheKey(uid){ return 'bp_role:'+uid; }

  function checkBooksAccess(SB,user){
    if(!SB||!user) return Promise.resolve({ member:false, role:'reader', admin:false });
    if(isAdmin(user)) return Promise.resolve({ member:true, role:'editor', admin:true });
    var mk=memberCacheKey(user.id), rk=roleCacheKey(user.id);
    function fromCache(){
      if(lsGet(mk)==='1') return { member:true, role:lsGet(rk)||'reader', admin:false, cached:true };
      return { member:false, role:'reader', admin:false, cached:true };
    }
    if(typeof navigator!=='undefined' && navigator.onLine===false) return Promise.resolve(fromCache());
    return SB.from('whitelist').select('email,role').eq('email',(user.email||'').toLowerCase()).limit(1).then(function(r){
      if(r.error) return fromCache();
      if(r.data&&r.data.length){
        var role=r.data[0].role||'reader';
        lsSet(mk,'1'); lsSet(rk,role);
        return { member:true, role:role, admin:false };
      }
      lsSet(mk,'0');
      return { member:false, role:'reader', admin:false };
    }).catch(function(){ return fromCache(); });
  }

  function redeemInvite(SB,code,name){
    if(!SB||!code) return Promise.resolve({ error:{ message:'no_code' } });
    return SB.rpc('invite_redeem',{ p_code:code, p_name:name||'' }).then(function(r){ return r; })
      .catch(function(e){ return { error:{ message:String((e&&e.message)||e) } }; });
  }

  function finishAuth(SB,session,opts){
    opts=opts||{};
    var user=session&&session.user;
    if(!user) return Promise.resolve({ ok:false, error:'no_session' });
    var p=Promise.resolve(null);
    if(opts.inviteCode){
      p=p.then(function(){ return redeemInvite(SB,opts.inviteCode,opts.inviteName||''); }).then(function(rd){
        if(rd&&rd.error) return { ok:false, error:rd.error.message, redeemFailed:true };
        return null;
      });
    }
    return p.then(function(fail){
      if(fail) return fail;
      return checkBooksAccess(SB,user).then(function(acc){
        return {
          ok:acc.member,
          member:acc.member,
          role:acc.role,
          admin:acc.admin,
          redirect:opts.isSignup?'path.html':'solve-home.html',
          user:user
        };
      });
    });
  }

  function boot(SB,cb){
    cb=cb||function(){};
    if(!SB){
      global.__MEMBER=false;
      global.__BOOKS_ROLE='reader';
      cb({ session:null, user:null, member:false, role:'reader' });
      return Promise.resolve();
    }
    return SB.auth.getSession().then(function(s){
      var sess=s&&s.data&&s.data.session;
      var user=sess?sess.user:null;
      if(!user){
        global.__MEMBER=false;
        global.__BOOKS_ROLE='reader';
        cb({ session:null, user:null, member:false, role:'reader' });
        return null;
      }
      return checkBooksAccess(SB,user).then(function(acc){
        global.__MEMBER=acc.member;
        global.__BOOKS_ROLE=acc.role;
        cb({ session:sess, user:user, member:acc.member, role:acc.role, admin:acc.admin });
      });
    }).catch(function(){
      global.__MEMBER=mcLikelySession();
      global.__BOOKS_ROLE='reader';
      cb({ session:null, user:null, member:!!global.__MEMBER, role:'reader' });
    });
  }

  var McAuth={
    ADMIN:ADMIN,
    parseInviteCode:parseInviteCode,
    inviteUrl:inviteUrl,
    redirectLegacyJoin:redirectLegacyJoin,
    authErr:authErr,
    mcLikelySession:mcLikelySession,
    isAdmin:isAdmin,
    checkBooksAccess:checkBooksAccess,
    redeemInvite:redeemInvite,
    finishAuth:finishAuth,
    boot:boot
  };

  global.McAuth=McAuth;
  global.mcLikelyMember=mcLikelySession;
  if(mcLikelySession()) global.__MEMBER=true;
})(typeof window!=='undefined'?window:this);
