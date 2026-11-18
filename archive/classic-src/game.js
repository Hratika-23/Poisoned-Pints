// =====================================================================
// GAME STATE + UI
// =====================================================================
const ME = 0;
let S = null, phase = 'menu', token = 0, setup = {rivals:3, diff:'normal', mode:'tut'}, tab = null;
let tipsOff = false, tipIdx = 0, seenCases = 0, tut = 0, skipNow = false, clipFigs = [];
const STAFF = PP.STAFF, MISSIONS = PP.MISSIONS, QUIRKS = PP.QUIRKS, TRAITS = PP.TRAITS;
const me = () => S.taverns[ME];
const isLeader = id => { if (S.taverns.length <= 2) return false; const r = PP.ranking(S); return r[0].id === id && PP.score(r[0]) > PP.score(r[1]); };
const tname = id => S.taverns[id].name;
const dotOf = id => `<span class="dotc" style="background:${S.taverns[id].css}"></span>`;
const traitChips = (t, hits) => TRAITS.map((tr,i) => `<span class="chip ${hits && hits.has(i) ? 'hit' : ''}">${tr.icon} ${tr.vals[t.traits[i]]}</span>`).join('');
const quirkChip = x => `<span class="chip">${QUIRKS[x.quirk].icon} ${QUIRKS[x.quirk].name}</span>`;
const moodChip = x => `<span class="chip ${x.loyalty<=2?'bad':x.loyalty>=4?'good':''}">${PP.mood(x)}</span>`;

function show(id){ ['#mMain','#mSetup','#mHow','#mEnd','#lDay','#lNight'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }
let bannerTimer = 0;
function banner(txt, color, small, dur=1.6){ const b = $('#banner'); b.innerHTML = `<span style="color:${color}">${txt}</span>${small?`<small>${small}</small>`:''}`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(()=>b.classList.remove('show'), dur*1000); }
function modal(html, lock){ $('#modal').innerHTML = html; $('#modalLayer').classList.remove('hidden'); $('#modal').scrollTop = 0; if (lock) $('#modal').dataset.lock = '1'; else delete $('#modal').dataset.lock; }
function closeModal(){ $('#modalLayer').classList.add('hidden'); delete $('#modal').dataset.lock; }
$('#modalLayer').addEventListener('click', e => { if ((e.target.id === 'modalLayer' && !$('#modal').dataset.lock) || e.target.closest('[data-close]')) closeModal(); });
const toast = t => banner(t, '#fff', null, 1.3);

// ---------------- menus ----------------
try { if (localStorage.getItem('pp-played')) { setup.mode = 'full'; } } catch(e){}
function renderSetup(){
  [...$('#sMode').children].forEach(b => b.classList.toggle('on', b.dataset.v === setup.mode));
  $('#fullOpts').classList.toggle('hidden', setup.mode !== 'full');
  $('#modeNote').textContent = setup.mode === 'tut' ? 'Hire one crew member, send one mission, and solve your first crime. Takes about 5 minutes.'
    : '7 days and nights against bots with their own styles. About 20 minutes.';
}
$('#bPlay').onclick = () => { audioInit(); renderSetup(); show('#mSetup'); };
$('#bHow').onclick = () => show('#mHow');
$$('[data-back]').forEach(b => b.onclick = () => show('#mMain'));
$('#sMode').onclick = e => { const b = e.target.closest('button'); if (!b) return; setup.mode = b.dataset.v; renderSetup(); };
$('#sRivals').onclick = e => { const b = e.target.closest('button'); if (!b) return; [...$('#sRivals').children].forEach(x => x.classList.toggle('on', x===b)); setup.rivals = +b.textContent; };
$('#sDiff').onclick = e => { const b = e.target.closest('button'); if (!b) return; [...$('#sDiff').children].forEach(x => x.classList.toggle('on', x===b)); setup.diff = b.dataset.v; };
$('#bGo').onclick = () => startGame();
$('#dMenu').onclick = () => { modal(`<h2>Paused</h2><div class="row"><button class="btn green" data-close>Resume</button></div>
  <div class="row"><button class="btn ghost sm" id="pTips">${tipsOff?'Turn tips ON':'Turn tips OFF'}</button><button class="btn ghost sm" id="pMute">${muted?'Sound ON':'Sound OFF'}</button></div>
  <div class="row"><button class="btn pink sm" id="pQuit">Quit to menu</button></div>`);
  $('#pQuit').onclick = () => { closeModal(); toMenu(); };
  $('#pTips').onclick = () => { tipsOff = !tipsOff; closeModal(); renderAdvisor(); };
  $('#pMute').onclick = () => { muted = !muted; closeModal(); }; };
$('#dHelp').onclick = () => helpFor(tab);
function toMenu(){ token++; phase = 'menu'; closeModal(); show('#mMain'); buildMenuScene(); }

function startGame(){
  token++; audioInit(); closeModal();
  const tutorial = setup.mode === 'tut';
  S = PP.createGame({rivals:setup.rivals, difficulty: tutorial ? 'easy' : setup.diff, tutorial});
  buildWorld(S.taverns.map(t => ({name:t.name, css:t.css})));
  tut = tutorial ? 1 : 0; tipIdx = 0; seenCases = 0; dayF = 0; dayTarget = 0; cam.pos.set(0,70,60);
  startDay(true);
}

// ---------------- DAY ----------------
function startDay(first){
  phase = 'day'; dayTarget = 0; speedMul = 1;
  clearCustomers(); clearClip();
  W.taverns.forEach(t => { t.poisonViz = 0; t.ringOn = false; t.seats.forEach(s => s.stool.visible = true); });
  W.guard.root.visible = false; W.arrow.visible = false;
  S.taverns.forEach(t => { if (t.isBot) PP.botDay(S, t.id); });
  if (S.tutorial && S.day === 2) tut = 10;
  if (S.tutorial && S.day === 3) tut = 20;
  show('#lDay'); setTab(null); sync3D(); renderTop();
  if (!first) sfx.rooster();
  banner(`DAY ${S.day}`, '#ffc23d', S.day === S.maxDays ? 'The final day. Make it count!' : 'Time to scheme.', 1.6);
  const inbox = me().inbox.splice(0);
  if (inbox.length) setTimeout(() => { if (phase === 'day') modal(`<h2>📨 This morning…</h2>${inbox.map(m=>`<div class="rline ${m.kind}">${esc(m.text)}</div>`).join('')}
    <div class="row"><button class="btn" data-close>OK</button></div>`); }, 900);
  renderAdvisor();
}
function renderTop(){
  const p = me();
  $('#dTitle').innerHTML = `DAY ${S.day}<small>OF ${S.maxDays}${S.tutorial?' · LEARN':''}</small>`;
  $('#dGold').textContent = '💰 ' + p.gold; $('#dRep').textContent = '⭐ ' + p.rep;
  const st = $('#dStand'), under = PP.isUnderdog(S,p), lead = isLeader(ME);
  st.className = 'pill' + (under ? ' under' : lead ? ' lead' : ''); st.innerHTML = under ? '🐾<span class="t"> Underdog</span>' : lead ? '👑<span class="t"> Leader</span>' : '⚖️<span class="t"> In the race</span>';
  st.classList.toggle('hidden', S.taverns.length <= 2 && !under);
  const unsolved = p.incidents.filter(i => !i.solved).length;
  [['crew', !p.staff.length && p.recruits.length],
   ['missions', p.staff.some(x => STAFF[x.type].mission && !x.jailed && !p.plan.missions.find(m=>m.staffId===x.id))],
   ['case', p.incidents.length > seenCases && unsolved]].forEach(([k,on]) => {
    const b = $(`#tabs [data-tab=${k}]`); let d = b.querySelector('.dot'); if (on && !d){ d = document.createElement('span'); d.className = 'dot'; b.appendChild(d); } if (!on && d) d.remove(); });
}
$('#dStand').addEventListener('click', () => {});
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; sfx.click(); setTab(tab === b.dataset.tab ? null : b.dataset.tab); });
$('#panelX').onclick = () => setTab(null);
$('#nightBtn').onclick = () => { sfx.click(); confirmNight(); };

