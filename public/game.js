/* ============================================================
   PokeDungeon — Zone I
   Foggy cavern crawler. Limited Poké Balls, rarity-based catch
   odds & token values (max 150,000/session), looted chests, one
   exploding mimic, an inventory, settings + synth audio, and a
   $RIPPED airdrop whitelist on the win screen.
   ============================================================ */

const cvs = document.getElementById("game");
let ctx = cvs.getContext("2d");                 // `let` so we can redirect it for icon rendering
const dark = document.createElement("canvas"), dctx = dark.getContext("2d");
let VW, VH;
function resize(){ VW = cvs.width = innerWidth; VH = cvs.height = innerHeight; dark.width = VW; dark.height = VH; }
addEventListener("resize", resize); resize();

/* ---------- dungeon generation ---------- */
const TS = 48, MAPW = 46, MAPH = 34;
let grid = [], rooms = [];
function rnd(a, b){ return a + Math.floor(Math.random() * (b - a)); }
function genDungeon(){
  grid = Array.from({ length: MAPH }, () => Array(MAPW).fill(1));
  rooms = [];
  for(let i = 0; i < 90 && rooms.length < 11; i++){
    const w = rnd(6, 10), h = rnd(5, 8), x = rnd(1, MAPW - w - 1), y = rnd(1, MAPH - h - 1);
    const nr = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if(rooms.some(r => !(nr.x + nr.w + 1 < r.x || r.x + r.w + 1 < nr.x || nr.y + nr.h + 1 < r.y || r.y + r.h + 1 < nr.y))) continue;
    rooms.push(nr);
    for(let yy = y; yy < y + h; yy++) for(let xx = x; xx < x + w; xx++) grid[yy][xx] = 0;
  }
  for(let i = 1; i < rooms.length; i++) carve(rooms[i - 1], rooms[i]);
}
function carve(a, b){
  let x = a.cx, y = a.cy;
  while(x !== b.cx){ grid[y][x] = 0; grid[y + 1] && (grid[y + 1][x] = 0); x += Math.sign(b.cx - x); }
  while(y !== b.cy){ grid[y][x] = 0; grid[y][x + 1] = 0; y += Math.sign(b.cy - y); }
  grid[y][x] = 0;
}
function solidTile(tx, ty){ if(tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) return true; return grid[ty][tx] === 1; }
function solidPx(x, y){ return solidTile((x / TS) | 0, (y / TS) | 0); }
genDungeon();

/* ---------- rarity model ---------- (values across all 10 sum to 100,000) */
const RARITY = {
  Common:    { val: 4500,  pen: 2000,  zone: 0.16,  base: 0.96, speed: 0.95, color: "#9fb0c0", label: "COMMON" },
  Uncommon:  { val: 8000,  pen: 3000,  zone: 0.14,  base: 0.88, speed: 1.10, color: "#5fd06f", label: "UNCOMMON" },
  Rare:      { val: 12000, pen: 5000,  zone: 0.11,  base: 0.75, speed: 1.30, color: "#4aa3ff", label: "RARE" },
  Epic:      { val: 17000, pen: 7000,  zone: 0.095, base: 0.62, speed: 1.50, color: "#c267d9", label: "EPIC" },
  Legendary: { val: 25000, pen: 10000, zone: 0.08,  base: 0.50, speed: 1.70, color: "#ffcb3d", label: "LEGENDARY" },
};
const CREATURES = [
  { name: "Voltchu",   type: "Electric", rar: "Common",    c1: "#f6d33b", c2: "#c9a414", acc: "#fff6c2", feat: "ears" },
  { name: "Embertail", type: "Fire",     rar: "Uncommon",  c1: "#ef5f2c", c2: "#b23a12", acc: "#ffce8a", feat: "flame" },
  { name: "Aquafin",   type: "Water",    rar: "Common",    c1: "#3ba3e6", c2: "#1f6fb0", acc: "#bfe6ff", feat: "fin" },
  { name: "Sprigleaf", type: "Grass",    rar: "Common",    c1: "#4fb05a", c2: "#2f7d3a", acc: "#d6f3c2", feat: "leaf" },
  { name: "Rokkit",    type: "Rock",     rar: "Common",    c1: "#9a8b73", c2: "#6d5f4b", acc: "#e2d8c4", feat: "spikes" },
  { name: "Psymee",    type: "Psychic",  rar: "Epic",      c1: "#c267d9", c2: "#8e3da8", acc: "#f3cdfb", feat: "swirl" },
  { name: "Umbrapup",  type: "Dark",     rar: "Rare",      c1: "#5b5676", c2: "#322e46", acc: "#9b96ba", feat: "horns" },
  { name: "Glacip",    type: "Ice",      rar: "Rare",      c1: "#8fd9e6", c2: "#56aebd", acc: "#e3fbff", feat: "crystal" },
  { name: "Draklet",   type: "Dragon",   rar: "Legendary", c1: "#6f5fe0", c2: "#4434a8", acc: "#c5bdfb", feat: "wings" },
  { name: "Normimo",   type: "Normal",   rar: "Uncommon",  c1: "#cfb89a", c2: "#a08a6e", acc: "#f1e6d2", feat: "round" },
];
const CREATURE_N = 10;
const CHEST_REWARD_N = 3;                          // + 1 mimic = 4 chests total (sparser than before)
const CHEST_RANGES = [[6000, 16000], [6000, 16000], [8000, 18000]]; // max sum = 50,000
const BALLS_START = 16;
const BOMB_PENALTY = 12000;
const REVEAL = 168;

/* ---------- optional CC0 sprite sheet ----------
   Drop a sprite-sheet PNG at public/assets/monsters.png and fill SHEET below.
   Until it's present AND a creature has a frame mapped, the game falls back to
   the drawn creature — so nothing breaks if the assets aren't added yet. */
const SHEET = {
  src: "assets/monsters.png",
  fw: 32, fh: 32,     // frame size in px — set to match your pack
  cols: 0,            // columns in the sheet (auto-detected from width if 0)
  scale: 2.4,         // on-screen size vs the drawn creatures
  frames: {           // creature name -> [col, row] in the sheet (filled once we see the sheet)
    // Voltchu:[0,0], Embertail:[1,0], Aquafin:[2,0], Sprigleaf:[3,0], Rokkit:[4,0],
    // Psymee:[5,0], Umbrapup:[6,0], Glacip:[7,0], Draklet:[8,0], Normimo:[9,0],
  },
};
let sheetImg = null, sheetReady = false;
(() => {
  const img = new Image();
  img.onload = () => { sheetImg = img; sheetReady = true; if(!SHEET.cols) SHEET.cols = Math.max(1, Math.floor(img.width / SHEET.fw)); };
  img.onerror = () => { sheetReady = false; };
  img.src = SHEET.src;
})();
function drawSprite(x, y, s, def){
  const f = SHEET.frames[def.name], d = s * (SHEET.scale || 2.4);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImg, f[0] * SHEET.fw, f[1] * SHEET.fh, SHEET.fw, SHEET.fh, x - d / 2, y - d / 2, d, d);
  ctx.imageSmoothingEnabled = sm;
}

/* ---------- world objects & run state ---------- */
let chests = [], gates = [], creatures = [], torches = [], vault = null;
let coins = 0, balls = BALLS_START, caughtCount = 0, fledCount = 0;
let tokMon = 0, tokChest = 0, penaltyTotal = 0;    // for the win-screen breakdown
let bombFx = null, shakeT = 0, shakeMag = 0, flashT = 0, fogPhase = 0, animT = 0, staticPose = false;

