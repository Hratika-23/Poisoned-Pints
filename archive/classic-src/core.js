<script>
(function(){
'use strict';
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
if (!window.THREE || !window.PP){ $('#err').classList.remove('hidden'); $('#mMain').classList.add('hidden'); return; }
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TAU = Math.PI*2, rand = (a,b) => a + Math.random()*(b-a), clamp = (v,a,b) => Math.max(a, Math.min(b, v)), lerp = (a,b,t) => a+(b-a)*t;
const d2 = (a,b) => { const x=a.x-b.x, z=a.z-b.z; return x*x+z*z; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// =====================================================================
// 3D CORE
// =====================================================================
const renderer = new THREE.WebGLRenderer({canvas:$('#c'), antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
let portrait = false;
function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; portrait = w < h;
  camera.fov = portrait ? 60 : 44; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const SKY_DAY = new THREE.Color(0x8a6cc9), SKY_NIGHT = new THREE.Color(0x120a28);
scene.background = SKY_DAY.clone(); scene.fog = new THREE.Fog(0x8a6cc9, 55, 140);
const hemi = new THREE.HemisphereLight(0xfff6ea, 0x5b4a86, 0.62); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 0.85); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera, {left:-30,right:30,top:30,bottom:-30,near:1,far:110}); sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);
const SUN_DAY = new THREE.Color(0xfff0dc), SUN_NIGHT = new THREE.Color(0x7d8cff);
let dayF = 0, dayTarget = 0;   // 0 = day, 1 = night

const grad = new THREE.DataTexture(new Uint8Array([120,120,120,255, 195,195,195,255, 255,255,255,255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const matCache = {};
const mat = (c, emi) => { const k = c+'|'+(emi||0); return matCache[k] || (matCache[k] = new THREE.MeshToonMaterial({color:c, gradientMap:grad, emissive:emi||0})); };
function mk(geo, c, cast=true, recv=false){ const m = new THREE.Mesh(geo, (c && c.isMaterial) ? c : mat(c)); m.castShadow = cast; m.receiveShadow = recv; return m; }
const box = (w,h,d,c) => mk(new THREE.BoxGeometry(w,h,d), c);
const cyl = (rt,rb,h,c,s=12) => mk(new THREE.CylinderGeometry(rt,rb,h,s), c);

// sprites
const texCache = {};
function emojiTex(e, bg){
  const k = e+'|'+bg; if (texCache[k]) return texCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (bg){ g.fillStyle = bg; g.beginPath(); g.arc(64,60,54,0,TAU); g.fill(); g.lineWidth = 7; g.strokeStyle = '#1a0f2e'; g.stroke();
    g.beginPath(); g.moveTo(52,110); g.lineTo(64,126); g.lineTo(76,110); g.fill(); }
  g.font = '62px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 64);
  return texCache[k] = new THREE.CanvasTexture(c);
}
function textTex(txt, color, w=256){
  const k = 'T|'+txt+'|'+color+'|'+w; if (texCache[k]) return texCache[k];
  const c = document.createElement('canvas'); c.width = w; c.height = 96; const g = c.getContext('2d');
  g.font = '56px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#1a0f2e'; g.strokeText(txt, w/2, 50); g.fillStyle = color; g.fillText(txt, w/2, 50);
  return texCache[k] = new THREE.CanvasTexture(c);
}
function sprite(tex, sx, sy){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false})); s.scale.set(sx, sy||sx, 1); s.renderOrder = 10; return s; }
const floaters = [];
function floatText(x, y, z, txt, color='#ffc23d'){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:textTex(txt,color,384), transparent:true, depthWrite:false, depthTest:false}));
  s.scale.set(3.6, 0.9, 1); s.position.set(x, y, z); s.renderOrder = 20; scene.add(s); floaters.push({s, life:1.3, max:1.3});
}