function setTab(t){
  tab = t; panelOpen = !!t;
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#panel').classList.toggle('closed', !t);
  if (t === 'case') seenCases = me().incidents.length;
  if (t === 'missions') camCity(); else camTavern(ME);
  if (tut === 1 && t === 'crew') tut = 2;
  if (tut === 3 && t === 'missions') tut = 4;
  if (tut === 5 && t === 'bribe') tut = 6;
  if (tut === 10 && t === 'case') tut = 11;
  if (tut === 12 && t === 'missions') tut = 13;
  renderPanel(); renderTop(); renderAdvisor();
}
function renderPanel(){
  if (!tab) return;
  const titles = {crew:'👥 Your Crew', missions:'🗺️ Tonight\'s Missions', bribe:'🪙 Bribe the Captain', case:'🔍 Case File', tavern:'🍺 Your Tavern'};
  $('#panelTitle').textContent = titles[tab];
  $('#panelBody').innerHTML = ({crew:crewHTML, missions:missionsHTML, bribe:bribeHTML, case:caseHTML, tavern:tavernHTML})[tab]();
}
function refresh(){ renderTop(); renderPanel(); sync3D(); renderAdvisor(); }

// ---- crew ----
function staffStatus(x){
  const p = me(), m = p.plan.missions.find(y => y.staffId === x.id);
  if (x.jailed) return `<span class="chip bad">⛓️ Jailed ${x.jailed} more night${x.jailed>1?'s':''}</span>`;
  if (m) return `<span class="chip gold">${MISSIONS[m.type].icon} ${MISSIONS[m.type].name} → ${m.target===ME?'home':esc(tname(m.target))}</span>`;
  if (!STAFF[x.type].mission) return `<span class="chip good">🏠 Guards your tavern</span>`;
  return `<span class="chip">💤 No orders</span>`;
}
function crewHTML(){
  const p = me(), max = PP.maxStaff(S,p), under = PP.isUnderdog(S,p);
  let h = `<div class="sec">Your crew (${p.staff.length}/${max}) · wages ${p.staff.filter(x=>!x.jailed).reduce((a,x)=>a+x.wage,0)+10}g a night</div>`;
  if (!p.staff.length) h += `<div class="empty">Nobody works for you yet. Hire someone from the door below. 👇</div>`;
  p.staff.forEach(x => { const S0 = STAFF[x.type];
    h += `<div class="item"><div class="ic">${S0.icon}</div><div class="tx"><b>${esc(x.name)} · ${S0.name}</b><small>${S0.desc}</small>
      <div class="chips">${moodChip(x)}${quirkChip(x)}${staffStatus(x)}${x.exposed?'<span class="chip bad">🐀 TRAITOR</span>':''}</div>
      <i>“${esc(x.name)} ${esc(x.note)}.”</i><small style="margin-top:3px">${QUIRKS[x.quirk].desc}</small></div>
      <button class="mini ghost" data-fire="${x.id}">Fire</button></div>`; });
  h += `<div class="sec">At your door today ${under ? '· 🐾 underdog prices (−25%)' : ''}</div>`;
  if (!p.recruits.length) h += `<div class="empty">No one else is looking for work today.</div>`;
  p.recruits.forEach(r => { const S0 = STAFF[r.type], cost = PP.hireCost(S,p,r), can = p.gold >= cost && p.staff.length < max;
    h += `<div class="item recruit"><div class="ic">${S0.icon}</div><div class="tx"><b>${esc(r.name)} · ${S0.name}</b><small>${S0.desc} Wage ${r.wage}g a night.</small>
      <div class="chips">${moodChip(r)}${quirkChip(r)}</div><i>Note: ${esc(r.name)} ${esc(r.note)}.</i><small style="margin-top:3px">${QUIRKS[r.quirk].desc}</small></div>
      <button class="mini" data-hire="${r.id}" ${can?'':'disabled'}>Hire ${cost}g</button></div>`; });
  if (!S.tutorial) h += `<div class="note" style="margin-top:8px">🐀 Rarely, a recruit is secretly a rival's mole. Unhappy crew can also be bought. Keep them busy and paid.</div>`;
  return h;
}
$('#panelBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || phase !== 'day') return;
  const p = me();
  if (b.dataset.hire){ const err = PP.hire(S, ME, +b.dataset.hire); if (err) return toast(err); sfx.hire();
    const x = p.staff[p.staff.length-1]; banner(`${STAFF[x.type].icon} ${x.name} joined!`, '#7cff4f', `${QUIRKS[x.quirk].icon} ${QUIRKS[x.quirk].name} · ${PP.mood(x)}`, 1.5);
    if (tut === 2) tut = 3; refresh(); return; }
  if (b.dataset.fire){ const x = p.staff.find(y => y.id === +b.dataset.fire);
    modal(`<h2>Fire ${esc(x.name)}?</h2><div class="note">You won't get the hiring fee back.</div><div class="row"><button class="btn pink sm" id="fY">Fire them</button><button class="btn ghost sm" data-close>Keep</button></div>`);
    $('#fY').onclick = () => { PP.fire(S, ME, x.id); closeModal(); sfx.miss(); refresh(); }; return; }
  if (b.dataset.agent) return missionPicker(+b.dataset.agent);
  if (b.dataset.bribe !== undefined){ const v = b.dataset.bribe; PP.setBribe(S, ME, v === 'clear' ? 0 : p.plan.bribe + (+v)); sfx.coin(); refresh(); return; }
  if (b.dataset.accuse) return accuseConfirm(+b.dataset.accuse, +b.dataset.sus);
  if (b.dataset.ale){ const err = PP.upgradeAle(S, ME); if (err) return toast(err); sfx.coin(); banner('🍻 Better ale!', '#ffc23d', null, 1); refresh(); return; }
  if (b.dataset.price){ PP.setPrice(S, ME, b.dataset.price); sfx.click(); refresh(); return; }
  if (b.dataset.dossier) return dossier(+b.dataset.dossier);
});

