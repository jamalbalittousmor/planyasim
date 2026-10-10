/* ====== Риг Плани: PixiJS SimplePlane + деформация меша (псевдо-Live2D) ====== */
window.Rig = (function(){
  const R = {ready:false, expr:'idle', persona:null, talking:false};
  const W = 640, H = 953, COLS = 16, ROWS = 26;
  const PIV = {x:320, y:345};
  let app, plane, holder, root, tex = {}, orig, buf, mountEl = null, opts = {};
  let t = 0, look = {x:0, y:0}, lookT = {x:0, y:0}, hairLag = 0, hairVel = 0, ahoge = 0, ahogeV = 0;
  let blinkAt = 2, blinking = 0, mouth = 0, mouthTimer = 0, exprTimer = null, talkEnd = 0;
  const P = {tilt:0, bob:0, squash:0, sway:1, nod:0, danceAmp:0};  // tweenable params
  R.P = P;

  function sstep(a, b, x){ const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); }

  R.init = function(){
    return new Promise(res => {
      const keys = Object.keys(window.SPRITES || {});
      let left = keys.length;
      if (!left) return res();
      keys.forEach(k => {
        const img = new Image();
        img.onload = img.onerror = () => { tex[k] = PIXI.Texture.from(img); if (--left === 0) build(res); };
        img.src = SPRITES[k];
      });
    });
  };

  function build(res){
    try { buildPixi(); } catch(e) { console.warn('WebGL недоступен, статичный режим', e); R.fallback = true; }
    res();
  }
  function buildPixi(){
    app = new PIXI.Application({backgroundAlpha:0, antialias:true, width:600, height:800,
      resolution:Math.min(window.devicePixelRatio || 1, 2), autoDensity:true, powerPreference:'high-performance'});
    root = new PIXI.Container(); app.stage.addChild(root);
    holder = new PIXI.Container(); root.addChild(holder);
    plane = new PIXI.SimplePlane(tex.idle, COLS, ROWS);
    plane.x = -W / 2; plane.y = -H;
    holder.addChild(plane);
    buf = plane.geometry.getBuffer('aVertexPosition');
    orig = Float32Array.from(buf.data);
    app.ticker.add(tick);
    app.view.addEventListener('pointerdown', e => { if (R.onClick) R.onClick(e); });
    window.addEventListener('pointermove', e => {
      if (!mountEl) return;
      const r = app.view.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width * .5, cy = r.top + r.height * .28;
      lookT.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * .45)));
      lookT.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * .5)));
      R._lastMove = performance.now();
    });
    R.ready = true;
  }

  let fbImg = null;
  function fbSync(){ if (fbImg) { const k = R.persona === 'ester' ? 'ester' : R.persona === 'mikhalych' ? 'mikhalych' : R.expr; fbImg.src = SPRITES[k] || SPRITES.idle; } }
  R.mount = function(el, o){
    if (R.fallback && el) {
      if (!fbImg) { fbImg = new Image(); fbImg.style.cssText = 'position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:100%;animation:none'; }
      el.appendChild(fbImg); fbSync(); return;
    }
    if (!R.ready || !el) return;
    opts = Object.assign({fill:1, anchor:'bottom', offsetY:0, flip:false}, o || {});
    mountEl = el;
    if (app.view.parentNode !== el) el.appendChild(app.view);
    R.resize();
  };
  R.resize = function(){
    if (!mountEl || !app) return;
    const w = mountEl.clientWidth || 600, h = mountEl.clientHeight || 800;
    app.renderer.resize(w, h);
    const s = (h * opts.fill) / H;
    root.scale.set(opts.flip ? -s : s, s);
    root.x = w / 2;
    root.y = h + opts.offsetY;
  };

  function baseTex(){
    const p = R.persona;
    if (p === 'ester') return blinking > 0 ? 'ester_blink' : 'ester';
    if (p === 'mikhalych') return 'mikhalych';
    const e = R.expr;
    if (e === 'idle') { if (blinking > 0) return 'blink'; return mouth > 0 ? 'talk' : 'idle'; }
    if (e === 'angry') return mouth > 0 ? 'angry_talk' : 'angry';
    return tex[e] ? e : 'idle';
  }

  function tick(){
    const dt = Math.min(.05, app.ticker.deltaMS / 1000);
    t += dt;
    // idle look drift when mouse still
    if (!R._lastMove || performance.now() - R._lastMove > 2500) {
      lookT.x = Math.sin(t * .37) * .35 + Math.sin(t * .13) * .2; lookT.y = Math.sin(t * .29) * .2;
    }
    look.x += (lookT.x - look.x) * Math.min(1, dt * 4);
    look.y += (lookT.y - look.y) * Math.min(1, dt * 4);
    // blink
    blinkAt -= dt;
    if (blinkAt <= 0) { blinking = .12; blinkAt = 2.2 + Math.random() * 3.2; if (Math.random() < .15) blinkAt = .25; }
    if (blinking > 0) blinking -= dt;
    // mouth
    if (mouth > 0) mouth -= dt;
    const tk = baseTex();
    if (plane.texture !== tex[tk] && tex[tk]) plane.texture = tex[tk];

    const breath = Math.sin(t * 2.0);
    const headDX = look.x * 11 + P.bob * .3;
    const headDY = look.y * 6 + breath * 1.4 + P.bob + P.nod * 10;
    const ang = Math.sin(t * .8) * .018 * P.sway + look.x * .05 + P.tilt + Math.sin(t * 4) * P.danceAmp * .05;
    // springs: hair lags behind head
    const k = 60, d = 9;
    hairVel += ((headDX + ang * 250) - hairLag) * k * dt; hairVel *= Math.max(0, 1 - d * dt); hairLag += hairVel * dt;
    const hairOff = (hairLag - (headDX + ang * 250)) * .9;
    ahogeV += (-hairOff * 1.4 - ahoge) * 80 * dt; ahogeV *= Math.max(0, 1 - 6 * dt); ahoge += ahogeV * dt;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const sway = Math.sin(t * .55) * 3.5 * P.sway;
    const v = buf.data;
    for (let i = 0; i < orig.length; i += 2) {
      const x0 = orig[i], y0 = orig[i + 1];
      let dx = 0, dy = 0;
      const wHead = 1 - sstep(300, 395, y0);
      // body sway: more at top
      const up = 1 - y0 / H;
      dx += sway * up * up;
      // breathing (chest)
      const wChest = sstep(360, 470, y0) * (1 - sstep(560, 760, y0));
      dx += (x0 - 320) * .014 * breath * wChest;
      dy += -breath * 2.4 * wChest - breath * 1.2 * (1 - sstep(330, 520, y0)) * (1 - wHead);
      // squash (talking/reactions), anchored at bottom
      dy += (H - y0) * P.squash * .08;
      dx += (x0 - 320) * -P.squash * .04 * up;
      if (wHead > 0) {
        const rx = x0 - PIV.x, ry = y0 - PIV.y;
        const nx = rx * ca - ry * sa, ny = rx * sa + ry * ca;
        dx += ((nx - rx) + headDX) * wHead;
        dy += ((ny - ry) + headDY) * wHead;
        // hair sides (secondary motion)
        const side = Math.min(1, Math.max(0, (Math.abs(x0 - 320) - 70) / 140));
        const wHair = side * sstep(150, 260, y0) * (1 - sstep(340, 400, y0));
        dx += hairOff * wHair * 1.3;
        dy += Math.abs(hairOff) * wHair * .15;
        // ahoge
        if (y0 < 115 && x0 > 280 && x0 < 400) { const w = (115 - y0) / 115; dx += (ahoge + Math.sin(t * 2.7) * 1.5) * w * 2.2; }
      }
      v[i] = x0 + dx; v[i + 1] = y0 + dy;
    }
    buf.update();
  }

  R.setExpr = function(e, ms){
    if (exprTimer) { clearTimeout(exprTimer); exprTimer = null; }
    R.expr = e || 'idle'; fbSync();
    if (ms) exprTimer = setTimeout(() => { R.expr = 'idle'; exprTimer = null; fbSync(); }, ms);
  };
  R.setPersona = function(p){ R.persona = p || null; fbSync(); };

  R.say = function(text, o){
    o = o || {};
    if (o.expr) R.setExpr(o.expr, o.hold ? 0 : null);
    const voice = o.voice || (R.persona === 'ester' ? 'ester' : R.persona === 'mikhalych' ? 'mikhalych' : 'planya');
    const dur = A.babble(text, voice, (i) => {
      mouth = .07;
      if (R.expr !== 'idle' && R.expr !== 'angry' || R.persona) gsap.fromTo(P, {squash:.012}, {squash:0, duration:.12, overwrite:'auto'});
    });
    if (o.expr && !o.hold) { if (exprTimer) clearTimeout(exprTimer); exprTimer = setTimeout(() => { R.expr = 'idle'; }, dur * 1000 + (o.linger || 1400)); }
    return dur;
  };

  R.react = function(kind){
    if (!R.ready) return;
    gsap.killTweensOf(holder.scale); gsap.killTweensOf(holder);
    holder.scale.set(1, 1); holder.y = 0; holder.rotation = 0;
    if (kind === 'hop') gsap.timeline().to(holder.scale, {x:1.04, y:.95, duration:.08}).to(holder.scale, {x:.97, y:1.05, duration:.12}).to(holder, {y:-26, duration:.16, ease:'power2.out'}, '<').to(holder, {y:0, duration:.22, ease:'bounce.out'}).to(holder.scale, {x:1, y:1, duration:.3, ease:'elastic.out(1,.4)'}, '<');
    else if (kind === 'shake') gsap.fromTo(holder, {x:-10}, {x:0, duration:.5, ease:'elastic.out(1.2,.2)'});
    else if (kind === 'nod') gsap.fromTo(P, {nod:1}, {nod:0, duration:.5, ease:'elastic.out(1,.35)'});
    else if (kind === 'tilt') gsap.fromTo(P, {tilt:(Math.random() < .5 ? -1 : 1) * .12}, {tilt:0, duration:1.4, ease:'elastic.out(1,.3)'});
    else if (kind === 'squash') gsap.timeline().to(holder.scale, {x:1.08, y:.9, duration:.1}).to(holder.scale, {x:1, y:1, duration:.6, ease:'elastic.out(1,.3)'});
    else if (kind === 'shock') gsap.timeline().to(holder.scale, {x:.94, y:1.08, duration:.08}).to(holder, {y:-14, duration:.08}, '<').to(holder, {y:0, duration:.4, ease:'bounce.out'}).to(holder.scale, {x:1, y:1, duration:.4, ease:'elastic.out(1,.3)'}, '<');
    else if (kind === 'spin') gsap.fromTo(holder, {rotation:-.08}, {rotation:0, duration:.9, ease:'elastic.out(1,.25)'});
  };
  R.beat = function(strong){
    if (!R.ready) return;
    gsap.fromTo(P, {bob:strong ? 7 : 4, squash:strong ? .02 : .01}, {bob:0, squash:0, duration:.35, ease:'power2.out', overwrite:'auto'});
    P.tilt = (Math.random() - .5) * .06;
  };
  R.setDance = function(a){ P.danceAmp = a; };
  R.texture = k => tex[k];
  return R;
})();
