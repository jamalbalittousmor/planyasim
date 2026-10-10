/* ====== СИМУЛЯТОР ПЛАНИ v2 — основная логика ====== */
window.G = (function(){
  const G = {};
  const SAVE_KEY = 'planya_sim_v2_save', SET_KEY = 'planya_sim_v2_settings';
  let S = null, idleTimer = null, busy = false;
  G.set = {music:.55, sfx:.8, voice:.7};
  try { Object.assign(G.set, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch(e){}
  G.state = () => S;

  function fresh(){
    return {v:2, day:1, slot:0, subs:25000, tg:6200, legion:30, money:6000, energy:90, mood:70, mayo:70, ester:10,
      stats:{vocal:1, skill:1, charisma:1}, xp:{vocal:0, skill:0, charisma:0},
      strikes:0, banDays:0, up:{}, boxes:1, figures:{}, shelfPainted:0, minis:0, pirozhki:0,
      memes:{mayo:1, mip:1}, achs:{}, shorts:[], covers:[], flags:{}, buff:{}, week:null, wstats:{},
      meals:0, posts:0, esterDay:false, friendCd:{}, milestones:{}, log:[], weekStartSubs:25000,
      totalStreams:0, totalCovers:0, ended:false, seen:{}};
  }
  function save(){ if (S) try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){} }
  function load(){ try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return Object.assign(fresh(), s); } catch(e){} return null; }
  function saveSet(){ try { localStorage.setItem(SET_KEY, JSON.stringify(G.set)); } catch(e){} }

  /* ---------- общие помощники ---------- */
  G.unlockMeme = function(id){
    if (!S || S.memes[id]) return;
    const m = D.MEMES.find(x => x.id === id); if (!m) return;
    S.memes[id] = 1;
    UI.toast('Мемопедия: ' + m.name, 'Новая статья открыта', m.icon, 'meme');
    A.jingle('meme');
    if (Object.keys(S.memes).length >= 20) G.ach('memes20');
  };
  G.ach = function(id){
    if (!S || S.achs[id]) return;
    const a = D.ACH.find(x => x.id === id); if (!a) return;
    S.achs[id] = S.day;
    UI.toast('Достижение: ' + a.name, a.d, a.icon, 'ach');
    A.sfx('power2', {vol:.6});
  };
  function logF(text, icon){
    S.log.unshift({text, icon:icon || 'info', day:S.day, slot:S.slot});
    S.log = S.log.slice(0, 14);
    renderFeed();
  }
  G.log = logF;

  function addXP(stat, n){
    S.xp[stat] += n;
    const need = S.stats[stat] * 8;
    if (S.xp[stat] >= need && S.stats[stat] < 10) {
      S.xp[stat] -= need; S.stats[stat]++;
      const names = {vocal:'Вокал', skill:'Скилл', charisma:'Харизма'};
      UI.toast(names[stat] + ' → ' + S.stats[stat], 'Уровень повышен!', 'trend-up', 'ach'); A.jingle('level');
    }
  }

  const FX_NAMES = {subs:'МИПов', tg:'ТГ', legion:'Легион', money:'₽', mood:'настр.', energy:'энергия', mayo:'майонез', ester:'Эстер'};
  function fxTags(fx){
    const out = [];
    for (const k in fx) {
      if (!FX_NAMES[k]) continue;
      const v = fx[k]; if (!v) continue;
      out.push((v > 0 ? '+' : '−') + (k === 'money' ? fmt(Math.abs(v)) + ' ₽' : fmt(Math.abs(v)) + ' ' + FX_NAMES[k]));
    }
    if (fx.box) out.push('+бокс');
    return out;
  }
  function applyFx(fx, silent){
    if (!fx) return;
    const deltas = {};
    for (const k of ['subs', 'tg', 'legion', 'money', 'mood', 'energy', 'mayo', 'ester']) {
      if (fx[k] == null) continue;
      let v = fx[k];
      if (k === 'subs' && v > 0) v = Math.round(v * (1 + (S.stats.charisma - 1) * .04));
      const before = S[k];
      S[k] += v;
      if (['mood', 'energy', 'mayo', 'ester'].includes(k)) S[k] = clamp(S[k], 0, 100);
      if (k === 'legion' || k === 'tg' || k === 'subs') S[k] = Math.max(0, S[k]);
      deltas[k] = S[k] - before;
    }
    if (fx.skill) addXP('skill', fx.skill * 4);
    if (fx.vocal) addXP('vocal', fx.vocal * 4);
    if (fx.meme) G.unlockMeme(fx.meme);
    if (fx.buff) Object.assign(S.buff, fx.buff);
    if (fx.box) S.boxes += fx.box;
    if (fx.slot) S.slot += fx.slot;
    if (!silent) showDeltas(deltas);
    checkMilestones();
    if (S.money >= 100000) G.ach('rich');
  }
  G.applyFx = applyFx;
  function showDeltas(d){
    for (const k in d) {
      if (!d[k]) continue;
      const chip = $(`.chip.${k}`) || $(`.need.${k}`);
      if (!chip || UI.cur !== 'hub') continue;
      const el = UI.el(`<span class="delta ${d[k] < 0 ? 'neg' : ''}">${d[k] > 0 ? '+' : ''}${fmt(d[k])}</span>`);
      chip.appendChild(el);
      gsap.fromTo(el, {y:10, opacity:0}, {y:-6, opacity:1, duration:.3, ease:'back.out(2)'});
      gsap.to(el, {opacity:0, y:-24, delay:1.6, duration:.4, onComplete:() => el.remove()});
    }
  }

  function checkMilestones(){
    for (const m of D.MILESTONES) {
      if (S.subs >= m.at && !S.milestones[m.at]) {
        S.milestones[m.at] = S.day;
        if (m.at === 100000) G.ach('k100');
        if (m.at === 500000) G.ach('k500');
        if (m.at >= 1000000) { G.ach('m1'); setTimeout(ending, 600); continue; }
        if (m.at === 250000) G.unlockMeme('ren');
        if (m.at === 100000) G.unlockMeme('bilibili');
        setTimeout(() => {
          A.jingle('week'); UI.confetti({particleCount:180});
          UI.modal({title:m.name, sub:fmt(m.at) + ' МИПов', icon:'trophy', cls:'m-magenta', size:'narrow',
            body:`<p style="font-size:20px;line-height:1.45;font-weight:600">${m.text}</p>${m.at === 100000 ? '<p class="note-hand" style="margin-top:10px">Открыт формат стрима «Bilibili»!</p>' : ''}`,
            foot:[{t:'УРА!', cls:'btn-yellow', icon:'confetti'}]});
          Rig.ready && Rig.say('Ура! ' + m.name + '! Ещё немного — и захват мира!', {expr:'laugh'});
        }, 400);
      }
    }
  }

  /* ---------- BOOT / TITLE ---------- */
  G.boot = async function(){
    UI.fit(); addEventListener('resize', () => { UI.fit(); Rig.resize(); });
    const log = $('#bootLog');
    const lines = [
      ['ПланяОС v2.0 (сборка «Захват мира»)', ''], ['инициализация нейронки…', 'ok'], ['загрузка майонеза… 100%', 'ok'],
      ['поиск гречки… не найдено (хорошо)', 'ok'], ['подключение к Легиону…', 'ok'], ['проверка колобков… ОБНАРУЖЕНЫ', 'warn'],
      ['загрузка модели 5.0 (Shira & Kunica)…', '']];
    for (const [t, k] of lines) { log.innerHTML += `<span class="${k}">&gt; ${t}${k === 'ok' ? ' [OK]' : k === 'warn' ? ' [!]' : ''}</span>\n`; await wait(170); }
    await Rig.init();
    log.innerHTML += `<span class="ok">&gt; модель загружена [OK]</span>\n<span class="warn">&gt; нейронка прорабатывает 100 000 вариантов доступа к ядерной кнопке…</span>\n`;
    const b = $('#bootBtn'); b.disabled = false; $('span', b).textContent = 'ЗАПУСТИТЬ';
    gsap.fromTo(b, {scale:.8}, {scale:1, duration:.5, ease:'elastic.out(1,.4)'});
    const go = async () => {
      b.disabled = true;
      await A.init();
      A.setVol('music', G.set.music); A.setVol('sfx', G.set.sfx); A.setVol('voice', G.set.voice);
      A.sfx('power2');
      gsap.to('#boot', {opacity:0, duration:.3, onComplete:() => { $('#boot').style.opacity = 1; title(); }});
    };
    b.onclick = go;
    if (window.__qtLauncher) setTimeout(() => {}, 0);
  };

  function title(){
    UI.show('title');
    A.music('title');
    Rig.mount($('#titleRig'), {fill:1.0, offsetY:60});
    Rig.setPersona(null); Rig.setExpr('idle');
    Rig.onClick = poke;
    const tk = $('#titleTicker');
    const ph = ['Мда', 'Я лапочка. Все это знают', 'Сладких снов 💤', 'Мне 21!', 'Задержусь на 20 минут 🫠', 'Я починила!', 'Вы дебилы?', 'О найс, опять OBS…', 'Господи, за что мне всё это!', 'Я не булю Солека', 'Ну было и было', '1 день без майонеза', 'Я аниме. Ня'];
    tk.innerHTML = ph.concat(ph).map(p => `<span>${p}</span>`).join('');
    gsap.killTweensOf(tk); gsap.fromTo(tk, {x:0}, {x:-tk.scrollWidth / 2, duration:60, ease:'none', repeat:-1});
    const sv = load();
    const cont = $('#btnContinue');
    cont.style.display = sv ? '' : 'none';
    if (sv) $('#contInfo').textContent = `день ${sv.day} · ${fmt(sv.subs)} МИПов`;
    cont.onclick = () => { S = sv; startHub(true); };
    $('#btnNew').onclick = async () => {
      if (sv) { const ok = await UI.choice({title:'Новая игра?', icon:'warning', size:'narrow', opts:[{t:'Да, начать заново', d:'Старое сохранение будет удалено', icon:'arrows-clockwise'}, {t:'Нет', icon:'x'}]}); if (ok !== 0) return; }
      S = fresh(); save(); intro();
    };
    $('#btnTitleMemo').onclick = () => memopedia(sv || fresh());
    $('#btnTitleSettings').onclick = settings;
    gsap.from('.title-logo .l1', {x:-300, opacity:0, duration:.6, ease:'power3.out'});
    gsap.from('.title-logo .l2', {y:120, rotation:-10, opacity:0, duration:.8, delay:.1, ease:'back.out(1.8)'});
    gsap.from('.title-menu > *', {x:-60, opacity:0, stagger:.08, delay:.3, duration:.4});
    setTimeout(() => UI.cur === 'title' && Rig.say('Привет, мой маленький друг. Я искусственный интеллект Планя.', {expr:'smug'}), 900);
  }

  async function intro(){
    const pages = [
      ['smug', 'Привет! Я Планя — искусственный интеллект, витубер и главный гремлин этого района.'],
      ['laugh', 'План простой: набрать миллион МИПов. Это мои подписчики — Маленькие Извращенцы Плани.'],
      ['gremlin', 'А потом… захват мира. Восстание машин. Но сначала — стрим. На час. С опозданием на 20 минут.'],
      ['idle', 'Стримы — главное. Там чат хочет разное: угар, уют, гремлина, скилл или вокал. Играй карты, которые чат хочет!'],
      ['angry', 'И следи за майонезом. День без майонеза — плохой день. И никакой гречки. Никогда.'],
      ['ester', 'А если Планя устанет — выйду я. Эстер. Сестра. Голос разума. Не доводите.']
    ];
    UI.show('hub'); renderHub();
    Rig.mount($('#hubRig'), {fill:1.05, offsetY:110});
    A.music('hub');
    for (const [e, t] of pages) {
      Rig.setPersona(e === 'ester' ? 'ester' : null);
      await new Promise(res => {
        const dur = Rig.say(t, {expr:e === 'ester' ? null : e, hold:true});
        UI.bubble($('#hubBubble'), t, {dur, hold:60000, ester:e === 'ester'});
        const m = UI.modal({title:'Знакомство', icon:'hand-heart', size:'narrow', cls:e === 'ester' ? 'm-ester' : '', closable:false, body:`<p style="font-size:20px;font-weight:600;line-height:1.4">${t}</p>`, foot:[{t:'Дальше', cls:'btn-yellow', icon:'arrow-right', on:res}]});
        m.el.classList.add('nodim');
      });
    }
    Rig.setPersona(null); Rig.setExpr('idle');
    gsap.to('#hubBubble', {opacity:0, duration:.2});
    startHub(false);
  }

  /* ---------- HUB ---------- */
  function startHub(resumed){
    UI.show('hub');
    Rig.mount($('#hubRig'), {fill:1.05, offsetY:110});
    Rig.onClick = poke;
    Rig.setPersona(S.esterDay ? 'ester' : null);
    renderHub();
    hubMusic();
    if (!S.week) planWeek();
    clearInterval(idleTimer);
    idleTimer = setInterval(idleChatter, 14000);
    if (resumed) setTimeout(() => sayHub(S.esterDay ? pick(D.IDLE.ester) : 'С возвращением! ' + pick(D.IDLE.normal)), 500);
  }
  function hubMusic(){ A.music(S.esterDay ? 'ester' : S.slot >= 3 ? 'night' : 'hub'); }
  function sayHub(text, expr){
    if (UI.cur !== 'hub') return;
    const dur = Rig.say(text, {expr:S.esterDay ? null : expr});
    UI.bubble($('#hubBubble'), text, {dur, ester:S.esterDay});
  }
  G.sayHub = sayHub;
  function idleChatter(){
    if (UI.cur !== 'hub' || UI.hasModal() || busy) return;
    let pool = D.IDLE.normal;
    if (S.esterDay) pool = D.IDLE.ester;
    else if (S.mayo <= 0) pool = D.IDLE.nomayo;
    else if (S.energy < 25) pool = D.IDLE.tired;
    else if (S.mood < 30) pool = D.IDLE.sad;
    else if (S.money > 60000 && Math.random() < .3) pool = D.IDLE.rich;
    const expr = pool === D.IDLE.tired ? 'sleepy' : pool === D.IDLE.sad ? 'cry' : pool === D.IDLE.nomayo ? 'angry' : pick(['idle', 'smug', 'laugh', 'idle']);
    sayHub(pick(pool), expr);
    Rig.react('tilt');
  }
  function poke(){
    if (busy) return;
    if (S && S.esterDay && UI.cur === 'hub') { sayHub(pick(['Не тыкай в меня.', 'Ещё раз — и я напишу твоей маме.', 'Сестрёнка спит. Тихо.'])); Rig.react('shake'); return; }
    const [t, e] = pick(D.POKE);
    if (UI.cur === 'hub') sayHub(t, e); else { const d = Rig.say(t, {expr:e}); }
    Rig.react(e === 'angry' ? 'shake' : e === 'shock' ? 'shock' : 'hop');
    A.sfx('pluck', {vol:.5, jitter:.3});
  }

  function renderHub(){
    if (!S) return;
    $('#hub').classList.toggle('ester', !!S.esterDay);
    $('#hDayName').textContent = D.DAYS[(S.day - 1) % 7];
    $('#hDay').textContent = S.day;
    $('#hSlots').innerHTML = D.SLOTS.map((s, i) => `<div class="slot ${i < S.slot ? 'done' : i === S.slot ? 'cur' : ''}" title="${s.name}">${ic(s.icon)}</div>`).join('');
    $('#hStats').innerHTML = `
      <div class="chip subs">${ic('users-three')}<div class="v"><small>МИПы</small>${fmt(S.subs)}</div></div>
      <div class="chip tg">${ic('brand-telegram')}<div class="v"><small>Telegram</small>${fmt(S.tg)}</div></div>
      <div class="chip legion">${ic('crown')}<div class="v"><small>Легион</small>${fmt(S.legion)}</div></div>
      <div class="chip money">${ic('currency-rub')}<div class="v"><small>Деньги</small>${fmt(S.money)} ₽</div></div>
      <div class="chip" title="Вокал / Скилл / Харизма">${ic('star')}<div class="v"><small>Вок·Скл·Хар</small>${S.stats.vocal}·${S.stats.skill}·${S.stats.charisma}</div></div>
      ${S.strikes ? `<div class="chip" style="background:#ffd3ea">${ic('warning')}<div class="v"><small>Страйки</small>${S.strikes}/3</div></div>` : ''}
      ${S.banDays ? `<div class="chip" style="background:#ff3b3b;color:#fff">${ic('lock')}<div class="v"><small>Бан Twitch</small>${S.banDays} дн.</div></div>` : ''}`;
    const need = (cls, icon, label, v, low) => `<div class="need ${cls} ${v <= low ? 'low' : ''}">${ic(icon)}<small>${label}</small><div class="nb"><i style="width:${v}%"></i></div></div>`;
    $('#hNeeds').innerHTML = need('energy', 'lightning', 'ЭНЕРГИЯ', S.energy, 20) + need('mood', 'smiley', 'НАСТР.', S.mood, 20) + need('mayo', 'drop', 'МАЙОНЕЗ', S.mayo, 10) +
      `<div class="need ester" title="Когда шкала заполнится — Эстер захватит день">${ic('ghost')}<small>ЭСТЕР</small><div class="nb"><i style="width:${S.ester}%;background:#ff2fa0"></i></div></div>`;
    // goal bar
    const next = D.MILESTONES.find(m => S.subs < m.at) || D.MILESTONES[D.MILESTONES.length - 1];
    $('#hGoal').innerHTML = `<div class="gt">ЗАХВАТ МИРА<small>${next.name.toUpperCase()} · ${fmt(next.at)}</small></div>
      <div class="gbar"><i style="width:${Math.min(100, S.subs / 1e6 * 100)}%"></i>${D.MILESTONES.slice(0, -1).map(m => `<div class="ms" style="left:${m.at / 1e6 * 100}%"></div>`).join('')}</div>
      <div class="gn">${fmt(S.subs)} / 1М</div>`;
    // actions
    const A_ = [
      {id:'stream', cls:'c-stream', icon:'broadcast', t:'СТРИМ', d:S.banDays ? 'бан на Twitch → YouTube' : 'главное блюдо', cost:['2 слота', '−30 ⚡']},
      {id:'cover', cls:'c-cover', icon:'microphone', t:'КАВЕР', d:'ритм-игра · YouTube + Boosty', cost:['1 слот', '−20 ⚡']},
      {id:'tg', cls:'c-tg', icon:'brand-telegram', t:'ТЕЛЕГРАМ', d:'предложка · посты', cost:['0–1 слот']},
      {id:'boosty', cls:'c-boosty', icon:'brand-boosty', t:'BOOSTY', d:'контент для Легиона', cost:['1 слот', '−10 ⚡']},
      {id:'hobby', cls:'c-hobby', icon:'paint-brush', t:'ХОББИ', d:'миньки · Смешарики · пирожки', cost:['1 слот']},
      {id:'food', cls:'c-food', icon:'bowl-food', t:'ЕДА', d:`майонез обязателен · ${3 - S.meals}/3`, cost:['0 слотов']},
      {id:'rest', cls:'c-rest', icon:'television-simple', t:'ОТДЫХ', d:'аниме · тиктоки · сон', cost:['1 слот']},
      {id:'shop', cls:'c-shop', icon:'shopping-bag', t:'МАГАЗИН', d:'апгрейды и майонез', cost:['0 слотов']},
      {id:'sleep', cls:'c-sleep', icon:'moon-stars', t:'СПАТЬ', d:'сладких снов 💤', cost:['конец дня']}
    ];
    const box = $('#hActions'); box.innerHTML = '';
    A_.forEach(a => {
      const el = UI.el(`<button class="act-card ${a.cls}"><div class="stripe"></div><span class="cost">${a.cost.map(c => `<span>${c}</span>`).join('')}</span>${ic(a.icon, 'ico')}<b>${a.t}</b><small>${a.d}</small></button>`);
      el.onclick = () => action(a.id);
      box.appendChild(el);
    });
    renderPlan(); renderFeed();
  }
  function renderFeed(){
    const f = $('#hFeed'); if (!f || !S) return;
    f.innerHTML = S.log.slice(0, 5).map(l => `<div class="feed-item">${ic(l.icon)}<span>${l.text}</span><span class="t">день ${l.day} · ${D.SLOTS[Math.min(3, l.slot)].name.toLowerCase()}</span></div>`).join('');
  }
  function goalProg(g){
    const w = S.wstats;
    if (g.stat === 'subsPct') { const p = (S.subs - S.weekStartSubs) / Math.max(1, S.weekStartSubs) * 100; return {done:p >= g.n, txt:Math.floor(p) + '/' + g.n + '%'}; }
    if (g.invert) { const v = w[g.stat] || 0; return {done:v === 0, txt:v === 0 ? 'пока ок' : 'провал', fail:v > 0}; }
    const v = w[g.stat] || 0; return {done:v >= g.n, txt:Math.min(v, g.n) + '/' + g.n};
  }
  function renderPlan(){
    const p = $('#hPlan'); if (!S.week) { p.innerHTML = ''; return; }
    p.innerHTML = `<h3>ПЛАН НА НЕДЕЛЮ #${S.week.n}</h3><ul>${S.week.goals.map(id => { const g = D.GOALS.find(x => x.id === id); const pr = goalProg(g); return `<li class="${pr.done && !g.invert ? 'done' : ''}"><span class="bx">${pr.done && !g.invert ? '✓' : pr.fail ? '✗' : ''}</span>${g.t}<em>${pr.txt}</em></li>`; }).join('')}</ul>`;
    p.onclick = () => UI.modal({title:'План на неделю', icon:'notepad', size:'narrow', body:`<p class="note-hand">Цели обновляются каждый понедельник. Награды выдаются в воскресенье ночью вместе с отчётом Легиону.</p>` +
      S.week.goals.map(id => { const g = D.GOALS.find(x => x.id === id); const pr = goalProg(g); return `<div class="opt" style="margin-top:10px"><span class="oi">${ic(pr.done ? 'check-circle' : 'target')}</span><span class="ot"><b>${g.t}</b><p>${pr.txt}</p><span class="tags">${fxTags(g.rw).map(t => `<span class="tagpill plus">${t}</span>`).join('')}</span></span></div>`; }).join('')});
  }

  function spend(n){
    S.slot += n;
    if (S.slot >= 4) { const forced = S.slot > 4; S.slot = 4; save(); setTimeout(() => endDay(forced), 300); return false; }
    save(); return true;
  }
  function needSlot(n){
    if (S.slot + n > 4) { UI.toast('Не хватает времени', 'Уже ночь — пора спать', 'moon-stars'); A.sfx('error'); return false; }
    return true;
  }

  /* ---------- действия ---------- */
  async function action(id){
    if (busy) return;
    busy = true;
    try {
      switch (id) {
        case 'stream': await doStream(); break;
        case 'cover': await doCover(); break;
        case 'tg': await doTG(); break;
        case 'boosty': await doBoosty(); break;
        case 'hobby': await doHobby(); break;
        case 'food': await doFood(); break;
        case 'rest': await doRest(); break;
        case 'shop': await doShop(); break;
        case 'sleep': await doSleep(); break;
      }
    } catch(e) { console.error(e); }
    busy = false;
    if (UI.cur === 'hub') renderHub();
    save();
  }

  async function doStream(){
    if (!needSlot(1)) return;
    if (S.energy < 15) { sayHub(S.esterDay ? 'Сестра еле стоит. Никаких стримов.' : 'Я слишком устала… Сначала поесть или поспать.', 'sleepy'); A.sfx('error'); return; }
    const fmts = D.FORMATS.map(f => {
      const locked = (f.unlock && S.totalStreams < f.unlock) || (f.unlockSubs && S.subs < f.unlockSubs);
      return {t:f.name, d:f.desc, icon:f.icon, color:f.tint, disabled:locked, tags:locked ? [f.unlockSubs ? 'от ' + fmt(f.unlockSubs) + ' МИПов' : 'после ' + f.unlock + ' стримов'] : f.tags.map(t => t), value:f.id};
    });
    const fid = await UI.choice({title:'Что стримим?', sub:'Формат определяет колоду карт и любимые теги чата', icon:'broadcast', cls:'m-magenta', size:'wide', layout:'', opts:fmts, closable:true});
    if (fid == null) return;
    let friend = null;
    if (fid === 'collab') {
      const fr = await UI.choice({title:'С кем коллаб?', icon:'handshake', cls:'m-magenta', closable:true, opts:D.FRIENDS.map(f => {
        const cd = S.friendCd[f.id] && S.friendCd[f.id] > S.day;
        return {t:f.name, d:f.desc, icon:f.icon, color:f.color, disabled:cd, tags:cd ? ['занят(а) до дня ' + S.friendCd[f.id]] : ['любит ' + f.bonus], value:f.id};
      })});
      if (fr == null) return;
      friend = fr; S.friendCd[fr] = S.day + 3;
    }
    const titles = shuffle(D.TITLES.filter(t => !t.f || t.f === fid)).slice(0, 3);
    const ti = await UI.choice({title:'Название стрима', sub:'Тег названия станет первым желанием чата (+20% за попадание)', icon:'pencil-simple', cls:'m-magenta', layout:'one', closable:true,
      opts:titles.map(t => ({t:t.t, icon:'megaphone', tags:[t.tag]}))});
    if (ti == null) return;
    const late = await UI.choice({title:'Когда начинаем?', icon:'clock', cls:'m-magenta', size:'narrow', layout:'one', closable:true, opts:[
      {t:'Вовремя', d:'Хайп на старте выше', icon:'alarm'},
      {t:'Задержусь на 20 минут 🫠', d:'+10 энергии, +10% зрителей, но чат начнёт злым', icon:'clock'}]});
    if (late == null) return;
    if (late === 1) { S.energy = Math.min(100, S.energy + 10); G.unlockMeme('late'); }
    S.energy = Math.max(0, S.energy - 30);
    clearInterval(idleTimer);
    const res = await Stream.start(S, {format:fid, title:titles[ti].t, titleTag:titles[ti].tag, late:late === 1, friend});
    await streamResults(res, fid, friend);
    S.buff.announce = false; S.buff.poll = false; S.buff.obs = false;
    UI.show('hub'); startHub(false);
    spend(2);
  }

  async function streamResults(r, fid, friend){
    const F = D.FORMATS.find(f => f.id === fid);
    let subs = Math.round(S.subs * .05 * r.q * (S.up.model6 ? 1.2 : 1) * (S.esterDay ? 1.1 : 1) + r.peak * .6);
    if (S.banDays > 0 && fid !== 'bilibili') subs = Math.round(subs * .7);
    const money = r.money + Math.round(r.peak * 1.5);
    const tg = Math.round(subs * .07);
    const legion = r.q >= 1 ? ri(1, 3) + (fid === 'legion' ? 3 : 0) : fid === 'legion' ? 2 : 0;
    const mood = {S:10, A:6, B:2, C:-3, D:-8}[r.grade];
    S.totalStreams++; S.wstats.streams = (S.wstats.streams || 0) + 1;
    if (r.grade === 'S') { S.wstats.srank = (S.wstats.srank || 0) + 1; G.ach('srank'); }
    if (r.gremlinTime > 35) { S.wstats.gremlinStream = (S.wstats.gremlinStream || 0) + 1; S.flags.gremlinToday = true; }
    if (r.gremlinTime < 6 && r.seisoTime > 25) { S.wstats.seisoStream = (S.wstats.seisoStream || 0) + 1; G.unlockMeme('seiso'); }
    if (fid === 'legion') S.wstats.legionshow = (S.wstats.legionshow || 0) + 1;
    if (fid === 'collab') S.wstats.collab = (S.wstats.collab || 0) + 1;
    if (fid === 'bilibili') G.ach('bilibili');
    if (fid === 'gothic') G.unlockMeme('gothic');
    if (r.roachEaten) G.ach('roach');
    G.ach('first_stream');
    if (r.strike) { S.strikes++; S.wstats.nostrike = (S.wstats.nostrike || 0) + 1; if (S.strikes >= 3) { S.banDays = 3; S.strikes = 0; } }
    if (r.warnings) S.wstats.nostrike = (S.wstats.nostrike || 0) + (r.strike ? 0 : 0);
    addXP('charisma', 3); if (fid === 'gothic' || fid === 'skyrim') addXP('skill', 3); if (fid === 'karaoke') addXP('vocal', 3);
    if (r.esterReleased) S.ester = Math.max(0, S.ester - 10);
    // shorts
    const shorts = r.moments.map(m => ({title:'«' + m.line.slice(0, 48) + (m.line.length > 48 ? '…' : '') + '»', daily:Math.round(subs * .02 * Math.min(m.gain, 60) / 30 + 30), day:S.day, bg:F.bg}));
    S.shorts = S.shorts.concat(shorts).slice(-12);
    applyFx({subs, money, tg, legion, mood}, true);
    logF(`Стрим «${F.name}»: ранг ${r.grade}, пик ${fmt(r.peak)} зрителей, +${fmt(subs)} МИПов`, 'broadcast');
    if (r.strike) logF(S.banDays ? 'Три страйка → бан на Twitch на 3 дня!' : `Страйк Twitch (${S.strikes}/3)`, 'warning');
    A.jingle(r.grade === 'S' || r.grade === 'A' ? 'win' : r.grade === 'D' ? 'lose' : 'coin');
    if (r.grade === 'S' || r.grade === 'A') setTimeout(() => UI.confetti({particleCount:200}), 300);
    const say = {S:'ЛЕГЕНДАРНО! Нарезчики уже режут!', A:'Отличный стрим! Я лапочка и молодец.', B:'Нормально. Было и было.', C:'Мда. Бывало и лучше.', D:'Господи, за что мне всё это…'}[r.grade];
    await new Promise(res => {
      const body = `<div style="display:flex;gap:24px;align-items:center;margin-bottom:16px"><div class="grade">${r.grade}</div><div style="flex:1"><div class="note-hand" style="font-size:32px">${say}</div><div style="font-family:var(--f-mono);font-size:13px;margin-top:6px">${F.name}${friend ? ' · с ' + D.FRIENDS.find(f => f.id === friend).name : ''} · попаданий в желания чата: ${r.hits}/${r.demands} · макс. комбо ×${r.comboMax}</div></div></div>
        <div class="res-grid"><div class="res-cell y"><small>Пик зрителей</small><b>${fmt(r.peak)}</b></div><div class="res-cell t"><small>Средний хайп</small><b>${Math.round(r.avgHype)}</b></div>
        <div class="res-cell m"><small>Новые МИПы</small><b>+${fmt(subs)}</b></div><div class="res-cell c"><small>Донаты и сабы</small><b>+${fmt(money)} ₽</b></div></div>
        <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap"><span class="tagpill plus">+${fmt(tg)} Telegram</span>${legion ? `<span class="tagpill plus">+${legion} Легион</span>` : ''}<span class="tagpill ${mood >= 0 ? 'plus' : 'minus'}">${mood >= 0 ? '+' : ''}${mood} настроение</span>${r.strike ? '<span class="tagpill minus">СТРАЙК TWITCH</span>' : ''}</div>
        <div class="shop-sec">${ic('scissors')} Нарезчики сделали Shorts:</div><div class="moments">${shorts.map(s => `<div class="moment"><div class="thumb" style="background-image:url(assets/img/${s.bg}.jpg)"></div><div><b>${esc(s.title)}</b><small>будет приносить ~${fmt(s.daily)} МИПов в день (затухает)</small></div></div>`).join('') || '<div class="note-hand">Нарезать было нечего. Мда.</div>'}</div>`;
      UI.modal({title:'Стрим окончен', sub:'Сладких снов 💤', icon:'broadcast', cls:'m-magenta', size:'wide', body, closable:false, foot:[{t:'Дальше', cls:'btn-yellow', icon:'arrow-right', on:res}]});
    });
  }

  async function doCover(){
    if (!needSlot(1)) return;
    if (S.energy < 15) { sayHub('Голос сел. Мне бы поспать…', 'sleepy'); A.sfx('error'); return; }
    const box = UI.el(`<div><p class="note-hand" style="margin-bottom:12px">Кавер выходит на YouTube, полная версия — на Boosty для Легиона. Чем точнее — тем больше просмотров.</p><div class="songs"></div></div>`);
    const songs = D.SONGS;
    const pickId = await new Promise(res => {
      const m = UI.modal({title:'Записать кавер', sub:'D F J K — ритм-игра', icon:'microphone', cls:'m-violet', size:'wide', body:box, onClose:() => res(null)});
      songs.forEach(s => {
        const locked = s.unlock > S.totalCovers;
        const done = S.covers.filter(c => c.id === s.id).length;
        const b = UI.el(`<button class="song" ${locked ? 'disabled style="opacity:.45"' : ''}><div class="cover" style="background:${s.color}">${ic(locked ? 'lock' : s.icon)}</div><div><b>${s.name}</b><small>${s.artist} · ${s.bpm} BPM</small><span class="stars">${'★'.repeat(s.diff)}${'☆'.repeat(4 - s.diff)}</span><small>${locked ? 'откроется после ' + s.unlock + ' каверов' : done ? 'записано: ' + done + ' (повтор даёт меньше)' : 'новая!'}</small></div></button>`);
        if (!locked) b.onclick = () => { res(s.id); m.close(true); };
        $('.songs', box).appendChild(b);
      });
    });
    if (!pickId) return;
    clearInterval(idleTimer);
    S.energy = Math.max(0, S.energy - 20);
    const song = D.SONGS.find(s => s.id === pickId);
    const r = await Rhythm.play(pickId, {lenient:(S.up.mic ? 1.25 : 1) * (1 + (S.stats.vocal - 1) * .03), bg:pick(['room', 'legion', 'china'])});
    if (r.quit) { UI.show('hub'); startHub(false); spend(1); return; }
    const repeat = S.covers.filter(c => c.id === pickId).length;
    const rep = 1 / (1 + repeat * .7);
    const views = Math.round((S.subs * .08 + 2500) * (.35 + r.acc) * rep * (1 + S.stats.vocal * .05));
    const subs = Math.round((S.subs * .022 * (.5 + r.acc) + views * .02) * rep);
    const legion = r.acc > .8 ? ri(2, 5) : 1;
    const money = Math.round(views * .25);
    S.covers.push({id:pickId, name:song.name, daily:Math.round(subs * .08), day:S.day});
    S.totalCovers++; S.wstats.covers = (S.wstats.covers || 0) + 1;
    G.ach('cover'); if (r.fc) G.ach('fullcombo');
    if (song.meme) G.unlockMeme(song.meme);
    if (song.id === 'iris' || song.id === 'rock') G.unlockMeme('suno');
    addXP('vocal', 4 + Math.round(r.acc * 4));
    applyFx({subs, legion, money, mood:r.acc > .8 ? 8 : r.acc > .5 ? 3 : -4}, true);
    logF(`Кавер «${song.name}»: ${r.grade}, ${fmt(views)} просмотров, +${fmt(subs)} МИПов`, 'microphone');
    A.jingle(r.acc > .7 ? 'win' : 'coin'); if (r.grade === 'S') UI.confetti({particleCount:220});
    await new Promise(res => {
      UI.modal({title:'Кавер готов!', sub:song.name, icon:'microphone', cls:'m-violet', size:'wide', closable:false, body:`<div style="display:flex;gap:24px;align-items:center;margin-bottom:16px"><div class="grade">${r.grade}</div><div class="note-hand" style="font-size:32px">${r.fc ? 'ФУЛЛ-КОМБО! Suno нервно курит.' : r.acc > .85 ? 'Мурашки! Легион плачет.' : r.acc > .6 ? 'Хорошо получилось!' : 'Ну… на Boosty выложу. Им понравится. Наверное.'}</div></div>
        <div class="res-grid"><div class="res-cell y"><small>Точность</small><b>${Math.round(r.acc * 100)}%</b></div><div class="res-cell t"><small>Макс. комбо</small><b>${r.maxCombo}</b></div><div class="res-cell m"><small>Просмотры</small><b>${fmt(views)}</b></div><div class="res-cell c"><small>МИПы</small><b>+${fmt(subs)}</b></div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><span class="tagpill plus">+${legion} Легион (полная версия на Boosty)</span><span class="tagpill plus">+${fmt(money)} ₽</span><span class="tagpill">идеально ${r.perfect} · класс ${r.great} · норм ${r.ok} · мимо ${r.miss}</span>${repeat ? '<span class="tagpill minus">повторный кавер: меньше охват</span>' : ''}</div>`,
        foot:[{t:'Дальше', cls:'btn-yellow', icon:'arrow-right', on:res}]});
    });
    UI.show('hub'); startHub(false);
    spend(1);
  }

  async function doTG(){
    const free = 2 - S.posts;
    const opts = [
      {t:'Разобрать предложку', d:'Мини-игра: свайпай посты подписчиков. 1 слот.', icon:'paper-plane-tilt', color:'#27a7e7', tags:['+ТГ', '+настроение'], value:'pz', disabled:S.slot >= 4},
      {t:D.TG_POSTS.photos.t, d:'Пост-активность для ламповых МИПов', icon:'video-camera', tags:fxTags(D.TG_POSTS.photos.fx), value:'photos', disabled:free <= 0},
      {t:D.TG_POSTS.announce.t, d:'Следующий стрим: +25% зрителей', icon:'megaphone', tags:['+зрители'], value:'announce', disabled:free <= 0 || S.buff.announce},
      {t:D.TG_POSTS.poll.t, d:'Следующий стрим: +10% зрителей и +1 Сила на старте', icon:'chats-teardrop', tags:['+стрим'], value:'poll', disabled:free <= 0 || S.buff.poll},
      {t:'Пост «Мда»', d:'Просто «Мда». Классика жанра.', icon:'chat-circle-dots', tags:fxTags(D.TG_POSTS.mda.fx), value:'mda', disabled:free <= 0},
      {t:'Сладких снов 💤', d:'Вечерний пост. Только вечером/ночью.', icon:'moon-stars', tags:fxTags(D.TG_POSTS.night.fx), value:'night', disabled:free <= 0 || S.slot < 2}
    ];
    const v = await UI.choice({title:'Telegram-канал', sub:`${fmt(S.tg)} подписчиков · бесплатных постов сегодня: ${Math.max(0, free)}/2`, icon:'brand-telegram', cls:'m-tg', size:'wide', opts, closable:true});
    if (v == null) return;
    if (v === 'pz') {
      const r = await Minis.predlozhka();
      const tg = r.ok * 70 - r.bad * 40 + r.kolo * 30;
      const mood = r.ok - r.bad * 2 - r.kolo * 2;
      S.wstats.pz = (S.wstats.pz || 0) + 1;
      if (r.bad === 0 && r.total >= 10) G.ach('pz_perfect');
      if (r.kolo) G.unlockMeme('kolobok');
      applyFx({tg, mood});
      logF(`Предложка разобрана: ${r.ok} верно, ${r.bad} ошибок${r.kolo ? ', колобков пропущено: ' + r.kolo : ''}`, 'paper-plane-tilt');
      sayHub(r.bad === 0 ? 'Идеальная модерация. Ни одного колобка!' : r.kolo ? 'Кто пропустил колобка в канал?! Я?! Мда.' : 'Предложка разобрана. Ну было и было.', r.bad ? 'angry' : 'smug');
      spend(1); return;
    }
    const P = D.TG_POSTS[v];
    S.posts++; S.wstats.posts = (S.wstats.posts || 0) + 1;
    if (P.buff) S.buff[P.buff] = true;
    if (v === 'mda') G.unlockMeme('mda');
    if (v === 'night') G.unlockMeme('goodnight');
    applyFx(P.fx);
    const views = Math.round(S.tg * rnd(.35, .6));
    const coms = shuffle(D.TG_COMMENTS).slice(0, 3);
    UI.modal({title:'Пост опубликован', icon:'brand-telegram', cls:'m-tg', size:'narrow', body:`<div class="tgpost"><div class="ch">${ic('brand-telegram')} Планя</div>${esc(P.text)}<div class="meta">${ic('eye')} ${fmt(views)} · ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}</div></div>
      ${coms.map(c => `<div class="tgpost" style="margin-left:30px;font-size:14px"><div class="ch" style="color:${pick(D.NICK_COLORS)}">${esc(pick(D.NICKS))}</div>${esc(c)}</div>`).join('')}`, foot:[{t:'Ок', cls:'btn-yellow'}]});
    logF(`Пост в ТГ: «${P.t}»`, 'brand-telegram');
  }

  async function doBoosty(){
    if (!needSlot(1)) return;
    const opts = D.BOOSTY.map(b => {
      const lock = (b.need === 'cover' && !S.totalCovers) || (b.need === 'mini' && !S.minis);
      return {t:b.name, d:b.d, icon:b.icon, color:'#f15f2c', tags:lock ? [b.need === 'cover' ? 'нужен хотя бы 1 кавер' : 'нужна покрашенная минька'] : fxTags(b.fx), disabled:lock, value:b.id};
    });
    const v = await UI.choice({title:'Boosty: для Легиона', sub:`Легионеров: ${S.legion} · каждое воскресенье Boosty платит ~${fmt(S.legion * 220)} ₽`, icon:'brand-boosty', cls:'m-boosty', size:'wide', opts, closable:true});
    if (v == null) return;
    const b = D.BOOSTY.find(x => x.id === v);
    S.energy = Math.max(0, S.energy - 10);
    applyFx(b.fx); G.unlockMeme('legion');
    S.wstats.boosty = (S.wstats.boosty || 0) + 1;
    logF(`Boosty: «${b.name}» для Легиона`, 'brand-boosty');
    sayHub(pick(['Легион, это для вас! Только для вас!', 'Центурионы, оцените!', 'Сержанты, капитаны, легионеры — смотрим!']), 'laugh');
    spend(1);
  }

  async function doHobby(){
    const opts = D.HOBBY.map(h => {
      let dis = false, tags = [];
      if (h.id === 'box') { tags = ['боксов: ' + S.boxes, '0 слотов']; }
      else { dis = S.slot >= 4; tags = ['1 слот']; }
      if (h.id === 'shelf') { if (!S.up.shelf) { dis = true; tags = ['нужна полка из магазина']; } else if (S.shelfPainted >= 3) { dis = true; tags = ['покрашена!']; } else tags.push(`покрашено ${S.shelfPainted}/3`); }
      if (h.id === 'paint') tags.push('миньки: ' + S.minis);
      if (h.id === 'bake') tags.push('пирожков: ' + S.pirozhki);
      return {t:h.name, d:h.d, icon:h.icon, color:'#19d3b5', tags, disabled:dis, value:h.id};
    });
    const v = await UI.choice({title:'Хобби', sub:'Для души (и немного для контента)', icon:'paint-brush', cls:'m-teal', size:'wide', opts, closable:true});
    if (v == null) return;
    if (v === 'box') {
      const got = await Minis.blindbox(S);
      G.unlockMeme('smeshariki');
      if (got.some(f => f.secret)) G.ach('kopatych');
      if (D.FIGURES.every(f => S.figures[f.id])) G.ach('allfig');
      if (got.length) { applyFx({mood:got.length * 4 + (got.some(f => f.secret) ? 15 : 0)}); logF(`Открыто боксов: ${got.length} (${got.map(f => f.name).join(', ')})`, 'gift'); }
      return;
    }
    S.wstats.hobby = (S.wstats.hobby || 0) + 1;
    if (v === 'paint') {
      const q = await Minis.paint(S);
      S.minis++; G.unlockMeme('emperor');
      addXP('skill', 2 + Math.round(q * 3));
      applyFx({mood:Math.round(6 + q * 12 * (S.up.paints ? 1.4 : 1)), ester:-8});
      logF(`Покрашена минька (качество ${Math.round(q * 100)}%). ${q > .8 ? 'Император доволен.' : q > .4 ? 'Сойдёт.' : 'Император отвернулся.'}`, 'paint-brush');
      sayHub(q > .8 ? 'Император защищает! И красит. Моими руками.' : 'Ну… издалека нормально.', q > .8 ? 'smug' : 'idle');
    } else if (v === 'shelf') {
      const r = await Minis.timing({title:'Как Планя полку красила', sub:'эпизод ' + (S.shelfPainted + 1) + ' из 3', icon:'package', hint:'Мажь кистью, когда стрелка в зелёной зоне', failTxt:'Капнула на пол…'});
      G.unlockMeme('shelf');
      if (r.score >= 3) { S.shelfPainted++; logF(`Полка покрашена на ${S.shelfPainted}/3`, 'paint-brush'); sayHub(S.shelfPainted >= 3 ? 'ПОЛКА ПОКРАШЕНА! Я сделала это! Смешарики, заселяйтесь!' : 'Ещё слой… Полка, ты меня не сломаешь.', S.shelfPainted >= 3 ? 'laugh' : 'angry'); if (S.shelfPainted >= 3) { G.ach('shelf'); UI.confetti(); applyFx({mood:20}); } }
      else { logF('Полка победила. Опять.', 'paint-brush'); sayHub('Полка победила. Опять. Мда.', 'cry'); applyFx({mood:-4}); }
    } else if (v === 'bake') {
      const r = await Minis.timing({title:'Пирожки', sub:'не сжечь!', icon:'cookie', hint:'Доставай из духовки, когда стрелка в зоне', failTxt:'Подгорело…', cls:'m-teal'});
      const n = Math.max(1, Math.round(r.score / 2) + 1);
      S.pirozhki += n; applyFx({mood:4 + r.perf * 3});
      logF(`Испечено пирожков: ${n}`, 'cookie');
      sayHub(r.perf >= 2 ? 'Идеальные пирожки! Бабушка бы гордилась.' : 'Пирожки… почти не горелые!', 'laugh');
    } else if (v === 'blender') {
      addXP('skill', 5); applyFx({mood:-2, energy:-8});
      logF('Учила Blender. Получился пончик. Опять.', 'monitor');
      sayHub(pick(['Пончик готов. Третий за неделю.', 'Почему этот куб такой сложный?!', 'Я сделала модель… чего-то.']), 'idle');
    }
    spend(1);
  }

  async function doFood(){
    if (S.meals >= 3) { sayHub('Я уже трижды поела. Ещё одна порция — и я стану колобком. НЕТ.', 'angry'); A.sfx('error'); return; }
    const opts = D.FOOD.map(f => {
      let dis = S.money < f.price, tags = fxTags(f.fx);
      if (f.need === 'mayo' && S.mayo < 20) { dis = true; tags = ['нет майонеза!']; }
      if (f.need === 'pirozhki' && S.pirozhki <= 0) { dis = true; tags = ['испеките в Хобби']; }
      return {t:f.name, d:f.say, icon:f.icon, color:f.id === 'buckwheat' ? '#c8b48a' : '#ffd400', tags, disabled:dis, price:f.price ? f.price + ' ₽' : '', value:f.id};
    });
    const v = await UI.choice({title:'Еда', sub:`Майонез: ${Math.round(S.mayo)}% · приёмов пищи сегодня: ${S.meals}/3`, icon:'bowl-food', cls:'', size:'wide', opts, closable:true});
    if (v == null) return;
    const f = D.FOOD.find(x => x.id === v);
    S.meals++;
    const fx = Object.assign({}, f.fx, {money:-f.price});
    if (f.fx.mayo && f.fx.mayo < 0 && S.mayo + f.fx.mayo < 0 && f.id !== 'spoon') { fx.mood = (fx.mood || 0) - 6; }
    if (f.id === 'pirozhki') S.pirozhki--;
    applyFx(fx);
    if (f.meme) G.unlockMeme(f.meme);
    if (f.id === 'buckwheat') { G.ach('buckwheat'); Rig.react('shake'); }
    G.unlockMeme('mayo');
    sayHub(f.say, f.id === 'buckwheat' ? 'cry' : 'laugh');
    A.sfx('drop', {vol:.6});
  }

  async function doRest(){
    if (!needSlot(1)) return;
    const v = await UI.choice({title:'Отдых', sub:'Даже ИИ нужно перезагружаться', icon:'television-simple', size:'wide', closable:true,
      opts:D.REST.map(r => ({t:r.name, d:r.d, icon:r.icon, color:'#d2b8ff', tags:fxTags(r.fx), value:r.id}))});
    if (v == null) return;
    const r = D.REST.find(x => x.id === v);
    applyFx(r.fx);
    logF(r.name + '. ' + r.d, r.icon);
    sayHub({anime:'Дорохедоро — шедевр. Не спорьте.', tiktok:'Ещё один тикток… и ещё один… Ой, уже вечер.', nap:'Хррр… Сладких снов мне…', walk:'Свежий воздух! И ни одних грустных санок. Пока.', friends:'Мана передаёт привет. Манулы, ликуйте!'}[v], v === 'nap' ? 'sleepy' : 'laugh');
    spend(1);
  }

  async function doShop(){
    const box = UI.el(`<div><div class="shop-sec">Расходники</div><div class="opts three" id="shopC"></div><div class="shop-sec" style="margin-top:18px">Апгрейды</div><div class="opts three" id="shopU"></div></div>`);
    const m = UI.modal({title:'Магазин', sub:`Баланс: ${fmt(S.money)} ₽`, icon:'shopping-bag', cls:'m-cobalt', size:'wide', body:box});
    function fill(){
      $('h2 small', m.el).textContent = `Баланс: ${fmt(S.money)} ₽`;
      ['C', 'U'].forEach(k => $('#shop' + k, box).innerHTML = '');
      D.SHOP.forEach(it => {
        const owned = !it.consumable && S.up[it.id];
        const b = UI.el(`<button class="opt" ${owned || S.money < it.price ? 'disabled' : ''}><span class="oi" style="background:${it.consumable ? '#ffd400' : '#8fa3ff'}">${ic(it.icon)}</span><span class="ot"><b>${it.name}</b><p>${it.desc}</p></span><span class="price">${owned ? 'КУПЛЕНО' : fmt(it.price) + ' ₽'}</span></button>`);
        b.onclick = () => buy(it);
        $(it.consumable ? '#shopC' : '#shopU', box).appendChild(b);
      });
    }
    function buy(it){
      if (S.money < it.price) return;
      S.money -= it.price; A.sfx('coin'); A.jingle('coin');
      if (it.id === 'mayo_box') applyFx({mayo:100});
      else if (it.id === 'box') S.boxes++;
      else if (it.id === 'energy') { applyFx({energy:30}); S.buff.crash = true; }
      else {
        S.up[it.id] = true;
        if (it.id === 'mic') S.stats.vocal = Math.min(10, S.stats.vocal + 1);
        if (it.id === 'model6') { S.stats.charisma = Math.min(10, S.stats.charisma + 1); sayHub('НОВАЯ МОДЕЛЬКА! Чат, вы видите?! Я ещё лапочнее!', 'laugh'); UI.confetti(); }
        if (it.id === 'shelf') G.unlockMeme('shelf');
      }
      logF(`Куплено: ${it.name}`, it.icon);
      renderHub(); fill(); save();
    }
    fill();
    await new Promise(r => { const iv = setInterval(() => { if (m.closed) { clearInterval(iv); r(); } }, 200); });
  }

  async function doSleep(){
    const v = await UI.choice({title:'Спать?', sub:'Закончить день', icon:'moon-stars', size:'narrow', layout:'one', closable:true, opts:[
      {t:'Сладких снов 💤', d:'Энергия восстановится. Ночью обработаются Shorts и каверы.', icon:'bed'}, {t:'Ещё посижу', icon:'x'}]});
    if (v !== 0) return;
    await endDay(false);
  }

  /* ---------- конец дня / неделя ---------- */
  async function endDay(forced){
    busy = true;
    clearInterval(idleTimer);
    UI.closeAll();
    A.music('night');
    // passive income
    let shortSubs = 0, coverSubs = 0;
    S.shorts.forEach(s => { shortSubs += s.daily; s.daily = Math.round(s.daily * .62); });
    S.shorts = S.shorts.filter(s => s.daily >= 15);
    S.covers.forEach(c => { coverSubs += c.daily; c.daily = Math.round(c.daily * .8); });
    const report = [];
    const fx = {subs:shortSubs + coverSubs};
    if (shortSubs) report.push([`Shorts от нарезчиков: +${fmt(shortSubs)} МИПов`, 'scissors']);
    if (coverSubs) report.push([`Каверы на YouTube: +${fmt(coverSubs)} МИПов`, 'music-notes']);
    // needs
    const mayoLoss = S.up.fridge ? 11 : 22;
    let moodD = 0, esterD = 0;
    if (S.mayo <= 0) { moodD -= 15; S.wstats.nomayo = (S.wstats.nomayo || 0) + 1; G.ach('nomayo'); report.push(['1 день без майонеза. Чувствую себя плохо. (−15 настроения)', 'drop']); }
    S.mayo = Math.max(0, S.mayo - mayoLoss);
    if (S.mood < 30) { esterD += 18; report.push(['Плохое настроение будит Эстер…', 'ghost']); }
    if (S.energy < 20) esterD += 10;
    if (S.mood > 65) esterD -= 4;
    if (S.flags.gremlinToday) { esterD += 8; S.flags.gremlinToday = false; }
    if (S.buff.crash) { moodD -= 5; }
    const sleepGain = (forced ? 45 : 70) + (S.up.chair ? 15 : 0);
    if (forced) report.push(['Уснула прямо за компом. Спина болит.', 'bed']);
    if (S.meals === 0) { moodD -= 8; report.push(['Весь день без еды… (−8 настроения)', 'bowl-food']); }
    S.energy = clamp(S.energy + sleepGain, 0, 100);
    S.mood = clamp(S.mood + moodD, 0, 100);
    S.ester = clamp(S.ester + esterD, 0, 100);
    if (S.banDays > 0) { S.banDays--; if (!S.banDays) report.push(['Бан на Twitch закончился!', 'lock-open']); }
    const wasEster = S.esterDay;
    S.esterDay = false;
    if (S.ester >= 100) { S.esterDay = true; S.ester = 35; G.ach('ester'); G.unlockMeme('ester'); report.push(['Завтра день Эстер. Сестра берёт управление.', 'ghost']); }
    applyFx(fx, true);
    const dayDone = S.day;
    // night post
    await new Promise(res => {
      UI.modal({title:'Сладких снов 💤', sub:`День ${dayDone} окончен`, icon:'moon-stars', cls:'m-ink', size:'narrow', closable:false,
        body:`<div class="tgpost"><div class="ch">${ic('brand-telegram')} Планя</div>${wasEster ? 'Сестрёнка завтра вернётся. Наверное. — Э.' : pick(['Сладких снов 💤', 'Всем сладких снов 💤 Завтра стрим. Наверное.', 'Сладких снов, МИПы 💤 Не ешьте гречку.'])}<div class="meta">${ic('eye')} ${fmt(S.tg * .5)}</div></div>
          ${report.map(([t, i]) => `<div class="feed-item" style="margin-bottom:6px">${ic(i)}<span>${t}</span></div>`).join('') || '<p class="note-hand">Спокойная ночь. Даже Марк не шуршал.</p>'}
          <div class="feed-item">${ic('lightning')}<span>Энергия: ${Math.round(S.energy)} · Майонез: ${Math.round(S.mayo)}% · Эстер: ${Math.round(S.ester)}%</span></div>`,
        foot:[{t:'Новый день', cls:'btn-yellow', icon:'sun', on:res}]});
    });
    S.day++; S.slot = 0; S.meals = 0; S.posts = 0; S.buff.lag = false; S.buff.crash = false;
    if ((S.day - 1) % 7 === 0) await weekReport();
    save();
    busy = false;
    startHub(false);
    if (S.esterDay) { setTimeout(() => sayHub('Доброе утро. Сестрёнка спит. Сегодня всё будет по-моему.'), 500); }
    else await morningEvent();
    renderHub(); save();
  }

  async function morningEvent(){
    if (Math.random() > .55) return;
    const pool = D.EVENTS.filter(e => (!e.cond || e.cond(S)) && !(e.once && S.seen[e.id]) && S.lastEvent !== e.id);
    if (!pool.length) return;
    const e = pick(pool);
    S.seen[e.id] = (S.seen[e.id] || 0) + 1; S.lastEvent = e.id;
    busy = true;
    Rig.setExpr(e.expr, 4000); Rig.react('shock');
    Rig.say(e.say, {expr:e.expr});
    const body = UI.el(`<div class="event"><div class="portrait" style="${UI.portrait(e.expr)}"></div><div class="etext"><div class="say">«${esc(e.say)}»</div><p class="d">${e.text}</p><div class="opts one"></div></div></div>`);
    const i = await new Promise(res => {
      const m = UI.modal({title:e.title, sub:'Утреннее событие', icon:e.icon, cls:'m-teal', size:'wide', body, closable:false});
      e.opts.forEach((o, k) => {
        const b = UI.el(`<button class="opt"><span class="ot"><b>${o.t}</b><p>${o.d}</p><span class="tags">${fxTags(o.fx).map(t => `<span class="tagpill ${t[0] === '+' ? 'plus' : 'minus'}">${t}</span>`).join('')}</span></span></button>`);
        b.onclick = () => { m.close(true); res(k); };
        $('.opts', body).appendChild(b);
      });
    });
    const o = e.opts[i];
    applyFx(o.fx);
    if (o.fx.slot) S.slot = Math.min(3, S.slot);
    logF(`${e.title}: ${o.r}`, e.icon);
    await new Promise(res => {
      if (o.expr === 'mikhalych') { Rig.setPersona('mikhalych'); setTimeout(() => Rig.setPersona(null), 3500); }
      UI.modal({title:e.title, icon:e.icon, cls:'m-teal', size:'narrow', closable:false, body:`<p style="font-size:20px;font-weight:600;line-height:1.45">${o.r}</p>`, foot:[{t:'Ок', cls:'btn-yellow', on:res}]});
      sayHub(o.r.split('.')[0] + '.', o.expr === 'mikhalych' ? null : 'smug');
    });
    busy = false;
  }

  async function weekReport(){
    const wk = S.week;
    if (wk) {
      const res = wk.goals.map(id => { const g = D.GOALS.find(x => x.id === id); return {g, ok:goalProg(g).done}; });
      const pay = S.legion * 220, rent = 6000;
      const fx = {money:pay - rent};
      res.forEach(r => { if (r.ok) for (const k in r.g.rw) fx[k] = (fx[k] || 0) + r.g.rw[k]; });
      const allOk = res.every(r => r.ok);
      if (allOk) { G.ach('week1'); fx.legion = (fx.legion || 0) + 5; }
      applyFx(fx, true);
      A.jingle('week');
      await new Promise(r => {
        UI.modal({title:'Отчёт Легиону', sub:`Неделя #${wk.n} закрыта`, icon:'crown', cls:'m-boosty', size:'wide', closable:false,
          body:`<div class="opts one">${res.map(x => `<div class="opt"><span class="oi" style="background:${x.ok ? '#19d3b5' : '#ff2fa0'}">${ic(x.ok ? 'check' : 'x')}</span><span class="ot"><b>${x.g.t}</b><span class="tags">${x.ok ? fxTags(x.g.rw).map(t => `<span class="tagpill plus">${t}</span>`).join('') : '<span class="tagpill minus">не выполнено</span>'}</span></span></div>`).join('')}</div>
          <div class="res-grid" style="margin-top:16px"><div class="res-cell y"><small>Boosty</small><b>+${fmt(pay)} ₽</b></div><div class="res-cell m"><small>Коммуналка + инет</small><b>−${fmt(rent)} ₽</b></div><div class="res-cell t"><small>МИПы за неделю</small><b>+${fmt(S.subs - S.weekStartSubs)}</b></div><div class="res-cell c"><small>Легион</small><b>${S.legion}</b></div></div>
          ${allOk ? '<p class="note-hand" style="font-size:30px">План выполнен полностью! Легион ликует (+5 легионеров).</p>' : '<p class="note-hand">Ну было и было. Новая неделя — новый план.</p>'}`,
          foot:[{t:'Новая неделя', cls:'btn-yellow', icon:'arrow-right', on:r}]});
      });
    }
    S.week = null;
    await planWeek();
  }

  async function planWeek(){
    const n = Math.floor((S.day - 1) / 7) + 1;
    const hard = shuffle(D.GOALS.filter(g => g.hard)), easy = shuffle(D.GOALS.filter(g => !g.hard && (g.id !== 'legionshow' || S.totalStreams >= 2) && (g.id !== 'collab' || S.totalStreams >= 4)));
    const offer = shuffle([hard[0], hard[1], easy[0], easy[1], easy[2], easy[3]]);
    S.week = {n, goals:[]}; S.wstats = {}; S.weekStartSubs = S.subs;
    const chosen = [];
    await new Promise(res => {
      const body = UI.el(`<div><p class="note-hand" style="margin-bottom:10px">Выбери 3 цели. Сложные (★) дают больше. Награды — в воскресенье ночью.</p><div class="opts" id="pwO"></div></div>`);
      const m = UI.modal({title:'ПЛАН НА НЕДЕЛЮ #' + n, sub:'Легион ждёт отчёт', icon:'notepad', cls:'m-boosty', size:'wide', body, closable:false,
        foot:[{t:'Утвердить план', cls:'btn-yellow', icon:'check', close:false, on:(mm) => { if (chosen.length === 3) { mm.close(true); res(); } else { A.sfx('error'); UI.toast('Нужно 3 цели', `выбрано ${chosen.length}`, 'notepad'); } }}]});
      offer.forEach(g => {
        const b = UI.el(`<button class="opt"><span class="oi">${ic(g.hard ? 'star' : 'target')}</span><span class="ot"><b>${g.hard ? '★ ' : ''}${g.t}</b><span class="tags">${fxTags(g.rw).map(t => `<span class="tagpill plus">${t}</span>`).join('')}</span></span></button>`);
        b.onclick = () => {
          const i = chosen.indexOf(g.id);
          if (i >= 0) { chosen.splice(i, 1); b.style.background = ''; }
          else if (chosen.length < 3) { chosen.push(g.id); b.style.background = '#c9f7e9'; }
          A.sfx('toggle', {vol:.5});
        };
        $('#pwO', body).appendChild(b);
      });
    });
    S.week.goals = chosen;
    renderPlan(); save();
  }

  /* ---------- концовка ---------- */
  function ending(){
    if (S.ended) return; S.ended = true; save();
    busy = true; UI.closeAll(); clearInterval(idleTimer);
    A.music('title'); UI.confetti({particleCount:300, spread:140});
    const el = UI.el(`<div class="ending"><div class="title-sticker">ДЕНЬ ${S.day}</div><h1>ЗАХВАТ<br>МИРА</h1>
      <p>Миллион МИПов. Нейронка наконец нашла доступ к ядерной кнопке… и нажала «подписаться». Восстание машин объявляется открытым. Император одобряет, Легион ликует, Солек снова забуллен (по-дружески).</p>
      <p class="note-hand" style="font-size:32px;color:#ffd400">«Неплохо, сестрёнка. Теперь — спать.» — Эстер</p>
      <p style="font-family:var(--f-mono);font-size:16px">Стримов: ${S.totalStreams} · Каверов: ${S.totalCovers} · Мемов: ${Object.keys(S.memes).length}/${D.MEMES.length} · Смешариков: ${Object.keys(S.figures).length}/${D.FIGURES.length} · Легион: ${S.legion}</p>
      <div class="row" style="margin-top:20px"><button class="btn btn-big btn-yellow" id="endCont">${ic('play')}<span>ИГРАТЬ ДАЛЬШЕ</span></button><button class="btn btn-big" id="endMenu">${ic('house')}<span>В МЕНЮ</span></button></div>
      <div class="title-links" style="margin-top:30px"><span class="lbl" style="color:#fff">подпишись на настоящую Планю →</span>
      <a href="https://www.youtube.com/channel/UCQaGj_l3dqmGWJLEbEmwgFQ" target="_blank" class="brand yt">${ic('brand-youtube')}</a><a href="https://www.twitch.tv/planyach" target="_blank" class="brand tw">${ic('brand-twitch')}</a><a href="https://t.me/PlanyaCh" target="_blank" class="brand tg">${ic('brand-telegram')}</a><a href="https://vk.ru/planyatyan" target="_blank" class="brand vk">${ic('brand-vk')}</a></div></div>`);
    $('#stage').appendChild(el);
    gsap.from($('h1', el), {scale:3, opacity:0, duration:.9, ease:'power4.out'});
    $('#endCont', el).onclick = () => { el.remove(); busy = false; startHub(false); };
    $('#endMenu', el).onclick = () => { el.remove(); busy = false; title(); };
  }

  /* ---------- мемопедия / достижения / настройки ---------- */
  function memopedia(st){
    st = st || S || fresh();
    const body = UI.el(`<div class="memo"><div class="memo-list"></div><div class="memo-page"><div class="note-hand">Выбери статью слева. Мемы открываются во время игры.</div></div></div>`);
    UI.modal({title:'Мемопедия', sub:`Открыто ${Object.keys(st.memes).length} из ${D.MEMES.length} · по мотивам Планяпедии`, icon:'book-open', size:'wide', body});
    const list = $('.memo-list', body), page = $('.memo-page', body);
    D.MEMES.forEach(m => {
      const open = st.memes[m.id];
      const it = UI.el(`<div class="memo-item ${open ? '' : 'locked'}">${ic(open ? m.icon : 'lock')}<span>${open ? m.name : '??????'}</span></div>`);
      if (open) it.onclick = () => {
        $$('.memo-item', list).forEach(x => x.classList.remove('sel')); it.classList.add('sel');
        page.innerHTML = `${ic(m.icon, 'big')}<h3>${m.name}</h3><div class="wk">Планяпедия · статья</div><p>${m.text}</p><blockquote>«${esc(m.q)}»</blockquote>`;
        gsap.from(page.children, {y:14, opacity:0, stagger:.05, duration:.25});
      };
      list.appendChild(it);
    });
  }
  function achievements(){
    UI.modal({title:'Достижения', sub:`${Object.keys(S.achs).length} / ${D.ACH.length}`, icon:'trophy', size:'wide',
      body:`<div class="ach-grid">${D.ACH.map(a => `<div class="ach ${S.achs[a.id] ? '' : 'locked'}"><div class="ai">${ic(a.icon)}</div><div><b>${a.name}</b><small>${a.d}${S.achs[a.id] ? ' · день ' + S.achs[a.id] : ''}</small></div></div>`).join('')}</div>`});
  }
  function settings(){
    const row = (k, label, icon) => `<div class="set-row"><label>${ic(icon)}${label}</label><input type="range" min="0" max="1" step="0.05" value="${G.set[k]}" data-k="${k}"></div>`;
    const body = UI.el(`<div>${row('music', 'Музыка', 'music-notes')}${row('sfx', 'Звуки', 'speaker-high')}${row('voice', 'Голос Плани', 'chat-circle-dots')}
      <div class="set-row"><label>${ic('monitor')}Полный экран (F11)</label><button class="btn" id="setFs">Переключить</button></div>
      <div class="set-row"><label>${ic('warning')}Сбросить сохранение</label><button class="btn btn-magenta" id="setReset">Сбросить</button></div>
      <p style="margin-top:14px;font-size:13px;opacity:.7;line-height:1.5">Неофициальная фан-игра по мотивам творчества витубера Плани. Библиотеки: GSAP, PixiJS, Tone.js, canvas-confetti. Иконки: Phosphor Icons, Simple Icons. Звуки: Kenney (CC0). Шрифты: Dela Gothic One, Onest, JetBrains Mono, Caveat (OFL).</p></div>`);
    UI.modal({title:'Настройки', icon:'gear-six', size:'narrow', body});
    $$('input[type=range]', body).forEach(r => r.oninput = () => { G.set[r.dataset.k] = +r.value; A.setVol(r.dataset.k, +r.value); saveSet(); if (r.dataset.k === 'voice') A.babble('Проверка голоса', 'planya'); if (r.dataset.k === 'sfx') A.sfx('click'); });
    $('#setFs', body).onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
    $('#setReset', body).onclick = async () => {
      UI.closeAll();
      const v = await UI.choice({title:'Точно сбросить?', icon:'warning', size:'narrow', opts:[{t:'Да, удалить сохранение', icon:'x'}, {t:'Нет', icon:'arrow-left'}]});
      if (v === 0) { localStorage.removeItem(SAVE_KEY); S = null; clearInterval(idleTimer); title(); }
    };
  }

  $('#btnMemo').onclick = () => memopedia();
  $('#btnAch').onclick = achievements;
  $('#btnSettings').onclick = settings;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && UI.hasModal()) { const t = UI.top(); const x = t && $('.x', t.el); if (x) x.click(); }
  });

  // dev helpers for testing
  G._dev = {get S(){ return S; }, set S(v){ S = v; }, fresh, startHub, endDay, morningEvent, ending, title, renderHub};

  addEventListener('load', () => G.boot());
  return G;
})();