// ---- missions ----
function missionsHTML(){
  const p = me(), agents = p.staff.filter(x => STAFF[x.type].mission);
  let h = '';
  if (isLeader(ME)) h += `<div class="item" style="background:rgba(255,194,61,.12)"><div class="ic">👑</div><div class="tx"><small><b>You're leading.</b> The Guard watches you closely: +15% catch risk on your missions.</small></div></div>`;
  if (PP.isUnderdog(S,p)) h += `<div class="item" style="background:rgba(124,255,79,.1)"><div class="ic">🐾</div><div class="tx"><small><b>Underdog revenge:</b> missions against the leader carry −10% catch risk.</small></div></div>`;
  h += `<div class="sec">Tap an agent to give orders</div>`;
  if (!agents.length) h += `<div class="empty">Nobody here can go on missions. Hire a Poisoner, Pickpocket, Bruiser, Spy, Bard or Smooth-talker in 👥 CREW.</div>`;
  agents.forEach(x => { const S0 = STAFF[x.type], refuse = x.quirk === 'proud' && x.loyalty <= 2;
    h += `<div class="item ${x.jailed?'':'agent'}"><div class="ic">${S0.icon}</div><div class="tx"><b>${esc(x.name)} · ${S0.name}</b>
      <div class="chips">${moodChip(x)}${staffStatus(x)}</div>${refuse?'<small class="warn">🦚 Too proud to work while this unhappy. They will refuse.</small>':''}</div>
      ${x.jailed ? '' : `<button class="mini" data-agent="${x.id}">Orders</button>`}</div>`; });
  const home = p.staff.filter(x => !STAFF[x.type].mission);
  if (home.length) h += `<div class="note" style="margin-top:6px">🏠 ${home.map(g=>esc(g.name)).join(', ')} stay${home.length>1?'':'s'} home on guard duty.</div>`;
  h += `<div class="sec">The city</div>` + S.taverns.filter(t=>t.id!==ME).map(t => rivalRow(t)).join('');
  return h;
}
function rivalRow(t){
  const p = me(), lead = isLeader(t.id), proven = p.proven.includes(t.id);
  return `<div class="item"><div class="ic">${dotOf(t.id)}</div><div class="tx"><b>${esc(t.name)} ${lead?'👑':''}</b>
    <small>⭐ ${t.rep} · ${'💰'.repeat(PP.wealthTier(t.gold))} rumored wealth</small><div class="chips">${proven?'<span class="chip bad">⚔️ Proven attacker</span>':''}${lead?'<span class="chip gold">👑 Leading</span>':''}</div></div>
    <button class="mini ghost" data-dossier="${t.id}">Dossier</button></div>`;
}
function highlightTarget(id){ W.taverns.forEach(t => t.ringOn = (t.i === id)); }
function missionPicker(sid){
  const p = me(), x = p.staff.find(y => y.id === sid), mt = STAFF[x.type].mission, M = MISSIONS[mt], cur = p.plan.missions.find(m => m.staffId === sid);
  const targets = M.selfOnly ? [ME] : M.selfOk ? [...S.taverns.filter(t=>t.id!==ME).map(t=>t.id), ME] : S.taverns.filter(t=>t.id!==ME).map(t=>t.id);
  let h = `<h2>${STAFF[x.type].icon} ${esc(x.name)}</h2><div class="item" style="background:rgba(255,194,61,.12)"><div class="ic">${M.icon}</div><div class="tx"><b>${M.name}</b><small>${M.desc}</small>
    <div class="chips">${moodChip(x)}${quirkChip(x)}</div></div></div>
    ${x.quirk==='proud'&&x.loyalty<=2?'<div class="warn">🦚 Warning: they\'re too unhappy and will refuse tonight.</div>':''}
    <div class="sec">Choose a target</div>`;
  targets.forEach(id => { const t = S.taverns[id], sel = cur && cur.target === id;
    const risk = M.catch ? Math.round(PP.riskFor(S, ME, x, mt, id)*100) : 0, rev = id !== ME && PP.isRevenge(S, p, id);
    const tasterSeen = mt==='poison' && p.intel[id] && p.intel[id].staff.includes('taster');
    h += `<div class="item ${sel?'sel':''}" data-pick="${id}" style="cursor:pointer"><div class="ic">${id===ME?'🏠':dotOf(id)}</div><div class="tx">
      <b>${id===ME?(mt==='spy'?'Your own tavern (hunt traitors)':'Your own tavern'):esc(t.name)}</b>
      <div class="chips">${M.catch?`<span class="chip ${risk>=25?'bad':''}">🚨 ~${risk}% risk</span>`:''}${rev?'<span class="chip good">⚔️ Revenge −10%</span>':''}${tasterSeen?'<span class="chip bad">👃 Spy saw a Taster</span>':''}</div></div>
      <div style="font-size:22px">${sel?'✅':'›'}</div></div>`; });
  h += `<div class="note">Risk goes up 12% if a rival wins tonight's bribe, and drops to 0% if you do.</div>
    <div class="row"><button class="btn ghost sm" id="mIdle">💤 No orders</button><button class="btn sm" data-close>Done</button></div>`;
  modal(h);
  $$('#modal [data-pick]').forEach(el => el.onclick = () => { const id = +el.dataset.pick; const err = PP.setMission(S, ME, {staffId:sid, type:mt, target:id});
    if (err) return toast(err); sfx.click(); highlightTarget(id); if (tut === 4) tut = 5; if (tut === 13) tut = 14; closeModal(); refresh();
    banner(`${M.icon} ${x.name} → ${id===ME?'home':tname(id)}`, '#ffc23d', null, 1.1); });
  $('#mIdle').onclick = () => { PP.clearMission(S, ME, sid); closeModal(); refresh(); };
}
function dossier(id){
  const t = S.taverns[id], intel = me().intel[id];
  let h = `<h2>${dotOf(id)} ${esc(t.name)}</h2>
    <div class="item"><div class="ic">🧾</div><div class="tx"><b>Known habits of their crew</b><small>The whole city knows these. Clues never lie, so match them.</small><div class="chips">${traitChips(t)}<span class="chip">🧵 ${t.color}</span></div></div></div>
    <div class="item"><div class="ic">⭐</div><div class="tx"><b>Reputation ${t.rep}</b><small>Rumored wealth: ${'💰'.repeat(PP.wealthTier(t.gold))}</small></div></div>`;
  if (intel) h += `<div class="item"><div class="ic">🔍</div><div class="tx"><b>Spy report (night ${intel.day})</b><small>Crew: ${intel.staff.map(x=>STAFF[x].icon+' '+STAFF[x].name).join(', ')||'nobody'}<br>Gold: ~${Math.round(intel.gold/10)*10} · Ale ${'★'.repeat(intel.ale)}<br>
    That night they hit: ${intel.attacks.length?intel.attacks.map(a=>MISSIONS[a.type].icon+' '+(a.target===ME?'YOU':esc(tname(a.target)))).join(', '):'nobody'}</small></div></div>`;
  else h += `<div class="item"><div class="ic">❓</div><div class="tx"><b>Crew & plans unknown</b><small>Send a 🕵️ Spy to see what they're hiding.</small></div></div>`;
  h += `<div class="row"><button class="btn sm" data-close>Close</button></div>`;
  modal(h);
}