function setup(){
  const start = rooms[0];
  const sc = { x: start.cx, y: start.cy };
  let cells = [];
  rooms.forEach((r, ri) => {
    for(let yy = r.y + 1; yy < r.y + r.h - 1; yy++)
      for(let xx = r.x + 1; xx < r.x + r.w - 1; xx++)
        if(grid[yy] && grid[yy][xx] === 0)
          cells.push({ x: xx, y: yy, ri, d: Math.abs(xx - sc.x) + Math.abs(yy - sc.y) });
  });
  const occ = new Set();
  const key = c => c.x + "," + c.y;
  for(let yy = start.cy - 1; yy <= start.cy + 1; yy++)
    for(let xx = start.cx - 1; xx <= start.cx + 1; xx++) occ.add(xx + "," + yy);

  // Vault: farthest cell
  const far = [...cells].sort((a, b) => b.d - a.d);
  const vc = far.find(c => !occ.has(key(c))) || far[0];
  vault = { x: vc.x * TS + TS / 2, y: vc.y * TS + TS / 2, tx: vc.x, ty: vc.y, open: false };
  occ.add(key(vc));

  // 5 locked zone gates: next-farthest, spaced
  gates = [];
  for(const c of far){
    if(gates.length >= 5) break;
    if(occ.has(key(c)) || Math.abs(c.x - vc.x) + Math.abs(c.y - vc.y) < 4) continue;
    if(gates.some(g => Math.abs(g.tx - c.x) + Math.abs(g.ty - c.y) < 5)) continue;
    gates.push({ x: c.x * TS + TS / 2, y: c.y * TS + TS / 2, tx: c.x, ty: c.y, zone: gates.length + 2 });
    occ.add(key(c));
  }

  // 10 creatures (roster order → dex index === CREATURES index)
  const shuf = () => [...cells].sort(() => Math.random() - 0.5);
  creatures = [];
  for(const c of shuf()){
    if(creatures.length >= CREATURE_N) break;
    if(occ.has(key(c)) || creatures.some(o => Math.abs(o.tx - c.x) + Math.abs(o.ty - c.y) < 3)) continue;
    creatures.push({ x: c.x * TS + TS / 2, y: c.y * TS + TS / 2, tx: c.x, ty: c.y, def: CREATURES[creatures.length], caught: false, caughtAt: -1, bob: Math.random() * 7, hop: 0 });
    occ.add(key(c));
  }

  // chests: 3 reward + 1 mimic (bomb), spread out (min spacing 5 tiles)
  chests = [];
  const placeChest = (type, range) => {
    for(const c of shuf()){
      if(chests.length >= CHEST_REWARD_N + 1) break;
      if(occ.has(key(c))) continue;
      if(chests.some(o => Math.abs(o.tx - c.x) + Math.abs(o.ty - c.y) < 5)) continue;
      chests.push({ x: c.x * TS + TS / 2, y: c.y * TS + TS / 2, tx: c.x, ty: c.y, opened: false, type, range, value: 0 });
      occ.add(key(c));
      return;
    }
  };
  CHEST_RANGES.forEach(rg => placeChest("reward", rg));
  placeChest("bomb", null);

  // torches on the top wall of each room
  torches = [];
  rooms.forEach(r => { const tx = r.cx, ty = r.y - 1; if(ty > 0 && grid[ty][tx] === 1) torches.push({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 + 10, f: Math.random() * 7 }); });
}
setup();

/* ---------- player & state ---------- */
const p = { x: rooms[0].cx * TS + TS / 2, y: rooms[0].cy * TS + TS / 2, face: "down", step: 0, moving: false };
let state = "intro";        // intro | play | catch | win
let catchG = null;
let uiPaused = false;       // true while a panel (settings/inventory) is open
let elapsed = 0, msg = "", msgT = 0;

/* ---------- input ---------- */
const keys = {};
// keyed by physical key code (e.code) so movement/actions work on any keyboard layout (e.g. Cyrillic)
const MK = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], KeyW:[0,-1], KeyS:[0,1], KeyA:[-1,0], KeyD:[1,0] };
function clearKeys(){ for(const k in keys) keys[k] = false; }
addEventListener("keydown", e => {
  if(document.activeElement && document.activeElement.tagName === "INPUT") return; // let the wallet field work
  const c = e.code;
  if(c === "Space"){ e.preventDefault(); if(state === "intro") enter(); else if(state === "catch") throwBall(); }
  if(c === "KeyE"){ if(state === "play") interact(); else if(state === "catch") throwBall(); }
  if(c === "KeyI") toggleInventory();
  if(c === "KeyO") toggleSettings();
  if(c === "Escape") closeAllPanels();
  if(MK[c]){ e.preventDefault(); keys[c] = true; }
});
addEventListener("keyup", e => { if(MK[e.code]) keys[e.code] = false; });

