// Poisoned Pints: online rooms.
// Free relay: a public MQTT broker carries small JSON messages between phones. No server of our own.
// The host's browser is the referee: it runs engine.js, keeps every secret, and sends each player only their own view.
(function(){
'use strict';
const PFX = 'poisonedpints/v1/';
const qs = new URLSearchParams(location.search);
const BROKERS = qs.get('broker') ? [qs.get('broker')] : ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://mqtt.eclipseprojects.io/mqtt'];
const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DAY_SEC = d => (d === 1 ? 180 : 140);
const NIGHT_WAIT = 115;                 // seconds the host waits for night results
const rid = n => Array.from({length:n}, () => CODE_CH[Math.floor(Math.random()*CODE_CH.length)]).join('');
const clone = o => JSON.parse(JSON.stringify(o));
const now = () => Date.now();
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};

// ---------------------------------------------------------------- transport
function connectOne(url, timeout){
  return new Promise((res, rej) => {
    if (!window.mqtt) return rej(new Error('no mqtt lib'));
    const c = window.mqtt.connect(url, {clientId:'pp_' + rid(10), clean:true, keepalive:20, reconnectPeriod:2000, connectTimeout:timeout, protocolVersion:4});
    let done = false;
    const t = setTimeout(() => { if (!done){ done = true; c.end(true); rej(new Error('timeout')); } }, timeout);
    c.once('connect', () => { if (done) return; done = true; clearTimeout(t); res(c); });
  });
}
function Link(){
  const L = {c:null, url:null, code:null, seen:new Set(), seenQ:[], onMsg:null, onState:null, subs:[]};
  L.open = async (urls) => {
    let last;
    for (const u of urls){ try { L.c = await connectOne(u, 7000); L.url = u; break; } catch(e){ last = e; } }
    if (!L.c) throw last || new Error('no broker');
    L.c.on('message', (topic, buf) => {
      if (!buf || !buf.length) { L.onMsg && L.onMsg(topic, null); return; }
      let m; try { m = JSON.parse(new TextDecoder().decode(buf)); } catch(e){ return; }
      if (m.id){ if (L.seen.has(m.id)) return; L.seen.add(m.id); L.seenQ.push(m.id); if (L.seenQ.length > 400) L.seen.delete(L.seenQ.shift()); }
      L.onMsg && L.onMsg(topic, m);
    });
    L.c.on('connect', () => L.onState && L.onState('up'));
    L.c.on('reconnect', () => L.onState && L.onState('reconnecting'));
    L.c.on('offline', () => L.onState && L.onState('down'));
    L.c.on('close', () => L.onState && L.onState('down'));
    return L;
  };
  L.sub = (topic) => new Promise(r => { L.subs.push(topic); L.c.subscribe(topic, {qos:1}, () => r()); });
  L.pub = (topic, obj, opts={}) => { if (!L.c) return; const m = obj === null ? '' : JSON.stringify({id:rid(12), ...obj}); L.c.publish(topic, m, {qos:1, retain:!!opts.retain}); };
  L.close = () => { try { L.c && L.c.end(true); } catch(e){} L.c = null; };
  return L;
}
const T = code => ({room:PFX+code+'/room', host:PFX+code+'/h', all:PFX+code+'/all', me:pid => PFX+code+'/p/'+pid});

// find which broker a room lives on, by its retained "room" note
async function findRoom(code){
  for (const u of BROKERS){
    let L; try { L = await Link().open([u]); } catch(e){ continue; }
    const got = await new Promise(res => {
      const t = setTimeout(() => res(null), 4000);
      L.onMsg = (topic, m) => { if (topic === T(code).room && m){ clearTimeout(t); res(m); } };
      L.sub(T(code).room);
    });
    if (got && !got.closed) { L.c.unsubscribe(T(code).room); L.onMsg = null; return {L, room:got}; }
    L.close();
  }
  return null;
}

// ======================================================================= HOST (referee)
function Host(){
  const H = {code:null, L:null, players:[], bots:2, phase:'lobby', S:null, roll:null, ready:{}, nres:{}, last:{}, deadline:0, timer:null, lastSeen:{}, hostPid:null};
  const PP = window.PP;

  const save = () => store.set('pp_host_' + H.code, {code:H.code, players:H.players, bots:H.bots, phase:H.phase, S:H.S, roll:H.roll, ready:H.ready, nres:H.nres,
    last:H.last, deadline:H.deadline, hostPid:H.hostPid, url:H.L && H.L.url, t:now()});
  const seatOf = pid => (H.players.find(p => p.pid === pid) || {}).seat;
  const humans = () => H.players;
  const online = pid => now() - (H.lastSeen[pid] || 0) < 30000;
  const toP = (pid, t, d, keep=true) => { const msg = {t, d}; if (keep) H.last[pid] = msg; H.L.pub(T(H.code).me(pid), msg); };
  const status = () => H.L.pub(T(H.code).all, {t:'status', d:{phase:H.phase, round:H.S ? H.S.day : 0, bots:H.bots,
    players:H.players.map(p => ({pid:p.pid, name:p.name, seat:p.seat, ready:!!(H.phase==='day' ? H.ready[p.pid] : H.phase==='night' ? H.nres[p.pid] : false), online:online(p.pid)})),
    left:Math.max(0, Math.round((H.deadline - now())/1000))}});
  const roomNote = () => H.L.pub(T(H.code).room, {t:'room', host:H.hostPid, phase:H.phase, ts:now()}, {retain:true});

  // what one player is allowed to see
  function view(S, seat){
    const v = clone(S);
    v.taverns.forEach(t => {
      if (t.id === seat) return;
      t.plan = {missions:[], bribe:0}; t.recruits = []; t.incidents = []; t.intel = {}; t.suspicion = {}; t.inbox = []; t.last = null; t.leaks = 0;
      t.aggr = 0; t.targetStyle = null;
      t.staff = t.staff.map(x => ({id:x.id, type:x.type, name:x.name, quirk:x.quirk, jailed:x.jailed, loyalty:3, moleFor:null, wage:x.wage, idle:0}));
    });
    v.history = v.history.map(h => ({day:h.day, fav:null, bids:{}, events:h.events.filter(e => e.target === seat || e.by === seat)}));
    return v;
  }

  function seedCrew(t){
    const S = H.S;
    [['Vex','poisoner','proud',4],['Pip','pickpocket','lucky',3],['Dunk','bruiser','sensitive',3],['Tansy','bard','gossip',4]].forEach(([name,type,quirk,loyalty]) => {
      t.staff.push({id:S.nextId++, type, name, quirk, cost:PP.STAFF[type].cost, wage:PP.STAFF[type].wage, loyalty, moleFor:null, born:false, turned:false,
        note:'has worked here for years', tell:false, jailed:0, exposed:false, idle:0, wins:0, station:'rest'}); });
  }
  function firstSpies(){
    // night 1: each human gets one bot spy at the door so they learn to catch them
    const S = H.S, bots = S.taverns.filter(t => t.isBot); if (!bots.length) return;
    humans().forEach((p, i) => {
      if (bots.some(b => b.plan.missions.some(m => m.target === p.seat && PP.MISSIONS[m.type].harm))) return;
      const b = bots[i % bots.length];
      let st = b.staff.find(x => x.type === 'pickpocket' && !x.jailed && !b.plan.missions.some(m => m.staffId === x.id));
      if (!st){ st = {id:S.nextId++, type:'pickpocket', name:'Snitch', quirk:'clumsy', cost:40, wage:10, loyalty:3, moleFor:null, born:false, turned:false, note:'', tell:false, jailed:0, exposed:false, idle:0, wins:0}; b.staff.push(st); }
      PP.setMission(S, b.id, {staffId:st.id, type:'steal', target:p.seat});
    });
  }

  function startGame(){
    if (H.phase !== 'lobby') return;
    const n = Math.min(5, Math.max(2, H.players.length + H.bots));
    H.S = PP.createGame({rivals:n-1, difficulty:'normal'});
    if (+qs.get('days')) H.S.maxDays = Math.max(2, Math.min(7, +qs.get('days')));   // tests
    H.players.forEach((p, i) => { p.seat = i; const t = H.S.taverns[i];
      t.isBot = false; t.pers = null; t.name = `${p.name}'s Tavern`; t.owner = p.name; seedCrew(t); });
    H.S.taverns.forEach(t => { if (t.isBot) PP.botDay(H.S, t.id); });
    firstSpies();
    H.phase = 'day'; H.ready = {}; H.nres = {}; H.deadline = now() + (DAY_SEC(1) + 60)*1000;
    H.players.forEach(p => toP(p.pid, 'day', {seat:p.seat, round:1, state:view(H.S, p.seat), sec:DAY_SEC(1)}));
    roomNote(); status(); save(); arm();
  }

  function arm(){ clearTimeout(H.timer); H.timer = setTimeout(tick, 1000); }
  function tick(){
    arm();
    if (H.phase === 'day'){
      const wait = humans().filter(p => !H.ready[p.pid]);
      const onlineWait = wait.filter(p => online(p.pid));
      if (!wait.length || now() > H.deadline || (!onlineWait.length && now() > (H.offSince || (H.offSince = now())) + 20000)) return resolveDay();
      if (onlineWait.length) H.offSince = 0;
    } else if (H.phase === 'night'){
      const wait = humans().filter(p => !H.nres[p.pid]);
      const onlineWait = wait.filter(p => online(p.pid));
      if (!wait.length || now() > H.deadline || (!onlineWait.length && now() > (H.offSince || (H.offSince = now())) + 20000)) return resolveNight();
      if (onlineWait.length) H.offSince = 0;
    }
    if ((H.tk = (H.tk||0) + 1) % 5 === 0) status();
  }

  const ALLOWED = {hire:1, fire:1, upgradeAle:1, setBribe:1, setMission:1, clearMission:1, accuse:1, setPrice:1};
  function resolveDay(){
    const S = H.S; H.offSince = 0;
    humans().forEach(p => {
      const r = H.ready[p.pid]; if (!r) return;
      (r.log || []).slice(0, 300).forEach(a => { if (!Array.isArray(a) || !ALLOWED[a[0]]) return; try { PP[a[0]](S, p.seat, ...a.slice(1)); } catch(e){} });
      const t = S.taverns[p.seat];
      t.staff.forEach(x => { const st = r.stations && r.stations[x.id]; if (['bar','door','map','rest'].includes(st)) x.station = st; });
    });
    H.roll = PP.rollNight(S);
    H.phase = 'night'; H.nres = {}; H.deadline = now() + NIGHT_WAIT*1000;
    humans().forEach(p => {
      const ev = H.roll.events.filter(e => e.by === p.seat || e.target === p.seat);
      toP(p.pid, 'night', {round:S.day, roll:{events:ev, fav:H.roll.fav, bids:{[p.seat]:H.roll.bids[p.seat] || 0}}});
    });
    status(); save();
  }

  function resolveNight(){
    const S = H.S, roll = H.roll, M = PP.MISSIONS; H.offSince = 0;
    const harmTo = seat => roll.events.filter(e => e.target === seat && e.by !== seat && M[e.type].harm && !e.foiled && !e.refused && !e.slept);
    // 1) luck taps on your own agents (guards look away)
    humans().forEach(p => { const r = H.nres[p.pid]; if (!r || r.skip) return;
      roll.events.forEach(e => { if (e.by === p.seat && (r.lucky||[]).includes(e.id) && M[e.type].catch) e.caught = false; }); });
    // 2) what each human actually caught at their own door overrides the guards' roll
    humans().forEach(p => { const r = H.nres[p.pid]; if (!r || r.skip) return;
      harmTo(p.seat).forEach(e => { e.caught = (r.caught||[]).includes(e.id); if ((r.fizzled||[]).includes(e.id)){ e.refused = false; e.slept = true; } });
      S.taverns[p.seat].staff.forEach(x => { if ((r.working||[]).includes(x.id)) x.idle = -1; });
    });
    const vs = {}; humans().forEach(p => vs[p.pid] = harmTo(p.seat).map(e => ({id:e.id, by:e.by, type:e.type})));
    const lv0 = {}; humans().forEach(p => lv0[p.pid] = PP.levelOf(S.taverns[p.seat]));
    const res = PP.applyNight(S, roll);
    humans().forEach(p => {
      const r = H.nres[p.pid], t = S.taverns[p.seat], R = res.perTavern[p.seat];
      let n = {served:R.served, income:R.income, caught:0, escaped:0, missed:0};
      if (r && !r.skip){
        const inc = Math.max(0, Math.min(5000, +r.income || 0)), missed = Math.max(0, +r.missed || 0);
        t.gold += inc - R.income; t.gold = Math.max(0, Math.round(t.gold)); t.stats.served += Math.max(0, Math.min(60, +r.served || 0)) - R.served; R.income = inc; R.served = +r.served || 0; t.rep = Math.max(0, Math.min(100, t.rep - Math.floor(missed/2)));
        n = {served:R.served, income:inc, caught:+r.caught?.length || 0, escaped:+r.escaped || 0, missed};
        R.newIncidents.forEach(id => { const ic = t.incidents.find(i => i.id === id); if (!ic) return;
          const ev = vs[p.pid].find(e => e.by === ic.culprit && e.type === ic.type); const got = ev ? (+(r.clues||{})[ev.id] || 0) : 0;
          const traits = ic.clues.filter(c => c.kind === 'trait'), extra = ic.clues.filter(c => c.kind !== 'trait' && c.kind !== 'none');
          ic.clues = [...traits.slice(0, got), ...extra]; if (!ic.clues.length) ic.clues = [{kind:'none', text:'You didn\'t pick up any clues.', points:null, icon:'🌫️'}]; });
      }
      p.n = n;
      const lv = PP.levelOf(t);
      if (lv > lv0[p.pid]) R.msgs.unshift({cat:'you', kind:'good', text:`🎉 Your tavern reached LEVEL ${lv}! New staff you can hire: ${PP.LEVELS.slice(lv0[p.pid], lv).flatMap(L => L.unlock).map(k => PP.STAFF[k].icon + ' ' + PP.STAFF[k].name).join(', ')}.`});
      if (!S.over) PP.refreshRecruits(S, p.seat);
    });
    if (!S.over){ S.taverns.forEach(t => { if (t.isBot) PP.botDay(S, t.id); }); }
    H.phase = S.over ? 'over' : 'day'; H.ready = {}; H.deadline = now() + (DAY_SEC(S.day) + 150)*1000;
    humans().forEach(p => toP(p.pid, 'morning', {round:S.day, night:S.history.length, over:S.over, state:view(S, p.seat), rep:res.perTavern[p.seat], news:res.news, n:p.n, sec:DAY_SEC(S.day)}));
    roomNote(); status(); save();
    if (S.over){ clearTimeout(H.timer); setTimeout(() => H.L.pub(T(H.code).room, null, {retain:true}), 60000); }
  }

  function onMsg(topic, m){
    if (!m || topic !== T(H.code).host) return;
    const pid = m.f; if (!pid) return; H.lastSeen[pid] = now();
    const p = H.players.find(x => x.pid === pid), d = m.d || {};
    if (m.t === 'hello'){
      if (!p){
        if (H.phase !== 'lobby') return toP(pid, 'nope', {why:'This game has already started.'}, false);
        if (H.players.length >= 5) return toP(pid, 'nope', {why:'This room is full (5 players).'}, false);
        H.players.push({pid, name:String(d.name || 'Player').slice(0, 14), seat:null});
        if (H.players.length + H.bots > 5) H.bots = 5 - H.players.length;
        save();
      } else if (d.name && H.phase === 'lobby') p.name = String(d.name).slice(0, 14);
      const pl = H.players.find(x => x.pid === pid);
      toP(pid, 'sync', {phase:H.phase, round:H.S ? H.S.day : 0, seat:pl.seat, state:H.S && pl.seat !== null ? view(H.S, pl.seat) : null,
        last:H.last[pid] || null, hasReady:!!H.ready[pid], hasNres:!!H.nres[pid], host:H.hostPid}, false);
      status();
    }
    else if (!p) return;
    else if (m.t === 'ping'){ if (Math.random() < 0.25) status(); }
    else if (m.t === 'leave' && H.phase === 'lobby'){ H.players = H.players.filter(x => x.pid !== pid); status(); save(); }
    else if (m.t === 'ready' && H.phase === 'day' && d.round === H.S.day){ if (!H.ready[pid]){ H.ready[pid] = d; status(); save(); tick(); } }
    else if (m.t === 'nres' && H.phase === 'night' && d.round === H.S.day){ if (!H.nres[pid]){ H.nres[pid] = d; status(); save(); tick(); } }
  }

  H.create = async (pid, name) => {
    H.hostPid = pid;
    for (const u of BROKERS){
      try { H.L = await Link().open([u]); } catch(e){ continue; }
      // pick a code nobody is using
      for (let k=0;k<5;k++){
        const code = rid(5);
        const busy = await new Promise(res => { const t = setTimeout(() => res(false), 1200);
          H.L.onMsg = (tp, m) => { if (tp === T(code).room && m && !m.closed && now() - (m.ts||0) < 6*3600e3){ clearTimeout(t); res(true); } }; H.L.sub(T(code).room); });
        H.L.c.unsubscribe(T(code).room);
        if (!busy){ H.code = code; break; }
      }
      if (H.code) break;
      H.L.close(); H.L = null;
    }
    if (!H.code) throw new Error('Could not reach the game server');
    await bind();
    roomNote(); save(); arm();
    return H.code;
  };
  H.resume = async (snap) => {
    Object.assign(H, {code:snap.code, players:snap.players, bots:snap.bots, phase:snap.phase, S:snap.S, roll:snap.roll, ready:snap.ready||{}, nres:snap.nres||{},
      last:snap.last||{}, deadline:Math.max(snap.deadline||0, now() + 60000), hostPid:snap.hostPid});
    H.L = await Link().open(snap.url ? [snap.url, ...BROKERS.filter(u => u !== snap.url)] : BROKERS);
    await bind(); roomNote(); status(); arm();
    return H.code;
  };
  async function bind(){
    H.L.onMsg = onMsg;
    H.L.onState = s => { if (s === 'up'){ roomNote(); status(); } };
    await H.L.sub(T(H.code).host);
  }
  H.setBots = n => { if (H.phase !== 'lobby') return; H.bots = Math.max(0, Math.min(5 - H.players.length, n)); if (H.players.length + H.bots < 2) H.bots = 2 - H.players.length; status(); save(); };
  H.kick = pid => { if (H.phase !== 'lobby' || pid === H.hostPid) return; H.players = H.players.filter(x => x.pid !== pid); toP(pid, 'nope', {why:'The host removed you from the room.'}, false); status(); save(); };
  H.start = startGame;
  H.close = () => { clearTimeout(H.timer); if (H.L){ H.L.pub(T(H.code).room, null, {retain:true}); setTimeout(() => H.L.close(), 400); } store.del('pp_host_' + H.code); };
  H._force = () => { if (H.phase === 'day') resolveDay(); else if (H.phase === 'night') resolveNight(); };   // tests
  return H;
}

// ======================================================================= PLAYER (every phone, host included)
function Player(){
  const P = {pid:null, name:'', code:null, L:null, host:null, on:{}, status:null, lastHost:0, url:null, pingT:null};
  const emit = (ev, d) => P.on[ev] && P.on[ev](d);
  const send = (t, d) => P.L && P.L.pub(T(P.code).host, {f:P.pid, t, d});
  P.send = send;
  P.join = async (code, name, pid, url) => {
    P.code = code.toUpperCase(); P.name = name; P.pid = pid;
    if (url) P.L = await Link().open([url]);
    else { const f = await findRoom(P.code); if (!f) throw new Error('Room not found. Check the code.'); P.L = f.L; }
    P.url = P.L.url;
    P.L.onMsg = (topic, m) => {
      if (!m) return;
      if (topic === T(P.code).all && m.t === 'status'){ P.status = m.d; P.lastHost = now(); emit('status', m.d); }
      else if (topic === T(P.code).me(P.pid)){ P.lastHost = now(); emit(m.t, m.d); }
    };
    P.L.onState = s => { emit('link', s); if (s === 'up') send('hello', {name:P.name}); };
    await P.L.sub(T(P.code).me(P.pid)); await P.L.sub(T(P.code).all);
    store.set('pp_mp', {code:P.code, pid:P.pid, name:P.name, t:now(), url:P.url});
    send('hello', {name:P.name});
    clearInterval(P.pingT); P.pingT = setInterval(() => { send('ping', {}); emit('tick', {hostAge:now() - P.lastHost}); }, 4000);
  };
  P.leave = () => { send('leave', {}); clearInterval(P.pingT); setTimeout(() => P.L && P.L.close(), 300); store.del('pp_mp'); };
  return P;
}

window.NET = {Host, Player, findRoom, store, rid, DAY_SEC, BROKERS};
})();