// ---- bribe (blind, all-pay) ----
function bribeHTML(){
  const p = me(), talk = PP.active(p,'talker'), under = PP.isUnderdog(S,p);
  return `<div class="item"><div class="ic">🤫</div><div class="tx"><small><b>Blind auction.</b> Everyone bids in secret. The highest bid wins the Captain's favour: <b>your agents can't be caught tonight</b>, and everyone else's risk rises 12%.</small></div></div>
    <div class="item" style="background:rgba(255,77,109,.14)"><div class="ic">💸</div><div class="tx"><small><b>Every bid is paid, win or lose.</b> The Captain keeps it all. Ties mean nobody wins.</small></div></div>
    ${talk||under?`<div class="item" style="background:rgba(124,255,79,.1)"><div class="ic">✨</div><div class="tx"><small>${talk?'🎩 Your Smooth-talker makes your bid count <b>50% more</b>. ':''}${under?'🐾 As the underdog, your bid counts <b>30% more</b>.':''}</small></div></div>`:''}
    <div class="big">🪙 ${p.plan.bribe}</div>
    <div class="row" style="margin-top:4px"><button class="mini ghost" data-bribe="-10">−10</button><button class="mini" data-bribe="10">+10</button><button class="mini" data-bribe="25">+25</button>
    <button class="mini" data-bribe="50">+50</button><button class="mini ghost" data-bribe="clear">Clear</button></div>
    <div class="note" style="margin-top:10px">You have ${p.gold} gold. Bribing only matters if your agents are going out.</div>`;
}

// ---- case file + evidence board ----
function caseHTML(){
  const p = me(); if (!p.incidents.length) return `<div class="empty">No crimes against you… yet. When someone attacks, the clues land here. Clues never lie: each one crosses off rivals who don't match.</div>`;
  let h = `<div class="note" style="text-align:left;opacity:.9;margin-bottom:8px">Each clue crosses off rivals who don't match. ${p.accusedToday?'<b>You already accused someone today.</b>':'You get <b>one accusation per day</b>. Right: they\'re fined 80 gold and revenge gets safer. Wrong: −8 rep.'}</div>`;
  p.incidents.slice().reverse().forEach(inc => {
    const M = MISSIONS[inc.type], cand = PP.candidates(S, ME, inc), hits = new Set(inc.clues.filter(c=>c.kind==='trait').map(c=>c.trait));
    h += `<div class="case"><h4>${M.icon} Night ${inc.day}: ${inc.blocked?'attempted ':''}${M.name.toLowerCase()}
      ${inc.solved?`<span class="chip good">✅ ${esc(tname(inc.culprit))}</span>`:`<span class="chip bad">${cand.length} suspect${cand.length>1?'s':''} left</span>`}</h4>
      ${inc.clues.map(c => `<div class="clue ${c.sure?'sure':''}">${c.icon||'🌫️'} ${esc(c.text)}</div>`).join('')}
      <div class="sec" style="margin-top:10px">Suspects</div>`;
    S.taverns.filter(t => t.id !== ME).forEach(t => {
      const out = !cand.includes(t.id) || inc.accused.includes(t.id) && inc.culprit !== t.id;
      const can = !inc.solved && !out && !p.accusedToday;
      h += `<div class="item ${out && !(inc.solved && inc.culprit===t.id) ? 'out' : ''}"><div class="ic">${dotOf(t.id)}</div><div class="tx"><b>${esc(t.name)}</b><div class="chips">${traitChips(t, hits)}</div>
        ${inc.accused.includes(t.id) && inc.culprit !== t.id ? '<small>❌ Wrongly accused</small>' : ''}</div>
        ${can ? `<button class="mini pink" data-accuse="${inc.id}" data-sus="${t.id}">Accuse</button>` : ''}</div>`; });
    h += `</div>`; });
  return h;
}
function accuseConfirm(incId, sus){
  const inc = me().incidents.find(i => i.id === incId), cand = PP.candidates(S, ME, inc);
  modal(`<h2>⚖️ Accuse ${esc(tname(sus))}?</h2><div class="note" style="text-align:left">${cand.length === 1 ? 'Every clue points to them. 🎯' : `${cand.length} rivals still match the clues. Spy reports, mole tips or who got caught might help you decide.`}</div>
    <div class="row"><button class="btn pink sm" id="aY">Accuse!</button><button class="btn ghost sm" data-close>Not yet</button></div>`);
  $('#aY').onclick = () => {
    const r = PP.accuse(S, ME, incId, sus); closeModal(); if (r.err) return toast(r.err);
    if (tut === 11) tut = 12;
    refresh();
    if (r.correct){ sfx.win(); banner('GUILTY!', '#7cff4f', `${tname(sus)} was fined ${r.fine} gold. Revenge on them is now safer.`, 2.6); W.owners[ME].cheer = true; setTimeout(()=>W.owners[ME].cheer=false, 2200); }
    else { sfx.miss(); banner('WRONG!', '#ff4d6d', 'The city laughs. −8 rep', 2.2); }
  };
}

// ---- tavern ----
function tavernHTML(){
  const p = me(), PR = PP.PRICES, price = 6 + p.ale + PR[p.price].add;
  let h = `<div class="item"><div class="ic">🍻</div><div class="tx"><b>Ale quality ${'★'.repeat(p.ale)}${'☆'.repeat(5-p.ale)}</b><small>Better ale draws more customers and sells for more (now ${price}g a mug).</small></div>
    ${p.ale<5?`<button class="mini" data-ale="1" ${p.gold<PP.aleCost(p)?'disabled':''}>Upgrade ${PP.aleCost(p)}g</button>`:''}</div>
    <div class="sec">Prices</div><div class="pricebtns">${Object.keys(PR).map(k => `<button class="${p.price===k?'on':''}" data-price="${k}">${PR[k].name}<br><small>${k==='cheap'?'more customers':k==='pricey'?'fewer, richer':'balanced'}</small></button>`).join('')}</div>`;
  if (p.last) h += `<div class="sec">Last night</div><div class="trio"><div><b>${p.last.served}</b>served</div><div><b style="color:var(--poison)">+${p.last.income}</b>earned</div><div><b style="color:var(--pink)">−${p.last.wages}</b>wages</div></div>`;
  h += `<div class="sec">Your crew's known habits</div><div class="chips">${traitChips(p)}</div><div class="note" style="text-align:left;margin-top:4px">Rivals use these to work out what YOU did. 🎩 Covering your tracks leaves fewer clues.</div>`;
  h += `<div class="sec">Rivals</div>` + S.taverns.filter(t=>t.id!==ME).map(t => rivalRow(t)).join('');
  return h;
}