let tStart = null, tMove = { x: 0, y: 0 };
addEventListener("touchstart", e => {
  if(state === "intro"){ enter(); return; }
  const t = e.touches[0]; tStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
addEventListener("touchmove", e => { const t = e.touches[0]; if(tStart) tMove = { x: t.clientX - tStart.x, y: t.clientY - tStart.y }; }, { passive: true });
addEventListener("touchend", () => {
  if(tStart && Math.hypot(tMove.x, tMove.y) < 14){ if(state === "play") interact(); else if(state === "catch") throwBall(); }
  tStart = null; tMove = { x: 0, y: 0 };
}, { passive: true });

function enter(){
  state = "play";
  if(window.Sound) Sound.unlock();
  const intro = document.getElementById("intro");
  intro.classList.add("hide");
  setTimeout(() => intro.style.display = "none", 700);
  document.getElementById("topbtns").classList.add("show");
  toast("Catch with limited balls · loot chests · beware the mimic · reach the Vault");
}
function toast(t){ msg = t; msgT = 220; }

/* ---------- interaction ---------- */
function interact(){
  if(state !== "play" || uiPaused) return;
  const cand = [];
  for(const cr of creatures) if(!cr.caught && !cr.fled){ const d = Math.hypot(cr.x - p.x, cr.y - p.y); if(d < TS * 1.4) cand.push({ d, t: "cr", o: cr }); }
  for(const c of chests) if(!c.opened){ const d = Math.hypot(c.x - p.x, c.y - p.y); if(d < TS * 1.3) cand.push({ d, t: "chest", o: c }); }
  { const d = Math.hypot(vault.x - p.x, vault.y - p.y); if(d < TS * 1.5) cand.push({ d, t: "vault", o: vault }); }
  for(const g of gates){ const d = Math.hypot(g.x - p.x, g.y - p.y); if(d < TS * 1.4) cand.push({ d, t: "gate", o: g }); }
  if(!cand.length) return;
  cand.sort((a, b) => a.d - b.d);
  const top = cand[0];
  if(top.t === "cr") startCatch(top.o);
  else if(top.t === "chest"){ top.o.type === "bomb" ? explode(top.o) : openChest(top.o); }
  else if(top.t === "vault"){ if(vault.open) win(); else toast("The Vault is sealed — catch them all or run dry first (" + caughtCount + "/" + CREATURE_N + ")"); }
  else if(top.t === "gate") toast("ZONE " + roman(top.o.zone) + " — LOCKED · opens after the airdrop");
}

function openChest(c){
  c.opened = true;
  const v = Math.round(rnd(c.range[0], c.range[1] + 1) / 500) * 500;
  c.value = v; coins += v; tokChest += v;
  if(window.Sound) Sound.sfx.chest();
  toast("Chest! +" + fmt(v) + " $RIPPED");
}
function explode(c){
  c.opened = true; c.bomb = true;
  const pen = Math.min(coins, BOMB_PENALTY);
  coins -= pen; penaltyTotal += pen;
  bombFx = { x: c.x, y: c.y, t: 0 };
  shakeT = 0.5; shakeMag = 16; flashT = 0.5;
  if(window.Sound) Sound.sfx.bomb();
  toast(pen > 0 ? "💥 BOOM! Mimic chest — lost " + fmt(pen) + " $RIPPED" : "💥 BOOM! A mimic chest!");
}

/* ---------- catch mini-game ---------- */
function startCatch(cr){
  if(balls <= 0){ toast("Out of Poké Balls! Head to the Vault to cash out."); return; }
  const r = RARITY[cr.def.rar];
  state = "catch";
  catchG = { cr, phase: "aim", m: Math.random() * 0.4 + 0.05, dir: Math.random() < 0.5 ? 1 : -1, speed: r.speed, zone: r.zone, base: r.base, ball: 0, t: 0, wobN: 0, success: false };
}
function catchRoll(g){
  const d = Math.abs(g.m - 0.5);
  let prob;
  if(d <= g.zone * 0.22) prob = 1;            // dead-centre → guaranteed
  else if(d <= g.zone) prob = g.base;         // green
  else if(d <= g.zone * 1.7) prob = g.base * 0.45; // yellow
  else prob = 0.1;                            // miss
  return Math.random() < prob;
}
function throwBall(){
  if(state !== "catch" || catchG.phase !== "aim") return;
  balls--;                                    // every throw costs a ball
  catchG.success = catchRoll(catchG);
  catchG.phase = "throw"; catchG.ball = 0;
  if(window.Sound) Sound.sfx.throw();
}
function updateCatch(dt){
  const g = catchG;
  if(g.phase === "aim"){ g.m += g.dir * g.speed * dt; if(g.m > 1){ g.m = 1; g.dir = -1; } if(g.m < 0){ g.m = 0; g.dir = 1; } }
  else if(g.phase === "throw"){ g.ball += dt * 2.4; if(g.ball >= 1){ g.ball = 1; g.phase = "wobble"; g.t = 0; g.wobN = 0; } }
  else if(g.phase === "wobble"){ g.t += dt; if(g.t >= 0.45){ g.t = 0; g.wobN++; if(g.wobN >= (g.success ? 3 : 2)) finishCatch(); } }
  else if(g.phase === "result"){ g.t += dt; if(g.t >= 1.4) endCatch(); }
}
function finishCatch(){
  const g = catchG; g.phase = "result"; g.t = 0;
  if(g.success){
    g.cr.caught = true; g.cr.caughtAt = caughtCount++;
    const v = RARITY[g.cr.def.rar].val; coins += v; tokMon += v;
    if(window.Sound) Sound.sfx.catch();
  } else {
    // a miss is permanent: the creature flees for good and a penalty is charged
    g.cr.fled = true; fledCount++;
    const pen = Math.min(coins, RARITY[g.cr.def.rar].pen); coins -= pen; g.pen = pen; penaltyTotal += pen;
    flashT = 0.35; shakeT = 0.28; shakeMag = 9;
    if(window.Sound) Sound.sfx.fail();
  }
}
function endCatch(){
  const g = catchG; state = "play";
  let t = g.success
    ? "Gotcha! " + g.cr.def.name + "  +" + fmt(RARITY[g.cr.def.rar].val) + " $RIPPED"
    : "💀 " + g.cr.def.name + " escaped for good" + (g.pen > 0 ? "  ·  fine −" + fmt(g.pen) + " $RIPPED" : "");
  if(!vault.open && (caughtCount + fledCount >= CREATURE_N || balls <= 0)){
    vault.open = true;
    t = (caughtCount + fledCount >= CREATURE_N) ? "All creatures resolved — the Vault is open. Cash out!" : "Out of Poké Balls — the Vault is open. Cash out!";
  }
  toast(t); catchG = null;
}

/* ---------- update loop ---------- */
function update(dt){
  for(const cr of creatures){ cr.bob += dt * 3; if(cr.hop > 0) cr.hop -= dt; else if(Math.random() < 0.004) cr.hop = 0.4; }
  for(const t of torches) t.f += dt * 6;
  if(shakeT > 0) shakeT -= dt;
  if(flashT > 0) flashT -= dt;
  if(bombFx){ bombFx.t += dt; if(bombFx.t > 0.6) bombFx = null; }
  fogPhase += dt; animT += dt;

  if(state === "catch"){ updateCatch(dt); return; }
  if(state !== "play" || uiPaused){ if(msgT > 0) msgT -= dt * 60; return; }

  elapsed += dt;
  let dx = 0, dy = 0;
  for(const k in keys){ if(keys[k] && MK[k]){ dx += MK[k][0]; dy += MK[k][1]; } }
  if(Math.abs(tMove.x) > 16) dx += Math.sign(tMove.x);
  if(Math.abs(tMove.y) > 16) dy += Math.sign(tMove.y);
  const m = Math.hypot(dx, dy); p.moving = m > 0;
  if(m > 0){
    dx /= m; dy /= m;
    if(Math.abs(dx) > Math.abs(dy)) p.face = dx > 0 ? "right" : "left"; else p.face = dy > 0 ? "down" : "up";
    const sp = 2.7 * dt * 60, hs = 13;
    const nx = p.x + dx * sp; if(free(nx, p.y, hs)) p.x = nx;
    const ny = p.y + dy * sp; if(free(p.x, ny, hs)) p.y = ny;
    p.step += dt * 10;
  } else p.step = 0;
  if(msgT > 0) msgT -= dt * 60;
}
function free(x, y, hs){ return !solidPx(x - hs, y - hs) && !solidPx(x + hs, y - hs) && !solidPx(x - hs, y + hs) && !solidPx(x + hs, y + hs); }

/* ---------- camera ---------- */
function clamp(v, a, b){ return Math.max(a, Math.min(b, Math.max(a, v))); }
function camX(){ return clamp(p.x - VW / 2, 0, MAPW * TS - VW); }
function camY(){ return clamp(p.y - VH / 2, 0, MAPH * TS - VH); }

/* ---------- small draw helpers ---------- */
function rr(x, y, w, h, r, fill){ ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }
function dot(x, y, r){ ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
function tri(x, baseY, halfW, h){ ctx.beginPath(); ctx.moveTo(x - halfW, baseY); ctx.lineTo(x, baseY - h); ctx.lineTo(x + halfW, baseY); ctx.closePath(); ctx.fill(); }
function flame(x, y, s){ ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s, y, x, y + s * 0.6); ctx.quadraticCurveTo(x - s, y, x, y - s); ctx.fill(); }
function hash(x, y){ return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
function roman(n){ return ["", "I", "II", "III", "IV", "V", "VI"][n] || n; }
function fmt(n){ return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

function drawBall(x, y, r, rot = 0){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.fillStyle = "#f3f3f3"; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.fillStyle = "#ef4d4d"; ctx.fillRect(-r, -r, 2 * r, r);
  ctx.fillStyle = "#1a1622"; ctx.fillRect(-r, -r * 0.16, 2 * r, r * 0.32);
  ctx.restore();
  ctx.fillStyle = "#1a1622"; dot(x, y, r * 0.34);
  ctx.fillStyle = "#f3f3f3"; dot(x, y, r * 0.2);
  ctx.fillStyle = "#1a1622"; dot(x, y, r * 0.09);
}

/* ---------- main draw ---------- */
function draw(){
  ctx.fillStyle = "#06070d"; ctx.fillRect(0, 0, VW, VH);
  if(state === "intro") return;

  const cx = camX(), cy = camY();
  const ox = shakeT > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  const oy = shakeT > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  ctx.save(); ctx.translate(-cx + ox, -cy + oy);
  drawTiles(cx, cy);
  for(const t of torches) drawTorch(t);
  for(const c of chests) drawChest(c);
  for(const g of gates) drawGate(g);
  drawVault();
  for(const cr of creatures) if(!cr.caught && !cr.fled) drawWild(cr);
  drawBombFx();
  promptNear();
  drawPlayer();
  ctx.restore();

  if(state === "play") paintFog(cx, cy);
  if(flashT > 0){ ctx.fillStyle = "rgba(255,90,40," + Math.min(0.6, flashT) + ")"; ctx.fillRect(0, 0, VW, VH); }

  drawHUD();
  drawDex();
  if(state === "catch") drawCatch();
  drawToast();
}

function drawTiles(cx, cy){
  const x0 = Math.max(0, (cx / TS | 0) - 1), x1 = Math.min(MAPW, ((cx + VW) / TS | 0) + 2);
  const y0 = Math.max(0, (cy / TS | 0) - 1), y1 = Math.min(MAPH, ((cy + VH) / TS | 0) + 2);
  for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++) drawTile(x, y);
}
function drawTile(x, y){
  const sx = x * TS, sy = y * TS, wall = grid[y][x] === 1;
  if(wall){
    ctx.fillStyle = "#2c2840"; ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = "#37324c";
    for(let by = 0; by < TS; by += 12){ const off = ((y * TS + by) / 12 | 0) % 2 ? 12 : 0; for(let bx = -off; bx < TS; bx += 24) ctx.fillRect(sx + bx + 1, sy + by + 1, 22, 10); }
    const below = grid[y + 1] && grid[y + 1][x] === 0;
    if(below){ ctx.fillStyle = "#46415e"; ctx.fillRect(sx, sy + TS - 6, TS, 6); ctx.fillStyle = "#1c1930"; ctx.fillRect(sx, sy + TS - 1, TS, 1); }
  } else {
    const h = hash(x, y) % 5;
    ctx.fillStyle = ["#23301f", "#202b1f", "#243322", "#212c1f", "#222f20"][h];
    ctx.fillRect(sx, sy, TS, TS);
    ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1);
    if(h === 2){ ctx.fillStyle = "#365c38"; ctx.fillRect(sx + 10, sy + TS - 12, 3, 8); ctx.fillRect(sx + 15, sy + TS - 15, 3, 11); ctx.fillRect(sx + 20, sy + TS - 11, 3, 7); }
  }
}
function drawTorch(t){
  ctx.fillStyle = "#3a2a16"; ctx.fillRect(t.x - 3, t.y - 2, 6, 14);
  const fl = Math.sin(t.f) * 2;
  ctx.fillStyle = "#f0a020"; ctx.beginPath(); ctx.ellipse(t.x, t.y - 6 + fl, 5, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#f5d040"; ctx.beginPath(); ctx.ellipse(t.x, t.y - 5 + fl, 2.5, 5, 0, 0, 7); ctx.fill();
}
function drawChest(c){
  if(c.opened){
    if(c.bomb){ // charred remains
      rr(c.x - 16, c.y - 2, 32, 14, 3, "#1a1410"); ctx.fillStyle = "#0e0a06"; ctx.fillRect(c.x - 14, c.y - 8, 28, 7);
      ctx.fillStyle = "#52391c"; ctx.fillRect(c.x - 16, c.y - 12, 7, 6); ctx.fillRect(c.x + 9, c.y - 11, 6, 5);
      return;
    }
    rr(c.x - 15, c.y - 4, 30, 16, 3, "#3a2a14");
    ctx.fillStyle = "#1c1408"; ctx.fillRect(c.x - 15, c.y - 12, 30, 8);
    ctx.fillStyle = "#5a4a20"; ctx.fillRect(c.x - 15, c.y - 16, 30, 5);
    return;
  }
  // closed chests (reward & mimic look identical — that's the trap)
  rr(c.x - 16, c.y - 4, 32, 18, 3, "#7a531f");
  rr(c.x - 16, c.y - 15, 32, 13, 5, "#9a6a28");
  ctx.fillStyle = "#ffcb3d"; ctx.fillRect(c.x - 16, c.y - 3, 32, 4);
  ctx.fillStyle = "#f3d479"; ctx.fillRect(c.x - 3, c.y - 7, 6, 9);
  ctx.fillStyle = "#3a2a14"; ctx.fillRect(c.x - 1, c.y - 2, 2, 3);
}
function drawBombFx(){
  if(!bombFx) return;
  const pr = Math.min(1, bombFx.t / 0.6);
  ctx.strokeStyle = "rgba(255,170,60," + (1 - pr) + ")"; ctx.lineWidth = 6 * (1 - pr) + 2;
  ctx.beginPath(); ctx.arc(bombFx.x, bombFx.y, 18 + pr * 72, 0, 7); ctx.stroke();
  for(let i = 0; i < 9; i++){ const a = i / 9 * 7, d = pr * 64; ctx.fillStyle = "rgba(255,120,40," + (1 - pr) + ")"; dot(bombFx.x + Math.cos(a) * d, bombFx.y + Math.sin(a) * d, 4 * (1 - pr) + 1); }
}
function drawGate(d){
  rr(d.x - 18, d.y - 26, 36, 44, 4, "#241c30");
  rr(d.x - 14, d.y - 22, 28, 38, 3, "#312646");
  ctx.fillStyle = "#5a4d72"; ctx.fillRect(d.x - 14, d.y - 4, 28, 2);
  ctx.fillStyle = "#caa24a"; dot(d.x, d.y - 2, 4); ctx.fillStyle = "#241c30"; ctx.fillRect(d.x - 1, d.y - 2, 2, 5);
  ctx.fillStyle = "#b89a6a"; ctx.font = "800 12px 'Baloo 2',sans-serif"; ctx.textAlign = "center";
  ctx.fillText("ZONE " + roman(d.zone), d.x, d.y - 30);
}
function drawVault(){
  const v = vault, open = v.open;
  rr(v.x - 26, v.y - 32, 52, 56, 5, "#1a1322");
  rr(v.x - 21, v.y - 27, 42, 48, 4, open ? "#caa24a" : "#3a2f1a");
  ctx.fillStyle = open ? "#f3d479" : "#564621"; dot(v.x, v.y - 2, 12);
  ctx.fillStyle = open ? "#1a1322" : "#241c10"; dot(v.x, v.y - 2, 7);
  for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; ctx.fillStyle = open ? "#f3d479" : "#564621"; dot(v.x + Math.cos(a) * 15, v.y - 2 + Math.sin(a) * 15, 2); }
  ctx.fillStyle = open ? "#ffcb3d" : "#7a6a52"; ctx.font = "800 13px 'Baloo 2',sans-serif"; ctx.textAlign = "center";
  ctx.fillText("VAULT", v.x, v.y - 38);
}
function drawWild(cr){
  const bob = Math.sin(cr.bob) * 2 + (cr.hop > 0 ? Math.sin(cr.hop / 0.4 * Math.PI) * 6 : 0);
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(cr.x, cr.y + 16, 14, 5, 0, 0, 7); ctx.fill();
  drawCreature(cr.x, cr.y - 6 - bob, 18, cr.def);
}

/* ---------- creature art ----------
   Each creature type has its own silhouette, outline and light/shade pass.
   Dispatched by `feat`; falls back to the sprite sheet if one is mapped. */
const OL = "#15101c";
const FEAT_KIND = { ears:"electric", flame:"fire", fin:"water", leaf:"grass", spikes:"rock", swirl:"psychic", horns:"dark", crystal:"ice", wings:"dragon", round:"normal" };
function strokeOL(w){ ctx.lineWidth = w; ctx.strokeStyle = OL; ctx.lineJoin = "round"; ctx.stroke(); }
function cBody(x, y, rw, rh, def, o){               // outlined, volume-shaded body
  ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, 0, 7); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, 0, 7); ctx.clip();
  ctx.globalAlpha = 0.5; ctx.fillStyle = def.c2; ctx.beginPath(); ctx.ellipse(x, y + rh * 0.55, rw * 1.15, rh * 0.7, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.22; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(x - rw * 0.22, y - rh * 0.46, rw * 0.62, rh * 0.34, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function cBelly(x, y, rw, rh, def){ ctx.beginPath(); ctx.ellipse(x, y + rh * 0.28, rw * 0.6, rh * 0.56, 0, 0, 7); ctx.fillStyle = def.acc; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; }
function cEyes(cx, cy, r, sp){
  let open = 1;                                       // periodic blink
  if(!staticPose){ const b = Math.sin(animT * 0.8 + cx * 0.05); if(b > 0.96) open = Math.max(0.06, 1 - (b - 0.96) / 0.04); }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(cx - sp, cy, r, r * 1.12 * open, 0, 0, 7); ctx.ellipse(cx + sp, cy, r, r * 1.12 * open, 0, 0, 7); ctx.fill(); strokeOL(r * 0.3);
  if(open > 0.4){
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(cx - sp, cy + r * 0.12, r * 0.52, 0, 7); ctx.arc(cx + sp, cy + r * 0.12, r * 0.52, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx - sp + r * 0.2, cy - r * 0.2, r * 0.2, 0, 7); ctx.arc(cx + sp + r * 0.2, cy - r * 0.2, r * 0.2, 0, 7); ctx.fill();
  }
}
const CREATURE_ART = {
  electric(x, y, s, def, o){
    ctx.beginPath(); ctx.moveTo(x + s * 0.6, y + s * 0.05); ctx.lineTo(x + s * 1.0, y - s * 0.1); ctx.lineTo(x + s * 0.85, y - s * 0.25); ctx.lineTo(x + s * 1.3, y - s * 0.55); ctx.lineTo(x + s * 0.95, y - s * 0.5); ctx.lineTo(x + s * 1.2, y - s * 0.95); ctx.lineTo(x + s * 0.72, y - s * 0.35); ctx.lineTo(x + s * 0.6, y - s * 0.05); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
    const tw = staticPose ? 0 : Math.sin(animT * 4 + x) * s * 0.06;
    for(const d of [-1, 1]){
      ctx.beginPath(); ctx.moveTo(x + d * s * 0.32, y - s * 0.5); ctx.quadraticCurveTo(x + d * s * 0.5, y - s * 1.35, x + d * s * 0.8 + tw, y - s * 1.5); ctx.quadraticCurveTo(x + d * s * 0.66, y - s * 0.85, x + d * s * 0.62, y - s * 0.5); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
      ctx.beginPath(); ctx.moveTo(x + d * s * 0.58, y - s * 1.08); ctx.quadraticCurveTo(x + d * s * 0.64, y - s * 1.4, x + d * s * 0.8 + tw, y - s * 1.5); ctx.quadraticCurveTo(x + d * s * 0.64, y - s * 1.2, x + d * s * 0.64, y - s * 1.02); ctx.closePath(); ctx.fillStyle = OL; ctx.fill();
    }
    cBody(x, y, s * 0.84, s * 0.8, def, o); cBelly(x, y, s * 0.84, s * 0.8, def);
    ctx.fillStyle = "#ff5a4a"; ctx.beginPath(); ctx.arc(x - s * 0.56, y + s * 0.2, s * 0.15, 0, 7); ctx.arc(x + s * 0.56, y + s * 0.2, s * 0.15, 0, 7); ctx.fill();
    cEyes(x, y - s * 0.06, s * 0.2, s * 0.32);
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(x, y + s * 0.16, s * 0.06, 0, 7); ctx.fill();
  },
  fire(x, y, s, def, o){
    const fk = staticPose ? 0 : Math.sin(animT * 9 + x), fj = staticPose ? 0 : Math.cos(animT * 11 + x) * s * 0.05;
    ctx.beginPath(); ctx.moveTo(x + s * 0.55, y + s * 0.35); ctx.quadraticCurveTo(x + s * 1.3, y + s * 0.2, x + s * 1.1, y - s * 0.5); ctx.quadraticCurveTo(x + s * 0.95, y + s * 0.05, x + s * 0.5, y + s * 0.1); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
    ctx.fillStyle = "#ffd27a"; flame(x + s * 1.12 + fj, y - s * 0.7, s * 0.34 * (1 + fk * 0.16)); ctx.fillStyle = "#ff7a2c"; flame(x + s * 1.12 + fj, y - s * 0.66, s * 0.2 * (1 + fk * 0.2));
    cBody(x, y, s * 0.8, s * 0.84, def, o); cBelly(x, y, s * 0.8, s * 0.84, def);
    ctx.fillStyle = def.c1; ctx.beginPath(); ctx.ellipse(x - s * 0.72, y + s * 0.22, s * 0.16, s * 0.26, 0.5, 0, 7); ctx.fill(); strokeOL(o);
    ctx.fillStyle = "#ffd27a"; flame(x - fj, y - s * 0.98, s * 0.34 * (1 + fk * 0.16)); ctx.fillStyle = "#ff7a2c"; flame(x - fj, y - s * 0.92, s * 0.2 * (1 + fk * 0.2));
    cEyes(x, y - s * 0.1, s * 0.18, s * 0.3);
    ctx.fillStyle = def.c2; ctx.beginPath(); ctx.ellipse(x, y + s * 0.22, s * 0.2, s * 0.13, 0, 0, 7); ctx.fill();
  },
  water(x, y, s, def, o){
    ctx.beginPath(); ctx.moveTo(x + s * 0.55, y); ctx.lineTo(x + s * 1.25, y - s * 0.5); ctx.lineTo(x + s * 1.05, y); ctx.lineTo(x + s * 1.25, y + s * 0.5); ctx.closePath(); ctx.fillStyle = def.c2; ctx.fill(); strokeOL(o);
    ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * 0.65); ctx.lineTo(x + s * 0.08, y - s * 1.25); ctx.lineTo(x + s * 0.38, y - s * 0.55); ctx.closePath(); ctx.fillStyle = def.c2; ctx.fill(); strokeOL(o);
    cBody(x, y, s * 0.82, s * 0.78, def, o); cBelly(x, y, s * 0.82, s * 0.78, def);
    ctx.fillStyle = def.acc; ctx.beginPath(); ctx.ellipse(x - s * 0.62, y + s * 0.28, s * 0.24, s * 0.12, -0.5 + (staticPose ? 0 : Math.sin(animT * 4 + x) * 0.3), 0, 7); ctx.fill(); strokeOL(o * 0.8);
    cEyes(x - s * 0.06, y - s * 0.06, s * 0.2, s * 0.32);
  },
  grass(x, y, s, def, o){
    const sw = staticPose ? 0 : Math.sin(animT * 2.5) * 0.14;
    for(const d of [-1, 0, 1]){ ctx.save(); ctx.translate(x, y - s * 0.62); ctx.rotate(d * 0.55 + sw);
      ctx.beginPath(); ctx.ellipse(0, -s * 0.5, s * 0.18, s * 0.5, 0, 0, 7); ctx.fillStyle = "#5fcf63"; ctx.fill(); strokeOL(o);
      ctx.strokeStyle = "#2f7d3a"; ctx.lineWidth = o * 0.8; ctx.beginPath(); ctx.moveTo(0, -s * 0.05); ctx.lineTo(0, -s * 0.9); ctx.stroke(); ctx.restore(); }
    cBody(x, y, s * 0.82, s * 0.84, def, o); cBelly(x, y, s * 0.82, s * 0.84, def);
    cEyes(x, y + s * 0.02, s * 0.2, s * 0.3);
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(x, y + s * 0.3, s * 0.05, 0, 7); ctx.fill();
  },
  rock(x, y, s, def, o){
    ctx.beginPath(); ctx.moveTo(x - s * 0.85, y + s * 0.2); ctx.lineTo(x - s * 0.7, y - s * 0.55); ctx.lineTo(x - s * 0.2, y - s * 0.9); ctx.lineTo(x + s * 0.45, y - s * 0.8); ctx.lineTo(x + s * 0.85, y - s * 0.2); ctx.lineTo(x + s * 0.72, y + s * 0.7); ctx.lineTo(x - s * 0.6, y + s * 0.72); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
    ctx.save(); ctx.clip(); ctx.globalAlpha = 0.5; ctx.fillStyle = def.c2; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.15); ctx.lineTo(x + s, y + s * 0.05); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = def.acc; tri(x - s * 0.4, y - s * 0.78, s * 0.16, s * 0.4); tri(x + s * 0.12, y - s * 0.92, s * 0.2, s * 0.5); tri(x + s * 0.52, y - s * 0.66, s * 0.14, s * 0.35);
    ctx.fillStyle = def.c2; ctx.fillRect(x - s * 0.5, y - s * 0.3, s * 1.0, s * 0.12);
    cEyes(x, y, s * 0.16, s * 0.3);
  },
  psychic(x, y, s, def, o){
    ctx.fillStyle = def.c1; for(const d of [-1, 1]){ ctx.beginPath(); ctx.ellipse(x + d * s * 0.4, y + s * 0.95, s * 0.12, s * 0.18, 0, 0, 7); ctx.fill(); strokeOL(o * 0.7); }
    cBody(x, y, s * 0.8, s * 0.8, def, o);
    const ts = staticPose ? 0 : Math.sin(animT * 2.2) * s * 0.16;
    for(const d of [-1, 1]){ ctx.strokeStyle = def.c1; ctx.lineWidth = o * 1.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + d * s * 0.5, y - s * 0.6); ctx.quadraticCurveTo(x + d * s * 1.05, y - s * 1.1, x + d * s * 0.6 + ts, y - s * 1.45); ctx.stroke();
      ctx.fillStyle = def.acc; ctx.beginPath(); ctx.arc(x + d * s * 0.6 + ts, y - s * 1.45, s * 0.13, 0, 7); ctx.fill(); strokeOL(o * 0.7); }
    cEyes(x, y + s * 0.05, s * 0.22, s * 0.34);
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + s * 0.14, y - s * 0.32); ctx.lineTo(x, y - s * 0.14); ctx.lineTo(x - s * 0.14, y - s * 0.32); ctx.closePath(); ctx.fillStyle = def.acc; ctx.fill(); strokeOL(o * 0.8);
  },
  dark(x, y, s, def, o){
    const dtw = staticPose ? 0 : Math.sin(animT * 3 + x) * s * 0.1;
    for(const d of [-1, 1]){ ctx.beginPath(); ctx.moveTo(x + d * s * 0.3, y - s * 0.55); ctx.lineTo(x + d * s * 0.62, y - s * 1.2); ctx.lineTo(x + d * s * 0.74, y - s * 0.5); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o); }
    ctx.beginPath(); ctx.moveTo(x + s * 0.55, y + s * 0.2); ctx.quadraticCurveTo(x + s * 1.3, y - s * 0.1 + dtw, x + s * 1.05, y - s * 0.7 + dtw); ctx.quadraticCurveTo(x + s * 0.98, y - s * 0.05, x + s * 0.5, y + s * 0.05); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
    cBody(x, y, s * 0.82, s * 0.82, def, o);
    ctx.fillStyle = def.acc; tri(x - s * 0.45, y - s * 0.58, s * 0.1, s * 0.4); tri(x + s * 0.45, y - s * 0.58, s * 0.1, s * 0.4);
    const gl = staticPose ? 0 : Math.abs(Math.sin(animT * 2.5)) * 0.4; if(gl > 0){ ctx.globalAlpha = gl; ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.04, s * 0.17, s * 0.21, 0, 0, 7); ctx.ellipse(x + s * 0.3, y - s * 0.04, s * 0.17, s * 0.21, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = "#ffd34a"; ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.04, s * 0.12, s * 0.16, 0, 0, 7); ctx.ellipse(x + s * 0.3, y - s * 0.04, s * 0.12, s * 0.16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.04, s * 0.045, s * 0.12, 0, 0, 7); ctx.ellipse(x + s * 0.3, y - s * 0.04, s * 0.045, s * 0.12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = def.c2; ctx.beginPath(); ctx.ellipse(x, y + s * 0.26, s * 0.22, s * 0.15, 0, 0, 7); ctx.fill();
  },
  ice(x, y, s, def, o){
    ctx.fillStyle = def.acc; tri(x - s * 0.5, y - s * 0.55, s * 0.16, s * 0.5); tri(x, y - s * 0.85, s * 0.22, s * 0.78); tri(x + s * 0.5, y - s * 0.55, s * 0.16, s * 0.5);
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x + s * 0.8, y - s * 0.1); ctx.lineTo(x + s * 0.5, y + s * 0.8); ctx.lineTo(x - s * 0.5, y + s * 0.8); ctx.lineTo(x - s * 0.8, y - s * 0.1); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
    ctx.save(); ctx.clip(); ctx.globalAlpha = staticPose ? 0.28 : 0.2 + Math.abs(Math.sin(animT * 3 + x)) * 0.3; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x - s * 0.8, y - s * 0.1); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.fillStyle = def.c2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.5, y + s * 0.8); ctx.lineTo(x - s * 0.5, y + s * 0.8); ctx.closePath(); ctx.fill(); ctx.restore();
    cEyes(x, y + s * 0.02, s * 0.18, s * 0.28);
  },
  dragon(x, y, s, def, o){
    const fl = staticPose ? 0 : Math.sin(animT * 6 + x * 0.05) * s * 0.2;   // wing flap
    for(const d of [-1, 1]){ ctx.beginPath(); ctx.moveTo(x + d * s * 0.4, y - s * 0.2); ctx.lineTo(x + d * s * 1.3, y - s * 0.7 - fl); ctx.lineTo(x + d * s * 1.15, y - s * 0.1 - fl * 0.5); ctx.lineTo(x + d * s * 1.35, y + s * 0.2 - fl * 0.3); ctx.lineTo(x + d * s * 0.95, y + s * 0.25); ctx.lineTo(x + d * s * 0.5, y + s * 0.3); ctx.closePath(); ctx.fillStyle = def.acc; ctx.fill(); strokeOL(o); }
    ctx.beginPath(); ctx.moveTo(x + s * 0.4, y + s * 0.4); ctx.quadraticCurveTo(x + s * 1.1, y + s * 0.6, x + s * 1.0, y - s * 0.1); ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.35, x + s * 0.4, y + s * 0.25); ctx.closePath(); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
    cBody(x, y, s * 0.78, s * 0.84, def, o); cBelly(x, y, s * 0.78, s * 0.84, def);
    ctx.fillStyle = def.acc; tri(x - s * 0.35, y - s * 0.62, s * 0.1, s * 0.45); tri(x + s * 0.35, y - s * 0.62, s * 0.1, s * 0.45);
    cEyes(x, y - s * 0.1, s * 0.17, s * 0.28);
    ctx.fillStyle = def.c2; ctx.beginPath(); ctx.ellipse(x, y + s * 0.2, s * 0.2, s * 0.14, 0, 0, 7); ctx.fill();
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(x - s * 0.07, y + s * 0.18, s * 0.03, 0, 7); ctx.arc(x + s * 0.07, y + s * 0.18, s * 0.03, 0, 7); ctx.fill();
  },
  normal(x, y, s, def, o){
    const ew = staticPose ? 0 : Math.sin(animT * 3.5 + x) * 0.12;
    for(const d of [-1, 1]){ ctx.beginPath(); ctx.ellipse(x + d * s * 0.58, y - s * 0.55, s * 0.24, s * 0.4, d * 0.4 + ew, 0, 7); ctx.fillStyle = def.c1; ctx.fill(); strokeOL(o);
      ctx.beginPath(); ctx.ellipse(x + d * s * 0.6, y - s * 0.55, s * 0.12, s * 0.24, d * 0.4 + ew, 0, 7); ctx.fillStyle = def.acc; ctx.fill(); }
    ctx.fillStyle = def.c2; ctx.beginPath(); ctx.ellipse(x - s * 0.4, y + s * 0.78, s * 0.22, s * 0.14, 0, 0, 7); ctx.ellipse(x + s * 0.4, y + s * 0.78, s * 0.22, s * 0.14, 0, 0, 7); ctx.fill();
    cBody(x, y, s * 0.9, s * 0.84, def, o); cBelly(x, y, s * 0.9, s * 0.84, def);
    cEyes(x, y - s * 0.04, s * 0.2, s * 0.3);
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(x, y + s * 0.18, s * 0.06, 0, 7); ctx.fill();
  },
};
/* draws any creature centred at (x,y); s ≈ body radius. Uses the active `ctx`.
   A gentle breathing squash/stretch (driven by the global animT) brings it to life;
   staticPose freezes it for one-off icon snapshots. */
