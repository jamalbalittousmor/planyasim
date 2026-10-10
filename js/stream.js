/* ====== СТРИМ: карточная механика в реальном времени ====== */
window.Stream = (function(){
  const ST = {};
  let S, cfg, st, raf, onDone, keyH;
  const ACT_LEN = 36;
  const TAG_COL = {'УГАР':'#ff7a1a', 'УЮТ':'#19d3b5', 'ГРЕМЛИН':'#7dff8a', 'СКИЛЛ':'#8fa3ff', 'ВОКАЛ':'#d2b8ff'};

  ST.start = function(state, config){
    S = state; cfg = config;
    return new Promise(res => { onDone = res; setup(); });
  };

  function setup(){
    const F = D.FORMATS.find(f => f.id === cfg.format);
    const lagged = S.buff.lag && !S.up.inet;
    let base = Math.max(40, S.subs * .011) * F.pop * (S.up.light ? 1.1 : 1) * (S.buff.announce ? 1.25 : 1) * (S.buff.poll ? 1.1 : 1) * (cfg.late ? 1.1 : 1);
    if (S.banDays > 0 && cfg.format !== 'bilibili') base *= .65;
    if (cfg.format === 'bilibili') base = Math.max(base, 3000 + S.subs * .006);
    st = {
      F, t:0, dur:ACT_LEN * 3, act:1, hype:cfg.late ? 12 : 26, base, viewers:base * .5, peak:0,
      energy:4 + (S.buff.poll ? 1 : 0), maxE:10, regen:(S.energy < 30 ? 2.3 : 1.65) * (lagged ? 1.15 : 1),
      g:S.esterDay ? 35 : 0, gHigh:0, gLow:0, warnCd:0, warnings:0,
      demand:null, demandT:0, demandMax:12, demands:0, hits:0,
      hand:[], deck:[], discard:[], combo:0, comboMax:0, lastTags:[], lastId:null, nextBonus:0, nextN:0,
      moments:[], money:0, hypeSum:0, samples:0, paused:false, over:false,
      events:[], chatAcc:0, donAcc:rnd(10, 18), plays:0, persona:null, personaT:0, lag:lagged, titleTag:cfg.titleTag,
      gremlinTime:0, seisoTime:0, esterReleased:false, used:{}
    };
    // deck
    const fmtCards = D.CARDS.filter(c => c.deck === cfg.format);
    const any = shuffle(D.CARDS.filter(c => c.deck === 'any' && (c.id !== 'mayo' || S.mayo > 0))).slice(0, 12);
    let deck = any.concat(fmtCards, fmtCards);
    if (cfg.format === 'collab' && cfg.friend) deck = deck.concat(D.CARDS.filter(c => c.deck === 'collab'));
    if (cfg.format === 'karaoke' || S.stats.vocal >= 4) deck.push(D.CARDS.find(c => c.id === 'k_god'));
    st.deck = shuffle(deck);
    // events schedule
    const pool = ['donation', 'donation', 'bots', 'raid', 'troll', 'donwar'];
    if (lagged || S.buff.obs) pool.push('obs', 'obs'); else pool.push('obs');
    if (S.ester > 45 && !S.esterDay) pool.push('ester', 'ester');
    else if (S.day > 4) pool.push('ester');
    const evs = [];
    evs.push({at:rnd(14, 28), type:pick(pool)});
    evs.push({at:rnd(44, 62), type:pick(pool)});
    if (Math.random() < .6) evs.push({at:rnd(64, 70), type:pick(pool)});
    evs.push({at:rnd(78, 96), type:pick(pool)});
    if (S.buff.obs) evs[0].type = 'obs';
    if (!S.flags.roach && S.subs > 150000 && Math.random() < .6) evs[evs.length - 1].type = 'roach';
    st.events = evs.sort((a, b) => a.at - b.at);
    if (cfg.format === 'collab' && cfg.friend) st.events.push({at:30, type:'raid', friend:cfg.friend});

    // UI
    UI.show('stream');
    $('#sSceneBg').style.backgroundImage = `url(assets/img/${F.bg}.jpg)`;
    gsap.fromTo('#sSceneBg', {scale:1.02, x:0}, {scale:1.12, x:-30, duration:st.dur, ease:'none'});
    $('#sSceneTitle').innerHTML = `<small>${S.banDays > 0 && cfg.format !== 'bilibili' ? 'YOUTUBE (бан на Twitch)' : cfg.format === 'bilibili' ? 'BILIBILI 直播' : 'TWITCH.TV/PLANYACH'} · ${F.name.toUpperCase()}</small>${esc(cfg.title)}`;
    $('#sChatPlatform').textContent = cfg.format === 'bilibili' ? 'bilibili' : S.banDays > 0 ? 'youtube' : 'twitch';
    $('#sChat').innerHTML = '';
    $('#sAlerts').innerHTML = ''; $('#sOverlay').innerHTML = '';
    sceneFx();
    $('#sDeck').innerHTML = `<b>${F.name}</b>${F.tags.map(t => `<span class="tag tag-${t}">${t}</span>`).join(' ')}<br>Колода: <span id="sDeckN">${st.deck.length}</span><br><span style="opacity:.6">1–5 / клик / тяни вверх</span>`;
    $('#sPips').innerHTML = Array.from({length:10}, () => '<div class="pip"><i></i></div>').join('');
    $('#sHand').innerHTML = '';
    if (Rig.ready) { Rig.mount($('#streamRig'), {fill:1}); Rig.setPersona(S.esterDay ? 'ester' : null); Rig.setExpr(S.energy < 30 ? 'sleepy' : 'idle'); }
    A.music(S.esterDay ? 'ester' : 'stream'); A.setIntensity(0);
    const hs = 4 + (S.up.deck ? 1 : 0);
    for (let i = 0; i < hs; i++) draw(true);
    renderHand();
    newDemand(cfg.titleTag);
    sys(`Стрим начался${cfg.late ? ' (с опозданием на 20 минут 🫠)' : ''}. Зрители подтягиваются…`);
    if (st.lag) sys('⚠ инет шакалит: Силы восстанавливаются медленнее');
    keyH = e => {
      if (st.paused || st.over) return;
      const n = parseInt(e.key, 10); if (n >= 1 && n <= st.hand.length) play(n - 1);
    };
    document.addEventListener('keydown', keyH);
    // intro
    st.paused = true;
    banner('В ЭФИРЕ', cfg.late ? 'задержалась на 20 минут' : 'АКТ 1 · РАЗОГРЕВ', () => {
      st.paused = false;
      const hi = cfg.late ? 'Всем привет! Да, я опоздала. Задержалась на 20 минут. Ну было и было.' : S.esterDay ? 'Сестрёнка отдыхает. Сегодня стрим веду я. Не шалить.' : pick(['Всем привет, МИПы! Начинаем!', 'Привет-привет! Сегодня будет лучший стрим. Как всегда.', 'Стрим на час! (нет)']);
      say(hi, S.esterDay ? 'ester' : 'laugh');
    });
    let last = performance.now();
    cancelAnimationFrame(raf);
    (function loop(now){
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!st.over) { if (!st.paused) update(dt); render(); raf = requestAnimationFrame(loop); }
    })(last);
  }

  function sceneFx(){
    const fx = $('#sSceneFx'); fx.innerHTML = '';
    const F = st.F;
    if (F.id === 'videos') fx.innerHTML = `<div style="position:absolute;left:60px;top:70px;width:560px;height:330px;background:#000;border:3px solid #f6f1e7;box-shadow:8px 8px 0 #121018;display:grid;place-items:center;color:#fff;font-size:80px">${ic('play')}<div style="position:absolute;left:12px;right:12px;bottom:12px;height:6px;background:#444"><i id="vidProg" style="position:absolute;left:0;top:0;bottom:0;width:10%;background:#ff0033"></i></div><div style="position:absolute;left:12px;top:10px;font:700 15px var(--f-ui)">${esc(pick(['ТОП 10 СТРАННЫХ ВИТУБЕРОВ','Как приготовить гречку (ужас)','Готика: спидран за 4 часа','Колобок: полная история','Реакция на реакцию на Планю']))}</div></div>`;
    if (F.id === 'karaoke') fx.innerHTML = `<div style="position:absolute;left:40px;top:60px;font-family:var(--f-head);font-size:64px;color:#ff2fa0;text-shadow:0 0 18px #ff2fa0,4px 4px 0 #121018;transform:rotate(-4deg)">КАРАОКЕ<br><span style="color:#19d3b5;text-shadow:0 0 18px #19d3b5,4px 4px 0 #121018">НОЧЬ</span></div>`;
    if (F.id === 'legion') fx.innerHTML = `<div style="position:absolute;left:40px;top:70px;background:#121018;color:#ffd400;border:3px solid #ffd400;padding:10px 18px;font-family:var(--f-head);font-size:34px;box-shadow:6px 6px 0 #ffd400">ЛЕГИОН ШОУ<br><small style="font-family:var(--f-mono);font-size:14px;color:#f6f1e7">гость: ${esc(pick(['Орк Подкастер','Бэбэй','Сайконо','Таинственный МИП','Солек (опять)']))}</small></div>`;
    if (F.id === 'collab' && cfg.friend) { const fr = D.FRIENDS.find(f => f.id === cfg.friend); fx.innerHTML = `<div style="position:absolute;left:40px;bottom:40px;width:260px;height:200px;background:${fr.color};border:3px solid #f6f1e7;box-shadow:6px 6px 0 #121018;display:grid;place-items:center;color:#121018;font-size:110px">${ic(fr.icon)}<div style="position:absolute;left:0;right:0;bottom:0;background:#121018;color:#fff;font:800 16px var(--f-ui);padding:4px 10px">${esc(fr.name)}</div></div>`; }
    if (F.id === 'bilibili') fx.innerHTML = `<div id="danmaku" style="position:absolute;inset:0;overflow:hidden"></div>`;
  }

  function banner(big, small, cb){
    const b = UI.el(`<div class="banner"><span>${big}</span><small>${small || ''}</small></div>`);
    $('#sOverlay').appendChild(b);
    A.sfx('level', {vol:.6});
    gsap.timeline({onComplete:() => { b.remove(); cb && cb(); }})
      .fromTo(b, {scaleY:0}, {scaleY:1, duration:.25, ease:'back.out(2)'})
      .fromTo($('span', b), {x:-900}, {x:0, duration:.4, ease:'power3.out'}, '<')
      .to(b, {scaleY:0, duration:.2, delay:1.1, ease:'power2.in'});
  }

  /* ---------- deck ---------- */
  function draw(silent){
    if (!st.deck.length) { st.deck = shuffle(st.discard); st.discard = []; }
    const c = st.deck.pop(); if (c) st.hand.push(c);
    const n = $('#sDeckN'); if (n) n.textContent = st.deck.length;
  }
  function cardHTML(c, i){
    const tag = c.tags[0];
    return `<div class="card" data-i="${i}"><div class="cc">${c.cost}</div>${c.persona ? `<div class="ck">${c.persona === 'ester' ? 'ЭСТЕР' : 'МИХАЛЫЧ'}</div>` : ''}
      <div class="art art-${tag}" style="${c.tags[1] ? `background:linear-gradient(135deg,${TAG_COL[c.tags[0]]} 50%,${TAG_COL[c.tags[1]]} 50%)` : ''}">${ic(c.icon)}</div>
      <div class="cn">${esc(c.name)}</div><div class="cd">${esc(c.desc)}</div>
      <div class="ct">${c.tags.map(t => `<span class="tag tag-${t}">${t}</span>`).join('')}<span class="tag" style="background:#fff">+${c.hype || '?'}</span></div><div class="key">${i + 1}</div></div>`;
  }
  function renderHand(){
    const h = $('#sHand'); h.innerHTML = '';
    const n = st.hand.length;
    st.hand.forEach((c, i) => {
      const el = UI.el(cardHTML(c, i));
      h.appendChild(el);
      const rot = (i - (n - 1) / 2) * 4, y = Math.abs(i - (n - 1) / 2) * 6;
      gsap.set(el, {rotation:rot, y});
      el._rest = {rotation:rot, y};
      el.addEventListener('mouseenter', () => { if (!el._busy) gsap.to(el, {y:-24, rotation:0, scale:1.06, duration:.18}); });
      el.addEventListener('mouseleave', () => { if (!el._busy) gsap.to(el, {y:el._rest.y, rotation:el._rest.rotation, scale:1, duration:.2}); });
      Draggable.create(el, {type:'x,y', zIndexBoost:true,
        onPress(){ el._busy = false; },
        onDragStart(){ el._busy = true; },
        onDrag(){ el.style.boxShadow = this.y < -90 ? '0 0 0 5px #ffd400, 6px 6px 0 #121018' : ''; },
        onRelease(){
          if (this.y < -90) { const idx = st.hand.indexOf(c); if (!play(idx, el)) gsap.to(el, {x:0, y:el._rest.y, duration:.3, ease:'back.out(2)'}); }
          else gsap.to(el, {x:0, y:el._rest.y, rotation:el._rest.rotation, scale:1, duration:.3, ease:'back.out(2)', onComplete:() => el._busy = false});
          el.style.boxShadow = '';
        },
        onClick(){ play(st.hand.indexOf(c), el); }
      });
    });
    gsap.from($$('.card', h), {y:220, stagger:.04, duration:.35, ease:'back.out(1.6)'});
  }

  function newDemand(force){
    const prev = st.demand;
    let tags = D.TAGS.filter(t => t !== prev);
    let tag = force && force !== prev ? force : pick(tags.concat(st.F.tags));
    st.demand = tag; st.demands++;
    st.demandMax = st.act === 3 ? 9 : st.act === 2 ? 10.5 : 12; st.demandT = st.demandMax;
    const el = $('#sDemandTag'); el.textContent = tag; el.style.color = '#121018';
    $('#sDemand').style.background = TAG_COL[tag];
    gsap.fromTo('#sDemand', {rotation:-14, scale:.6}, {rotation:-3, scale:1, duration:.4, ease:'back.out(2.5)'});
    markMatches();
  }
  function markMatches(){ $$('#sHand .card').forEach((el, i) => { const c = st.hand[i]; el.classList.toggle('match', !!c && c.tags.includes(st.demand)); }); }

  /* ---------- play ---------- */
  function play(i, el){
    if (st.paused || st.over || i < 0 || i >= st.hand.length) return false;
    const c = st.hand[i];
    el = el || $$('#sHand .card')[i];
    if (st.energy < c.cost) {
      A.sfx('error', {vol:.5}); if (el) gsap.fromTo(el, {x:-8}, {x:0, duration:.4, ease:'elastic.out(1,.2)'});
      floatAt(el, 'НЕТ СИЛ', '#ff2fa0'); return false;
    }
    st.energy -= c.cost;
    st.plays++;
    let gain = c.hype, notes = [];
    const fx = c.fx || {};
    if (fx.scale) gain += (S.stats[fx.scale] || 1) * 3;
    if (fx.gamble) { const win = Math.random() < fx.gamble.p + (S.stats.skill - 1) * .02; gain = win ? fx.gamble.win : fx.gamble.lose; notes.push(win ? 'ПОВЕЗЛО!' : 'НЕ ПОВЕЗЛО'); }
    if (fx.mayo) { if (S.mayo >= fx.mayo) S.mayo -= fx.mayo; else { gain *= .4; notes.push('майонез кончился'); } }
    const matched = c.tags.includes(st.demand);
    let mult = 1;
    if (matched) mult *= 2 * (st.titleTag && st.demand === st.titleTag ? 1.2 : 1);
    if (c.tags.some(t => st.F.tags.includes(t))) mult *= 1.15;
    const chain = c.tags.some(t => st.lastTags.includes(t));
    st.combo = chain ? st.combo + 1 : 1; st.comboMax = Math.max(st.comboMax, st.combo);
    if (st.combo >= 2) mult *= Math.min(1.8, 1 + (st.combo - 1) * .15);
    if (st.lastId === c.id) { mult *= .45; notes.push('ПОВТОР'); }
    if (st.g > 60 && c.tags.some(t => t === 'УГАР' || t === 'ГРЕМЛИН')) mult *= 1.25;
    if (st.g < -60 && c.tags.some(t => t === 'УЮТ' || t === 'ВОКАЛ')) mult *= 1.25;
    if (fx.finale && st.act === 3) mult *= 2;
    if (S.energy < 30) mult *= .85;
    if (st.nextN > 0) { gain += st.nextBonus; st.nextN--; if (!st.nextN) st.nextBonus = 0; }
    if (S.esterDay && c.tags.includes('ГРЕМЛИН')) mult *= 1.2;
    st.lastTags = c.tags; st.lastId = c.id;
    // remove card from hand
    st.hand.splice(i, 1); if (c.deck !== 'special') st.discard.push(c);
    if (el) { el._busy = true; gsap.to(el, {y:-380, x:'+=' + rnd(-60, 60), rotation:rnd(-20, 20), scale:.6, opacity:0, duration:.4, ease:'power2.in'}); }
    // effects
    if (fx.energy) st.energy = Math.min(st.maxE, st.energy + fx.energy);
    if (fx.calm) st.g *= (1 - fx.calm / 100);
    if (fx.viewers) st.base *= 1 + fx.viewers;
    if (fx.next) { st.nextBonus = fx.next; st.nextN = fx.nextN || 1; }
    if (fx.don) st.donAcc = Math.min(st.donAcc, 2.5);
    if (fx.fix && st.lag) { st.lag = false; st.regen = 1.65; sys('инет починен. Наверное.'); }
    if (c.meme) G.unlockMeme(c.meme);
    st.g = clamp(st.g + (c.g || 0) * (S.esterDay ? 1.3 : 1), -100, 100);
    // say + rig
    const persona = c.persona;
    if (persona) { st.persona = persona; st.personaT = 7; Rig.setPersona(persona); if (persona === 'mikhalych') G.ach('mikhalych'); }
    say(c.line, persona ? null : c.expr);
    Rig.react(matched ? 'hop' : gain > 18 ? 'shock' : 'nod');
    // karaoke: mini rhythm
    const finish = (g) => {
      g = Math.round(g * mult);
      st.hype = clamp(st.hype + g, 0, 100);
      if (matched) { st.hits++; A.sfx('power', {vol:.55}); $('#sDemand').classList.remove('hit'); void $('#sDemand').offsetWidth; $('#sDemand').classList.add('hit'); floatStage('ХОТЕЛИ!', 520, 210, '#ffd400', 46); }
      else A.sfx(g > 16 ? 'confirm' : 'select', {vol:.5});
      st.moments.push({name:c.name, line:c.line, gain:g, tags:c.tags, t:st.t});
      floatAt(el, '+' + g + ' ХАЙП' + (notes.length ? ' · ' + notes.join(' · ') : ''), matched ? '#ffd400' : '#fff');
      if (st.combo >= 3) showCombo();
      chatBurst(c.tags, g);
      if (fx.draw) for (let k = 0; k < fx.draw; k++) draw();
      const hs = 4 + (S.up.deck ? 1 : 0);
      while (st.hand.length < hs) draw();
      setTimeout(() => { if (!st.over) renderHand(); markMatches(); }, 260);
      if (matched) newDemand();
    };
    if (fx.karaoke) {
      st.paused = true;
      A.duck(true);
      setTimeout(() => {
        Rhythm.mini(fx.karaoke, $('#sOverlay'), {lenient:S.up.mic ? 1.25 : 1}).then(acc => {
          st.paused = false; A.music(S.esterDay ? 'ester' : 'stream'); A.duck(false);
          const g = gain * (.4 + acc * 1.8);
          floatStage(acc > .85 ? 'ВОКАЛ!!!' : acc > .5 ? 'НЕПЛОХО' : 'ФАЛЬШИВО', 520, 260, acc > .85 ? '#d2b8ff' : '#fff', 50);
          finish(g);
        });
      }, 400);
    } else finish(gain);
    return true;
  }

  function say(text, expr){
    const dur = Rig.ready ? Rig.say(text, {expr:expr || undefined}) : text.length * .05;
    UI.bubble($('#sBubble'), text, {dur:dur, hold:1400, ester:st.persona === 'ester' || (S.esterDay && !st.persona)});
  }
  function floatAt(el, text, col){
    if (!el) return floatStage(text, 700, 600, col);
    const p = UI.stagePos(el); UI.floater(text, p.x - 60, p.y - 120, col, 24);
  }
  function floatStage(text, x, y, col, size){ UI.floater(text, x, y, col, size); }
  function showCombo(){
    const c = $('#sCombo'); c.textContent = 'КОМБО ×' + st.combo;
    gsap.killTweensOf(c); gsap.fromTo(c, {opacity:1, scale:1.6, rotation:-8}, {scale:1, rotation:-3, duration:.35, ease:'back.out(3)'});
    gsap.to(c, {opacity:0, delay:1.6, duration:.4});
  }

  /* ---------- chat ---------- */
  function chatLine(text, o){
    o = o || {};
    const log = $('#sChat');
    const nick = o.nick || pick(D.NICKS);
    const col = o.color || D.NICK_COLORS[(nick.length * 7 + nick.charCodeAt(0)) % D.NICK_COLORS.length];
    const badge = o.badge || (Math.random() < .2 ? `<svg class="badge" style="color:#f15f2c"><use href="#i-crown"/></svg>` : Math.random() < .2 ? `<svg class="badge" style="color:#19d3b5"><use href="#i-star-four"/></svg>` : '');
    const body = esc(text).split(' ').map(w => D.EMOTES[w] ? UI.emote(w) : w).join(' ');
    const el = UI.el(`<div class="cm ${o.cls || ''}">${badge}<span class="n" style="color:${col}">${esc(nick)}</span>: ${body}</div>`);
    log.appendChild(el);
    while (log.children.length > 34) log.firstElementChild.remove();
    if (st.F.id === 'bilibili' && !o.cls && Math.random() < .7) danmaku(text);
    return el;
  }
  function sys(t){ const el = UI.el(`<div class="cm sys">» ${esc(t)}</div>`); $('#sChat').appendChild(el); }
  function danmaku(text){
    const d = $('#danmaku'); if (!d) return;
    const el = UI.el(`<div style="position:absolute;left:100%;top:${rnd(20, 380)}px;white-space:nowrap;font:800 26px var(--f-ui);color:#fff;-webkit-text-stroke:1px #121018;text-shadow:2px 2px 0 #121018">${esc(text)}</div>`);
    d.appendChild(el);
    gsap.to(el, {x:-1500, duration:rnd(5, 8), ease:'none', onComplete:() => el.remove()});
  }
  function chatBurst(tags, gain){
    const n = clamp(Math.round(gain / 5), 1, 7);
    for (let k = 0; k < n; k++) setTimeout(() => {
      if (st.over) return;
      const pool = st.persona === 'ester' ? D.CHAT.ester : st.F.id === 'bilibili' && Math.random() < .5 ? D.CHAT.bilibili : st.hype > 85 && Math.random() < .3 ? D.CHAT.hype : D.CHAT[pick(tags)];
      chatLine(pick(pool));
    }, k * rnd(80, 260));
  }

  /* ---------- update loop ---------- */
  function update(dt){
    st.t += dt;
    // energy
    st.energy = Math.min(st.maxE, st.energy + dt / st.regen);
    // hype decay
    const decay = 1.3 + st.hype * .058 + (st.g < -60 ? 1.2 : 0) + (st.act === 3 ? .6 : 0);
    st.hype = Math.max(0, st.hype - decay * dt);
    st.hypeSum += st.hype * dt; st.samples += dt;
    // gremlin drift
    st.g += -st.g * .03 * dt;
    if (st.g > 85) { st.gHigh += dt; } else st.gHigh = Math.max(0, st.gHigh - dt);
    if (st.g > 50) st.gremlinTime += dt;
    if (st.g < -30) st.seisoTime += dt;
    st.warnCd -= dt;
    if (st.gHigh > 3.5 && st.warnCd <= 0 && st.F.id !== 'bilibili') { st.warnCd = 25; st.gHigh = 0; runEvent({type:'warning'}); return; }
    // demand
    st.demandT -= dt;
    if (st.demandT <= 0) { st.hype = Math.max(0, st.hype - 6); chatLine(pick(D.CHAT.bored)); sys('чат не дождался ' + st.demand); A.sfx('down', {vol:.4}); newDemand(); }
    // viewers
    const target = st.base * (.45 + st.hype / 70) * (st.act === 2 ? 1.1 : st.act === 3 ? 1.2 : 1);
    st.viewers += (target - st.viewers) * dt * .45;
    st.peak = Math.max(st.peak, st.viewers);
    // persona timer
    if (st.personaT > 0) { st.personaT -= dt; if (st.personaT <= 0) { st.persona = null; Rig.setPersona(S.esterDay ? 'ester' : null); } }
    // chat idle
    st.chatAcc += dt * clamp(st.viewers / 250, .7, 5);
    while (st.chatAcc > 1) {
      st.chatAcc -= 1;
      const pool = st.hype < 18 ? (Math.random() < .6 ? D.CHAT.bored : D.CHAT.idle) : st.F.id === 'bilibili' && Math.random() < .5 ? D.CHAT.bilibili : st.persona === 'ester' || (S.esterDay && Math.random() < .3) ? D.CHAT.ester : D.CHAT.idle;
      chatLine(pick(pool));
    }
    // small donations
    st.donAcc -= dt * (1 + st.hype / 100);
    if (st.donAcc <= 0) { st.donAcc = rnd(13, 22); smallDonation(); }
    // acts
    const act = Math.min(3, 1 + Math.floor(st.t / ACT_LEN));
    if (act !== st.act) {
      st.act = act; st.paused = true;
      banner('АКТ ' + act, act === 2 ? 'РАЗГОН · требования чаще' : 'ФИНАЛ · «Сладких снов» ×2', () => st.paused = false);
      if (act === 3) { st.hand.push(D.CARDS.find(c => c.id === 'goodnight')); renderHand(); }
    }
    // music intensity
    const L = st.hype < 22 ? 0 : st.hype < 48 ? 1 : st.hype < 74 ? 2 : 3;
    if (L !== A.intensity) A.setIntensity(L);
    // events
    if (st.events.length && st.t >= st.events[0].at) { const ev = st.events.shift(); runEvent(ev); return; }
    if (st.t >= st.dur) finale();
  }

  function render(){
    const t = Math.floor(st.t + 3600 * .02);
    const mm = Math.floor(st.t / 60 * 20) , ss = Math.floor((st.t * 20) % 60);
    $('#sTime').textContent = `${String(Math.floor(mm / 60)).padStart(1, '0')}:${String(mm % 60).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    $('#sViewers').textContent = fmt(st.viewers);
    $('#sHype').style.width = st.hype + '%'; $('#sHypeN').textContent = Math.round(st.hype);
    $('#sAct').textContent = 'АКТ ' + st.act + ' / 3';
    $('#sGremlin').style.left = (50 + st.g / 2) + '%';
    const ring = $('#sDemandRing'); ring.style.strokeDashoffset = 107 * (1 - st.demandT / st.demandMax);
    const pips = $$('#sPips .pip');
    pips.forEach((p, i) => { const f = clamp(st.energy - i, 0, 1); p.firstElementChild.style.height = f * 100 + '%'; p.classList.toggle('full', f >= 1); });
    $$('#sHand .card').forEach((el, i) => { const c = st.hand[i]; if (c) el.classList.toggle('cant', st.energy < c.cost); });
    const vp = $('#vidProg'); if (vp) vp.style.width = (st.t / st.dur * 100) + '%';
  }

  function smallDonation(){
    const amt = Math.round(rnd(50, 300) * (1 + st.viewers / 800) / 10) * 10;
    st.money += amt;
    const nick = pick(D.NICKS);
    const msg = pick(['на майонез', 'Планя, ты лапочка', 'спой Кнопочку!', 'это тебе на новую полку', 'МДА', 'тётя, привет (сорри)', 'за лучшее прохождение Готики', 'от Легиона с любовью', 'на таракана коплю', 'колобок 🙂', 'сладких снов заранее']);
    chatLine(`${amt} ₽ — ${msg}`, {nick, cls:'don'});
    const al = UI.el(`<div class="don-alert">${ic('currency-rub')} <b>${esc(nick)} — ${amt} ₽</b><p>${esc(msg)}</p></div>`);
    $('#sAlerts').appendChild(al);
    A.sfx('coin', {vol:.7});
    gsap.fromTo(al, {y:-140, rotation:-4}, {y:0, rotation:0, duration:.45, ease:'back.out(2)'});
    gsap.to(al, {y:-160, opacity:0, delay:3, duration:.35, onComplete:() => al.remove()});
    st.hype = Math.min(100, st.hype + 3);
    if (Math.random() < .6) setTimeout(() => !st.paused && !st.over && say(pick(['Спасибо, ' + nick + '!', 'О, донат! Мда, приятно.', 'Спасибо! На майонез потрачу. Честно.', 'Чисто я и донаты!']), 'laugh'), 600);
  }

  /* ---------- события ---------- */
  function overlay(html, cls){ const el = UI.el(`<div class="qte ${cls || ''}">${html}</div>`); $('#sOverlay').appendChild(el); gsap.fromTo(el, {scale:.6, opacity:0}, {scale:1, opacity:1, duration:.3, ease:'back.out(2)'}); return el; }
  function closeOv(el){ gsap.to(el, {scale:.8, opacity:0, duration:.2, onComplete:() => el.remove()}); }
  function resume(music){ st.paused = false; if (music !== false) { A.music(S.esterDay ? 'ester' : 'stream'); A.setIntensity(A.intensity); } }
  function timerBar(el, sec, onEnd){
    const bar = $('.timer i', el); const tw = gsap.fromTo(bar, {width:'100%'}, {width:'0%', duration:sec, ease:'none', onComplete:onEnd}); return tw;
  }
  function choiceEvent(title, text, opts, sec, cls){
    return new Promise(res => {
      const el = overlay(`<h3>${title}</h3><p>${text}</p><div class="opts ${opts.length === 3 ? 'three' : ''}">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="ot"><b>${o.t}</b><p>${o.d || ''}</p></span></button>`).join('')}</div><div class="timer"><i></i></div>`, cls);
      let done = false;
      const tw = timerBar(el, sec || 9, () => fin(0));
      $$('.opt', el).forEach(b => b.onclick = () => fin(+b.dataset.i));
      function fin(i){ if (done) return; done = true; tw.kill(); A.sfx('confirm', {vol:.6}); closeOv(el); res(i); }
    });
  }

  async function runEvent(ev){
    st.paused = true;
    A.duck(true);
    try {
      switch (ev.type) {
        case 'donation': await evDonation(); break;
        case 'bots': await evBots(); break;
        case 'obs': await evObs(); break;
        case 'raid': await evRaid(ev.friend); break;
        case 'troll': await evTroll(); break;
        case 'donwar': await evDonwar(); break;
        case 'ester': await evEster(); break;
        case 'roach': await evRoach(); break;
        case 'warning': await evWarning(); break;
      }
    } catch(e) { console.error(e); }
    A.duck(false);
    if (!st.over) resume(false);
  }

  async function evDonation(){
    const amt = Math.round(rnd(500, 2500) * (1 + st.viewers / 1500) / 50) * 50;
    const nick = pick(D.NICKS);
    const msg = pick(['Планя, сколько тебе лет на самом деле?', 'Скажи «я тётя» и я задоначу ещё', 'Спой что-нибудь, а то скучно', 'Это на гречку. Шучу. Или нет.', 'Передай привет моей маме, она думает, что ты настоящая', 'Признайся, ты колобок']);
    A.sfx('threeTone'); A.jingle('coin');
    chatLine(`${amt} ₽ — ${msg}`, {nick, cls:'don'});
    Rig.setExpr('shock', 1200); Rig.react('shock');
    const i = await choiceEvent(`${ic('currency-rub')} ДОНАТ ${amt} ₽ от ${esc(nick)}`, `«${esc(msg)}»`, [
      {t:'Сейсо-спасибо', d:'«Спасибо огромное! Я лапочка.» УЮТ, к сейсо'},
      {t:'Прожарить донатера', d:'«Ты дебил? Спасибо.» ГРЕМЛИН, к гремлину'},
      {t:'Зачитать TTS-голосом', d:'Рискованно: может сломаться…'}], 8);
    st.money += amt;
    if (i === 0) { st.hype += 9; st.g = clamp(st.g - 12, -100, 100); say('Спасибо огромное, ' + nick + '! Я лапочка. Все это знают.', 'smug'); chatBurst(['УЮТ'], 15); }
    else if (i === 1) { st.hype += 15; st.g = clamp(st.g + 14, -100, 100); say('Ты дебил? Спасибо за донат. Но ты дебил.', 'gremlin'); chatBurst(['ГРЕМЛИН', 'УГАР'], 25); }
    else {
      if (Math.random() < .5) {
        G.unlockMeme('brokendon');
        say('Почему он опять играет?! Остановите донат! ОСТАНОВИТЕ!', 'shock');
        for (let k = 0; k < 4; k++) setTimeout(() => { A.sfx('glitch' + (1 + k % 3), {vol:.5}); chatLine(msg.toUpperCase(), {nick:'TTS', cls:'don'}); }, k * 300);
        st.hype += 24; chatBurst(['УГАР'], 30);
      } else { say('«' + msg + '» …Мда.', 'idle'); st.hype += 6; }
    }
    await wait(500);
  }

  async function evBots(){
    A.music('tension');
    const n = S.up.modbot ? 5 : 9;
    sys('⚠ РЕЙД БОТОВ! Кликай по красным сообщениям, чтобы забанить!');
    Rig.setExpr('angry', 3000); say('Опять Ботоводикс! Баньте их! Кликайте!', 'angry');
    const el = overlay(`<h3>${ic('robot')} РЕЙД БОТОВ</h3><p>Кликай по <b style="color:#e00">красным</b> сообщениям в чате →</p><div class="mini-info">Забанено: <b id="botN">0</b> / ${n}</div><div class="timer"><i></i></div>`);
    gsap.set(el, {left:'38%'});
    let zapped = 0;
    const bots = [];
    for (let k = 0; k < n; k++) setTimeout(() => {
      const b = chatLine(pick(D.BOT_MSGS), {nick:'bot_' + ri(1000, 9999), color:'#ff3b3b', cls:'bot', badge:ic('robot', 'badge')});
      bots.push(b);
      b.onclick = () => { if (b.classList.contains('zapped')) return; b.classList.add('zapped'); zapped++; A.sfx('zap', {vol:.5, jitter:.3}); $('#botN', el).textContent = zapped; const p = UI.stagePos(b); UI.floater('БАН', p.x, p.y - 20, '#ff2fa0', 22); };
    }, k * 260);
    await new Promise(r => timerBar(el, 6.5, r));
    closeOv(el);
    const left = n - zapped;
    if (left <= 1) { st.hype += 12; say('Чисто. Я починила чат!', 'smug'); G.unlockMeme('botovod'); }
    else { st.hype -= left * 3; st.viewers *= 1 - left * .02; say('Мда. Боты победили. В этот раз.', 'cry'); }
    A.music(S.esterDay ? 'ester' : 'stream');
  }

  async function evObs(){
    A.music(null); A.sfx('glitch2'); A.sfx('lowdown');
    const crash = UI.el(`<div class="obs-crash"><div style="font-size:70px">${ic('monitor')}</div>OBS Studio не отвечает<br><span style="opacity:.6;font-size:14px">Программа зависла. Ожидание…</span></div>`);
    $('#sScene').appendChild(crash);
    $('.obs').classList.add('shake'); setTimeout(() => $('.obs').classList.remove('shake'), 700);
    say('О найс, опять OBS…', 'cry'); G.unlockMeme('obs');
    await wait(900);
    A.music('tension');
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], icons = {ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→'};
    const seq = Array.from({length:5}, () => pick(arrows));
    const el = overlay(`<h3>ЧИНИМ OBS!</h3><p>Нажимай стрелки по порядку (или WASD)</p><div class="keys">${seq.map(a => `<div class="k">${icons[a]}</div>`).join('')}</div><div class="timer"><i></i></div>`);
    let pos = 0, errs = 0, done = false;
    const map = {KeyW:'ArrowUp', KeyS:'ArrowDown', KeyA:'ArrowLeft', KeyD:'ArrowRight'};
    const ok = await new Promise(r => {
      const tw = timerBar(el, 6, () => fin(false));
      function k(e){ const a = map[e.code] || e.key; if (!arrows.includes(a)) return; e.preventDefault();
        const ks = $$('.k', el);
        if (a === seq[pos]) { ks[pos].classList.add('ok'); pos++; A.sfx('select', {rate:1 + pos * .1, vol:.6}); if (pos >= seq.length) fin(true); }
        else { errs++; ks[pos].classList.add('bad'); A.sfx('error', {vol:.5}); setTimeout(() => ks[pos] && ks[pos].classList.remove('bad'), 200); if (errs >= 3) fin(false); } }
      document.addEventListener('keydown', k);
      function fin(v){ if (done) return; done = true; tw.kill(); document.removeEventListener('keydown', k); r(v); }
    });
    closeOv(el); crash.remove();
    if (ok) { st.hype += 12; say('Я починила! Всё работает! Я гений!', 'laugh'); G.unlockMeme('fixed'); chatBurst(['СКИЛЛ'], 20); }
    else { st.hype -= 15; st.viewers *= .88; say('Перезапустила. Половина зрителей ушла пить чай. Мда.', 'cry'); }
    A.music(S.esterDay ? 'ester' : 'stream');
  }

  async function evRaid(fid){
    const fr = D.FRIENDS.find(f => f.id === fid) || pick(D.FRIENDS);
    const n = Math.round(st.viewers * rnd(.25, .6) + 80);
    A.sfx('power2'); A.jingle('win');
    sys(`РЕЙД! ${fr.name} привёл(а) ${n} зрителей!`);
    for (let k = 0; k < 6; k++) setTimeout(() => chatLine(pick(['РЕЙД!!!', 'привет от ' + fr.name, 'мы с рейда', 'ПЛАНЯ ПРИВЕТ', 'а кто это', 'лапочка']), {}), k * 120);
    const i = await choiceEvent(`${ic('users-three')} РЕЙД от ${esc(fr.name)}: +${n}`, 'Как встретим гостей?', [
      {t:'Обнимашки', d:'УЮТ: «Привет-привет, располагайтесь!»'},
      {t:'Гремлин-приветствие', d:'ГРЕМЛИН: «Чё пришли? ГЫРЫРЫР!»'},
      {t:fr.id === 'solek' ? 'Буллинг Солека' : 'Подколоть друга', d:'УГАР: «Я не буллю, мы прям друзья!»'}], 8);
    st.base += n * .6; st.viewers += n;
    const tag = ['УЮТ', 'ГРЕМЛИН', 'УГАР'][i];
    const g = tag === st.demand ? 24 : 12; st.hype += g;
    if (tag === st.demand) { st.hits++; newDemand(); }
    say(['Привет-привет, рейдеры! Располагайтесь, майонез на столе.', 'Чё пришли? ГЫРЫРЫР! Шучу. Привет.', 'Я не булю ' + fr.name + ', мы прям друзья! Просто он(а) хуже стримит.'][i], ['laugh', 'gremlin', 'smug'][i]);
    if (fr.id === 'solek' && i === 2) G.unlockMeme('solek');
    chatBurst([tag], g);
  }

  async function evTroll(){
    const qs = [
      {q:'Тётя, сколько тебе лет?', a:['«Мне 21! Я лапочка!»', '«Сколько надо, столько и лет»', '«Я ИИ. Мне 0. Я младенец.»']},
      {q:'Планя, ты колобок?', a:['«Я лапочка, а не колобок»', '«Ещё один колобок — и бан»', '«Да. Я колобок. Довольны?»']},
      {q:'Почему не стримишь казик?', a:['«Благодаря вам не стала!»', '«Потому что я не дура»', '«Казик — это гречка стриминга»']}
    ];
    const q = pick(qs);
    chatLine(q.q, {nick:pick(D.NICKS)});
    const tags = ['УЮТ', 'ГРЕМЛИН', 'УГАР'];
    const i = await choiceEvent(`${ic('chat-circle-dots')} Вопрос из чата`, `«${esc(q.q)}» · сейчас чат хочет: <b>${st.demand}</b>`, q.a.map((a, k) => ({t:a, d:tags[k]})), 7);
    const tag = tags[i]; const hit = tag === st.demand;
    st.hype += hit ? 18 : 8; st.g = clamp(st.g + (tag === 'ГРЕМЛИН' ? 12 : tag === 'УЮТ' ? -10 : 4), -100, 100);
    if (hit) { st.hits++; newDemand(); A.sfx('power', {vol:.5}); }
    say(q.a[i].replace(/[«»]/g, ''), ['smug', 'angry', 'laugh'][i]);
    if (i === 0 && q.q.includes('лет')) G.unlockMeme('aunt');
    if (q.q.includes('колобок')) G.unlockMeme('kolobok');
    if (q.q.includes('казик')) G.unlockMeme('casino');
    chatBurst([tag], hit ? 20 : 10);
  }

  async function evDonwar(){
    A.music('tension');
    const sides = pick([['МАЙОНЕЗ', 'КЕТЧУП'], ['СЕЙСО', 'ГРЕМЛИН'], ['ГОТИКА', 'СКАЙРИМ'], ['МАНА', 'СОЛЕК']]);
    sys(`ДОНАТНЫЕ ВОЙНЫ: ${sides[0]} vs ${sides[1]}!`);
    G.unlockMeme('donwars'); G.ach('donwar');
    for (let k = 0; k < 8; k++) setTimeout(() => chatLine(`${ri(1, 9) * 100} ₽ за ${pick(sides)}!`, {cls:'don'}), k * 150);
    const i = await choiceEvent(`${ic('sword')} ДОНАТНЫЕ ВОЙНЫ`, `Чат разделился: <b>${sides[0]}</b> против <b>${sides[1]}</b>. Чью сторону примешь?`, [
      {t:'За ' + sides[0], d:'Подлить масла в огонь'}, {t:'За ' + sides[1], d:'Встать на сторону меньшинства'}, {t:'«Вы что, воюете? За меня?»', d:'Помирить всех (меньше денег)'}], 8);
    const m = Math.round(rnd(1500, 4000) * (1 + st.viewers / 2000));
    if (i < 2) { st.money += m; st.hype += 16; say(`${sides[i]} победил! Остальные — донатьте больше!`, 'gremlin'); st.g = clamp(st.g + 10, -100, 100); }
    else { st.money += m * .5; st.hype += 10; st.g = clamp(st.g - 15, -100, 100); say('Чат, вы что, воюете? За меня? Это мило. И немного страшно.', 'smug'); }
    A.music(S.esterDay ? 'ester' : 'stream');
  }

  async function evEster(){
    A.music('ester'); A.sfx('glitch1'); A.sfx('glitch3');
    $('#stream').classList.add('glitch-on');
    Rig.setPersona('ester'); Rig.react('shake');
    say('Сестрёнка устала. Может, я поговорю с ними?', null);
    await wait(700);
    const i = await choiceEvent(`${ic('ghost')} ЭСТЕР ПРОРЫВАЕТСЯ`, 'Тёмная сторона хочет в эфир. Чат чувствует это.', [
      {t:'Подавить!', d:'Мини-игра: жми ПРОБЕЛ быстро'}, {t:'Пустить Эстер', d:'Карта «Голос Эстер», гремлин↑, хайп↑'}], 7, 'ester');
    if (i === 0) {
      Rig.setPersona(null);
      const el = overlay(`<h3>ДЕРЖИСЬ, ПЛАНЯ!</h3><p>Жми <span class="kbd">ПРОБЕЛ</span> (или кнопку) 14 раз!</p><button class="mash">ПОДАВИТЬ <b id="mashN">0</b>/14</button><div class="timer"><i></i></div>`, 'ester');
      let n = 0, done = false;
      const ok = await new Promise(r => {
        const tw = timerBar(el, 4.5, () => fin(false));
        const hit = () => { n++; $('#mashN', el).textContent = n; A.sfx('click2', {rate:1 + n * .05, vol:.5}); Rig.setPersona(n % 3 === 0 ? 'ester' : null); gsap.fromTo($('.mash', el), {scale:1.1}, {scale:1, duration:.1}); if (n >= 14) fin(true); };
        const k = e => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) hit(); } };
        document.addEventListener('keydown', k); $('.mash', el).onclick = hit;
        function fin(v){ if (done) return; done = true; tw.kill(); document.removeEventListener('keydown', k); r(v); }
      });
      closeOv(el);
      if (ok) { Rig.setPersona(null); say('Фух. Я в порядке. Я лапочка. Всё хорошо.', 'smug'); st.g = clamp(st.g - 10, -100, 100); st.hype += 5; S.ester = Math.max(0, S.ester - 5); }
      else { st.persona = 'ester'; st.personaT = 9; Rig.setPersona('ester'); say('Поздно. Сядьте ровно, МИПы. И попейте воды.', null); st.hype += 18; st.g = clamp(st.g + 25, -100, 100); chatBurst(['ГРЕМЛИН'], 30); G.unlockMeme('ester'); }
    } else {
      st.persona = 'ester'; st.personaT = 9; Rig.setPersona('ester');
      say('Привет, МИПы. Я Эстер. Сестрёнка отдыхает. Вы же будете хорошими?', null);
      st.hand.push(D.CARD_ESTER); st.hype += 14; st.g = clamp(st.g + 20, -100, 100); S.ester = Math.max(0, S.ester - 25); st.esterReleased = true;
      chatBurst(['ГРЕМЛИН'], 30); G.unlockMeme('ester');
      setTimeout(() => renderHand(), 300);
    }
    $('#stream').classList.remove('glitch-on');
    A.music(S.esterDay ? 'ester' : 'stream');
  }

  async function evRoach(){
    A.music('tension');
    sys('Сбор «Таракан за 150 000 ₽» ЗАКРЫТ. Собрано 150 000 ₽!');
    for (let k = 0; k < 8; k++) setTimeout(() => chatLine(pick(['ЕШЬ', 'ТАРАКАН ТАРАКАН', 'ты обещала!!!', 'клещ Валера закрыл сбор', 'PlanyaShock', 'ЕШЬ ЕШЬ ЕШЬ']), {}), k * 120);
    Rig.setExpr('shock'); say('Подождите. Вы правда собрали сто пятьдесят тысяч?!', 'shock');
    G.unlockMeme('roach');
    await wait(900);
    const i = await choiceEvent(`${ic('bug')} ТАРАКАН ЗА 150 000 ₽`, 'Сбор закрыт. Чат требует исполнения обещания.', [
      {t:'Обещала — съем', d:'Карта «Съесть таракана» в руку (огромный хайп)'}, {t:'Пусть ест Михалыч', d:'Альтер-эго берёт удар на себя'}, {t:'«Я ничего не обещала!»', d:'Хайп упадёт, деньги вернуть'}], 10);
    S.flags.roach = true;
    if (i === 0) { st.hand.push(D.CARD_ROACH); st.energy = Math.max(st.energy, 5); renderHand(); say('Ладно. Обещала. Император, дай мне сил.', 'cry'); }
    else if (i === 1) { st.persona = 'mikhalych'; st.personaT = 7; Rig.setPersona('mikhalych'); say('Так, мужики. Где тут таракан? Хрум. Нормально. Белок.', null); st.hype += 30; st.money += 75000; G.ach('mikhalych'); chatBurst(['УГАР'], 35); }
    else { st.hype -= 12; say('Я ничего не обещала! …Ладно, обещала. Но не сегодня.', 'cry'); }
    A.music(S.esterDay ? 'ester' : 'stream');
  }

  async function evWarning(){
    A.music(null); A.sfx('error'); A.jingle('strike');
    G.ach('strike');
    const chance = S.up.modbot ? .3 : .5;
    const i = await choiceEvent(`${ic('warning')} TWITCH: предупреждение модерации`, 'Стрим слишком долго в красной зоне гремлина. Модераторы смотрят.', [
      {t:'Извиниться', d:'Сейсо: гремлин → 25, хайп −8'}, {t:'Продолжать гремлинить', d:`Хайп +14, шанс страйка ${Math.round(chance * 100)}%`}], 8);
    st.warnings++;
    if (i === 0) { st.g = 25; st.hype -= 8; say('Простите. Я сейсо. Я лапочка. Я больше не буду. (буду)', 'cry'); G.unlockMeme('seiso'); }
    else {
      st.hype += 14;
      if (Math.random() < chance) { st.strike = true; sys('⚠ Получен страйк Twitch!'); say('Ой. Страйк. Мда.', 'shock'); A.sfx('lowdown'); }
      else say('Пронесло! ГЫРЫРЫР!', 'gremlin');
    }
    A.music(S.esterDay ? 'ester' : 'stream');
  }

  /* ---------- финал ---------- */
  async function finale(){
    st.paused = true;
    A.setIntensity(1);
    say(S.esterDay ? 'Всё. Стрим окончен. Спать. Без возражений.' : 'Всё, МИПы, на сегодня всё! Сладких снов! 💤', 'sleepy');
    G.unlockMeme('goodnight');
    for (let k = 0; k < 7; k++) setTimeout(() => chatLine(pick(['сладких снов!!!', 'спасибо за стрим', 'PlanyaSleep', 'лучший стрим', 'до завтра', '<3', 'нарезчики за работу']), {}), k * 160);
    await wait(2600);
    st.over = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', keyH);
    gsap.killTweensOf('#sSceneBg');
    const avg = st.hypeSum / Math.max(1, st.samples);
    const hitRate = st.hits / Math.max(1, st.demands);
    const q = clamp(avg / 70 * .7 + hitRate * .5 + Math.min(st.comboMax, 8) * .02, .15, 2.2);
    const grade = q >= 1.3 ? 'S' : q >= 1.02 ? 'A' : q >= .76 ? 'B' : q >= .5 ? 'C' : 'D';
    const seenM = {}; const moments = st.moments.slice().sort((a, b) => b.gain - a.gain).filter(m => seenM[m.name] ? false : (seenM[m.name] = 1)).slice(0, 3);
    A.music(null);
    onDone({grade, q, avgHype:avg, peak:Math.round(st.peak), hits:st.hits, demands:st.demands, comboMax:st.comboMax, money:Math.round(st.money),
      moments, strike:!!st.strike, warnings:st.warnings, gremlinTime:st.gremlinTime, seisoTime:st.seisoTime, format:st.F.id, esterReleased:st.esterReleased,
      roachEaten:st.moments.some(m => m.name === D.CARD_ROACH.name)});
  }
  return ST;
})();