// ---- advisor (real-time hints) ----
function tips(){
  const p = me(), out = [];
  if (S.tutorial){
    const T = {
      1:{t:'Welcome to Ashveil, boss! I\'m Bertha, your barkeep. Each day you scheme, each night the chaos happens. Tap <b>👥 CREW</b> to hire your first shady worker.', g:'#tabs [data-tab=crew]'},
      2:{t:'Pick ONE recruit for this first game. Read their <b>mood</b> and <b>quirk</b>: happy crew work hard, grumpy crew cause trouble. A <b>Pickpocket</b> is a fine start. Tap <b>Hire</b>.', g:'.recruit .mini'},
      3:{t:'Now tap <b>🗺️ MISSIONS</b> to give them orders for tonight.', g:'#tabs [data-tab=missions]'},
      4:{t:'Tap <b>Orders</b>, then pick a rival tavern. The <b>risk %</b> is your chance of getting caught.', g:'.agent .mini'},
      5:{t:'Optional trick: tap <b>🪙 BRIBE</b>. The highest secret bid makes your agents uncatchable, but <b>every bid is paid, win or lose</b>.', g:'#tabs [data-tab=bribe]'},
      6:{t:'When you\'re ready, tap <b>🌙 NIGHT</b>. In the morning I\'ll tell you what happened.', g:'#nightBtn'},
      10:{t:'Somebody <b>robbed us</b> last night! Open <b>🔍 CASES</b> and let\'s work out who.', g:'#tabs [data-tab=case]'},
      11:{t:'Each clue crosses off rivals whose habits don\'t match (green = match). Only one rival fits <b>all</b> the clues. Tap <b>Accuse</b> on them!', g:'.case .mini.pink'},
      12:{t:'Justice! A rival you\'ve <b>proven</b> attacked you is a safer target: <b>−10% risk</b>. Open <b>🗺️ MISSIONS</b> and get revenge.', g:'#tabs [data-tab=missions]'},
      13:{t:'Pick the culprit as your target. Look for the <b>⚔️ Revenge</b> tag.', g:'.agent .mini'},
      14:{t:'Lovely. Tap <b>🌙 NIGHT</b> when ready.', g:'#nightBtn'},
      20:{t:'Last night of your first game! Check your crew\'s <b>mood</b> in 👥 CREW: agents left without orders get grumpy, and grumpy crew can be <b>bought by rivals</b>.', g:'#tabs [data-tab=crew]'}
    };
    let k = tut;
    if (k === 2 && tab !== 'crew') k = 1;
    if (k === 4 && tab !== 'missions') k = 3;
    if (k === 11 && tab !== 'case') k = 10;
    if (k === 13 && tab !== 'missions') k = 12;
    if (k === 6 && !p.plan.missions.length && p.staff.length && STAFF[p.staff[0].type].mission) k = 3;
    if (T[k]) return [T[k]];
  }
  const fresh = p.last && p.last.newIncidents && p.last.newIncidents.length;
  const solvable = p.incidents.filter(i => !i.solved && PP.candidates(S,ME,i).length === 1);
  if (fresh && tab !== 'case' && !p.accusedToday) out.push({t:'You were hit last night! Open <b>🔍 CASES</b>. The clues cross off suspects for you.', g:'#tabs [data-tab=case]'});
  if (solvable.length && !p.accusedToday && tab !== 'case') out.push({t:`One of your cases has <b>only one suspect left</b>. That's a safe accusation in 🔍 CASES.`, g:'#tabs [data-tab=case]'});
  const exposed = p.staff.find(x => x.exposed); if (exposed) out.push({t:`<b>${esc(exposed.name)}</b> is a traitor! Fire them in 👥 CREW before they leak more.`, g:'#tabs [data-tab=crew]'});
  const grumpy = p.staff.filter(x => x.loyalty <= 2 && !x.exposed);
  if (grumpy.length) out.push({t:`<b>${grumpy.map(x=>esc(x.name)).join(', ')}</b> ${grumpy.length>1?'are':'is'} unhappy. Give them missions (success cheers them up) or let them go. Disgruntled crew can be <b>bought by rivals</b>.`, g:'#tabs [data-tab=crew]'});
  if (p.leaks >= 1 && p.staff.some(x=>x.type==='spy'&&!x.jailed) && !p.plan.missions.some(m=>m.type==='spy'&&m.target===ME))
    out.push({t:'Ambushes or gold vanishing from the till? Someone may be a <b>traitor</b>. Send your 🕵️ Spy to spy on <b>your own tavern</b>.', g:'#tabs [data-tab=missions]'});
  const idle = p.staff.find(x => STAFF[x.type].mission && !x.jailed && !p.plan.missions.find(m=>m.staffId===x.id));
  if (idle) out.push({t:`<b>${esc(idle.name)}</b> has no orders. Agents left idle two nights in a row lose loyalty.`, g:'#tabs [data-tab=missions]'});
  if (PP.isUnderdog(S,p)) out.push({t:'You\'re the <b>🐾 underdog</b>: hires are 25% cheaper, the locals chip in gold, and missions against the leader are safer. Time for a comeback!', g:null});
  if (isLeader(ME)) out.push({t:'You\'re in the <b>👑 lead</b>. The Guard watches you closely and rivals will gang up. A Taster or Bruiser at home helps.', g:null});
  const wages = p.staff.filter(x=>!x.jailed).reduce((a,x)=>a+x.wage,0) + 10;
  if (p.gold < wages*1.5) out.push({t:`Gold is tight. Wages of <b>${wages}g</b> are due tonight, and unpaid crew get angry.`, g:null});
  if (p.last && p.last.poisoned && !PP.active(p,'taster')) out.push({t:'Poisoned! A 👃 <b>Taster</b> at home blocks every poison attempt.', g:'#tabs [data-tab=crew]'});
  if (p.ale < 5 && p.gold > PP.aleCost(p) + 150) out.push({t:'Spare gold? <b>Better ale</b> brings more customers every night (🍺 TAVERN).', g:'#tabs [data-tab=tavern]'});
  if (S.day === S.maxDays) out.push({t:'Final night! Score = <b>gold + reputation × 5</b>. Hit the leader and protect what you have.', g:null});
  out.push({t:'Ready? Tap <b>🌙 NIGHT</b> to let the chaos begin.', g:'#nightBtn'});
  return out;
}
function renderAdvisor(){
  $$('.glow').forEach(el => el.classList.remove('glow'));
  const a = $('#advisor');
  if (tipsOff || phase !== 'day' || !S){ a.classList.add('hidden'); return; }
  const list = tips(), tip = list[tipIdx % list.length];
  a.classList.remove('hidden'); a.classList.toggle('top', panelOpen && portrait);
  $('#advT').innerHTML = tip.t + (list.length > 1 ? ` <span class="nx" id="advN">next tip ›</span>` : '');
  if (tip.g) requestAnimationFrame(() => { const el = $(tip.g); if (el) el.classList.add('glow'); });
  const n = $('#advN'); if (n) n.onclick = () => { tipIdx++; renderAdvisor(); };
}
$('#advX').onclick = () => { $('#advisor').classList.add('hidden'); $$('.glow').forEach(el => el.classList.remove('glow')); };
function helpFor(t){
  const H = {
    null:'<b>Day</b> is for scheming: 👥 hire crew, 🗺️ give missions, 🪙 bribe the Captain, 🔍 solve attacks, 🍺 improve your tavern. Then tap 🌙 NIGHT.',
    crew:'Hire up to 5. Agents (🧪🗡️💪🕵️🎻🎩) go on missions; a 👃 Taster stays home and stops poison. Everyone has a <b>mood</b> (loyalty) and a <b>quirk</b>. Success and steady work raise loyalty; jail, idleness and unpaid wages lower it. Disgruntled crew may quit or be bought by a rival.',
    missions:'Each agent can do one mission a night. Rivals never see your orders. Caught agents go to jail for 2 nights and the city learns who sent them. The leader is watched more closely; revenge missions are safer.',
    bribe:'Blind auction: every tavern bids in secret and <b>everyone pays their bid</b>. The highest bid wins the Captain\'s favour, and that tavern\'s agents can\'t be caught tonight.',
    case:'Clues never lie. Each crew has known habits (boots, scent, which hand). Clues cross off rivals who don\'t match. Spy reports and gossip clues name the culprit outright.',
    tavern:'Customers like good ale, a good reputation, bards and cheap prices. Poison and brawls scare them off. Underdogs get extra local support.'
  };
  modal(`<h2>❓ Help</h2><div class="how" style="font-size:15px">${H[t]||H.null}</div><div class="row"><button class="btn sm" data-close>Got it</button></div>`);
}