function drawCreature(x, y, s, def){
  if(sheetReady && SHEET.frames[def.name]){ drawSprite(x, y, s, def); return; }
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  if(!staticPose){ const ph = animT * 2.1 + x * 0.05, bx = 1 + 0.04 * Math.sin(ph), by = 1 - 0.035 * Math.sin(ph);
    ctx.translate(x, y + s * 0.85); ctx.scale(bx, by); ctx.translate(-x, -(y + s * 0.85)); }
  (CREATURE_ART[FEAT_KIND[def.feat]] || CREATURE_ART.normal)(x, y, s, def, Math.max(1, s * 0.09));
  ctx.restore();
}

function promptNear(){
  if(state !== "play" || uiPaused) return;
  let near = null, nd = TS * 1.4;
  const all = [...creatures.filter(c => !c.caught && !c.fled), ...chests.filter(c => !c.opened), vault, ...gates];
  for(const o of all){ const d = Math.hypot(o.x - p.x, o.y - p.y); if(d < nd){ nd = d; near = o; } }
  if(!near) return;
  const lift = near === vault ? 50 : near.zone ? 44 : near.def ? 34 : 26;
  const y = near.y - lift + Math.sin(Date.now() / 220) * 2;
  rr(near.x - 12, y - 12, 24, 22, 7, "#0c0a14");
  ctx.fillStyle = "#ffcb3d"; ctx.font = "800 14px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("E", near.x, y); ctx.textBaseline = "alphabetic";
  if(near.def){
    const r = RARITY[near.def.rar];
    ctx.fillStyle = r.color; ctx.font = "800 10px 'Baloo 2',sans-serif"; ctx.fillText(near.def.name + " · " + r.label, near.x, y - 18);
  }
}