// particles
const pGeoS = new THREE.SphereGeometry(0.13,6,5), pGeoB = new THREE.BoxGeometry(0.22,0.22,0.22), pGeoC = new THREE.CylinderGeometry(0.16,0.16,0.05,10);
const basic = {}; const bmat = c => basic[c] || (basic[c] = new THREE.MeshBasicMaterial({color:c, transparent:true}));
const pool = []; for (let i=0;i<260;i++){ const m = new THREE.Mesh(pGeoS, bmat(0xffffff)); m.visible = false; scene.add(m); pool.push({m, life:0}); }
function burst(x,y,z,color,n,o={}){
  const {spd=4, up=5, life=0.8, size=1, geo=pGeoS, grav=14} = o;
  for (let i=0;i<n;i++){ const p = pool.find(p => p.life <= 0); if (!p) return;
    p.m.geometry = geo; p.m.material = bmat(color); p.m.visible = true; p.m.position.set(x,y,z);
    const a = Math.random()*TAU, s = rand(0.3,1)*spd; p.vx = Math.cos(a)*s; p.vz = Math.sin(a)*s; p.vy = rand(0.4,1)*up; p.g = grav;
    p.life = p.max = life*rand(0.7,1.2); p.size = size*rand(0.7,1.3); p.spin = rand(-8,8); }
}
function updateParticles(dt){
  for (const p of pool){ if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0){ p.m.visible = false; continue; }
    p.vy -= p.g*dt; p.m.position.x += p.vx*dt; p.m.position.y += p.vy*dt; p.m.position.z += p.vz*dt;
    if (p.m.position.y < 0.08){ p.m.position.y = 0.08; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
    p.m.rotation.x += p.spin*dt; p.m.rotation.y += p.spin*dt; p.m.scale.setScalar(p.size * Math.min(1, p.life/p.max*2)); }
  for (let i=floaters.length-1;i>=0;i--){ const f = floaters[i]; f.life -= dt; f.s.position.y += dt*2;
    f.s.material.opacity = Math.min(1, f.life/f.max*2.5); if (f.life <= 0){ scene.remove(f.s); f.s.material.dispose(); floaters.splice(i,1); } }
}

// sound
let actx = null, muted = false;
function audioInit(){ if (!actx){ try { actx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} } if (actx && actx.state==='suspended') actx.resume(); }
function tone(f, dur, type='square', vol=0.08, f2=null, delay=0){
  if (!actx || muted) return; const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t+dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+dur+0.02);
}
const sfx = {
  coin(){ tone(988,.07,'square',.05); tone(1319,.12,'square',.05,null,.07); },
  click(){ tone(700,.05,'square',.03); },
  hire(){ tone(523,.1,'square',.05); tone(784,.15,'square',.05,null,.1); },
  poison(){ tone(330,.5,'sawtooth',.06,90); tone(220,.5,'sine',.05,70,.05); },
  hit(){ tone(160,.18,'triangle',.25,50); },
  miss(){ tone(200,.2,'square',.05,120); },
  whistle(){ tone(2100,.12,'sine',.07); tone(2100,.2,'sine',.07,null,.16); },
  busted(){ tone(400,.5,'sawtooth',.07,100); },
  alarm(){ tone(880,.15,'square',.05); tone(660,.15,'square',.05,null,.18); tone(880,.15,'square',.05,null,.36); },
  bell(){ tone(660,.6,'sine',.08); tone(990,.8,'sine',.05,null,.1); },
  owl(){ tone(420,.35,'sine',.06,360); tone(380,.5,'sine',.06,300,.45); },
  dash(){ tone(500,.12,'sine',.05,1200); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.25,'square',.05,null,i*.12)); },
  rooster(){ tone(600,.15,'sawtooth',.05,900); tone(900,.4,'sawtooth',.05,500,.15); }
};

// characters
const G_body = new THREE.CylinderGeometry(0.4,0.52,0.95,12), G_head = new THREE.SphereGeometry(0.42,16,12), G_eye = new THREE.SphereGeometry(0.07,8,6),
      G_arm = new THREE.BoxGeometry(0.2,0.55,0.2), G_hand = new THREE.SphereGeometry(0.13,8,6), G_leg = new THREE.BoxGeometry(0.25,0.5,0.25), G_nose = new THREE.SphereGeometry(0.09,8,6);
