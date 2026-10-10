/* ====== Мини-игры: предложка, блайнд-боксы, покрас, тайминг ====== */
window.Minis = (function(){
  const M = {};

  /* ---------- Смешарик (SVG) ---------- */
  M.figSVG = function(f){
    const c = f.color, d = 'stroke="#121018" stroke-width="3"';
    let ears = '';
    switch (f.ears) {
      case 'long': ears = `<ellipse cx="36" cy="16" rx="7" ry="20" fill="${c}" ${d}/><ellipse cx="64" cy="16" rx="7" ry="20" fill="${c}" ${d}/>`; break;
      case 'spike': ears = [20,32,44,56,68,80].map((x, i) => `<polygon points="${x - 8},${34 + Math.abs(i - 2.5) * 3} ${x},${12 + Math.abs(i - 2.5) * 4} ${x + 8},${34 + Math.abs(i - 2.5) * 3}" fill="#7b3fbf" ${d}/>`).join(''); break;
      case 'pig': ears = `<polygon points="26,30 30,10 44,24" fill="${c}" ${d}/><polygon points="74,30 70,10 56,24" fill="${c}" ${d}/>`; break;
      case 'horn': ears = `<path d="M24 34 q-14 -6 -6 -22 q10 -4 14 12" fill="#e6dcff" ${d}/><path d="M76 34 q14 -6 6 -22 q-10 -4 -14 12" fill="#e6dcff" ${d}/>`; break;
      case 'antler': ears = `<path d="M30 28 l-10 -18 m4 8 l-10 0 m14 -2 l-2 -12" fill="none" ${d}/><path d="M70 28 l10 -18 m-4 8 l10 0 m-14 -2 l2 -12" fill="none" ${d}/>`; break;
      case 'owl': ears = `<polygon points="24,34 22,10 40,26" fill="${c}" ${d}/><polygon points="76,34 78,10 60,26" fill="${c}" ${d}/>`; break;
      case 'bear': ears = `<circle cx="26" cy="24" r="10" fill="${c}" ${d}/><circle cx="74" cy="24" r="10" fill="${c}" ${d}/>`; break;
      case 'antenna': ears = `<line x1="50" y1="20" x2="50" y2="4" ${d}/><circle cx="50" cy="4" r="5" fill="#ff2fa0" ${d}/>`; break;
      default: ears = '';
    }
    const beak = f.ears === 'beak' || f.ears === 'owl' ? `<polygon points="44,60 56,60 50,72" fill="#ffb02e" ${d}/>` : `<path d="M40 66 q10 9 20 0" fill="none" ${d}/>`;
    const extra = f.id === 'kopatych' ? `<rect x="38" y="80" width="24" height="8" fill="#3a7d2a" ${d}/>` : f.id === 'nyusha' ? `<ellipse cx="50" cy="62" rx="9" ry="6" fill="#ff6fae" ${d}/>` : '';
    return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">${ears}<circle cx="50" cy="56" r="34" fill="${c}" ${d}/>
      <ellipse cx="39" cy="50" rx="8" ry="10" fill="#fff" ${d}/><ellipse cx="61" cy="50" rx="8" ry="10" fill="#fff" ${d}/>
      <circle cx="${40}" cy="52" r="3.5" fill="#121018"/><circle cx="${60}" cy="52" r="3.5" fill="#121018"/>${beak}${extra}
      ${f.secret ? '<text x="50" y="98" text-anchor="middle" font-size="11" font-weight="800" fill="#ff2fa0">СЕКРЕТ</text>' : ''}</svg>`;
  };

  M.shelfHTML = function(S){
    const painted = S.shelfPainted >= 3;
    if (!S.up.shelf) return `<div class="note-hand" style="padding:10px">Полки нет. Фигурки лежат кучей на столе. Купите полку в магазине.</div>`;
    return `<div class="shelf ${painted ? '' : 'unpainted'}">${D.FIGURES.map(f => `<div class="fig ${S.figures[f.id] ? '' : 'missing'}">${M.figSVG(f)}<span>${S.figures[f.id] ? f.name + (S.figures[f.id] > 1 ? ' ×' + S.figures[f.id] : '') : '???'}</span></div>`).join('')}</div>
      ${painted ? '' : `<div class="note-hand" style="margin-top:6px">Полка не покрашена (${S.shelfPainted}/3). Планя обещала докрасить. Когда-нибудь.</div>`}`;
  };

  M.rollFigure = function(){
    const tot = D.FIGURES.reduce((a, f) => a + f.w, 0);
    let r = Math.random() * tot;
    for (const f of D.FIGURES) { r -= f.w; if (r <= 0) return f; }
    return D.FIGURES[0];
  };

  M.blindbox = function(S){
    return new Promise(res => {
      const body = UI.el(`<div><div class="mini-wrap" style="height:330px">
        <div class="bb-box" id="bbBox">${boxSVG()}</div>
        <div class="mini-info" id="bbInfo">Кликай по коробке, чтобы открыть! (боксов: ${S.boxes})</div></div>
        <div id="bbShelf">${M.shelfHTML(S)}</div></div>`);
      let opening = false, clicks = 0, got = [];
      const m = UI.modal({title:'Блайнд-боксы Смешариков', sub:'КОПАТЫЧ, ГДЕ ТЫ?', icon:'gift', cls:'m-magenta', size:'wide', body, onClose:() => res(got)});
      const box = $('#bbBox', body);
      box.onclick = () => {
        if (opening) return;
        if (S.boxes <= 0) { $('#bbInfo', body).textContent = 'Боксы закончились. Магазин → «Блайнд-бокс».'; A.sfx('error'); gsap.fromTo(box, {x:-8}, {x:0, duration:.4, ease:'elastic.out(1,.2)'}); return; }
        clicks++;
        A.sfx('drop', {rate:1 + clicks * .15});
        gsap.fromTo(box, {rotation:clicks % 2 ? -8 : 8, scale:1 + clicks * .04}, {rotation:0, duration:.35, ease:'elastic.out(1,.3)'});
        if (clicks < 3) return;
        opening = true; clicks = 0; S.boxes--;
        const f = M.rollFigure(); const isNew = !S.figures[f.id];
        S.figures[f.id] = (S.figures[f.id] || 0) + 1; got.push(f);
        gsap.timeline()
          .to(box, {scale:1.25, rotation:4, duration:.2})
          .to(box, {scale:0, rotation:-30, duration:.25, ease:'back.in(2)', onComplete:() => {
            box.innerHTML = `<div style="width:300px;height:300px">${M.figSVG(f)}</div>`;
            A.sfx(f.secret ? 'power2' : 'confirm'); A.jingle(f.secret ? 'level' : 'coin');
            if (f.secret || isNew) UI.confetti({origin:{y:.4}, particleCount:f.secret ? 260 : 90});
            $('#bbInfo', body).innerHTML = `${f.secret ? '<b style="color:#ff2fa0">СЕКРЕТНЫЙ КОПАТЫЧ!!!</b> ' : ''}${f.name}${isNew ? ' — новая!' : ' — дубликат (×' + S.figures[f.id] + ')'} · боксов осталось: ${S.boxes}`;
            $('#bbShelf', body).innerHTML = M.shelfHTML(S);
            if (Rig.ready) Rig.say(f.secret ? 'КОПАТЫЧ! КОПАТЫЧ!!! Я ЕГО ВЫБИЛА!' : isNew ? 'О, ' + f.name + '! Новенький!' : 'Опять ' + f.name + '… Мда.', {expr:f.secret ? 'shock' : isNew ? 'laugh' : 'idle'});
          }})
          .to(box, {scale:1, rotation:0, duration:.5, ease:'back.out(2)'})
          .add(() => { setTimeout(() => { box.innerHTML = boxSVG(); opening = false; }, 1600); });
      };
    });
    function boxSVG(){
      return `<svg viewBox="0 0 200 200" style="width:300px;height:300px"><polygon points="30,70 100,40 170,70 100,100" fill="#ffd400" stroke="#121018" stroke-width="5"/>
      <polygon points="30,70 100,100 100,185 30,155" fill="#ff2fa0" stroke="#121018" stroke-width="5"/><polygon points="170,70 100,100 100,185 170,155" fill="#2a4bff" stroke="#121018" stroke-width="5"/>
      <text x="65" y="140" font-family="Dela Gothic One" font-size="34" fill="#fff" stroke="#121018" stroke-width="2" transform="skewY(22) translate(-8,-64)">?</text>
      <text x="128" y="125" font-family="Dela Gothic One" font-size="16" fill="#ffd400" transform="skewY(-22) translate(0,56)">BLIND</text></svg>`;
    }
  };

  /* ---------- Предложка (свайпы) ---------- */
  function pzPic(it){
    const S = window.SPRITES;
    switch (it.kind) {
      case 'art': {
        const map = {pixel:'idle', sketch:'smug', pop:'laugh', neon:'idle', gremlin:'gremlin', ester:'ester'};
        const k = map[it.style];
        if (it.style === 'pixel') return `<div style="position:absolute;inset:0;background:#7ad7ff"></div><canvas class="pxart" data-k="${k}" style="position:relative;height:100%;image-rendering:pixelated"></canvas>`;
        const st = {sketch:'filter:grayscale(1) contrast(1.8) brightness(1.15);', pop:'filter:saturate(2.2) contrast(1.2) drop-shadow(8px 8px 0 #121018);', neon:'filter:hue-rotate(150deg) saturate(1.8) drop-shadow(0 0 10px #ff2fa0);', gremlin:'filter:saturate(1.3);', ester:''}[it.style];
        const bg = {sketch:'#f4efe6 repeating-linear-gradient(0deg,transparent 0 22px,#cfd8e3 22px 23px)', pop:'#ff2fa0 radial-gradient(#ffd400 2px,transparent 2.5px) 0 0/12px 12px', neon:'#14002a', gremlin:'#7dff8a', ester:'#2a0c22'}[it.style];
        return `<div style="position:absolute;inset:0;background:${bg}"></div><img src="${S[k]}" style="position:relative;height:118%;margin-top:22%;${st}">`;
      }
      case 'kolobok':
        return `<div style="position:absolute;inset:0;background:#9ad4ff"></div><div style="position:absolute;left:50%;bottom:-10px;width:420px;height:40px;margin-left:-210px;background:#6cbf4a;border-top:3px solid #121018"></div>
          <div style="position:relative;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe98a,#f2b72f 70%);border:4px solid #121018;display:grid;place-items:center;box-shadow:6px 6px 0 #121018">
          <div style="width:150px;height:150px;border-radius:50%;border:3px solid #121018;${UI.faceStyle('smug', 150)}"></div></div>`;
      case 'bot':
        return `<div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,#ffecec 0 20px,#fff 20px 40px)"></div><div style="position:relative;font-family:var(--f-mono);font-weight:800;font-size:26px;color:#e00;text-align:center;padding:20px">${ic('warning')}<br>$$$ 300% $$$<br><span style="font-size:16px">ПЕРЕХОДИ ПО ССЫЛКЕ</span></div>`;
      case 'meme':
        return `<div style="position:absolute;inset:0;background:#121018"></div><img src="${S[pick(['shock','angry','smug','cry'])]}" style="position:absolute;height:150%;top:-6%;left:50%;transform:translateX(-50%)">
          <div style="position:absolute;left:0;right:0;bottom:12px;text-align:center;font-family:var(--f-head);font-size:30px;color:#fff;-webkit-text-stroke:2px #121018;padding:0 10px;line-height:1">${it.text}</div>`;
      case 'chair':
        return `<div style="position:absolute;inset:0;background:#e9e1d1"></div><svg viewBox="0 0 100 100" style="position:relative;width:60%;height:60%"><g fill="#a0703c" stroke="#121018" stroke-width="3"><rect x="28" y="12" width="44" height="40"/><rect x="24" y="52" width="52" height="10"/><rect x="26" y="62" width="6" height="32"/><rect x="68" y="62" width="6" height="32"/></g></svg>`;
      case 'photo':
        return `<div style="position:absolute;inset:0;background:${pick(['#19d3b5','#ffd400','#8fa3ff','#ff7a1a'])}"></div><div style="position:relative;font-size:160px;color:#121018">${ic(it.icon)}</div>`;
      case 'leak':
        return `<div style="position:absolute;inset:0;background:#333"></div><div style="position:relative;width:200px;height:260px;border-radius:50% 50% 40% 40%;background:#888;filter:blur(14px)"></div><div style="position:absolute;font-family:var(--f-head);font-size:60px;color:#fff">???</div>`;
      case 'bad':
        return `<div style="position:absolute;inset:0;background:#c8b48a"></div><div style="position:relative;font-size:170px;color:#6b4a1f">${ic(it.icon)}</div>`;
    }
    return '';
  }
  function drawPixel(cv){
    const img = new Image(); img.onload = () => {
      cv.width = 44; cv.height = 66; const c = cv.getContext('2d'); c.imageSmoothingEnabled = true;
      c.drawImage(img, 0, 0, 640, 953, 0, 0, 44, 66);
    }; img.src = SPRITES[cv.dataset.k];
  }

  M.predlozhka = function(){
    return new Promise(res => {
      const pool = shuffle(D.PZ).slice(0, 14);
      const TIME = 35;
      let idx = 0, ok = 0, bad = 0, kolo = 0, timeLeft = TIME, over = false, timer;
      const body = UI.el(`<div><div class="pz-hud"><span>${ic('clock')} <b id="pzT">${TIME}</b> c</span><span>Верно: <b id="pzOk">0</b> · Ошибки: <b id="pzBad">0</b></span><span>Осталось: <b id="pzLeft">${pool.length}</b></span></div>
        <div class="pz"><div class="pz-side no"><div class="k">${ic('x')}</div><br>ОТКЛОНИТЬ<br><span class="kbd">←</span> <span class="kbd">A</span></div>
        <div class="pz-stack" id="pzStack"></div>
        <div class="pz-side yes"><div class="k">${ic('check')}</div><br>В КАНАЛ<br><span class="kbd">→</span> <span class="kbd">D</span></div></div>
        <div style="text-align:center;font-family:var(--f-hand);font-size:24px">Фан-арты и мемы — в канал. Колобков, ботов, «сливы» и гречку — в бан.</div></div>`);
      const m = UI.modal({title:'Разобрать предложку', sub:'👤 посты от подписчиков · свайпай карточки', icon:'paper-plane-tilt', cls:'m-tg', size:'wide', body, closable:false});
      const stack = $('#pzStack', body);
      function render(){
        stack.innerHTML = '';
        for (let j = Math.min(pool.length - 1, idx + 2); j >= idx; j--) {
          const it = pool[j];
          const nick = pick(D.NICKS);
          const c = UI.el(`<div class="pz-card"><div class="from"><span class="av" style="background:${pick(D.NICK_COLORS)}">${ic('user-plus')}</span>👤 ${esc(nick)}</div>
            <div class="pic">${pzPic(it)}</div><div class="cap">${esc(it.cap)}</div><div class="pz-stamp yes">В КАНАЛ</div><div class="pz-stamp no">БАН</div></div>`);
          const off = j - idx;
          gsap.set(c, {y:off * 12, scale:1 - off * .04, rotation:off ? (j % 2 ? 2 : -2) : 0, zIndex:10 - off});
          stack.appendChild(c);
          $$('.pxart', c).forEach(drawPixel);
          if (off === 0) bindTop(c, it);
        }
      }
      function bindTop(c, it){
        const yes = $('.pz-stamp.yes', c), no = $('.pz-stamp.no', c);
        Draggable.create(c, {type:'x,y', onDrag(){ const x = this.x; gsap.set(c, {rotation:x / 18}); yes.style.opacity = clamp(x / 120, 0, 1); no.style.opacity = clamp(-x / 120, 0, 1); },
          onRelease(){ if (Math.abs(this.x) > 120) decide(this.x > 0); else { gsap.to(c, {x:0, y:0, rotation:0, duration:.4, ease:'back.out(2)'}); yes.style.opacity = no.style.opacity = 0; } }});
        c._decide = decide;
        function decide(approve){
          if (over || c._done) return; c._done = true;
          Draggable.get(c) && Draggable.get(c).kill();
          (approve ? yes : no).style.opacity = 1;
          gsap.to(c, {x:approve ? 700 : -700, rotation:approve ? 30 : -30, opacity:0, duration:.35, ease:'power2.in'});
          const right = approve === it.good;
          if (right) { ok++; A.sfx(approve ? 'confirm' : 'toggle', {vol:.6}); }
          else {
            bad++; A.sfx('error', {vol:.6});
            gsap.fromTo(stack, {x:-12}, {x:0, duration:.4, ease:'elastic.out(1,.2)'});
          }
          if (approve && it.kind === 'kolobok') { kolo++; Rig.ready && Rig.say('Ещё одна фотожаба с колобком — и я за себя не отвечаю!', {expr:'angry'}); }
          if (approve && it.kind === 'bad') Rig.ready && Rig.say('ГРЕЧКА?! В МОЁМ КАНАЛЕ?!', {expr:'angry'});
          if (approve && it.kind === 'leak') Rig.ready && Rig.say('Это не моё лицо! У меня вообще нет лица! Я ИИ!', {expr:'shock'});
          if (approve && it.meme) G.unlockMeme(it.meme);
          $('#pzOk', body).textContent = ok; $('#pzBad', body).textContent = bad;
          idx++; $('#pzLeft', body).textContent = pool.length - idx;
          if (idx >= pool.length) return finish();
          setTimeout(render, 200);
        }
      }
      function key(e){
        if (over) return;
        const top = stack.lastElementChild;
        if (!top || !top._decide) return;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'в' || e.key === 'D') top._decide(true);
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ф' || e.key === 'A') top._decide(false);
      }
      document.addEventListener('keydown', key);
      timer = setInterval(() => { timeLeft--; $('#pzT', body).textContent = timeLeft; if (timeLeft <= 5) A.sfx('click2', {vol:.4}); if (timeLeft <= 0) finish(); }, 1000);
      function finish(){
        if (over) return; over = true; clearInterval(timer); document.removeEventListener('keydown', key);
        setTimeout(() => { m.close(true); res({ok, bad, total:idx, kolo}); }, 500);
      }
      render();
    });
  };

  /* ---------- Покрас минек (ведение кисти по контуру) ---------- */
  M.paint = function(S){
    return new Promise(res => {
      const shapes = [
        {name:'Шлем Императора', f:(a) => 1 + .16 * Math.sin(3 * a + .5) + .08 * Math.sin(5 * a)},
        {name:'Аквила', f:(a) => 1 + .3 * Math.abs(Math.sin(2 * a)) - .12 * Math.cos(4 * a)},
        {name:'Наплечник', f:(a) => 1 + .22 * Math.cos(2 * a) + .06 * Math.sin(7 * a)}
      ];
      const sh = pick(shapes);
      const W = 760, Hh = 440, pts = [];
      for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2 - Math.PI / 2; const r = 160 * sh.f(a); pts.push({x:W / 2 + Math.cos(a) * r * 1.25, y:Hh / 2 + Math.sin(a) * r * .95}); }
      const paints = ['#ffd400', '#2a4bff', '#ff2fa0', '#19d3b5', '#c0392b'];
      const color = pick(paints);
      const TIME = S.up.paints ? 16 : 13;
      const body = UI.el(`<div class="mini-wrap"><div class="mini-info">${sh.name}: зажми кнопку мыши и веди кисть по пунктиру · <b id="ptT">${TIME}</b> c</div>
        <canvas class="mini-canvas" width="${W}" height="${Hh}"></canvas><div class="mini-info" id="ptP">Прогресс: 0%</div></div>`);
      const m = UI.modal({title:'Покрас минек', sub:'Император смотрит. Не дрожи.', icon:'paint-brush', cls:'m-teal', size:'wide', body, closable:false});
      const cv = $('canvas', body), c = cv.getContext('2d');
      let prog = 0, off = 0, on = 0, down = false, mouse = null, tl = TIME, over = false, started = false;
      function draw(){
        c.clearRect(0, 0, W, Hh);
        c.fillStyle = '#f6f1e7'; c.fillRect(0, 0, W, Hh);
        c.lineWidth = 34; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#ddd5c4';
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
        c.setLineDash([6, 10]); c.lineWidth = 3; c.strokeStyle = '#121018'; c.stroke(); c.setLineDash([]);
        if (prog > 0) { c.lineWidth = 26; c.strokeStyle = color; c.beginPath(); for (let i = 0; i <= prog; i++) { const p = pts[i]; i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.stroke(); }
        const nx = pts[Math.min(prog + 1, pts.length - 1)];
        c.fillStyle = '#ff2fa0'; c.beginPath(); c.arc(nx.x, nx.y, 9, 0, 7); c.fill(); c.lineWidth = 3; c.strokeStyle = '#121018'; c.stroke();
        if (mouse) { c.fillStyle = down ? color : 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(mouse.x, mouse.y, 8, 0, 7); c.fill(); c.stroke(); }
      }
      function pos(e){ const r = cv.getBoundingClientRect(); return {x:(e.clientX - r.left) / r.width * W, y:(e.clientY - r.top) / r.height * Hh}; }
      cv.addEventListener('pointerdown', e => { down = true; started = true; mouse = pos(e); });
      window.addEventListener('pointerup', up);
      function up(){ down = false; }
      cv.addEventListener('pointermove', e => {
        mouse = pos(e); if (!down || over) return;
        let adv = false;
        for (let k = 1; k <= 4; k++) {
          const p = pts[Math.min(prog + k, pts.length - 1)];
          if (Math.hypot(p.x - mouse.x, p.y - mouse.y) < 24) { prog = Math.min(prog + k, pts.length - 1); adv = true; if (prog % 6 === 0) A.sfx('pluck', {vol:.25, rate:.8 + prog / 120}); break; }
        }
        const dmin = Math.min(...pts.slice(Math.max(0, prog - 3), prog + 5).map(p => Math.hypot(p.x - mouse.x, p.y - mouse.y)));
        if (dmin > 30) off++; else on++;
        $('#ptP', body).textContent = 'Прогресс: ' + Math.round(prog / (pts.length - 1) * 100) + '%';
        if (prog >= pts.length - 1) finish();
      });
      setTimeout(() => started = true, 2500);
      const iv = setInterval(() => { if (!started) return; tl--; $('#ptT', body).textContent = tl; if (tl <= 0) finish(); }, 1000);
      let raf; (function loop(){ draw(); if (!over) raf = requestAnimationFrame(loop); })();
      function finish(){
        if (over) return; over = true; clearInterval(iv); window.removeEventListener('pointerup', up);
        const q = clamp(prog / (pts.length - 1) * (1 - off / Math.max(1, on + off) * .8), 0, 1);
        A.sfx(q > .7 ? 'confirm' : 'error'); if (q > .85) UI.confetti({particleCount:70});
        $('#ptP', body).innerHTML = `<b>Качество покраса: ${Math.round(q * 100)}%</b> — ${q > .85 ? 'Император доволен!' : q > .5 ? 'Сойдёт для Легиона.' : 'Ну… было и было.'}`;
        setTimeout(() => { m.close(true); res(q); }, 1500);
      }
    });
  };

  /* ---------- Тайминг-бар (пирожки / полка) ---------- */
  M.timing = function(o){
    return new Promise(res => {
      const rounds = o.rounds || 3;
      const body = UI.el(`<div class="mini-wrap"><div class="mini-info">${o.hint}</div>
        <div style="font-size:120px" id="tmIco">${ic(o.icon)}</div>
        <div class="timing"><div class="zone"></div><div class="zone p"></div><div class="needle"></div></div>
        <div class="mini-info" id="tmInfo">Раунд 1/${rounds} · <span class="kbd">ПРОБЕЛ</span> или клик</div></div>`);
      const m = UI.modal({title:o.title, sub:o.sub, icon:o.icon, cls:o.cls || 'm-teal', size:'wide', body, closable:false});
      const zone = $('.zone', body), pz = $('.zone.p', body), needle = $('.needle', body);
      let r = 0, score = 0, perf = 0, x = 0, dir = 1, speed = .9, zc, zw, over = false, lock = false;
      function setup(){ zw = .22 - r * .05; zc = rnd(.2 + zw / 2, .8 - zw / 2); zone.style.left = (zc - zw / 2) * 100 + '%'; zone.style.width = zw * 100 + '%'; pz.style.left = (zc - zw / 6) * 100 + '%'; pz.style.width = zw / 3 * 100 + '%'; speed = .8 + r * .35; }
      setup();
      let last = performance.now();
      (function loop(now){
        if (over) return;
        const dt = (now - last) / 1000; last = now;
        if (!lock) { x += dir * speed * dt; if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; } }
        needle.style.left = x * 100 + '%';
        requestAnimationFrame(loop);
      })(last);
      function hit(){
        if (over || lock) return;
        const d = Math.abs(x - zc); lock = true;
        let txt;
        if (d < zw / 6) { score += 2; perf++; txt = 'ИДЕАЛЬНО!'; A.sfx('power', {vol:.6}); }
        else if (d < zw / 2) { score += 1; txt = 'Норм'; A.sfx('confirm', {vol:.6}); }
        else { txt = o.failTxt || 'Мимо…'; A.sfx('error', {vol:.6}); }
        gsap.fromTo($('#tmIco', body), {scale:1.3, rotation:-10}, {scale:1, rotation:0, duration:.5, ease:'elastic.out(1,.3)'});
        r++;
        $('#tmInfo', body).innerHTML = `${txt} · ${r < rounds ? `Раунд ${r + 1}/${rounds}` : 'Готово!'}`;
        setTimeout(() => { lock = false; if (r >= rounds) finish(); else setup(); }, 650);
      }
      function key(e){ if (e.code === 'Space') { e.preventDefault(); hit(); } }
      document.addEventListener('keydown', key);
      $('.timing', body).addEventListener('pointerdown', hit);
      $('#tmIco', body).addEventListener('pointerdown', hit);
      function finish(){ over = true; document.removeEventListener('keydown', key); setTimeout(() => { m.close(true); res({score, perf, max:rounds * 2}); }, 500); }
    });
  };
  return M;
})();