function drawPlayer(){
  const x = p.x, bob = p.moving ? Math.abs(Math.sin(p.step)) * 2 : 0, y = p.y - bob;
  ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.beginPath(); ctx.ellipse(x, p.y + 15, 12, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#26407a"; ctx.fillRect(x - 7, y + 6, 5, 9); ctx.fillRect(x + 2, y + 6, 5, 9);
  rr(x - 10, y - 6, 20, 16, 5, "#e23b3b");
  ctx.fillStyle = "#f0e6cf"; ctx.fillRect(x - 3, y - 4, 6, 12);
  ctx.fillStyle = "#f0c79c"; ctx.beginPath(); ctx.arc(x, y - 12, 8, 0, 7); ctx.fill();
  ctx.fillStyle = "#e23b3b"; ctx.beginPath(); ctx.arc(x, y - 15, 8, Math.PI, 2 * Math.PI); ctx.fill();
  ctx.fillRect(x - 8, y - 15, 16, 3);
  const bill = p.face === "left" ? -7 : p.face === "right" ? 7 : 0;
  ctx.fillStyle = "#c22e2e"; ctx.fillRect(x - 2 + bill, y - 15, 8, 3);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y - 16, 3, Math.PI, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#2a2230";
  if(p.face === "down"){ dot(x - 3, y - 11, 1.5); dot(x + 3, y - 11, 1.5); }
  else if(p.face === "left"){ dot(x - 3, y - 11, 1.5); }
  else if(p.face === "right"){ dot(x + 3, y - 11, 1.5); }
}

/* ---------- fog of war ---------- */
function paintFog(cx, cy){
  dctx.clearRect(0, 0, VW, VH);
  dctx.fillStyle = "rgba(5,6,12,0.93)"; dctx.fillRect(0, 0, VW, VH);
  dctx.globalCompositeOperation = "destination-out";
  const px = p.x - cx, py = p.y - cy;
  const R = REVEAL * (0.97 + Math.sin(fogPhase * 2) * 0.025);
  let g = dctx.createRadialGradient(px, py, 18, px, py, R);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.85)"); g.addColorStop(1, "rgba(255,255,255,0)");
  dctx.fillStyle = g; dctx.beginPath(); dctx.arc(px, py, R, 0, 7); dctx.fill();
  for(const t of torches){
    const tx = t.x - cx, ty = t.y - cy; if(tx < -90 || ty < -90 || tx > VW + 90 || ty > VH + 90) continue;
    const r = 58 + Math.sin(t.f) * 6; let tg = dctx.createRadialGradient(tx, ty - 4, 4, tx, ty - 4, r);
    tg.addColorStop(0, "rgba(255,255,255,0.85)"); tg.addColorStop(1, "rgba(255,255,255,0)");
    dctx.fillStyle = tg; dctx.beginPath(); dctx.arc(tx, ty - 4, r, 0, 7); dctx.fill();
  }
  dctx.globalCompositeOperation = "source-over";
  ctx.drawImage(dark, 0, 0);
  const wg = ctx.createRadialGradient(px, py, 12, px, py, R);
  wg.addColorStop(0, "rgba(255,210,120,0.07)"); wg.addColorStop(1, "rgba(255,210,120,0)");
  ctx.fillStyle = wg; ctx.fillRect(0, 0, VW, VH);
}