// ---- 3D sync for the day ----
function sync3D(){
  const p = me(), t = W.taverns[ME], keep = new Set(), slots = [-3.6,-1.8,0,1.8,3.6];
  p.staff.forEach((x,k) => { keep.add(x.id); let ch = W.staff.get(x.id);
    const goal = toW(t,{x:slots[k],z:-0.2});
    if (!ch){ ch = makeChar(LOOK[x.type]); const door = toW(t,{x:0,z:6.5}); ch.pos = {x:door.x, z:door.z}; world.add(ch.root); W.staff.set(x.id, ch);
      ch.tag = sprite(textTex(x.name, '#ffffff'), 2.0, 0.75); ch.tag.position.y = 2.95; ch.root.add(ch.tag);
      ch.bub = sprite(emojiTex('🙂','#ffffff'), 0.9); ch.bub.position.y = 3.75; ch.root.add(ch.bub);
      walk(ch, route(ch.pos, goal), 4).then(() => { ch.face = faceLocal(t,0,-1); }); }
    else if (![...W.movers].some(m => m.ch === ch) && d2(ch.pos, goal) > 0.3) walk(ch, route(ch.pos, goal), 4).then(() => { ch.face = faceLocal(t,0,-1); });
    const m = p.plan.missions.find(y => y.staffId === x.id);
    const e = x.jailed ? '⛓️' : x.exposed ? '🐀' : m ? MISSIONS[m.type].icon : PP.mood(x).split(' ')[0];
    ch.bub.material.map = emojiTex(e, x.exposed ? '#ff9a9a' : '#ffffff'); ch.root.visible = true; });
  for (const [id,ch] of W.staff){ if (!keep.has(id)){ world.remove(ch.root); W.staff.delete(id); } }
  W.recruits.forEach(r => world.remove(r.root)); W.recruits = [];
  p.recruits.forEach((r,k) => { const ch = makeChar(LOOK[r.type]); const pos = toW(t,{x:-2.6+k*2.6, z:8.2}); ch.pos = pos; ch.face = faceLocal(t,0,-1);
    ch.root.position.set(pos.x,0,pos.z); const q = sprite(emojiTex(STAFF[r.type].icon,'#fff7e3'), 1.0); q.position.y = 3.0; ch.root.add(q); world.add(ch.root); W.recruits.push(ch); });
}

// =====================================================================
// NIGHT: a short clip, then the morning recap
// =====================================================================
function caption(t){ $('#caption').innerHTML = t; }
let skipResolve = null;
function sleepSkippable(ms){ return new Promise(res => { if (skipNow) return res(); const id = setTimeout(res, ms); skipResolve = () => { clearTimeout(id); res(); }; }); }
$('#skipBtn').onclick = () => { skipNow = true; if (skipResolve) skipResolve(); clearClip(); };
function confirmNight(){
  const p = me(), idle = p.staff.filter(x => STAFF[x.type].mission && !x.jailed && !p.plan.missions.find(m=>m.staffId===x.id));
  if (idle.length){ modal(`<h2>🌙 Start the night?</h2><div class="note" style="text-align:left">${idle.map(x=>esc(x.name)).join(', ')} ${idle.length>1?'have':'has'} no orders. Agents left idle too long lose loyalty.</div>
      <div class="row"><button class="btn ghost sm" id="cN">Give orders</button><button class="btn sm" id="cY">Start night</button></div>`);
    $('#cN').onclick = () => { closeModal(); setTab('missions'); }; $('#cY').onclick = () => { closeModal(); runNight(); }; return; }
  runNight();
}
function clearClip(){ clipFigs.forEach(f => removeChar(f)); clipFigs = []; }

async function runNight(){
  const tk = ++token; phase = 'night'; skipNow = false;
  if (tut >= 1 && tut <= 6) tut = 7; if (tut >= 12 && tut <= 14) tut = 15;
  setTab(null); $('#advisor').classList.add('hidden'); $$('.glow').forEach(el => el.classList.remove('glow'));
  show('#lNight'); $('#nightTitle').textContent = `NIGHT ${S.day}`;
  W.recruits.forEach(r => world.remove(r.root)); W.recruits = []; W.staff.forEach(ch => ch.root.visible = false);
  dayTarget = 1; camCity(1.2); sfx.owl(); W.guard.root.visible = true;
  const roll = PP.rollNight(S);
  spawnNightCustomers();
  const shown = roll.events.filter(e => e.type !== 'cover' && !(e.type === 'spy' && e.target === e.by) && !['refused','slept'].includes(PP.outcome(e))).slice(0, 10);
  caption(shown.length ? `🌙 Night falls on Ashveil. <b>${shown.length}</b> shadowy figure${shown.length>1?'s are':' is'} on the move…` : '🌙 A quiet night in Ashveil… or is it?');
  if (roll.fav === ME) setTimeout(() => { if (tk === token) banner('😎 THE CAPTAIN IS YOURS', '#7cff4f', 'Your agents can\'t be caught tonight', 1.8); }, 500);
  await sleepSkippable(1400); if (tk !== token) return;
  shown.forEach((e,k) => setTimeout(() => { if (tk === token && !skipNow) clipEvent(e); }, k*450));
  await sleepSkippable(Math.max(3000, shown.length*450 + 2700)); if (tk !== token) return;
  clearClip(); W.guard.root.visible = false;
  caption('🌅 Dawn breaks over Ashveil…'); dayTarget = 0.35;
  await sleepSkippable(900); if (tk !== token) return;
  const res = PP.applyNight(S, roll);
  showRecap(res);
}
const FX = {poison:['☠️','#7cff4f',0x7cff4f], steal:['💰','#ffc23d',0xffc23d], brawl:['🪑','#ff4d8d',0x9c6634], rumor:['🗣️','#d6b3ff',0xb15cff], spy:['🔍','#ffffff',0xffffff]};
async function clipEvent(e){
  const o = PP.outcome(e), t = W.taverns[e.target], mine = e.by === ME, vsMe = e.target === ME;
  const fig = makeChar(mine ? LOOK[e.staffType] : HOODED);
  const a = Math.atan2(t.cz, t.cx) + rand(-0.9, 0.9), start = {x:Math.cos(a)*4.5, z:Math.sin(a)*4.5};
  addChar(fig, start); clipFigs.push(fig);
  if (mine){ const tag = sprite(textTex(e.staffName, '#ffc23d'), 2.0, 0.75); tag.position.y = 2.95; fig.root.add(tag); }
  const dest = e.type === 'spy' ? [toW(t,{x:-4.2,z:6.3})] : [toW(t,{x:0,z:6.2}), toW(t,{x:0,z:2.6})];
  await walk(fig, o === 'caught' || o === 'foiled' ? [toW(t,{x:rand(-2,2),z:8.5})] : dest, 8.5);
  if (skipNow || !clipFigs.includes(fig)) return;
  const p = fig.pos, [ic, col, hexc] = FX[e.type] || ['❓','#fff',0xffffff];
  if (o === 'caught'){ burst(p.x,2,p.z,0x4cc9f0,16,{spd:4,up:5}); floatText(p.x,3.4,p.z,'⛓️ CAUGHT','#4cc9f0'); fig.stun = 2; if (mine) sfx.busted(); else sfx.whistle(); }
  else if (o === 'foiled'){ burst(p.x,2,p.z,0xff4d6d,16,{spd:4,up:5}); floatText(p.x,3.4,p.z,'🚨 AMBUSH','#ff4d6d'); fig.stun = 1.2; }
  else if (o === 'blocked'){ burst(p.x,2,p.z,0x4cc9f0,16,{spd:4,up:5}); floatText(p.x,3.4,p.z,'🛡️ STOPPED','#4cc9f0'); fig.stun = 1; }
  else {
    burst(p.x,1.8,p.z,hexc,20,{spd:4,up:6, geo: e.type==='steal'?pGeoC:e.type==='brawl'?pGeoB:pGeoS}); floatText(p.x,3.4,p.z,ic,col);
    if (e.type === 'poison'){ t.poisonViz = 1; scareCustomers(e.target, 0.5, 'sick'); }
    if (e.type === 'brawl'){ scareCustomers(e.target, 0.7, 'scared'); t.seats.slice(0,3).forEach(s => s.stool.visible = false); }
    if (e.type === 'rumor') scareCustomers(e.target, 0.3, 'angry');
  }
  if (vsMe && !mine){ shake(0.45); sfx.alarm(); caption(`⚠️ Something is happening at <b>YOUR</b> tavern!`); }
  else if (mine) caption(`${STAFF[e.staffType].icon} <b>${esc(e.staffName)}</b> is at work at ${esc(tname(e.target))}…`);
  await wait(900);
  if (!clipFigs.includes(fig)) return;
  await walk(fig, [{x:Math.cos(a)*(RAD+10), z:Math.sin(a)*(RAD+10)}], 9);
  removeChar(fig); clipFigs = clipFigs.filter(f => f !== fig);
}
function nightCustomerCount(t){ const s = S.taverns[t.i]; return clamp(Math.round(2 + s.rep/25 + s.ale*0.6 + PP.active(s,'bard')), 2, 6); }
function spawnNightCustomers(){
  clearCustomers();
  W.taverns.forEach(t => { const n = nightCustomerCount(t);
    t.seats.slice(0,n).forEach((seat,k) => {
      const ch = makeChar({body:pickA(CUST_BODY), skin:pickA(CUST_SKIN), hat:pickA(CUST_HAT), hatColor:pickA(CUST_BODY), scale:rand(0.85,1)});
      const a = Math.atan2(t.cz, t.cx) + rand(-0.5,0.5); ch.pos = {x:Math.cos(a)*5.5, z:Math.sin(a)*5.5}; world.add(ch.root);
      ch.tav = t.i; ch.seat = seat; seat.cust = ch; W.customers.push(ch);
      setTimeout(() => { if (ch.gone) return; walk(ch, [toW(t,{x:0,z:6.2}), toW(t,{x:0,z:3.6}), toW(t,{x:0,z:0}), toW(t,{x:seat.x,z:0}), toW(t,{x:seat.x,z:seat.z})], 5)
        .then(() => { if (ch.gone || ch.leaving) return; ch.sit = true; ch.face = faceLocal(t, seat.f, 0); ch.bub = sprite(emojiTex('🍺','#ffffff'), 0.8); ch.bub.position.y = 2.7; ch.root.add(ch.bub); }); }, k*250);
    }); });
}
function clearCustomers(){ (W.customers||[]).forEach(c => { c.gone = true; world.remove(c.root); if (c.seat) c.seat.cust = null; }); W.customers = [];
  W.movers.forEach(m => { if (m.ch.tav !== undefined) W.movers.delete(m); }); }