function makeChar(o){
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const body = mk(G_body, o.body); body.position.y = 1.0; rig.add(body);
  if (o.apron){ const a = box(0.62,0.6,0.08,0xf6efe1); a.position.set(0,0.92,0.44); rig.add(a); }
  if (o.cape){ const c = box(0.9,1.1,0.08,o.cape); c.position.set(0,1.0,-0.48); rig.add(c); }
  const head = mk(G_head, o.skin); head.position.y = 1.82; rig.add(head);
  for (const s of [-1,1]){ const e = mk(G_eye, o.eyes||0x1a0f2e, false); e.position.set(0.15*s,1.88,0.37); rig.add(e); }
  const nose = mk(G_nose, o.skin, false); nose.position.set(0,1.78,0.42); rig.add(nose);
  if (o.beard){ const b = mk(new THREE.SphereGeometry(0.3,10,8), o.beard); b.scale.set(1,0.8,0.7); b.position.set(0,1.58,0.25); rig.add(b); }
  const hc = o.hatColor || 0x222222, H = o.hat;
  if (H==='crown'){ const c = cyl(0.3,0.34,0.26,0xffc23d,6); c.position.y=2.27; rig.add(c);
    for (let i=0;i<6;i++){ const sp = mk(new THREE.ConeGeometry(0.07,0.18,4),0xffc23d); const a=i/6*TAU; sp.position.set(Math.cos(a)*0.3,2.47,Math.sin(a)*0.3); rig.add(sp); } }
  if (H==='cap' || H==='feather'){ const c = cyl(0.38,0.42,0.3,hc); c.position.y=2.2; rig.add(c); const br = cyl(0.55,0.55,0.05,hc); br.position.y=2.07; rig.add(br);
    if (H==='feather'){ const f = mk(new THREE.ConeGeometry(0.08,0.8,5),0xff4d8d); f.position.set(0.25,2.55,-0.1); f.rotation.z=-0.5; rig.add(f); } }
  if (H==='tophat'){ const c = cyl(0.3,0.3,0.6,hc); c.position.y=2.45; rig.add(c); const br = cyl(0.5,0.5,0.05,hc); br.position.y=2.15; rig.add(br);
    const band = cyl(0.31,0.31,0.1,0xb15cff); band.position.y=2.25; rig.add(band); }
  if (H==='witch'){ const c = mk(new THREE.ConeGeometry(0.42,0.95,10),hc); c.position.y=2.6; c.rotation.z=0.2; rig.add(c); const br = cyl(0.7,0.7,0.05,hc); br.position.y=2.15; rig.add(br); }
  if (H==='helmet'){ const h = mk(new THREE.SphereGeometry(0.46,12,8,0,TAU,0,Math.PI/2),0xb8c0d8); h.position.y=1.95; rig.add(h);
    const pl = box(0.1,0.35,0.5,0xff3b5c); pl.position.set(0,2.45,-0.05); rig.add(pl); }
  if (H==='bandana'){ const b = cyl(0.43,0.43,0.16,hc); b.position.y=2.02; rig.add(b); const k = mk(new THREE.SphereGeometry(0.1,6,6),hc); k.position.set(0,2.0,-0.45); rig.add(k); }
  if (H==='hood'){ const h = mk(new THREE.SphereGeometry(0.5,12,10,0,TAU,0,Math.PI*0.62),hc); h.position.y=1.84; h.rotation.x=-0.28; rig.add(h); }
  if (H==='bun'){ const b = mk(new THREE.SphereGeometry(0.2,8,8),hc); b.position.set(0,2.25,-0.1); rig.add(b); const t = mk(new THREE.SphereGeometry(0.44,12,8,0,TAU,0,Math.PI/2.2),hc); t.position.y=1.86; rig.add(t); }
  const limb = (s, leg) => { const p = new THREE.Group();
    if (leg){ p.position.set(0.21*s,0.55,0); const l = mk(G_leg, o.legs||0x2b2238); l.position.y=-0.26; p.add(l); }
    else { p.position.set(0.56*s,1.38,0); const a = mk(G_arm, o.body); a.position.y=-0.26; p.add(a); const h = mk(G_hand,o.skin); h.position.y=-0.58; p.add(h); }
    rig.add(p); return p; };
  const ch = {root, rig, armL:limb(-1), armR:limb(1), legL:limb(-1,true), legR:limb(1,true), head, walkT:Math.random()*6,
    face:0, sit:false, spd:0, pos:{x:0,z:0}, vel:{x:0,z:0}, stun:0, dash:0, dashCd:0, punch:0};
  if (o.prop==='vial'){ const v = new THREE.Group(); const b = mk(new THREE.SphereGeometry(0.17,10,8), mat(0x7cff4f,0x2f8a10)); v.add(b);
    const n = cyl(0.06,0.07,0.16,0xbfe8ff); n.position.y=0.18; v.add(n); v.position.set(0,-0.62,0.12); ch.armR.add(v); }
  if (o.prop==='lute'){ const l = mk(new THREE.SphereGeometry(0.3,10,8),0xb5651d); l.scale.set(1,1.2,0.4); l.position.set(-0.25,0.95,0.45); rig.add(l); }
  if (o.prop==='spear'){ const sp = cyl(0.05,0.05,2.6,0x8b5a2b,6); sp.position.set(0.6,1.4,0.1); rig.add(sp);
    const tip = mk(new THREE.ConeGeometry(0.12,0.35,6),0xd0d4e0); tip.position.set(0.6,2.85,0.1); rig.add(tip); }
  root.scale.setScalar(o.scale||1);
  ch.stars = sprite(emojiTex('💫'), 0.9); ch.stars.position.y = 3.0; ch.stars.visible = false; root.add(ch.stars);
  return ch;
}
function animChar(ch, dt){
  const spd = ch.spd; ch.walkT += dt * (2.5 + spd*1.6);
  const sw = Math.min(1, spd/5.5) * 0.95, s = Math.sin(ch.walkT);
  if (ch.sit){ ch.rig.position.y = -0.3; ch.legL.rotation.x = ch.legR.rotation.x = -1.45;
    ch.armL.rotation.x = ch.armR.rotation.x = -0.6 + Math.sin(ch.walkT*0.8)*0.15; ch.rig.rotation.set(0,0,0); return; }
  ch.rig.position.y = Math.abs(s)*0.12*sw + (spd < 0.1 ? Math.sin(ch.walkT*0.7)*0.03 : 0);
  ch.legL.rotation.x = s*sw; ch.legR.rotation.x = -s*sw;
  ch.armL.rotation.x = -s*sw; ch.armR.rotation.x = s*sw; ch.armL.rotation.z = ch.armR.rotation.z = 0;
  if (ch.punch > 0){ ch.punch -= dt; ch.armR.rotation.x = -1.6; }
  if (ch.cheer){ ch.armL.rotation.z = 2.4 + Math.sin(ch.walkT*6)*0.3; ch.armR.rotation.z = -2.4 - Math.sin(ch.walkT*6)*0.3; }
  ch.rig.rotation.x = sw*0.18;
  ch.stars.visible = ch.stun > 0;
  if (ch.stun > 0){ ch.stars.material.rotation += dt*6; ch.rig.rotation.z = Math.sin(ch.walkT*3)*0.35; ch.armL.rotation.z = 1.2; ch.armR.rotation.z = -1.2; }
  else ch.rig.rotation.z = 0;
}