/* ---------- HUD ---------- */
function drawHUD(){
  // left: coins + balls
  rr(14, 14, 176, 44, 12, "rgba(10,12,22,.8)");
  ctx.fillStyle = "#ffcb3d"; dot(38, 30, 9); ctx.fillStyle = "#1a1206"; ctx.font = "800 11px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", 38, 31);
  ctx.fillStyle = "#f3ecda"; ctx.font = "800 17px 'Baloo 2',sans-serif"; ctx.textAlign = "left"; ctx.fillText(fmt(coins), 54, 31);
  drawBall(38, 47, 8, 0);
  ctx.fillStyle = balls <= 3 ? "#ff7a6a" : "#cfe0d0"; ctx.font = "800 13px 'Baloo 2',sans-serif"; ctx.textAlign = "left"; ctx.fillText("× " + balls + " balls", 54, 48);
  ctx.textBaseline = "alphabetic";
  // top-centre: caught
  const cw = 120; rr(VW / 2 - cw / 2, 14, cw, 30, 10, "rgba(10,12,22,.8)");
  ctx.fillStyle = "#9fb0c0"; ctx.font = "800 12px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("CAUGHT " + caughtCount + " / " + CREATURE_N, VW / 2, 30); ctx.textBaseline = "alphabetic";
}
function drawDex(){
  if(state === "win") return;
  const n = CREATURE_N, sw = 30, gap = 6, totalW = n * sw + (n - 1) * gap, x0 = VW / 2 - totalW / 2, y = VH - 42;
  rr(x0 - 8, y - 6, totalW + 16, 40, 10, "rgba(10,12,22,.74)");
  for(let i = 0; i < n; i++){
    const cx = x0 + i * (sw + gap) + sw / 2, cy = y + 13, def = CREATURES[i];
    const cr = creatures.find(c => c.def === def);
    if(cr && cr.caught){ drawCreature(cx, cy, 8, def); }
    else if(cr && cr.fled){
      ctx.fillStyle = "#2a1620"; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = "#ff6a5a"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4); ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx - 4, cy + 4); ctx.stroke();
    } else { ctx.fillStyle = "#262e40"; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill(); ctx.fillStyle = RARITY[def.rar].color + "99"; ctx.font = "800 11px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", cx, cy + 1); ctx.textBaseline = "alphabetic"; }
  }
}

