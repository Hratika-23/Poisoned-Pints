// =====================================================================
// POISONED PINTS — RULES ENGINE v2 (no graphics)
// Each tavern's secrets live here. Screens only ever show a player
// their OWN crew, plans, bribes and clues. Reusable on a server later.
// =====================================================================
const PP = (() => {
  const DAYS = 7, TUT_DAYS = 3, START_GOLD = 250, START_REP = 50, MAX_STAFF = 7;
  // Tavern levels: serve guests to level up and unlock new kinds of staff.
  const LEVELS = [
    {lv:1, at:0,   unlock:['waiter','cellarer','bruiser','pickpocket','poisoner','bard']},
    {lv:2, at:20,  unlock:['watchman','taster']},
    {lv:3, at:50,  unlock:['cook']},
    {lv:4, at:85,  unlock:['spy']},
    {lv:5, at:130, unlock:['talker']}
  ];

  const STAFF = {
    poisoner:  {name:'Poisoner',     icon:'🧪', cost:70, wage:12, mission:'poison', desc:'Sneaks poison into a rival keg.'},
    pickpocket:{name:'Pickpocket',   icon:'🗡️', cost:55, wage:10, mission:'steal',  desc:'Lifts gold from a rival.'},
    bruiser:   {name:'Bruiser',      icon:'💪', cost:60, wage:11, mission:'brawl',  desc:'Starts brawls. At home, stops most brawls and some thefts.'},
    spy:       {name:'Spy',          icon:'🕵️', cost:65, wage:11, mission:'spy',    desc:'Spies on a rival, or on your own crew to find traitors. At home, may tail attackers.'},
    bard:      {name:'Bard',         icon:'🎻', cost:50, wage:9,  mission:'rumor',  desc:'Draws customers. Can spread nasty rumors about a rival.'},
    taster:    {name:'Taster',       icon:'👃', cost:45, wage:8,  mission:null,     desc:'Stays home and stops any poison in your keg.'},
    talker:    {name:'Smooth-talker',icon:'🎩', cost:60, wage:10, mission:'cover',  desc:'Your bribes count 50% more. Can cover your tracks.'},
    waiter:    {name:'Waiter',       icon:'🍽️', cost:35, wage:6,  mission:null,     desc:'Walks the floor serving guests by themselves.'},
    cellarer:  {name:'Cellar-keeper',icon:'🛢️', cost:35, wage:6,  mission:null,     desc:'Keeps the keg full, so it never runs dry.'},
    watchman:  {name:'Watchman',     icon:'🔦', cost:45, wage:7,  mission:null,     desc:'Spots spies early and slows them down. Rivals get caught more often.'},
    cook:      {name:'Cook',         icon:'🍲', cost:50, wage:8,  mission:null,     desc:'Sells hot food: +2 gold for every guest served.'}
  };
  const MISSIONS = {
    poison:{name:'Poison their ale', icon:'☠️', catch:0.22, harm:true, desc:'Halves their customers tonight. −6 rep.'},
    steal: {name:'Steal their gold', icon:'💰', catch:0.25, harm:true, desc:'Take 15% of their gold (max 120).'},
    brawl: {name:'Start a brawl',    icon:'🪑', catch:0.18, harm:true, desc:'−50 gold damage, fewer customers, −4 rep.'},
    rumor: {name:'Spread rumors',    icon:'🗣️', catch:0.10, harm:true, desc:'−8 rep for them.'},
    spy:   {name:'Spy',              icon:'🔍', catch:0.12, selfOk:true, desc:'Learn their crew, gold and tonight\'s targets. Target YOUR tavern to hunt traitors.'},
    cover: {name:'Cover your tracks',icon:'🧹', catch:0, selfOnly:true, desc:'Your crew leaves only one clue tonight.'}
  };
  const QUIRKS = {
    proud:    {name:'Proud',     icon:'🦚', desc:'Refuses missions when Grumbling or worse.'},
    drunk:    {name:'Drunk',     icon:'🍷', desc:'Sometimes sleeps through the night.'},
    gossip:   {name:'Gossip',    icon:'💬', desc:'Brags. Victims often learn exactly who sent them.'},
    greedy:   {name:'Greedy',    icon:'🤑', desc:'Wage creeps up every other day.'},
    steadfast:{name:'Steadfast', icon:'🪨', desc:'Never drops below Content. Can\'t be bought by rivals.'},
    lucky:    {name:'Lucky',     icon:'🍀', desc:'Much less likely to get caught.'},
    clumsy:   {name:'Clumsy',    icon:'🫨', desc:'More likely to get caught, but hires cheap.'},
    sensitive:{name:'Sensitive', icon:'🥺', desc:'Loses loyalty fast when jailed or left idle.'}
  };
  const MOODS = ['', '😠 Disgruntled', '😒 Grumbling', '😐 Content', '🙂 Loyal', '😄 Devoted'];
  const PRICES = {cheap:{name:'Cheap',add:-2,appeal:18}, fair:{name:'Fair',add:0,appeal:0}, pricey:{name:'Pricey',add:3,appeal:-18}};
  const CREWS = [
    {name:'Your Tavern',    color:'golden',  css:'#ffc23d'},
    {name:'Rusty Flagon',   color:'crimson', css:'#ff4d6d', pers:'brute'},
    {name:"Goblin's Gulp",  color:'blue',    css:'#4cc9f0', pers:'sly'},
    {name:'Drunken Wyvern', color:'purple',  css:'#b15cff', pers:'schemer'},
    {name:'Gilded Mug',     color:'green',   css:'#3ee08f', pers:'merchant'}
  ];
  // Fair-clue traits: every crew has a unique combination, known to the whole city.
  const TRAITS = [
    {key:'boots', icon:'👢', vals:['muddy boots','polished boots'],   clue:v => `Footprints in the spilled ale: ${v}.`},
    {key:'scent', icon:'👃', vals:['pipe smoke','lavender perfume'],  clue:v => `The room still smells of ${v}.`},
    {key:'hand',  icon:'✋', vals:['left-handed','right-handed'],     clue:v => `The lock was forced by someone ${v}.`}
  ];
  const PERS = {
    brute:   {label:'Hot-headed brawler',  pref:['bruiser','pickpocket','taster'], attack:0.72, revenge:0.95, bribe:0.05, ale:0.3,  accuse:'bold',    cover:0},
    schemer: {label:'Cold schemer',        pref:['poisoner','spy','talker'],      attack:0.75, revenge:0.5,  bribe:0.12, ale:0.35, accuse:'careful', cover:0.8},
    sly:     {label:'Sly operator',        pref:['pickpocket','talker','spy'],    attack:0.7,  revenge:0.4,  bribe:0.22, ale:0.4,  accuse:'careful', cover:0.5},
    merchant:{label:'Careful merchant',    pref:['bard','cook','taster','waiter'],      attack:0.28, revenge:0.7,  bribe:0.05, ale:0.85, accuse:'sharp',   cover:0}
  };
  const NAMES = ['Grimsby','Vex','Old Tom','Morla','Pip','Sable','Dunk','Rook','Nettle','Bram','Lark','Corvin','Mags','Fenn','Hobb','Isolde',
    'Jasper','Kit','Moth','Quill','Rusk','Tansy','Wick','Zora','Dregg','Ash','Blythe','Crumb','Gus','Hester','Ivo','Juniper','Pell','Sorrel'];
  const TELLS = ['avoids eye contact','asks a lot about your rivals','pays with coins from another tavern','smells of someone else\'s ale',
    'keeps glancing at the door','was seen leaving a rival\'s back door','knows too much about your plans'];
  const FLAVOR = {
    poisoner:['hums while mixing drinks','keeps a garden of "herbs"','never eats what others cook','calls every bottle "darling"'],
    pickpocket:['returns your coin purse as a joke','has very quick hands','owes money to everyone','never stands still'],
    bruiser:['cries at bard songs','arm-wrestles for fun','collects broken stools','is gentle with cats'],
    spy:['remembers every face','speaks in whispers','was never seen arriving','writes everything down'],
    bard:['knows 300 drinking songs','is banned from two cities','flirts with everyone','tunes the lute all day'],
    taster:['can name any ale blindfolded','has a famous nose','is suspicious of everything','burps politely'],
    talker:['could sell sand in a desert','claims to know the Captain','has three different accents','never loses an argument'],
    waiter:['never spills a drop','remembers every order','has the fastest feet in town','smiles at everyone'],
    cellarer:['can carry two barrels at once','talks to the kegs','smells faintly of hops','knows every cellar in Ashveil'],
    watchman:['never seems to sleep','notices every new face','has eyes like a hawk','keeps a lantern lit all night'],
    cook:['makes a legendary stew','burns everything but the stew','sings while chopping','swears by garlic']
  };

  const byId = (s,id) => s.taverns[id];
  const pick = (arr, rng) => arr[Math.floor(rng()*arr.length)];
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  function shuffle(a, rng){ for (let i=a.length-1;i>0;i--){ const j = Math.floor(rng()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
  const aleCost = t => 80*t.ale;
  const score = t => t.gold + t.rep*5;
  const active = (t,type) => t.staff.filter(x => x.type===type && !x.jailed).length;
  const wealthTier = g => g < 200 ? 1 : g < 450 ? 2 : g < 800 ? 3 : 4;
  const ranking = s => s.taverns.slice().sort((a,b) => score(b) - score(a));
  const leaderId = s => { const r = ranking(s); return r.length > 1 && score(r[0]) > score(r[1]) ? r[0].id : null; };   // null when tied
  const isUnderdog = (s,t) => { const r = ranking(s), i = r.findIndex(x => x.id === t.id); return i >= Math.ceil(r.length/2) && score(r[0]) - score(t) > 40; };
  const maxStaff = (s,t) => (s.tutorial && t.id === 0) ? 1 : MAX_STAFF;
  const hireCost = (s,t,r) => Math.round(r.cost * (isUnderdog(s,t) ? 0.75 : 1));
  const mood = x => MOODS[clamp(x.loyalty,1,5)];
  const xpOf = t => t.stats.served;
  const levelOf = t => LEVELS.filter(L => xpOf(t) >= L.at).length;
  const unlocked = t => LEVELS.slice(0, levelOf(t)).flatMap(L => L.unlock);
  const refreshRecruits = (s, tid, rng=Math.random) => genRecruits(s, byId(s,tid), rng);

  function createGame({rivals=3, difficulty='normal', tutorial=false}, rng=Math.random){
    if (tutorial) rivals = 2;
    const s = {day:1, maxDays: tutorial ? TUT_DAYS : DAYS, difficulty, tutorial, over:false, nextId:1, taverns:[], news:[], history:[]};
    const combos = shuffle([0,1,2,3,4,5,6,7].map(i => [i&1,(i>>1)&1,(i>>2)&1]), rng);
    for (let i=0;i<=rivals;i++){
      const c = CREWS[i];
      s.taverns.push({id:i, name:c.name, color:c.color, css:c.css, pers:c.pers||null, isBot:i>0, traits:combos[i],
        aggr: 0.65 + rng()*0.65, targetStyle: pick(['leader','grudge','random','leader'], rng),
        gold:START_GOLD, rep:START_REP, ale:1, price:'fair', staff:[], recruits:[], incidents:[], intel:{}, suspicion:{}, proven:[],
        plan:{missions:[], bribe:0}, accusedToday:false, inbox:[], last:null, leaks:0,
        stats:{served:0, attacks:0, caught:0, accuseRight:0, accuseWrong:0, foiled:0, bribesPaid:0, bribesWon:0}});
    }
    s.taverns.forEach(t => genRecruits(s, t, rng));
    return s;
  }

  function newStaff(s, type, rng, opts={}){
    const base = STAFF[type], quirk = opts.quirk || pick(Object.keys(QUIRKS), rng);
    const moleFor = opts.moleFor === undefined ? null : opts.moleFor;
    const tell = moleFor !== null ? rng() < 0.65 : rng() < 0.12;
    return {id:s.nextId++, type, name:pick(NAMES,rng), quirk, cost:base.cost - (quirk==='clumsy'?15:0),
      wage:base.wage, loyalty: opts.loyalty || (2 + Math.floor(rng()*3)), moleFor, born:moleFor!==null, turned:false,
      note: tell ? pick(TELLS,rng) : pick(FLAVOR[type],rng), tell, jailed:0, exposed:false, idle:0, wins:0};
  }
  function genRecruits(s, t, rng){
    t.recruits = [];
    if (s.tutorial && t.id === 0){
      if (s.day === 1) t.recruits = [newStaff(s,'pickpocket',rng,{quirk:'steadfast',loyalty:4}), newStaff(s,'poisoner',rng,{quirk:'lucky',loyalty:4}), newStaff(s,'taster',rng,{quirk:'steadfast',loyalty:4})];
      return;
    }
    // the same line-up every day: two people for every kind of staff your level has unlocked
    const rivals = s.taverns.filter(o => o.id !== t.id), sly = rivals.find(o => o.pers === 'sly');
    unlocked(t).forEach(type => { for (let k=0;k<2;k++){
      let moleFor;
      if (!s.tutorial && s.day > 1 && rng() < 0.03 + (sly ? 0.015 : 0)) moleFor = (sly && rng() < 0.6) ? sly.id : pick(rivals, rng).id;
      t.recruits.push(newStaff(s, type, rng, {moleFor}));
    } });
  }

  // ---------------- daytime actions ----------------
  function hire(s, tid, rid){
    const t = byId(s,tid), r = t.recruits.find(x => x.id === rid);
    if (!r) return 'They already left';
    if (t.staff.length >= maxStaff(s,t)) return s.tutorial && tid===0 ? 'Just one hire in your first game!' : `Your crew is full (${maxStaff(s,t)})`;
    const c = hireCost(s,t,r); if (t.gold < c) return 'Not enough gold';
    t.gold -= c; t.recruits = t.recruits.filter(x => x !== r); t.staff.push(r); return null;
  }
  function fire(s, tid, sid){ const t = byId(s,tid); t.staff = t.staff.filter(x => x.id !== sid); t.plan.missions = t.plan.missions.filter(m => m.staffId !== sid); return null; }
  function upgradeAle(s, tid){ const t = byId(s,tid); if (t.ale >= 5) return 'Already the finest ale'; const c = aleCost(t);
    if (t.gold < c) return 'Not enough gold'; t.gold -= c; t.ale++; return null; }
  function setPrice(s, tid, p){ if (PRICES[p]) byId(s,tid).price = p; }
  function setBribe(s, tid, amt){ const t = byId(s,tid); t.plan.bribe = Math.max(0, Math.min(Math.round(amt), t.gold)); }
  function missionError(s, tid, m){
    const t = byId(s,tid), st = t.staff.find(x => x.id === m.staffId), M = MISSIONS[m.type];
    if (!st) return 'No such crew member'; if (st.jailed) return 'They are in jail';
    if (!M || STAFF[st.type].mission !== m.type) return 'They can\'t do that';
    if (!byId(s, m.target)) return 'Pick a target';
    if (M.selfOnly && m.target !== tid) return 'Only for your own tavern';
    if (m.target === tid && !M.selfOk && !M.selfOnly) return 'Pick a rival';
    return null;
  }
  function setMission(s, tid, m){ const err = missionError(s, tid, m); if (err) return err;
    const t = byId(s,tid); t.plan.missions = t.plan.missions.filter(x => x.staffId !== m.staffId); t.plan.missions.push({...m}); return null; }
  function clearMission(s, tid, sid){ const t = byId(s,tid); t.plan.missions = t.plan.missions.filter(x => x.staffId !== sid); }

  // estimated catch risk for a planned mission (ignores tonight's unknown bribe winner)
  function riskFor(s, tid, st, type, target){
    const t = byId(s,tid); let p = MISSIONS[type].catch; const L = leaderId(s);
    if (tid === L && s.taverns.length > 2) p += 0.15;
    if (target === L || t.proven.includes(target)) p -= 0.10;
    if (st.quirk === 'lucky') p -= 0.10; if (st.quirk === 'clumsy') p += 0.10;
    return clamp(p, 0.02, 0.6);
  }
  const isRevenge = (s,t,target) => target === leaderId(s) || t.proven.includes(target);

  // ---- fair deduction ----
  function candidates(s, victimId, inc){
    return s.taverns.filter(t => t.id !== victimId && inc.clues.every(c =>
      c.kind === 'trait' ? t.traits[c.trait] === c.val : (c.points === undefined || c.points === null || c.points === t.id))).map(t => t.id);
  }
  function accuse(s, tid, incId, suspect){
    const t = byId(s,tid), inc = t.incidents.find(x => x.id === incId), S = byId(s,suspect);
    if (!inc || !S) return {err:'Unknown case'}; if (inc.solved) return {err:'Case already solved'};
    if (t.accusedToday) return {err:'Only one accusation per day'};
    if (inc.accused.includes(suspect)) return {err:'You already accused them for this'};
    if (suspect === tid) return {err:'You can\'t accuse yourself'};
    t.accusedToday = true; inc.accused.push(suspect);
    const what = MISSIONS[inc.type].name.toLowerCase();
    if (inc.culprit === suspect){
      const fine = Math.min(80, S.gold); S.gold -= fine; S.rep = Math.max(0, S.rep-10); t.rep = Math.min(100, t.rep+6);
      inc.solved = true; t.stats.accuseRight++; if (!t.proven.includes(suspect)) t.proven.push(suspect);
      const msg = `⚖️ ${t.name} proved ${S.name} was behind the "${what}" attack! ${S.name} was fined ${fine} gold.`;
      s.news.push(msg); S.inbox.push({kind:'bad', text:`⚖️ ${t.name} proved you attacked them. −${fine} gold, −10 rep. They'll want revenge.`});
      return {ok:true, correct:true, fine, msg};
    }
    t.rep = Math.max(0, t.rep-8); S.rep = Math.min(100, S.rep+3); t.stats.accuseWrong++;
    const msg = `⚖️ ${t.name} accused ${S.name}, but had it wrong. The city laughs.`;
    s.news.push(msg); S.inbox.push({kind:'news', text:`⚖️ ${t.name} wrongly accused you. +3 rep from sympathy.`});
    return {ok:true, correct:false, msg};
  }

  // ---------------- night ----------------
  function rollNight(s, rng=Math.random){
    // blind all-pay auction: every bid is paid, win or lose
    let fav = null, best = 0, tie = false; const bids = {};
    s.taverns.forEach(t => {
      const b = Math.min(t.plan.bribe||0, t.gold); bids[t.id] = b; t.gold -= b; if (b) t.stats.bribesPaid += b;
      const eff = b * (active(t,'talker') ? 1.5 : 1) * (isUnderdog(s,t) ? 1.3 : 1);
      if (eff > best){ best = eff; fav = t.id; tie = false; } else if (eff === best && eff > 0) tie = true;
    });
    if (tie) fav = null; if (fav !== null) byId(s,fav).stats.bribesWon++;
    const L = leaderId(s), events = [];
    s.taverns.forEach(t => t.plan.missions.forEach(m => {
      const st = t.staff.find(x => x.id === m.staffId); if (!st || st.jailed || missionError(s, t.id, m)) return;
      const M = MISSIONS[m.type], T = byId(s, m.target);
      const ev = {id:s.nextId++, by:t.id, target:m.target, type:m.type, staffId:st.id, staffName:st.name, staffType:st.type, quirk:st.quirk,
        refused:false, slept:false, foiled:false, caught:false, blocked:false, fav:fav===t.id};
      if (st.quirk === 'proud' && st.loyalty <= 2) ev.refused = true;
      else if (st.quirk === 'drunk' && rng() < 0.2) ev.slept = true;
      else {
        const otherMoles = t.staff.filter(x => x.moleFor !== null && x.id !== st.id);
        if (M.harm){
          if (otherMoles.some(x => x.moleFor === m.target) && rng() < 0.7) ev.foiled = true;
          else if (otherMoles.length && rng() < 0.15) ev.foiled = true;
          if (st.moleFor !== null && rng() < 0.5) ev.foiled = true;
        }
        let p = M.catch;
        if (fav === t.id) p = 0;
        else { if (fav !== null) p += 0.15; if (t.id === L && s.taverns.length > 2) p += 0.15; if (m.target === L || t.proven.includes(m.target)) p -= 0.10;
          if (st.quirk === 'lucky') p -= 0.10; if (st.quirk === 'clumsy') p += 0.10; p += 0.08*active(T,'watchman'); p = clamp(p, 0.02, 0.6); }
        if (s.tutorial && s.day === 1 && t.id === 1 && m.target === 0) p = 0;   // scripted lesson: this theft always lands
        ev.catchP = p;
        ev.caught = !ev.foiled && rng() < p;
        if (m.type==='poison' && active(T,'taster')) ev.blocked = true;
        if (m.type==='brawl' && active(T,'bruiser') && rng() < 0.6) ev.blocked = true;
        if (m.type==='steal' && active(T,'bruiser') && rng() < 0.3) ev.blocked = true;
      }
      events.push(ev);
    }));
    shuffle(events, rng);
    return {events, fav, bids};
  }
  const outcome = e => e.refused ? 'refused' : e.slept ? 'slept' : e.foiled ? 'foiled' : e.caught ? 'caught' : e.blocked ? 'blocked' : 'success';

  function makeClues(s, A, T, rng, cover, gossip){
    const clues = [], order = shuffle([0,1,2], rng);
    const r0 = rng(), n = s.tutorial ? 3 : cover ? 1 : (r0 < 0.22 ? 3 : r0 < 0.6 ? 2 : 1);
    for (let k=0;k<n;k++){ const i = order[k], tr = TRAITS[i]; clues.push({kind:'trait', trait:i, val:A.traits[i], text:tr.clue(tr.vals[A.traits[i]]), icon:tr.icon}); }
    if (!cover && rng() < 0.15) clues.push({kind:'color', text:`A ${A.color} thread was snagged on the window latch.`, points:A.id, sure:true, icon:'🧵'});
    if (active(T,'spy') && rng() < 0.6) clues.push({kind:'spy', text:`Your Spy tailed the culprit all the way back to ${A.name}!`, points:A.id, sure:true, icon:'🕵️'});
    if (gossip && rng() < 0.5) clues.push({kind:'gossip', text:`A loose-lipped agent was overheard bragging about working for ${A.name}.`, points:A.id, sure:true, icon:'💬'});
    return clues;
  }

  function applyNight(s, roll, rng=Math.random){
    const {events, fav, bids} = roll, rep = {}, news = [];
    s.taverns.forEach(t => { rep[t.id] = {msgs:[], newIncidents:[], income:0, served:0, wages:0, bid:bids[t.id]||0, wonBribe:fav===t.id}; t.flags = {}; });
    const say = (id, cat, kind, text) => rep[id].msgs.push({cat, kind, text});
    if (fav !== null){ say(fav,'mission','good',`🪙 You won the Captain's favour with ${bids[fav]} gold. Your agents were untouchable tonight.`);
      news.push('🪙 Rumor says someone had the Guard Captain in their pocket tonight.'); }
    s.taverns.forEach(t => { if (bids[t.id] > 0 && t.id !== fav) say(t.id,'mission','bad',`🪙 Your ${bids[t.id]} gold bribe was outbid. The Captain kept it anyway.`); });
    events.forEach(e => { if (e.type==='cover' && ['success','blocked'].includes(outcome(e))) byId(s,e.by).flags.cover = true; });

    events.forEach(e => {
      const A = byId(s,e.by), T = byId(s,e.target), M = MISSIONS[e.type], st = A.staff.find(x => x.id === e.staffId), o = outcome(e);
      const where = e.target === A.id ? ' at home' : ' at '+T.name;
      if (o === 'refused'){ say(A.id,'crew','bad',`🦚 ${e.staffName} refused your orders. "Not for this pay, not with this treatment."`); return; }
      if (o === 'slept'){ say(A.id,'crew','bad',`🍷 ${e.staffName} drank too much and slept through the mission.`); return; }
      A.staff.filter(x => x.moleFor !== null && x.id !== e.staffId).forEach(x => {
        const master = byId(s, x.moleFor); if (!master || master.id === A.id) return;
        say(master.id,'intel','intel',`🐀 Your mole ${x.name} reports: ${A.name} sent a ${STAFF[e.staffType].name} to ${M.name.toLowerCase()}${where}.`);
        if (e.target === master.id) master.suspicion[A.id] = (master.suspicion[A.id]||0) + 6;
      });
      if (e.type === 'cover'){ say(A.id,'mission', o==='success'||o==='blocked' ? 'good':'bad', o==='success'||o==='blocked' ? `🧹 ${e.staffName} covered your tracks. Victims find only one clue tonight.` : `🧹 ${e.staffName} failed to cover your tracks.`);
        if (st && (o==='success'||o==='blocked')){ st.loyalty++; st.wins++; } return; }
      if (o === 'foiled'){ A.stats.foiled++; A.leaks++;
        say(A.id,'mission','bad',`🚨 ${e.staffName} walked into an ambush${where}. They KNEW you were coming. Was your plan leaked?`);
        if (e.target !== A.id) say(T.id,'you','good',`🛡️ You were tipped off and stopped someone trying to ${M.name.toLowerCase()} you.`);
        return; }
      if (o === 'caught'){
        const fine = Math.min(50, A.gold); A.gold -= fine; A.rep -= 8; if (st){ st.jailed = 2; st.loyalty -= st.quirk==='sensitive' ? 2 : 1; } A.stats.caught++;
        say(A.id,'mission','bad',`⛓️ The Guard caught ${e.staffName}! −${fine} gold, −8 rep. Jailed for 2 nights.`);
        news.push(`⛓️ The Guard caught an agent of ${A.name} trying to ${M.name.toLowerCase()}${e.target===A.id?'':' at '+T.name}!`);
        if (e.target !== A.id){ T.suspicion[A.id] = (T.suspicion[A.id]||0) + 8; say(T.id,'you','good',`⛓️ The Guard caught ${A.name}'s agent trying to ${M.name.toLowerCase()} you!`); }
        return; }
      if (st){ st.loyalty++; st.wins++; }
      if (e.type === 'spy'){
        if (e.target === A.id){
          const moles = A.staff.filter(x => x.moleFor !== null && x.id !== e.staffId), found = moles.filter(() => rng() < 0.8);
          found.forEach(x => { x.exposed = true; A.suspicion[x.moleFor] = (A.suspicion[x.moleFor]||0) + 4;
            say(A.id,'intel','intel',`🕵️ ${e.staffName} exposed a TRAITOR: ${x.name} secretly works for ${byId(s,x.moleFor).name}! Fire them.`); });
          if (!found.length) say(A.id,'intel','intel',`🕵️ ${e.staffName} watched your crew all night. No traitor found${moles.length?'… this time':''}.`);
        } else {
          const tonight = events.filter(x => x.by===T.id && ['success','blocked','caught'].includes(outcome(x)) && x.type!=='cover' && !(x.type==='spy' && x.target===T.id)).map(x => ({type:x.type, target:x.target}));
          A.intel[T.id] = {day:s.day, staff:T.staff.map(x => x.type), gold:T.gold, attacks:tonight, ale:T.ale};
          say(A.id,'intel','intel',`🔍 ${e.staffName} spied on ${T.name}: crew ${T.staff.map(x=>STAFF[x.type].icon).join(' ')||'none'}, about ${Math.round(T.gold/10)*10} gold.`
            + (tonight.length ? ' Tonight they hit: ' + tonight.map(x => MISSIONS[x.type].icon+' '+byId(s,x.target).name).join(', ') + '.' : ' They made no moves tonight.'));
          tonight.forEach(x => { if (x.target === A.id) A.suspicion[T.id] = (A.suspicion[T.id]||0) + 10; });
        }
        return;
      }
      const inc = {id:s.nextId++, day:s.day, type:e.type, culprit:A.id, blocked:o==='blocked', clues:[], solved:false, accused:[]};
      if (o === 'blocked'){
        const who = e.type==='poison' ? 'Taster' : 'Bruiser';
        say(A.id,'mission','bad',`🛡️ ${e.staffName}'s attempt to ${M.name.toLowerCase()} at ${T.name} was stopped by their ${who}.`);
        say(T.id,'you','good',`🛡️ Your ${who} stopped someone trying to ${M.name.toLowerCase()} you!`);
      } else {
        A.stats.attacks++;
        if (e.type==='poison'){ T.flags.poisoned = true; T.rep -= 6; say(A.id,'mission','good',`☠️ ${e.staffName} poisoned ${T.name}'s keg.`);
          say(T.id,'you','bad','☠️ Someone poisoned your keg! Half your customers fled. −6 rep.'); news.push(`🤢 Customers at ${T.name} got violently sick.`); }
        if (e.type==='steal'){ const amt = Math.round(Math.min(120, Math.max(0,T.gold)*0.15)); T.gold -= amt; A.gold += amt;
          say(A.id,'mission','good',`💰 ${e.staffName} lifted ${amt} gold from ${T.name}.`); say(T.id,'you','bad',`💰 A thief stole ${amt} gold from your till!`); }
        if (e.type==='brawl'){ const d = Math.min(50, Math.max(0,T.gold)); T.gold -= d; T.rep -= 4; T.flags.brawled = true;
          say(A.id,'mission','good',`🪑 ${e.staffName} turned ${T.name} into a war zone.`); say(T.id,'you','bad',`🪑 A brawl wrecked your tavern! −${d} gold, −4 rep.`);
          news.push(`🪑 A huge brawl broke out at ${T.name}.`); }
        if (e.type==='rumor'){ T.rep -= 8; say(A.id,'mission','good',`🗣️ ${e.staffName} spread nasty rumors about ${T.name}.`);
          say(T.id,'you','bad','🗣️ Ugly rumors about your tavern are spreading. −8 rep.'); }
      }
      inc.clues = makeClues(s, A, T, rng, !!A.flags.cover, e.quirk === 'gossip');
      T.incidents.push(inc); rep[T.id].newIncidents.push(inc.id);
    });

    // traitors skim the till
    s.taverns.forEach(t => t.staff.forEach(x => {
      if (x.moleFor === null || x.jailed || rng() >= 0.25) return;
      const amt = Math.min(40, Math.round(t.gold*0.06)); if (amt <= 0) return;
      t.gold -= amt; byId(s,x.moleFor).gold += amt; t.leaks++;
      say(t.id,'crew','bad',`🐀 ${amt} gold went missing from your till overnight…`);
    }));

    // customers and money
    const n = s.taverns.length, crowd = 30 + 15*n;
    const under = new Set(s.taverns.filter(t => isUnderdog(s,t)).map(t => t.id));
    const ap = s.taverns.map(t => { let a = 10 + t.ale*8 + t.rep*0.4 + Math.min(2,active(t,'bard'))*12 + Math.min(2,active(t,'waiter'))*5 + Math.min(1,active(t,'cook'))*5 + PRICES[t.price].appeal + (under.has(t.id) ? 15 : 0) - (t.id === leaderId(s) && s.taverns.length > 2 ? 6 : 0);
      if (t.flags.poisoned) a *= 0.5; if (t.flags.brawled) a *= 0.75; return Math.max(2, a); });
    const tot = ap.reduce((a,b)=>a+b,0);
    s.taverns.forEach((t,i) => {
      const cap = 26 + t.ale*3, served = Math.min(cap, Math.round(crowd*ap[i]/tot)), price = 6 + t.ale + PRICES[t.price].add;
      const income = served*price, wages = t.staff.filter(x => !x.jailed).reduce((a,x)=>a+x.wage,0) + 10;
      t.gold += income - wages; t.stats.served += served;
      if (under.has(t.id) && !s.tutorial){ t.gold += 40; say(t.id,'crew','good','🤝 The locals rally behind the underdog: +40 gold and extra customers.'); }
      if (served >= cap*0.85) t.rep += 3;
      t.rep += (55 - t.rep) * 0.15 + active(t,'bard');   // reputations recover over time
      Object.assign(rep[t.id], {income, served, wages, price, poisoned:!!t.flags.poisoned, brawled:!!t.flags.brawled});
      const unpaid = t.gold < 0;
      if (unpaid){ t.gold = 0; t.rep -= 5; t.staff.forEach(x => x.loyalty--); say(t.id,'crew','bad','💸 You couldn\'t pay full wages. Your whole crew is unhappy. −5 rep.'); }
    });

    // crew moods: idleness, greed, quitting, being bought
    s.taverns.forEach(t => {
      const planned = new Set(t.plan.missions.map(m => m.staffId));
      t.staff.slice().forEach(x => {
        if (x.jailed > 0){ x.jailed--; return; }
        if (STAFF[x.type].mission){
          if (planned.has(x.id)) x.idle = 0;
          else { x.idle++; if (x.idle >= (x.quirk==='sensitive' ? 1 : 2)){ x.loyalty--; x.idle = 0; say(t.id,'crew','bad',`😒 ${x.name} feels ignored. Agents want work.`); } }
        }
        if (x.quirk === 'greedy' && s.day % 2 === 0){ x.wage += 2; say(t.id,'crew','news',`🤑 ${x.name} demanded a raise. Wage now ${x.wage}g.`); }
        if (x.quirk === 'steadfast') x.loyalty = Math.max(3, x.loyalty);
        x.loyalty = clamp(x.loyalty, 1, 5);
        if (x.loyalty === 1 && x.moleFor === null && x.quirk !== 'steadfast' && !s.tutorial){
          const sly = s.taverns.find(o => o.pers === 'sly' && o.id !== t.id);
          if (rng() < 0.25 + (sly ? 0.12 : 0)){
            const others = s.taverns.filter(o => o.id !== t.id), master = sly && rng() < 0.6 ? sly : pick(others, rng);
            x.moleFor = master.id; x.turned = true;
            say(master.id,'intel','intel',`🐀 ${x.name}, a disgruntled ${STAFF[x.type].name} at ${t.name}, now secretly works for you.`);
          } else if (rng() < 0.2){
            t.staff = t.staff.filter(y => y !== x); t.plan.missions = t.plan.missions.filter(m => m.staffId !== x.id);
            say(t.id,'crew','bad',`🚪 ${x.name} had enough and walked out.`);
          }
        }
      });
      t.rep = clamp(Math.round(t.rep), 0, 100); t.gold = Math.round(t.gold);
      t.plan = {missions:[], bribe:0}; t.accusedToday = false; t.last = rep[t.id]; delete t.flags;
    });

    s.taverns.forEach(t => { for (const id in t.suspicion) t.suspicion[id] *= 0.8; });
    s.history.push({day:s.day, fav, bids:{...bids}, events:events.map(e => ({by:e.by, target:e.target, type:e.type, staffName:e.staffName, outcome:outcome(e)}))});
    s.news = news;
    s.day++;
    if (s.day > s.maxDays){ s.over = true; s.day = s.maxDays; }
    else s.taverns.forEach(t => genRecruits(s, t, rng));
    return {perTavern:rep, news, fav};
  }

  // ---------------- bot brains (own knowledge + public info only) ----------------
  function botDay(s, tid, rng=Math.random){
    const t = byId(s,tid), d = s.difficulty, P = PERS[t.pers];
    const care = {easy:0.3, normal:0.6, hard:0.85}[d], diffMul = {easy:0.7, normal:1, hard:1.15}[d];
    t.staff.filter(x => x.exposed || (x.loyalty === 1 && rng() < care*0.6)).forEach(x => fire(s, tid, x.id));
    // accusations: by deduction
    if (!t.accusedToday){
      for (const inc of t.incidents.slice().reverse()){
        if (inc.solved) continue;
        const cand = candidates(s, tid, inc).filter(id => !inc.accused.includes(id));
        if (!cand.length) continue;
        cand.sort((a,b) => (t.suspicion[b]||0) - (t.suspicion[a]||0));
        const sure = cand.length === 1, leaning = cand.length === 2 && (t.suspicion[cand[0]]||0) > (t.suspicion[cand[1]]||0) + 4;
        if (sure && rng() < care + 0.2 || leaning && P.accuse !== 'sharp' && rng() < care*0.6 || cand.length === 2 && P.accuse === 'bold' && rng() < 0.45){
          accuse(s, tid, inc.id, cand[0]); break; }
      }
    }
    // hire (react to what hurt them)
    const want = s.tutorial ? 2 : {easy:3, normal:4, hard:5}[d];
    const pref = P.pref.slice();
    if (t.last && t.last.poisoned && !active(t,'taster')) pref.unshift('taster');
    if (t.last && t.last.brawled && !active(t,'bruiser')) pref.unshift('bruiser');
    if (t.leaks && !t.staff.some(x => x.type==='spy')) pref.unshift('spy');
    const w = r => (pref.indexOf(r.type) >= 0 ? 4 - Math.min(3, pref.indexOf(r.type)) : 0) + rng()*1.5 - (r.quirk==='clumsy'||r.quirk==='drunk' ? 0.8 : 0);
    if (s.tutorial && tid === 1 && s.day === 1 && !t.staff.some(x => x.type==='pickpocket')) t.staff.push(newStaff(s,'pickpocket',rng,{quirk:'steadfast',loyalty:4}));
    const seen = shuffle(t.recruits.slice(), rng).slice(0, 5);   // bots only meet a few job-seekers each day
    for (let g=0; g<4 && t.staff.length < want; g++){
      const reserve = 60 + t.staff.reduce((a,x)=>a+x.wage,0);
      const opts = seen.filter(r => t.recruits.includes(r) && hireCost(s,t,r) <= t.gold - reserve && !(r.tell && rng() < care));
      if (!opts.length) break;
      opts.sort((a,b) => w(b) - w(a)); hire(s, tid, opts[0].id);
    }
    if (t.ale < 5 && t.gold > aleCost(t) + 160 && rng() < P.ale) upgradeAle(s, tid);
    t.price = (t.pers==='merchant' && t.rep < 45) ? 'cheap' : (t.pers==='merchant' && t.rep > 75 ? 'pricey' : 'fair');
    // missions
    const rivals = s.taverns.filter(x => x.id !== tid), L0 = leaderId(s), L = (L0 === null || L0 === tid) ? (rivals.slice().sort((a,b) => score(b)-score(a))[0].id) : L0;
    let grudge = null, g = 0;
    for (const k in t.suspicion){ if (+k !== tid && t.suspicion[k] > g){ g = t.suspicion[k]; grudge = +k; } }
    t.proven.forEach(id => { if ((t.suspicion[id]||0) + 6 > g){ g = (t.suspicion[id]||0) + 6; grudge = id; } });
    const underdog = isUnderdog(s,t);
    const chooseTarget = () => {
      if (s.tutorial) return tid === 1 && s.day === 1 ? 0 : pick(rivals.filter(x => x.id !== 0), rng).id;
      if (grudge !== null && g > 3 && rng() < P.revenge) return grudge;
      if (underdog && L !== tid && rng() < 0.6) return L;
      const st = t.targetStyle;
      if (st === 'leader') return L !== tid ? L : pick(rivals,rng).id;
            if (st === 'grudge' && grudge !== null) return grudge;
      return rng() < 0.5 && L !== tid ? L : pick(rivals,rng).id;
    };
    let attacks = 0;
    t.staff.forEach(st => {
      const m = STAFF[st.type].mission; if (!m || st.jailed || m === 'cover') return;
      if (s.tutorial && tid === 1 && s.day === 1 && st.type === 'pickpocket'){ setMission(s, tid, {staffId:st.id, type:'steal', target:0}); attacks++; return; }
      if (s.tutorial && !(tid === 1 && s.day === 1)) { if (rng() < 0.5) return; }
      if (m === 'spy'){ const self = t.leaks >= 1 && rng() < 0.8;
        setMission(s, tid, {staffId:st.id, type:'spy', target: self ? tid : (grudge !== null ? grudge : L !== tid ? L : pick(rivals,rng).id)}); if (self) t.leaks = 0; return; }
      if (m === 'rumor' && t.pers === 'merchant' && rng() < 0.6) return;   // merchants keep bards home
      const chance = Math.min(0.97, P.attack * t.aggr * diffMul * (underdog ? 1.2 : 1) * (s.day === s.maxDays ? 1.3 : 1));
      if (rng() > chance) return;
      setMission(s, tid, {staffId:st.id, type:m, target:chooseTarget()}); attacks++;
    });
    const tk = t.staff.find(x => x.type==='talker' && !x.jailed);
    if (tk && attacks >= 1 && rng() < P.cover) setMission(s, tid, {staffId:tk.id, type:'cover', target:tid});
    else if (tk && attacks === 0) { /* idle talker */ }
    t.plan.bribe = attacks ? Math.round(Math.min(t.gold*0.4, t.gold * P.bribe * (0.5 + rng()) * (underdog ? 1.3 : 1))) : 0;
  }

  return {DAYS, TUT_DAYS, MAX_STAFF, STAFF, MISSIONS, QUIRKS, MOODS, PRICES, CREWS, TRAITS, PERS,
    createGame, hire, fire, upgradeAle, setPrice, setBribe, setMission, clearMission, missionError, riskFor, isRevenge,
    accuse, candidates, rollNight, applyNight, outcome, botDay, ranking, score, aleCost, wealthTier, active, leaderId, isUnderdog,
    hireCost, maxStaff, mood, LEVELS, levelOf, unlocked, refreshRecruits};
})();
if (typeof module !== 'undefined') module.exports = PP;
if (typeof window !== 'undefined') window.PP = PP;
