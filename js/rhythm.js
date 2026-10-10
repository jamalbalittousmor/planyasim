/* ====== Ритм-игра (каверы) ====== */
window.Rhythm = (function(){
  const R = {};
  const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  const LANE_COL = ['#ff2fa0', '#19d3b5', '#ffd400', '#2a4bff'];
  const LANE_LBL = ['D', 'F', 'J', 'K'];

  function chartFrom(built, diff){
    const notes = built.notes.filter(n => diff >= 3 || !n.grace).filter(n => diff >= 2 || n.idx % 2 === 0);
    const out = [];
    let prevLane = 1, prevMidi = null;
    notes.forEach(n => {
      let lane;
      if (prevMidi == null) lane = 1;
      else if (n.midi > prevMidi) lane = Math.min(3, prevLane + (n.midi - prevMidi > 4 ? 2 : 1));
      else if (n.midi < prevMidi) lane = Math.max(0, prevLane - (prevMidi - n.midi > 4 ? 2 : 1));
      else lane = prevLane === 1 ? 2 : prevLane === 2 ? 1 : (prevLane + 2) % 4;
      prevLane = lane; prevMidi = n.midi;
      out.push({t:n.t, lane, hit:false, judged:false});
      if (diff >= 3 && n.sec === 'chorus' && n.idx === 0) out.push({t:n.t, lane:(lane + 2) % 4, hit:false, judged:false});
    });
    return out.sort((a, b) => a.t - b.t);
  }
  function slice(built, b0, b1){
    const bar = built.bar;
    const plan = [{k:'intro', ph:null}].concat(built.plan.slice(b0, b1));
    const notes = built.notes.filter(n => n.bar >= b0 && n.bar < b1).map(n => Object.assign({}, n, {t:n.t - (b0 - 1) * bar, bar:n.bar - b0 + 1}));
    return Object.assign({}, built, {plan, notes, length:plan.length * bar});
  }

  function Engine(cv, opt){
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const lw = (W - 40) / 4, x0 = 20, hitY = opt.hitY || H - 120, speed = opt.speed || 620;
    const st = {perfect:0, great:0, ok:0, miss:0, combo:0, maxCombo:0, score:0, flash:[0,0,0,0], sparks:[]};
    const lenient = opt.lenient || 1;
    const WIN = {p:.05 * lenient, g:.095 * lenient, o:.145 * lenient};
    let chart = opt.chart, start = 0, paused = false, pauseAt = 0, offset = 0;
    const clockAudio = A.ok;
    st.time = function(){
      if (clockAudio) return A.songTime() - (Tone.getContext().lookAhead || 0) - .01;
      return paused ? pauseAt : (performance.now() - start) / 1000 - offset;
    };
    st.begin = function(){ start = performance.now() + 100; };
    st.pause = function(p){ paused = p; if (p) pauseAt = st.time(); else start = performance.now() - pauseAt * 1000; };
    function judge(kind, lane){
      if (kind === 'miss') { st.miss++; st.combo = 0; opt.onJudge && opt.onJudge('МИМО', '#ff3b3b', lane, kind); return; }
      st[kind]++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.score += ({perfect:300, great:180, ok:80})[kind] * (1 + Math.min(st.combo, 100) / 50);
      opt.onJudge && opt.onJudge(({perfect:'ИДЕАЛЬНО', great:'КЛАСС', ok:'НОРМ'})[kind], ({perfect:'#ffd400', great:'#19d3b5', ok:'#8fa3ff'})[kind], lane, kind);
      for (let i = 0; i < 10; i++) st.sparks.push({x:x0 + lw * lane + lw / 2, y:hitY, vx:rnd(-220, 220), vy:rnd(-420, -60), life:.5, col:LANE_COL[lane]});
    }
    st.press = function(lane){
      st.flash[lane] = 1;
      const now = st.time();
      let best = null, bd = 9;
      for (const n of chart) { if (n.judged || n.lane !== lane) continue; const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } if (n.t - now > .3) break; }
      if (best && bd <= WIN.o) {
        best.judged = best.hit = true;
        judge(bd <= WIN.p ? 'perfect' : bd <= WIN.g ? 'great' : 'ok', lane);
        A.sfx('pluck2', {vol:.12, rate:1.5});
      }
    };
    st.update = function(dt){
      const now = st.time();
      for (const n of chart) { if (!n.judged && now - n.t > WIN.o) { n.judged = true; judge('miss', n.lane); } }
      // draw
      c.clearRect(0, 0, W, H);
      c.fillStyle = 'rgba(13,11,20,.82)'; c.fillRect(x0, 0, lw * 4, H);
      for (let i = 0; i < 4; i++) {
        const x = x0 + lw * i;
        if (st.flash[i] > 0) { const g = c.createLinearGradient(0, hitY, 0, hitY - 400); g.addColorStop(0, LANE_COL[i] + 'aa'); g.addColorStop(1, LANE_COL[i] + '00'); c.fillStyle = g; c.globalAlpha = st.flash[i]; c.fillRect(x, hitY - 400, lw, 400); c.globalAlpha = 1; st.flash[i] = Math.max(0, st.flash[i] - dt * 6); }
        c.strokeStyle = 'rgba(246,241,231,.15)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
      }
      c.strokeStyle = '#f6f1e7'; c.lineWidth = 3; c.strokeRect(x0, -4, lw * 4, H + 8);
      // beat lines
      const spb = opt.spb;
      const firstBeat = Math.ceil(now / spb);
      for (let b = firstBeat; b < firstBeat + 12; b++) { const y = hitY - (b * spb - now) * speed; if (y < 0) break; c.fillStyle = b % 4 === 0 ? 'rgba(246,241,231,.18)' : 'rgba(246,241,231,.06)'; c.fillRect(x0, y, lw * 4, b % 4 === 0 ? 3 : 1); }
      // hit line + keys
      c.fillStyle = '#f6f1e7'; c.fillRect(x0, hitY - 3, lw * 4, 6);
      for (let i = 0; i < 4; i++) {
        const x = x0 + lw * i + 6, w = lw - 12;
        c.fillStyle = st.flash[i] > .3 ? LANE_COL[i] : '#121018'; c.strokeStyle = LANE_COL[i]; c.lineWidth = 4;
        c.fillRect(x, hitY + 14, w, 54); c.strokeRect(x, hitY + 14, w, 54);
        c.fillStyle = st.flash[i] > .3 ? '#121018' : LANE_COL[i]; c.font = '800 24px "JetBrains Mono"'; c.textAlign = 'center'; c.fillText(LANE_LBL[i], x + w / 2, hitY + 50);
      }
      // notes
      for (const n of chart) {
        if (n.hit) continue;
        const y = hitY - (n.t - now) * speed;
        if (y < -40) break; if (y > H + 40) continue;
        const x = x0 + lw * n.lane + 8, w = lw - 16;
        c.fillStyle = '#121018'; c.fillRect(x + 5, y - 13, w, 26);
        c.fillStyle = n.judged ? '#555' : LANE_COL[n.lane]; c.fillRect(x, y - 18, w, 26);
        c.strokeStyle = '#121018'; c.lineWidth = 3; c.strokeRect(x, y - 18, w, 26);
        c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x + 4, y - 14, w - 8, 5);
      }
      // sparks
      st.sparks = st.sparks.filter(s => (s.life -= dt) > 0);
      for (const s of st.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; c.fillStyle = s.col; c.fillRect(s.x - 4, s.y - 4, 8, 8); }
      return now;
    };
    st.total = () => chart.length;
    st.acc = () => { const t = chart.length || 1; return (st.perfect + st.great * .7 + st.ok * .4) / t; };
    return st;
  }

  R.grade = acc => acc >= .95 ? 'S' : acc >= .85 ? 'A' : acc >= .7 ? 'B' : acc >= .5 ? 'C' : 'D';

  /* полноэкранная ритм-игра */
  R.play = function(songId, o){
    o = o || {};
    return new Promise(res => {
      const song = D.SONGS.find(s => s.id === songId);
      const built = A.buildSong(song);
      const chart = chartFrom(built, song.diff);
      UI.show('rhythm');
      $('#rTitle').textContent = song.name; $('#rArtist').textContent = song.artist;
      $('#rBg').style.backgroundImage = `url(assets/img/${o.bg || 'room'}.jpg)`;
      $('#rScore').textContent = '0'; $('#rCombo').textContent = ''; $('#rJudge').textContent = '';
      if (Rig.ready) { Rig.mount($('#rhythmRig'), {fill:1}); Rig.setExpr('laugh'); }
      const cv = $('#rCanvas');
      const eng = Engine(cv, {chart, spb:built.spb, lenient:o.lenient || 1, onJudge});
      const viz = $('#rViz').getContext('2d');
      let lastBeat = -1, over = false, paused = false, last = performance.now();
      function onJudge(txt, col, lane, kind){
        const j = $('#rJudge'); j.textContent = txt; j.style.color = col;
        gsap.fromTo(j, {scale:1.4, opacity:1}, {scale:1, duration:.25, ease:'back.out(3)'}); gsap.to(j, {opacity:0, delay:.35, duration:.3});
        $('#rCombo').textContent = eng.combo >= 5 ? eng.combo : '';
        if (kind === 'miss' && Math.random() < .25 && Rig.ready) Rig.setExpr('shock', 600);
        if (eng.combo > 0 && eng.combo % 25 === 0) { Rig.ready && Rig.react('hop'); A.sfx('power', {vol:.4}); }
      }
      function key(e){
        if (over) return;
        if (e.code === 'Escape') { togglePause(); return; }
        if (paused || e.repeat) return;
        const l = LANE_KEYS.indexOf(e.code); if (l >= 0) { e.preventDefault(); eng.press(l); }
      }
      function togglePause(){
        paused = !paused; A.pauseSong(paused); eng.pause(paused);
        if (paused) {
          UI.modal({title:'Пауза', icon:'clock', size:'narrow', body:'<p class="note-hand">Планя пьёт чай. Чат ждёт.</p>', closable:false, foot:[
            {t:'Продолжить', cls:'btn-yellow', icon:'play', on:() => togglePause()},
            {t:'Бросить кавер', icon:'x', on:() => { finish(true); }}]});
        }
      }
      cv.onpointerdown = e => { const r = cv.getBoundingClientRect(); const lane = clamp(Math.floor(((e.clientX - r.left) / r.width * cv.width - 20) / ((cv.width - 40) / 4)), 0, 3); eng.press(lane); };
      document.addEventListener('keydown', key);
      let pulse = 0;
      A.playSong(built, .9); eng.begin();
      Rig.setDance && Rig.setDance(.6);
      (function loop(now){
        if (over) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        if (!paused) {
          const t = eng.update(dt);
          $('#rScore').textContent = fmt(eng.score);
          $('#rProg').style.width = clamp(t / built.length * 100, 0, 100) + '%';
          const beat = Math.floor(t / built.spb);
          if (beat !== lastBeat && t > 0) { lastBeat = beat; Rig.ready && Rig.beat(beat % 4 === 0); vizPulse(beat); }
          drawViz(t, dt);
          if (t > built.length + .8) finish(false);
        }
        requestAnimationFrame(loop);
      })(last);
      function vizPulse(b){ pulse = b % 4 === 0 ? 1 : .55; }
      function drawViz(t, dt){
        pulse = Math.max(0, pulse - dt * 2.5);
        viz.clearRect(0, 0, 1600, 900);
        const cx = 1240, cy = 450;
        for (let i = 0; i < 5; i++) {
          viz.strokeStyle = ['#ff2fa0', '#19d3b5', '#ffd400', '#2a4bff', '#7a4dff'][i]; viz.lineWidth = 6;
          viz.globalAlpha = .5 - i * .08;
          viz.beginPath(); viz.arc(cx, cy, 90 + i * 70 + pulse * 30 * (1 + i * .3), 0, Math.PI * 2); viz.stroke();
        }
        viz.globalAlpha = 1;
        for (let i = 0; i < 32; i++) {
          const h = (Math.sin(t * 3 + i * .7) * .5 + .5) * 120 * (.4 + pulse) + 10;
          viz.fillStyle = i % 2 ? '#ff2fa0' : '#19d3b5'; viz.fillRect(1000 + i * 18, 900 - h, 12, h);
        }
      }
      function finish(quit){
        if (over) return; over = true;
        document.removeEventListener('keydown', key); A.stopSong(); Rig.setDance && Rig.setDance(0);
        UI.closeAll();
        const acc = eng.acc();
        res({quit, acc, grade:R.grade(acc), score:Math.round(eng.score), maxCombo:eng.maxCombo, fc:eng.miss === 0 && !quit, perfect:eng.perfect, great:eng.great, ok:eng.ok, miss:eng.miss, total:eng.total()});
      }
    });
  };

  /* мини-ритм прямо на стриме (караоке) */
  R.mini = function(songId, host, o){
    o = o || {};
    return new Promise(res => {
      const song = D.SONGS.find(s => s.id === songId) || D.SONGS[0];
      const full = A.buildSong(song);
      const built = slice(full, 10, 14);
      const chart = chartFrom(built, Math.min(song.diff, 2));
      const wrap = UI.el(`<div class="qte" style="padding:16px 18px;min-width:0;left:auto;right:60px;top:52%;transform:translateY(-50%)"><h3 style="font-size:24px">${ic('microphone')} ${esc(song.name)}</h3><p style="margin-bottom:6px">Жми <span class="kbd">D</span><span class="kbd">F</span><span class="kbd">J</span><span class="kbd">K</span> в такт!</p><canvas width="360" height="440" style="display:block"></canvas></div>`);
      host.appendChild(wrap);
      gsap.fromTo(wrap, {scale:.6, opacity:0}, {scale:1, opacity:1, duration:.3, ease:'back.out(2)'});
      const cv = $('canvas', wrap);
      const eng = Engine(cv, {chart, spb:built.spb, hitY:340, speed:420, lenient:(o.lenient || 1) * 1.15});
      let over = false, last = performance.now(), lastBeat = -1;
      function key(e){ if (over || e.repeat) return; const l = LANE_KEYS.indexOf(e.code); if (l >= 0) { e.preventDefault(); eng.press(l); } }
      document.addEventListener('keydown', key);
      cv.onpointerdown = e => { const r = cv.getBoundingClientRect(); eng.press(clamp(Math.floor(((e.clientX - r.left) / r.width * 360 - 20) / 80), 0, 3)); };
      A.playSong(built, .3); eng.begin();
      (function loop(now){
        if (over) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        const t = eng.update(dt);
        const beat = Math.floor(t / built.spb); if (beat !== lastBeat && t > 0) { lastBeat = beat; Rig.ready && Rig.beat(beat % 4 === 0); }
        if (t > built.length + .3) done();
        requestAnimationFrame(loop);
      })(last);
      function done(){
        over = true; document.removeEventListener('keydown', key); A.stopSong();
        gsap.to(wrap, {scale:.7, opacity:0, duration:.25, onComplete:() => wrap.remove()});
        res(eng.acc());
      }
    });
  };
  return R;
})();
