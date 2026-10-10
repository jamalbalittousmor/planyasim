/* ====== UI-хелперы ====== */
window.$ = (s, r) => (r || document).querySelector(s);
window.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
window.ic = (n, c) => `<svg class="${c || ''}"><use href="#i-${n}"/></svg>`;
window.fmt = function(n){
  n = Math.round(n); const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',') + 'М';
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '').replace('.', ',') + 'К';
  return n.toLocaleString('ru-RU');
};
window.rnd = (a, b) => a + Math.random() * (b - a);
window.ri = (a, b) => Math.floor(rnd(a, b + 1));
window.pick = arr => arr[Math.floor(Math.random() * arr.length)];
window.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
window.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
window.wait = ms => new Promise(r => setTimeout(r, ms));
window.esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

window.UI = (function(){
  const U = {scale:1};
  U.fit = function(){
    const s = Math.min(innerWidth / 1600, innerHeight / 900);
    U.scale = s;
    const st = $('#stage');
    st.style.transform = `scale(${s})`;
    st.style.left = ((innerWidth - 1600 * s) / 2) + 'px';
    st.style.top = ((innerHeight - 900 * s) / 2) + 'px';
  };
  U.show = function(id){
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    $('#stage').classList.toggle('in-stream', id === 'stream' || id === 'rhythm');
    U.cur = id;
  };
  U.el = function(html){ const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

  /* emotes / portraits from sprite sheet */
  U.faceStyle = function(key, size){
    const src = (window.SPRITES || {})[key] || SPRITES.idle;
    const s = size / 250;                        // face region ≈ 250px wide around (320,240)
    return `background-image:url(${src});background-size:${640 * s}px ${953 * s}px;background-position:${-(320 * s - size / 2)}px ${-(238 * s - size / 2)}px`;
  };
  U.emote = name => { const e = D.EMOTES[name]; return e ? `<i class="emote" title="${name}" style="${U.faceStyle(e[0], 26)};background-color:#2a2533"></i>` : esc(name); };
  U.portrait = function(key){ return `background-image:url(${(window.SPRITES || {})[key] || ''})`; };

  /* modal */
  const stack = [];
  U.modal = function(o){
    const back = U.el(`<div class="modal-back ${o.cls || ''}"><div class="modal ${o.size || ''}">
      <div class="modal-head">${o.icon ? ic(o.icon, 'hico') : ''}<h2>${o.title || ''}${o.sub ? `<small>${o.sub}</small>` : ''}</h2>
      ${o.closable === false ? '' : `<button class="x" title="Закрыть">${ic('x')}</button>`}</div>
      <div class="modal-body"></div>${o.foot ? '<div class="modal-foot"></div>' : ''}</div></div>`);
    const body = $('.modal-body', back);
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    const m = {el:back, body, closed:false};
    m.close = function(silent){
      if (m.closed) return; m.closed = true;
      const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1);
      if (!silent) A.sfx('close', {vol:.5});
      gsap.to($('.modal', back), {y:30, opacity:0, duration:.16, ease:'power2.in'});
      gsap.to(back, {opacity:0, duration:.18, onComplete:() => back.remove()});
      if (o.onClose) o.onClose();
    };
    if (o.foot) {
      const f = $('.modal-foot', back);
      o.foot.forEach(b => {
        const btn = U.el(`<button class="btn ${b.cls || ''}">${b.icon ? ic(b.icon) : ''}<span>${b.t}</span></button>`);
        btn.onclick = () => { if (b.on) b.on(m); if (b.close !== false) m.close(true); };
        f.appendChild(btn);
      });
    }
    const x = $('.x', back); if (x) x.onclick = () => m.close();
    if (o.closable !== false && o.backdrop !== false) back.addEventListener('pointerdown', e => { if (e.target === back) m.close(); });
    $('#modalLayer').appendChild(back);
    stack.push(m);
    A.sfx('open', {vol:.5});
    gsap.fromTo(back, {opacity:0}, {opacity:1, duration:.15});
    gsap.fromTo($('.modal', back), {y:40, rotation:-1.5, scale:.96}, {y:0, rotation:0, scale:1, duration:.35, ease:'back.out(1.8)'});
    return m;
  };
  U.top = () => stack[stack.length - 1];
  U.closeAll = () => stack.slice().forEach(m => m.close(true));
  U.hasModal = () => stack.length > 0;

  U.choice = function(o){
    // o: title, icon, cls, text, opts:[{t,d,icon,tags,disabled,on}]
    return new Promise(res => {
      const body = U.el(`<div>${o.html || ''}<div class="opts ${o.layout || ''}"></div></div>`);
      let done = false;
      const m = U.modal({title:o.title, sub:o.sub, icon:o.icon, cls:o.cls, size:o.size, body, closable:!!o.closable, onClose:() => { if (!done) res(null); }});
      o.opts.forEach((op, i) => {
        const b = U.el(`<button class="opt" ${op.disabled ? 'disabled' : ''}>${op.icon ? `<span class="oi" style="${op.color ? 'background:' + op.color : ''}">${ic(op.icon)}</span>` : ''}
          <span class="ot"><b>${op.t}</b>${op.d ? `<p>${op.d}</p>` : ''}${op.tags ? `<span class="tags">${op.tags.map(t => `<span class="tagpill ${t[0] === '+' ? 'plus' : t[0] === '−' || t[0] === '-' ? 'minus' : ''}">${t}</span>`).join('')}</span>` : ''}</span>
          ${op.price ? `<span class="price">${op.price}</span>` : ''}</button>`);
        b.onclick = () => { if (done) return; done = true; A.sfx('confirm', {vol:.6}); m.close(true); res(op.value != null ? op.value : i); };
        $('.opts', body).appendChild(b);
      });
    });
  };

  /* toast */
  U.toast = function(title, text, icon, kind){
    const t = U.el(`<div class="toast ${kind || ''}">${ic(icon || 'info')}<div><b>${title}</b>${text || ''}</div></div>`);
    $('#toastLayer').appendChild(t);
    gsap.fromTo(t, {x:500, rotation:6}, {x:0, rotation:0, duration:.45, ease:'back.out(1.6)'});
    gsap.to(t, {x:520, opacity:0, delay:3.6, duration:.35, ease:'power2.in', onComplete:() => t.remove()});
    const all = $$('.toast'); if (all.length > 4) all[0].remove();
  };

  U.floater = function(text, x, y, color, size){
    const f = U.el(`<div class="floater">${text}</div>`);
    f.style.left = x + 'px'; f.style.top = y + 'px'; if (color) f.style.color = color; if (size) f.style.fontSize = size + 'px';
    $('#fxLayer').appendChild(f);
    gsap.fromTo(f, {y:0, scale:.4, rotation:rnd(-12, 12)}, {y:-80, scale:1, duration:.5, ease:'back.out(2)'});
    gsap.to(f, {opacity:0, y:-130, delay:.7, duration:.5, onComplete:() => f.remove()});
  };
  U.stagePos = function(el){
    const r = el.getBoundingClientRect(), s = $('#stage').getBoundingClientRect();
    return {x:(r.left - s.left) / U.scale + r.width / U.scale / 2, y:(r.top - s.top) / U.scale + r.height / U.scale / 2};
  };

  /* speech bubble with typewriter */
  U.bubble = function(el, text, o){
    o = o || {};
    const span = $('span', el);
    el.classList.toggle('ester', !!o.ester);
    gsap.killTweensOf(el);
    clearTimeout(el._t); clearInterval(el._iv);
    span.textContent = '';
    gsap.fromTo(el, {opacity:0, scale:.6, rotation:-4}, {opacity:1, scale:1, rotation:0, duration:.3, ease:'back.out(2.2)', transformOrigin:'0% 100%'});
    const dur = Math.max(.6, o.dur || text.length * .035);
    let i = 0; const step = Math.max(12, dur * 1000 / Math.max(1, text.length));
    el._iv = setInterval(() => { i++; span.textContent = text.slice(0, i); if (i >= text.length) clearInterval(el._iv); }, step);
    el._t = setTimeout(() => gsap.to(el, {opacity:0, y:-8, duration:.3, onComplete:() => gsap.set(el, {y:0})}), dur * 1000 + (o.hold || 2400));
  };

  U.count = function(el, to, o){
    o = o || {};
    const from = el._v != null ? el._v : to;
    el._v = to;
    const obj = {v:from};
    gsap.to(obj, {v:to, duration:o.d || .8, ease:'power2.out', onUpdate:() => el.textContent = (o.f || fmt)(obj.v)});
  };

  U.confetti = function(o){
    try { confetti(Object.assign({particleCount:120, spread:80, origin:{y:.6}, colors:['#ffd400','#ff2fa0','#19d3b5','#2a4bff','#7a4dff'], disableForReducedMotion:true}, o || {})); } catch(e){}
  };

  document.addEventListener('scroll', e => { const t = e.target; if (t && t.nodeType === 1 && (t.id === 'stage' || t.id === 'viewport' || t.classList.contains('screen') || t.classList.contains('obs-scene') || t.classList.contains('hub-left'))) { t.scrollTop = 0; t.scrollLeft = 0; } }, true);
  // UI sounds
  document.addEventListener('pointerover', e => {
    const b = e.target.closest && e.target.closest('.btn,.opt,.act-card,.iconbtn,.song,.memo-item,.card');
    if (b && b !== U._hov) { U._hov = b; A.sfx('hover', {vol:.18, jitter:.2}); }
  });
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.btn,.act-card,.iconbtn,.song,.memo-item,.brand');
    if (b) A.sfx('click', {vol:.5, jitter:.1});
  });
  return U;
})();