/* ---------- catch screen ---------- */
function badge(x, y, txt, col){
  ctx.font = "800 12px 'Baloo 2',sans-serif"; const w = ctx.measureText(txt).width + 24;
  rr(x - w / 2, y - 11, w, 22, 11, col);
  ctx.fillStyle = "#1a1206"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt.toUpperCase(), x, y + 1); ctx.textBaseline = "alphabetic";
}
function sparkle(x, y, t){ for(let i = 0; i < 7; i++){ const a = i / 7 * 7 + t * 4, r = 18 + t * 34; ctx.fillStyle = "rgba(255,230,150," + Math.max(0, 1 - t) + ")"; dot(x + Math.cos(a) * r, y + Math.sin(a) * r, 3); } }
function drawCatch(){
  const g = catchG, def = g.cr.def, r = RARITY[def.rar], arx = VW / 2, ary = VH * 0.40;
  ctx.fillStyle = "rgba(6,8,16,0.86)"; ctx.fillRect(0, 0, VW, VH);
  let ag = ctx.createRadialGradient(arx, ary, 10, arx, ary, 170);
  ag.addColorStop(0, "rgba(255,203,61,0.12)"); ag.addColorStop(1, "rgba(255,203,61,0)");
  ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(arx, ary, 170, 0, 7); ctx.fill();

  ctx.fillStyle = "#f3ecda"; ctx.font = "800 clamp(18px,5vw,24px) 'Baloo 2',sans-serif"; ctx.textAlign = "center";
  ctx.fillText("A wild " + def.name + " appeared!", VW / 2, VH * 0.12);
  badge(VW / 2, VH * 0.12 + 26, def.type + " · " + r.label, r.color);
  ctx.fillStyle = "#ffcb3d"; ctx.font = "700 13px 'Nunito',sans-serif"; ctx.fillText("Worth +" + fmt(r.val) + " $RIPPED   ·   Balls left: " + balls, VW / 2, VH * 0.12 + 50);

  if(g.phase === "aim") drawCreature(arx, ary, 64, def);
  else if(g.phase === "throw"){
    drawCreature(arx, ary, 64, def);
    const bx = VW / 2 + (arx - VW / 2) * g.ball;
    const by = VH * 0.86 + (ary + 18 - VH * 0.86) * g.ball - Math.sin(g.ball * Math.PI) * 130;
    drawBall(bx, by, 16, g.ball * 9);
  } else if(g.phase === "wobble"){
    const w = Math.sin(g.t / 0.45 * Math.PI) * (g.success ? 0.4 : 0.55);
    drawBall(arx, ary + 18, 18, w);
  } else if(g.phase === "result"){
    if(g.success){
      drawBall(arx, ary + 18, 18, 0); sparkle(arx, ary + 18, g.t);
      ctx.fillStyle = "#7fe08a"; ctx.font = "800 26px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.fillText("Gotcha!", VW / 2, VH * 0.63);
      ctx.fillStyle = "#cfeacf"; ctx.font = "700 15px 'Nunito',sans-serif"; ctx.fillText("+" + fmt(r.val) + " $RIPPED · added to inventory", VW / 2, VH * 0.67);
    } else {
      ctx.globalAlpha = 0.45; drawCreature(arx, ary, 64, def); ctx.globalAlpha = 1;
      ctx.fillStyle = "#ff7a6a"; ctx.font = "800 24px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.fillText(def.name + " escaped for good!", VW / 2, VH * 0.63);
      if(g.pen > 0){ ctx.fillStyle = "#ffb0a0"; ctx.font = "700 15px 'Nunito',sans-serif"; ctx.fillText("Penalty −" + fmt(g.pen) + " $RIPPED", VW / 2, VH * 0.67); }
    }
  }

  if(g.phase === "aim"){
    const bw = Math.min(440, VW * 0.74), bx = VW / 2 - bw / 2, by = VH - 96, bh = 20;
    ctx.fillStyle = "#f3ecda"; ctx.font = "700 13px 'Nunito',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Tap / SPACE / E to throw — dead-centre is a guaranteed catch", VW / 2, by - 16);
    rr(bx - 4, by - 4, bw + 8, bh + 8, 8, "rgba(0,0,0,.5)");
    rr(bx, by, bw, bh, 6, "#241f33");
    const zw = g.zone * 2 * bw;
    rr(bx + bw / 2 - zw / 2, by, zw, bh, 4, "#3fae54");
    rr(bx + bw / 2 - zw * 0.18, by, zw * 0.36, bh, 4, "#9af0a0");
    const mx = bx + g.m * bw;
    ctx.fillStyle = "#ffcb3d"; ctx.fillRect(mx - 2, by - 6, 4, bh + 12);
  }
}