function scareCustomers(i, frac, mood){
  const t = W.taverns[i], list = W.customers.filter(c => c.tav === i && !c.leaving);
  list.slice(0, Math.max(1, Math.round(list.length*frac))).forEach(c => {
    c.leaving = true; c.sit = false;
    const face = mood==='sick'?'🤢':mood==='angry'?'😡':'😱';
    if (c.bub) c.bub.material.map = emojiTex(face, mood==='sick'?'#b6ff8f':'#ffb3b3'); else { c.bub = sprite(emojiTex(face,'#ffb3b3'), 0.8); c.bub.position.y = 2.7; c.root.add(c.bub); }
    if (mood === 'sick') c.head.material = mat(0x7cff4f);
    [...W.movers].forEach(m => { if (m.ch === c) W.movers.delete(m); });
    const l = toL(t, c.pos); walk(c, [toW(t,{x:l.x,z:0}), toW(t,{x:0,z:0}), toW(t,{x:0,z:6.2}), toW(t,{x:rand(-4,4),z:13})], 6).then(() => { c.root.visible = false; });
  });
}

// ---- morning recap: one card at a time ----
function showRecap(res){
  const r = res.perTavern[ME], p = me(), by = c => r.msgs.filter(m => m.cat === c);
  const lines = arr => arr.map(m => `<div class="rline ${m.kind}">${esc(m.text)}</div>`).join('');
  const cards = [];
  const rally = by('crew').filter(m => m.text.startsWith('🤝'));
  cards.push({icon:'🍺', title:`Your tavern, night ${S.over ? S.maxDays : S.day-1}`,
    html:`<div class="trio"><div><b>${r.served}</b>customers</div><div><b style="color:var(--poison)">+${r.income}</b>earned</div><div><b style="color:var(--pink)">−${r.wages}</b>wages</div></div>
      ${r.poisoned?'<div class="rline bad">☠️ Poison scared off half your crowd.</div>':''}${r.brawled?'<div class="rline bad">🪑 The brawl kept customers away.</div>':''}${lines(rally)}
      <div class="trio" style="grid-template-columns:1fr 1fr"><div><b style="color:var(--gold)">💰 ${p.gold}</b>gold now</div><div><b>⭐ ${p.rep}</b>reputation</div></div>`});
  const you = by('you');
  if (you.length || r.newIncidents.length){
    let h = lines(you);
    r.newIncidents.forEach(id => { const inc = p.incidents.find(i => i.id === id), cand = PP.candidates(S, ME, inc);
      h += `<div class="case"><h4>${MISSIONS[inc.type].icon} Clues found</h4>${inc.clues.map(c => `<div class="clue ${c.sure?'sure':''}">${c.icon||'🌫️'} ${esc(c.text)}</div>`).join('')}
        <div style="margin-top:8px;font-weight:900;font-size:14px">${cand.length===1?'🎯 Only <b>one</b> rival matches: '+dotOf(cand[0])+' '+esc(tname(cand[0])):`🔎 ${cand.length} rivals still match: ${cand.map(c=>dotOf(c)+' '+esc(tname(c))).join(', ')}`}</div></div>`; });
    if (r.newIncidents.length) h += `<div class="note">Open 🔍 CASES today to accuse.</div>`;
    cards.push({icon:'⚠️', title:'What happened to you', html:h});
  }
  const mis = by('mission'); if (mis.length) cards.push({icon:'🗺️', title:'Your missions', html:lines(mis)});
  const crew = by('crew').filter(m => !m.text.startsWith('🤝'));
  if (p.staff.length || crew.length) cards.push({icon:'👥', title:'Your crew', html: lines(crew) + (p.staff.length ? `<div class="sec">Moods this morning</div>` + p.staff.map(x =>
    `<div class="item" style="padding:7px 10px"><div class="ic" style="font-size:24px;width:30px">${STAFF[x.type].icon}</div><div class="tx"><b style="font-size:14px">${esc(x.name)}</b><div class="chips">${moodChip(x)}${x.jailed?'<span class="chip bad">⛓️ jailed</span>':''}${x.exposed?'<span class="chip bad">🐀 traitor</span>':''}</div></div></div>`).join('') : '')});
  const intel = by('intel'); if (intel.length) cards.push({icon:'🤫', title:'Secret intel (only you know)', html:lines(intel)});
  const town = [...by('news').map(m => m.text), ...res.news]; if (town.length) cards.push({icon:'📣', title:'Talk of the town', html:town.map(t => `<div class="rline news">${esc(t)}</div>`).join('')});
  let k = 0; sfx.rooster();
  const draw = () => {
    const c = cards[k], last = k === cards.length - 1;
    modal(`<div class="steps">${cards.map((_,i)=>`<i class="${i===k?'on':''}"></i>`).join('')}</div><div class="cardicon">${c.icon}</div><h2 style="text-align:center">${c.title}</h2>${c.html}
      <div class="row">${k>0?'<button class="btn ghost sm" id="rB">‹ Back</button>':''}
      ${last ? (S.over ? '<button class="btn green sm" id="rN">🏆 Final results</button>' : `<button class="btn sm" id="rN">☀️ Start Day ${S.day}</button>`) : '<button class="btn sm" id="rN">Next ›</button>'}</div>`, true);
    const b = $('#rB'); if (b) b.onclick = () => { k--; draw(); };
    $('#rN').onclick = () => { if (!last){ k++; sfx.click(); draw(); return; } closeModal(); if (S.over) showEnd(); else { tipIdx = 0; startDay(false); } };
  };
  draw();
}