const LOOK = {
  poisoner:  {body:0x2f6b3a, hat:'hood', hatColor:0x1d4a26, skin:0xd7b48e, prop:'vial'},
  pickpocket:{body:0x3a3550, hat:'bandana', hatColor:0x15121f, skin:0xe0ac69},
  bruiser:   {body:0x8b3a2b, skin:0xc68642, scale:1.25, beard:0x3b2414},
  spy:       {body:0x22252e, hat:'cap', hatColor:0x111111, skin:0xf2c09b, cape:0x111111},
  bard:      {body:0xd35400, hat:'feather', hatColor:0x8e44ad, skin:0xf5c6a0, prop:'lute'},
  taster:    {body:0xecf0f1, hat:'bun', hatColor:0x6d4c41, skin:0xffdbac, apron:true},
  talker:    {body:0x5b2c6f, hat:'tophat', hatColor:0x1a1a1a, skin:0xf1c27d}
};
const OWNER_LOOK = [
  {body:0xffc23d, skin:0xf5c6a0, hat:'crown', apron:true, scale:1.05},
  {body:0xc0392b, skin:0xf2c09b, hat:'bandana', hatColor:0x8b1a1a, beard:0x5a3a22, apron:true},
  {body:0x2e86de, skin:0x8bd16a, hat:'hood', hatColor:0x1f4f7a, apron:true},
  {body:0x8e44ad, skin:0xf7d4b8, hat:'bun', hatColor:0x2d1b10, apron:true},
  {body:0x16a085, skin:0xc98a62, hat:'feather', hatColor:0x0b5345, beard:0xdddddd, apron:true}
];
const HOODED = {body:0x4a4558, hat:'hood', hatColor:0x302b3c, skin:0x4a4458, eyes:0xfff27a, cape:0x302b3c};
const CUST_BODY = [0xe74c3c,0x3498db,0x9b59b6,0x1abc9c,0xf39c12,0xd35400,0x27ae60,0xe84393,0x6c5ce7,0x00b894];
const CUST_SKIN = [0xf5c6a0,0xe0ac69,0xc68642,0x8d5524,0xffdbac,0x9be37a];
const CUST_HAT = [null,'cap','hood','bun','bandana',null,'cap'];
const pickA = a => a[Math.floor(Math.random()*a.length)];

// =====================================================================
// WORLD
// =====================================================================
const TW = 11, TD = 9, RAD = 19;
const SEATS = [{x:-3.75,z:1.2,f:1},{x:-1.25,z:1.2,f:-1},{x:1.25,z:1.2,f:1},{x:3.75,z:1.2,f:-1},{x:-3.85,z:-1.2,f:1},{x:-1.35,z:-1.2,f:-1}];
const TABLES = [{x:-2.5,z:1.2},{x:2.5,z:1.2},{x:-2.6,z:-1.2}];
const KEG = {x:3.6, z:-3.25}, KEG_STAND = {x:3.1, z:-2.0};
const LOCAL_BOXES = [
  {x0:-5.7,x1:5.7,z0:-4.75,z1:-4.25}, {x0:-5.7,x1:-5.2,z0:-4.75,z1:4.75}, {x0:5.2,x1:5.7,z0:-4.75,z1:4.75},
  {x0:-5.7,x1:-1.55,z0:4.25,z1:4.75}, {x0:1.55,x1:5.7,z0:4.25,z1:4.75}, {x0:-4.9,x1:2.3,z0:-4.0,z1:-3.05},
  ...TABLES.map(t => ({x0:t.x-0.62,x1:t.x+0.62,z0:t.z-0.62,z1:t.z+0.62}))
];
let world = null, W = null;

function signTex(name, css){
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#3b2412'; g.fillRect(0,0,512,128); g.fillStyle = css; g.fillRect(8,8,496,112);
  g.font = '60px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#1a0f2e'; g.strokeText(name, 256, 66); g.fillStyle = '#fff'; g.fillText(name, 256, 66);
  return new THREE.CanvasTexture(c);
}
const hex = css => parseInt(css.slice(1), 16);