/* ---------- toast ---------- */
function drawToast(){
  if(msgT <= 0) return;
  ctx.font = "800 15px 'Baloo 2',sans-serif"; const w = ctx.measureText(msg).width + 40;
  ctx.globalAlpha = Math.min(1, msgT / 40);
  rr(VW / 2 - w / 2, VH - 152, w, 40, 12, "rgba(10,12,22,.93)");
  ctx.fillStyle = "#ffcb3d"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(msg, VW / 2, VH - 132); ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

/* ---------- inventory (DOM) ---------- */
function creatureIconURL(def, px){
  const c = document.createElement("canvas"); c.width = c.height = px;
  const tctx = c.getContext("2d");
  const prev = ctx; ctx = tctx; staticPose = true;   // redirect context, freeze animation for a clean icon
  drawCreature(px / 2, px / 2 + px * 0.03, px * 0.34, def);
  ctx = prev; staticPose = false;
  return c.toDataURL();
}
function renderInventory(){
  document.getElementById("invBalls").textContent = "Poké Balls: " + balls;
  document.getElementById("invTokens").textContent = fmt(coins) + " $RIPPED";
  const grid = document.getElementById("invGrid");
  const list = creatures.filter(c => c.caught).sort((a, b) => a.caughtAt - b.caughtAt);
  grid.innerHTML = "";
  document.getElementById("invEmpty").style.display = list.length ? "none" : "block";
  for(const c of list){
    const r = RARITY[c.def.rar];
    const el = document.createElement("div"); el.className = "invcard";
    const img = document.createElement("img"); img.className = "invicon"; img.src = creatureIconURL(c.def, 96);
    const info = document.createElement("div"); info.className = "invinfo";
    info.innerHTML = "<b>" + c.def.name + "</b><span class='invtype'>" + c.def.type + "</span>" +
      "<span class='invrar' style='color:" + r.color + "'>" + r.label + "</span>" +
      "<span class='invval'>+" + fmt(r.val) + " $RIPPED</span>";
    el.appendChild(img); el.appendChild(info); grid.appendChild(el);
  }
}

/* ---------- panels ---------- */
function openInventory(){ if(state !== "play") return; renderInventory(); document.getElementById("inventory").classList.add("show"); uiPaused = true; clearKeys(); if(window.Sound) Sound.sfx.click(); }
function closeInventory(){ document.getElementById("inventory").classList.remove("show"); if(!document.getElementById("settings").classList.contains("show")) uiPaused = false; if(window.Sound) Sound.sfx.click(); }
function toggleInventory(){ document.getElementById("inventory").classList.contains("show") ? closeInventory() : openInventory(); }
function openSettings(){ if(state !== "play") return; syncSettingsUI(); document.getElementById("settings").classList.add("show"); uiPaused = true; clearKeys(); if(window.Sound) Sound.sfx.click(); }
function closeSettings(){ document.getElementById("settings").classList.remove("show"); if(!document.getElementById("inventory").classList.contains("show")) uiPaused = false; if(window.Sound) Sound.sfx.click(); }
function toggleSettings(){ document.getElementById("settings").classList.contains("show") ? closeSettings() : openSettings(); }
function closeAllPanels(){ document.getElementById("inventory").classList.remove("show"); document.getElementById("settings").classList.remove("show"); uiPaused = false; }

function syncSettingsUI(){
  if(!window.Sound) return;
  const s = Sound.get();
  document.getElementById("musicTog").checked = s.music;
  document.getElementById("sfxTog").checked = s.sfx;
  document.getElementById("musicVol").value = Math.round(s.musicVol * 100);
  document.getElementById("sfxVol").value = Math.round(s.sfxVol * 100);
}

/* ---------- win + whitelist ---------- */
const joinBtn = document.getElementById("joinBtn");
const walletEl = document.getElementById("wallet");
const okEl = document.getElementById("okmsg");
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function win(){
  if(state === "win") return;
  state = "win";
  if(window.Sound) Sound.sfx.win();
  closeAllPanels();
  document.getElementById("topbtns").classList.remove("show");
  document.getElementById("wlTotal").textContent = fmt(coins);
  document.getElementById("wlBreak").textContent =
    "Monsters " + fmt(tokMon) + "  ·  Chests " + fmt(tokChest) +
    (penaltyTotal ? "  ·  Penalties −" + fmt(penaltyTotal) : "") +
    "  ·  Caught " + caughtCount + "/" + CREATURE_N + (fledCount ? "  ·  Lost " + fledCount : "") + "  ·  max 150,000";
  const prev = localStorage.getItem("pokedungeon_wl");
  if(prev) lockWhitelist(prev);
  document.getElementById("win").classList.add("show");
}
function lockWhitelist(addr){
  walletEl.value = addr; walletEl.disabled = true;
  joinBtn.disabled = true; joinBtn.textContent = "ALREADY JOINED";
  okEl.style.color = "#7fe08a"; okEl.textContent = "✓ You've already joined the whitelist on this device.";
}
joinBtn.onclick = async () => {
  const prev = localStorage.getItem("pokedungeon_wl");
  if(prev){ lockWhitelist(prev); return; }
  const w = walletEl.value.trim();
  if(!SOLANA_RE.test(w)){ okEl.style.color = "#ff8a6a"; okEl.textContent = "That doesn't look like a valid Solana wallet."; return; }
  joinBtn.disabled = true; joinBtn.textContent = "JOINING…";
  try {
    const res = await fetch("/api/whitelist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: w }) });
    const data = await res.json();
    if(data.ok){ localStorage.setItem("pokedungeon_wl", w); okEl.style.color = "#7fe08a"; okEl.textContent = "✓ " + data.message; joinBtn.textContent = "JOINED"; walletEl.disabled = true; }
    else if(data.error === "already_joined"){ localStorage.setItem("pokedungeon_wl", w); lockWhitelist(w); }
    else { okEl.style.color = "#ff8a6a"; okEl.textContent = data.message || "Something went wrong."; joinBtn.disabled = false; joinBtn.textContent = "JOIN WHITELIST"; }
  } catch(err){ okEl.style.color = "#ff8a6a"; okEl.textContent = "Server unreachable — is the backend running?"; joinBtn.disabled = false; joinBtn.textContent = "JOIN WHITELIST"; }
};

/* ---------- wire up DOM controls ---------- */
document.getElementById("bagBtn").onclick = toggleInventory;
document.getElementById("gearBtn").onclick = toggleSettings;
document.getElementById("invClose").onclick = closeInventory;
document.getElementById("settingsClose").onclick = closeSettings;
document.getElementById("musicTog").onchange = e => { if(window.Sound) Sound.setMusic(e.target.checked); };
document.getElementById("sfxTog").onchange = e => { if(window.Sound){ Sound.setSfx(e.target.checked); Sound.sfx.click(); } };
document.getElementById("musicVol").oninput = e => { if(window.Sound) Sound.setMusicVol(e.target.value / 100); };
document.getElementById("sfxVol").oninput = e => { if(window.Sound) Sound.setSfxVol(e.target.value / 100); };
document.getElementById("sfxVol").onchange = () => { if(window.Sound) Sound.sfx.click(); };

/* ---------- main loop ---------- */
let last = performance.now();
function loop(now){ const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