function showEnd(){
  phase = 'end'; dayTarget = 0.2; camCity(1);
  try { localStorage.setItem('pp-played', '1'); } catch(e){}
  const rank = PP.ranking(S), pos = rank.findIndex(t => t.id === ME) + 1;
  let h = `<h2 style="text-align:center;font-size:32px">${pos===1?'🏆 YOU RULE ASHVEIL!':pos===2?'🥈 So close!':'🍺 Last orders…'}</h2>`;
  if (S.tutorial) h += `<div class="note" style="margin-bottom:8px">You've learned the ropes! The full game has 7 nights, more rivals, and the occasional traitor. 🐀</div>`;
  h += rank.map((t,i) => `<div class="rank ${t.id===ME?'me':''}"><span class="n">${i+1}</span>${dotOf(t.id)}<span>${t.id===ME?'You':esc(t.name)}${t.isBot?`<br><small style="opacity:.7;font-size:11px">${PP.PERS[t.pers].label}</small>`:''}</span>
    <span class="s">${PP.score(t)}<small>💰${t.gold} · ⭐${t.rep}</small></span></div>`).join('');
  const hits = []; S.history.forEach(n => n.events.forEach(e => { if (e.target === ME && e.by !== ME && MISSIONS[e.type].harm) hits.push(`Night ${n.day}: ${tname(e.by)} tried to ${MISSIONS[e.type].name.toLowerCase()} you (${e.outcome}).`); }));
  const moles = me().staff.filter(x => x.moleFor !== null).map(x => `${x.name} ${x.turned ? 'was bought by' : 'was secretly working for'} ${tname(x.moleFor)}!`);
  const bribes = S.history.filter(n => n.fav !== null).map(n => `Night ${n.day}: ${n.fav===ME?'You':tname(n.fav)} won the Captain with ${n.bids[n.fav]} gold.`);
  h += `<div class="sec">🕵️ The truth revealed</div>` + [...moles.map(t=>`<div class="rline bad">🐀 ${esc(t)}</div>`), ...hits.map(t=>`<div class="rline">${esc(t)}</div>`), ...bribes.map(t=>`<div class="rline news">🪙 ${esc(t)}</div>`)].join('');
  if (!hits.length && !moles.length) h += `<div class="rline">Nobody laid a finger on you. Suspicious…</div>`;
  h += `<div class="row"><button class="btn green" id="eA">${S.tutorial?'PLAY THE FULL GAME':'PLAY AGAIN'}</button></div><div class="row" style="margin-top:6px"><button class="btn ghost sm" id="eM">Main menu</button></div>`;
  $('#endCard').innerHTML = h; show('#mEnd'); if (pos === 1){ sfx.win(); W.owners[ME].cheer = true; }
  $('#eA').onclick = () => { if (S.tutorial) setup.mode = 'full'; renderSetup(); show('#mSetup'); }; $('#eM').onclick = toMenu;
}

// =====================================================================
// MENU SCENE + LOOP
// =====================================================================
let menuT = 0;
function buildMenuScene(){ buildWorld(PP.CREWS.slice(0,4).map(c => ({name:c.name, css:c.css}))); W.guard.root.visible = true; dayTarget = 0.45; }
function menuUpdate(dt){ menuT += dt; const a = menuT*0.07, r = portrait ? 40 : 32;
  cam.gp.set(Math.cos(a)*r, portrait?30:22, Math.sin(a)*r); cam.gl.set(0,0,0); cam.k = 2; cam.follow = null; }
function updateWorld(dt){
  if (!W) return;
  updateMovers(dt);
  const moving = new Set([...W.movers].map(m => m.ch));
  const all = [...W.owners, ...W.staff.values(), ...W.recruits, ...W.customers, ...W.extras, W.guard, W.captain];
  all.forEach(ch => { ch.stun = Math.max(0, (ch.stun||0)-dt); ch.root.position.set(ch.pos.x, ch.root.position.y, ch.pos.z);
    let df = ch.face - ch.root.rotation.y; df = Math.atan2(Math.sin(df),Math.cos(df)); ch.root.rotation.y += df*Math.min(1,dt*10);
    if (!moving.has(ch)) ch.spd = Math.max(0, ch.spd - dt*20); animChar(ch, dt); });
  W.captain.root.position.y = 3.45;
  if (W.guard.root.visible && phase !== 'day'){ const g = W.guard; g.patrolA += dt*0.28; const p = {x:Math.cos(g.patrolA)*9, z:Math.sin(g.patrolA)*9};
    const dx = p.x-g.pos.x, dz = p.z-g.pos.z; g.pos.x = p.x; g.pos.z = p.z; g.spd = 2.5; g.face = Math.atan2(dx,dz); }
  const now = performance.now();
  W.taverns.forEach(t => { const pv = t.poisonViz; t.kegMat.emissive.setRGB(pv*(0.12+0.1*Math.sin(now/120)), pv*(0.45+0.25*Math.sin(now/120)), pv*0.05);
    if (pv && Math.random() < dt*8){ const k = toW(t,KEG); burst(k.x+rand(-.5,.5),1.8,k.z+rand(-.5,.5),0x7cff4f,1,{spd:0.5,up:3,grav:-1,life:1.2}); }
    t.ring.material.opacity = t.ringOn ? 0.5 + 0.3*Math.sin(now/150) : 0; });
}
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  if (phase === 'menu') menuUpdate(dt);
  updateWorld(dt); updateParticles(dt); updateLight(dt); updateCamera(dt);
  renderer.render(scene, camera);
}
buildMenuScene(); requestAnimationFrame(frame);
window.__PPUI = {get S(){return S;}, get phase(){return phase;}, setTab, runNight, startGame, get tut(){return tut;}};
})();
</script>
</body>
</html>