function buildTavern(i, n, info){
  const a = Math.PI/2 + i/n*TAU, cx = Math.cos(a)*RAD, cz = Math.sin(a)*RAD, yaw = Math.atan2(-cx, -cz), col = hex(info.css);
  const t = {i, cx, cz, yaw, cs:Math.cos(yaw), sn:Math.sin(yaw), color:col, css:info.css, seats:[], g:new THREE.Group()};
  const g = t.g; g.position.set(cx,0,cz); g.rotation.y = yaw; world.add(g);
  const floor = mk(new THREE.BoxGeometry(TW,0.25,TD), 0x8a5a33, false, true); floor.position.y = 0.12; g.add(floor);
  for (let k=-4;k<=4;k++){ const pl = mk(new THREE.BoxGeometry(0.06,0.01,TD-0.2), 0x6b4225, false, true); pl.position.set(k*1.2,0.26,0); g.add(pl); }
  const rug = mk(new THREE.BoxGeometry(5.5,0.02,3.2), col, false, true); rug.position.set(0.2,0.27,0.6); g.add(rug);
  LOCAL_BOXES.slice(0,5).forEach(b => { const w = b.x1-b.x0, d = b.z1-b.z0;
    const wall = mk(new THREE.BoxGeometry(w,1.5,d), 0xd9c3a0, true, true); wall.position.set((b.x0+b.x1)/2, 0.75, (b.z0+b.z1)/2); g.add(wall);
    const tr = mk(new THREE.BoxGeometry(w+0.04,0.22,d+0.06), col); tr.position.set(wall.position.x,1.55,wall.position.z); g.add(tr); });
  for (const [x,z] of [[-5.45,-4.5],[5.45,-4.5],[-5.45,4.5],[5.45,4.5],[-1.6,4.5],[1.6,4.5]]){ const p = box(0.5,2.3,0.5,0x5a3820); p.position.set(x,1.15,z); g.add(p); }
  const beam = box(3.8,0.35,0.35,0x5a3820); beam.position.set(0,2.35,4.5); g.add(beam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.85), new THREE.MeshBasicMaterial({map:signTex(info.name, info.css), side:THREE.DoubleSide}));
  sign.position.set(0,2.95,4.55); g.add(sign); const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.z = 4.5; g.add(sign2);
  const lan = mk(new THREE.SphereGeometry(0.22,8,6), new THREE.MeshToonMaterial({color:0xffd27a, gradientMap:grad, emissive:0})); lan.position.set(-1.9,2.1,4.75); g.add(lan); t.lantern = lan;
  const bar = box(7.2,1.1,0.95,0x7a4a26); bar.position.set(-1.3,0.65,-3.52); g.add(bar);
  const top = box(7.4,0.12,1.1,0x4e2d16); top.position.set(-1.3,1.25,-3.52); g.add(top);
  for (let k=0;k<7;k++){ const b = cyl(0.1,0.12,0.45,[0x2ecc71,0x8e44ad,0xe67e22,0x3498db][k%4],6); b.position.set(-4.6+k*1.05,1.75,-4.35); g.add(b); }
  const keg = new THREE.Group(); keg.position.set(KEG.x,0,KEG.z); g.add(keg);
  t.kegMat = new THREE.MeshToonMaterial({color:0x9c6634, gradientMap:grad, emissive:0});
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,1.4,14), t.kegMat); barrel.castShadow = true; barrel.rotation.z = Math.PI/2; barrel.position.y = 1.0; keg.add(barrel);
  for (const x of [-0.45,0.45]){ const r = mk(new THREE.TorusGeometry(0.71,0.05,6,16),0x555566); r.rotation.y = Math.PI/2; r.position.set(x,1.0,0); keg.add(r); }
  const stand = box(1.5,0.3,1.2,0x5a3820); stand.position.y = 0.3; keg.add(stand);
  TABLES.forEach(tb => { const tp = cyl(0.75,0.75,0.12,0xa86b3a,14); tp.position.set(tb.x,1.05,tb.z); g.add(tp);
    const leg = cyl(0.12,0.2,1.0,0x6e4320,8); leg.position.set(tb.x,0.55,tb.z); g.add(leg);
    const cnd = mk(new THREE.CylinderGeometry(0.08,0.08,0.25,6), mat(0xfff3c4,0x332200)); cnd.position.set(tb.x,1.25,tb.z); g.add(cnd); });
  SEATS.forEach((s,k) => { const st = new THREE.Group(); const sx = cyl(0.36,0.36,0.1,0x9c6634); sx.position.y=0.55; st.add(sx);
    for (let q=0;q<3;q++){ const l = cyl(0.05,0.05,0.55,0x6e4320,6); const aa=q/3*TAU; l.position.set(Math.cos(aa)*0.22,0.27,Math.sin(aa)*0.22); st.add(l); }
    st.position.set(s.x,0.25,s.z); g.add(st); t.seats.push({k, x:s.x, z:s.z, f:s.f, stool:st, cust:null}); });
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.6,7.3,48), new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false}));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.3; g.add(ring); t.ring = ring;
  t.poisonViz = 0;
  return t;
}
const toL = (t,p) => { const dx=p.x-t.cx, dz=p.z-t.cz; return {x:dx*t.cs - dz*t.sn, z:dx*t.sn + dz*t.cs}; };
const toW = (t,l) => ({x:l.x*t.cs + l.z*t.sn + t.cx, z:-l.x*t.sn + l.z*t.cs + t.cz});
function regionOf(p){ for (const t of W.taverns){ const l = toL(t,p); if (Math.abs(l.x)<5.25 && Math.abs(l.z)<4.6) return t.i; } return -1; }
const faceLocal = (t, lx, lz) => Math.atan2(lx*t.cs + lz*t.sn, -lx*t.sn + lz*t.cs);

function buildWorld(names){
  if (world){ scene.remove(world); world.traverse(o => { if (o.geometry && !o.geometry.__shared) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  W = {taverns:[], owners:[], staff:new Map(), recruits:[], customers:[], movers:new Set(), extras:[], lamps:[]};
  const n = names.length;
  const grass = mk(new THREE.CircleGeometry(110,48), 0x3f7a4a, false, true); grass.rotation.x = -Math.PI/2; world.add(grass);
  const plaza = mk(new THREE.CircleGeometry(RAD+7.5,64), 0x8f7fa6, false, true); plaza.rotation.x = -Math.PI/2; plaza.position.y = 0.02; world.add(plaza);
  for (const [r0,r1,c] of [[4.6,5.4,0x7a6a92],[11,11.8,0x7a6a92],[RAD+6.8,RAD+7.5,0x6a5a80]]){
    const r = mk(new THREE.RingGeometry(r0,r1,64), c, false, true); r.rotation.x = -Math.PI/2; r.position.y = 0.04; world.add(r); }
  const cg = new THREE.CylinderGeometry(0.35,0.35,0.04,6);
  for (let k=0;k<160;k++){ const a = Math.random()*TAU, r = rand(5.5, RAD+6); const s = mk(cg, Math.random()<.5?0x9d8db5:0x82729c, false, true);
    s.position.set(Math.cos(a)*r, 0.05, Math.sin(a)*r); s.rotation.y = Math.random()*3; world.add(s); }
  // Guard Captain's watchtower in the middle
  const tower = new THREE.Group(); world.add(tower);
  const base = cyl(1.4,1.7,3.2,0x6d6380,10); base.position.y = 1.6; tower.add(base);
  const deck = cyl(2.0,2.0,0.3,0x5a3820,10); deck.position.y = 3.3; tower.add(deck);
  const roof = mk(new THREE.ConeGeometry(2.2,1.6,10), 0x2e5c8a); roof.position.y = 5.6; tower.add(roof);
  for (let k=0;k<4;k++){ const p = cyl(0.1,0.1,2,0x5a3820,6); const a = k/4*TAU+0.4; p.position.set(Math.cos(a)*1.7,4.3,Math.sin(a)*1.7); tower.add(p); }
  const flag = mk(new THREE.BoxGeometry(0.9,0.5,0.04), 0xffc23d); flag.position.set(0.5,6.8,0); tower.add(flag);
  const fp = cyl(0.04,0.04,1.4,0x333333,6); fp.position.set(0,6.7,0); tower.add(fp);
  const beacon = mk(new THREE.SphereGeometry(0.35,10,8), new THREE.MeshToonMaterial({color:0xfff08a, gradientMap:grad, emissive:0})); beacon.position.y = 4.1; tower.add(beacon); W.beacon = beacon;
  const captain = makeChar({body:0x2c3e50, skin:0xf1c27d, hat:'helmet', prop:'spear', scale:1.1, cape:0x8b1a1a}); captain.root.position.set(0,3.45,0.6); world.add(captain.root); W.captain = captain;
  for (let k=0;k<n;k++){ const a = Math.PI/2 + (k+0.5)/n*TAU, x = Math.cos(a)*(RAD-1), z = Math.sin(a)*(RAD-1);
    const post = cyl(0.12,0.16,3.6,0x2b2238,6); post.position.set(x,1.8,z); world.add(post);
    const l = mk(new THREE.SphereGeometry(0.35,10,8), new THREE.MeshToonMaterial({color:0xffe08a, gradientMap:grad, emissive:0})); l.position.set(x,3.7,z); world.add(l); W.lamps.push(l); }
  for (let k=0;k<28;k++){ const a = k/28*TAU + rand(-.1,.1), r = rand(RAD+9, RAD+16), x = Math.cos(a)*r, z = Math.sin(a)*r;
    const tr = cyl(0.25,0.35,1.6,0x6e4320,6); tr.position.set(x,0.8,z); world.add(tr);
    [0x2f8f5b,0x3aa76d,0x267a4c].forEach((c,q) => { const cn = mk(new THREE.ConeGeometry(1.6-q*0.35,1.6,8), c); cn.position.set(x,2.0+q*0.85,z); world.add(cn); }); }
  for (let k=0;k<64;k++){ const a = k/64*TAU, r = RAD+8.2; const p = box(0.25,0.8,0.25,0x6e4320); p.position.set(Math.cos(a)*r,0.4,Math.sin(a)*r); world.add(p); }
  names.forEach((info,i) => W.taverns.push(buildTavern(i, n, info)));
  // owners (rivals stand at their bar; you're the crowned one)
  W.taverns.forEach((t,i) => { const o = makeChar(OWNER_LOOK[i]); const p = toW(t,{x:-1.5,z:-2.3}); o.pos = p; o.face = faceLocal(t,0,1);
    o.root.position.set(p.x,0,p.z); o.root.rotation.y = o.face; world.add(o.root); W.owners.push(o); });
  // night watchman
  W.guard = makeChar({body:0x34495e, skin:0xf1c27d, hat:'helmet', prop:'spear', scale:1.12}); W.guard.pos = {x:0, z:8}; W.guard.patrolA = 0; world.add(W.guard.root);
  const cone = new THREE.Mesh(new THREE.CircleGeometry(7, 28, -Math.PI/3.2 + Math.PI/2, Math.PI/1.6),
    new THREE.MeshBasicMaterial({color:0xfff08a, transparent:true, opacity:0.2, depthWrite:false}));
  cone.rotation.x = -Math.PI/2; cone.position.y = 0.08; W.guard.root.add(cone); W.guard.cone = cone;
  W.arrow = mk(new THREE.ConeGeometry(0.4,0.8,4), mat(0x7cff4f,0x2f8a10), false); W.arrow.rotation.x = Math.PI; W.arrow.visible = false; world.add(W.arrow);
}

// ---- collision + navigation (used by the sneak game and walkers) ----
function pushOutBox(l, b, r){
  const qx = clamp(l.x,b.x0,b.x1), qz = clamp(l.z,b.z0,b.z1); let dx = l.x-qx, dz = l.z-qz; const dd = dx*dx+dz*dz;
  if (dd >= r*r) return false;
  if (dd > 1e-8){ const d = Math.sqrt(dd); l.x = qx + dx/d*r; l.z = qz + dz/d*r; }
  else { const o = [[l.x-b.x0,-1,0],[b.x1-l.x,1,0],[l.z-b.z0,0,-1],[b.z1-l.z,0,1]].sort((a,b)=>a[0]-b[0])[0]; l.x += o[1]*(o[0]+r); l.z += o[2]*(o[0]+r); }
  return true;
}
function collide(p, r){
  for (const t of W.taverns){ const l = toL(t,p); if (Math.abs(l.x) > 7 || Math.abs(l.z) > 6.5) continue; let hit = false;
    for (const b of LOCAL_BOXES) hit = pushOutBox(l, b, r) || hit;
    const kx = l.x-KEG.x, kz = l.z-KEG.z, kd = Math.hypot(kx,kz);
    if (kd < 0.9+r && kd > 0){ l.x = KEG.x + kx/kd*(0.9+r); l.z = KEG.z + kz/kd*(0.9+r); hit = true; }
    if (hit){ const w = toW(t,l); p.x = w.x; p.z = w.z; } }
  const cd = Math.hypot(p.x,p.z); if (cd < 1.9+r && cd > 0){ p.x = p.x/cd*(1.9+r); p.z = p.z/cd*(1.9+r); }
  const rr = Math.hypot(p.x,p.z), lim = RAD+7.6; if (rr > lim){ p.x *= lim/rr; p.z *= lim/rr; }
}
function localRoute(t, from, to){ const pts = [];
  if (Math.abs(from.z) > 0.35) pts.push({x:clamp(from.x,-4.2,3.1), z:0});
  pts.push({x:to.x, z:0}); pts.push(to); return pts.map(p => toW(t,p)); }
function plazaRoute(a, b){ const pts = [], vx = b.x-a.x, vz = b.z-a.z, L2 = vx*vx+vz*vz || 1;
  const u = clamp(-(a.x*vx + a.z*vz)/L2, 0, 1), cx = a.x+vx*u, cz = a.z+vz*u;
  if (Math.hypot(cx,cz) < 3.6){ let nx = -vz, nz = vx; const nl = Math.hypot(nx,nz)||1; nx/=nl; nz/=nl; if (nx*cx+nz*cz < 0){ nx=-nx; nz=-nz; } pts.push({x:nx*4.6, z:nz*4.6}); }
  pts.push(b); return pts; }
function route(from, to){
  const ra = regionOf(from), rb = regionOf(to);
  if (ra === rb && ra >= 0){ const t = W.taverns[ra]; return localRoute(t, toL(t,from), toL(t,to)); }
  let pts = [], cur = from;
  if (ra >= 0){ const t = W.taverns[ra]; pts = pts.concat(localRoute(t, toL(t,from), {x:0,z:3.6})); const door = toW(t,{x:0,z:6.2}); pts.push(door); cur = door; }
  if (rb >= 0){ const t = W.taverns[rb]; pts = pts.concat(plazaRoute(cur, toW(t,{x:0,z:6.2}))); pts.push(toW(t,{x:0,z:3.6})); pts = pts.concat(localRoute(t, {x:0,z:3.6}, toL(t,to))); }
  else pts = pts.concat(plazaRoute(cur, to));
  return pts;
}

// walkers (cinematic movement)
let speedMul = 1;
function addChar(ch, p, face){ ch.pos = {x:p.x, z:p.z}; ch.face = face||0; ch.root.position.set(p.x,0,p.z); ch.root.rotation.y = ch.face; world.add(ch.root); W.extras.push(ch); return ch; }
function removeChar(ch){ world.remove(ch.root); W.extras = W.extras.filter(x => x !== ch); }
function walk(ch, pts, speed=3.2){ return new Promise(res => { ch.sit = false; W.movers.add({ch, pts:pts.slice(), speed, res}); }); }
function updateMovers(dt){
  for (const m of W.movers){ const ch = m.ch, p = m.pts[0];
    if (!p){ W.movers.delete(m); ch.spd = 0; m.res(); continue; }
    const dx = p.x-ch.pos.x, dz = p.z-ch.pos.z, d = Math.hypot(dx,dz), s = m.speed*speedMul;
    if (d < Math.max(0.12, s*dt)){ ch.pos.x = p.x; ch.pos.z = p.z; m.pts.shift(); continue; }
    ch.pos.x += dx/d*s*dt; ch.pos.z += dz/d*s*dt; ch.spd = m.speed; ch.face = Math.atan2(dx,dz); }
}

// =====================================================================
// CAMERA + LIGHT
// =====================================================================
const cam = {pos:new THREE.Vector3(0,40,40), look:new THREE.Vector3(), gp:new THREE.Vector3(0,40,40), gl:new THREE.Vector3(), k:3, follow:null};
let shakeAmt = 0; const shake = a => { shakeAmt = Math.max(shakeAmt, a); };
let panelOpen = false;
function camTo(x,z,dist,h,k=3, lookShift=0){ cam.gp.set(x, h, z+dist+lookShift); cam.gl.set(x, 0, z+lookShift); cam.k = k; cam.follow = null; }
function camTavern(i, zoom=1, k=3){ const t = W.taverns[i];
  const shift = (portrait && panelOpen) ? 6.5*zoom : 0;
  camTo(t.cx, t.cz, (portrait?16:12.5)*zoom, (portrait?24:16.5)*zoom, k, shift); }
function camCity(k=2){ const shift = (portrait && panelOpen) ? 14 : 0; camTo(0, 1, portrait?46:34, portrait?66:44, k, shift); }
function updateCamera(dt){
  if (cam.follow){ const f = cam.follow, off = portrait ? {y:24, z:15} : {y:17, z:12}; cam.gp.set(f.pos.x, off.y, f.pos.z+off.z); cam.gl.set(f.pos.x, 0, f.pos.z); }
  const k = 1 - Math.exp(-cam.k*dt); cam.pos.lerp(cam.gp, k); cam.look.lerp(cam.gl, k);
  camera.position.copy(cam.pos);
  if (shakeAmt > 0){ camera.position.x += rand(-1,1)*shakeAmt; camera.position.y += rand(-1,1)*shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt*2.5); }
  camera.lookAt(cam.look);
  sun.position.set(cam.look.x-16, 36, cam.look.z+14); sun.target.position.copy(cam.look);
}
function updateLight(dt){
  dayF += (dayTarget - dayF) * Math.min(1, dt*0.8);
  scene.background.copy(SKY_DAY).lerp(SKY_NIGHT, dayF); scene.fog.color.copy(scene.background);
  sun.color.copy(SUN_DAY).lerp(SUN_NIGHT, dayF); sun.intensity = lerp(0.85, 0.42, dayF); hemi.intensity = lerp(0.62, 0.42, dayF);
  if (!W) return;
  W.lamps.forEach(l => l.material.emissive.setRGB(dayF, dayF*0.75, dayF*0.3));
  W.taverns.forEach(t => t.lantern.material.emissive.setRGB(dayF, dayF*0.7, dayF*0.25));
  W.beacon.material.emissive.setRGB(dayF*0.9, dayF*0.85, dayF*0.3);
}

