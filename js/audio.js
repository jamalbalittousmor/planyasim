/* ====== Звук: Tone.js (музыка, голос) + Kenney CC0 (UI) ====== */
window.A = (function(){
  const A = {ok:false, vol:{music:.55, sfx:.8, voice:.7}, track:null, intensity:0, buffers:{}};
  let musicBus, voiceBus, sfxGain, raw, inst = {}, loop = null, step = 0, curTrack = null, vinyl = null;
  const mtf = m => Tone.Frequency(m, 'midi').toFrequency();
  const db = v => v <= 0.001 ? -80 : 20*Math.log10(v);

  A.init = async function(){
    if (A.ok) return;
    try {
      await Tone.start();
      Tone.getContext().lookAhead = 0.08;
      raw = Tone.getContext().rawContext;
      const limiter = new Tone.Limiter(-1).toDestination();
      musicBus = new Tone.Volume(db(A.vol.music)).connect(limiter);
      voiceBus = new Tone.Volume(db(A.vol.voice)).connect(limiter);
      sfxGain = raw.createGain(); sfxGain.gain.value = A.vol.sfx;
      sfxGain.connect(raw.destination);
      const verb = new Tone.Reverb({decay:2.8, wet:.22}).connect(musicBus);
      const lp = new Tone.Filter(2600, 'lowpass').connect(verb);
      A.musicFilter = new Tone.Filter(20000, 'lowpass').connect(musicBus);
      inst.keys = new Tone.PolySynth(Tone.FMSynth, {harmonicity:2, modulationIndex:1.4, oscillator:{type:'sine'},
        envelope:{attack:.01, decay:.7, sustain:.25, release:1.4}, modulation:{type:'triangle'}, modulationEnvelope:{attack:.01, decay:.4, sustain:.2, release:.8}}).connect(lp);
      inst.keys.volume.value = -15; inst.keys.maxPolyphony = 16;
      inst.pad = new Tone.PolySynth(Tone.Synth, {oscillator:{type:'fatsawtooth', count:3, spread:22}, envelope:{attack:.6, decay:.5, sustain:.7, release:2}}).connect(lp);
      inst.pad.volume.value = -27;
      inst.bass = new Tone.MonoSynth({oscillator:{type:'square'}, filter:{Q:2, type:'lowpass'}, envelope:{attack:.005, decay:.25, sustain:.4, release:.2},
        filterEnvelope:{attack:.005, decay:.2, sustain:.3, release:.2, baseFrequency:120, octaves:2.6}}).connect(A.musicFilter);
      inst.bass.volume.value = -14;
      inst.arp = new Tone.Synth({oscillator:{type:'triangle8'}, envelope:{attack:.003, decay:.12, sustain:.05, release:.15}}).connect(verb);
      inst.arp.volume.value = -20;
      inst.lead = new Tone.Synth({oscillator:{type:'pulse', width:.3}, envelope:{attack:.01, decay:.15, sustain:.5, release:.25}}).connect(new Tone.FeedbackDelay('8n.', .22).connect(verb));
      inst.lead.volume.value = -17;
      inst.bell = new Tone.Synth({oscillator:{type:'sine'}, envelope:{attack:.002, decay:.9, sustain:0, release:.9}}).connect(verb);
      inst.bell.volume.value = -16;
      inst.kick = new Tone.MembraneSynth({pitchDecay:.04, octaves:6, envelope:{attack:.001, decay:.35, sustain:0, release:.1}}).connect(musicBus);
      inst.kick.volume.value = -7;
      const snHP = new Tone.Filter(1400, 'highpass').connect(musicBus);
      inst.snare = new Tone.NoiseSynth({noise:{type:'white'}, envelope:{attack:.001, decay:.16, sustain:0, release:.05}}).connect(snHP);
      inst.snare.volume.value = -15;
      const hatHP = new Tone.Filter(8000, 'highpass').connect(musicBus);
      inst.hat = new Tone.NoiseSynth({noise:{type:'white'}, envelope:{attack:.001, decay:.035, sustain:0, release:.01}}).connect(hatHP);
      inst.hat.volume.value = -22;
      const dist = new Tone.Distortion(.6).connect(new Tone.Filter(900, 'lowpass').connect(musicBus));
      inst.dbass = new Tone.MonoSynth({oscillator:{type:'sawtooth'}, envelope:{attack:.02, decay:.3, sustain:.6, release:.4}, filterEnvelope:{baseFrequency:80, octaves:2}}).connect(dist);
      inst.dbass.volume.value = -16;
      vinyl = new Tone.Noise('brown'); const vf = new Tone.Filter(1800, 'bandpass'); const vg = new Tone.Gain(0).connect(musicBus);
      vinyl.connect(vf); vf.connect(vg); vinyl.start(); A._vinylGain = vg;
      // voice
      const vbp = new Tone.Filter({frequency:1800, type:'bandpass', Q:1.2}).connect(voiceBus);
      inst.voice = new Tone.Synth({oscillator:{type:'triangle'}, envelope:{attack:.005, decay:.06, sustain:.3, release:.04}}).connect(vbp);
      inst.voice2 = new Tone.Synth({oscillator:{type:'square'}, envelope:{attack:.005, decay:.06, sustain:.3, release:.04}}).connect(vbp);
      inst.voice2.volume.value = -10;
      inst.esterVoice = new Tone.Synth({oscillator:{type:'sawtooth'}, envelope:{attack:.01, decay:.08, sustain:.3, release:.06}})
        .connect(new Tone.Filter(1100, 'lowpass').connect(new Tone.Distortion(.3).connect(voiceBus)));
      inst.esterVoice.volume.value = -6;
      inst.mikhVoice = new Tone.Synth({oscillator:{type:'square'}, envelope:{attack:.01, decay:.1, sustain:.4, release:.06}})
        .connect(new Tone.Filter(700, 'lowpass').connect(voiceBus));
      inst.mikhVoice.volume.value = -4;
      Object.values(inst).forEach(o => { if (o && o.triggerAttackRelease) { const f = o.triggerAttackRelease.bind(o); o.triggerAttackRelease = (...a) => { try { return f(...a); } catch (e) {} }; } });
      // sfx buffers
      for (const k in (window.SFX_DATA || {})) {
        try {
          const b64 = SFX_DATA[k].split(',')[1]; const bin = atob(b64); const u = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          raw.decodeAudioData(u.buffer).then(buf => A.buffers[k] = buf).catch(()=>{});
        } catch(e){}
      }
      A.ok = true;
      Tone.Transport.start('+0.05');
    } catch(e) { console.warn('audio init failed', e); }
  };

  A.setVol = function(k, v){
    A.vol[k] = v;
    if (!A.ok) return;
    if (k === 'music') musicBus.volume.rampTo(db(v), .1);
    if (k === 'voice') voiceBus.volume.rampTo(db(v), .1);
    if (k === 'sfx') sfxGain.gain.value = v;
  };

  A.sfx = function(name, o){
    if (!A.ok || !A.buffers[name]) return;
    o = o || {};
    try {
      const s = raw.createBufferSource(); s.buffer = A.buffers[name];
      s.playbackRate.value = (o.rate || 1) * (o.jitter ? 1 + (Math.random() - .5) * o.jitter : 1);
      const g = raw.createGain(); g.gain.value = o.vol == null ? 1 : o.vol;
      s.connect(g); g.connect(sfxGain); s.start();
    } catch(e){}
  };

  /* ---------- музыкальные треки (step-секвенсор по 16-м) ---------- */
  const chordN = (root, ch) => ch.map(n => root + n);
  const TRACKS = {
    title:{bpm:122, swing:0, vinyl:0, root:57, prog:[[0,3,7,12],[-4,0,3,8],[-9,-5,0,3],[-2,2,5,10]],
      step(t, s, bar, ch, r){
        const b = s % 16;
        if (b % 4 === 0) inst.kick.triggerAttackRelease('C1', '8n', t);
        if (b === 4 || b === 12) inst.snare.triggerAttackRelease('16n', t);
        if (b % 4 === 2) inst.hat.triggerAttackRelease('32n', t, .8);
        if (b % 2 === 0) inst.bass.triggerAttackRelease(mtf(r + ch[0] - 24 + (b % 8 === 6 ? 12 : 0)), '16n', t, .8);
        if (b === 2 || b === 6 || b === 10 || b === 14) inst.keys.triggerAttackRelease(chordN(r, ch.slice(0,3)).map(mtf), '16n', t, .5);
        inst.arp.triggerAttackRelease(mtf(r + 12 + ch[[0,1,2,3,2,1][s % 6] % ch.length]), '32n', t, .55);
        const mel = [12,null,15,null,19,null,17,15, 12,null,null,10,12,null,7,null];
        if (bar % 2 === 1 && mel[b] != null) inst.lead.triggerAttackRelease(mtf(r + mel[b] + ch[0] * 0), '8n', t, .6);
      }},
    hub:{bpm:80, swing:.35, vinyl:.05, root:53, prog:[[0,4,7,11],[-1,2,7,11],[-3,0,5,9],[-5,-1,2,7]],
      step(t, s, bar, ch, r){
        const b = s % 16;
        if (b === 0 || b === 10) inst.kick.triggerAttackRelease('C1', '8n', t, .7);
        if (b === 4 || b === 12) inst.snare.triggerAttackRelease('16n', t, .45);
        if (b % 2 === 0) inst.hat.triggerAttackRelease('32n', t, b % 4 === 2 ? .5 : .25);
        if (b === 0) inst.keys.triggerAttackRelease(chordN(r, ch).map(mtf), '2n', t, .55);
        if (b === 6) inst.keys.triggerAttackRelease(chordN(r + 12, ch.slice(1,3)).map(mtf), '8n', t, .3);
        if (b === 0 || b === 7 || b === 10) inst.bass.triggerAttackRelease(mtf(r + ch[0] - 12), '8n', t, .6);
        if (b % 2 === 0 && Math.random() < .22) {
          const pent = [0,2,4,7,9,12,14]; inst.bell.triggerAttackRelease(mtf(r + 24 + pent[Math.floor(Math.random()*pent.length)]), '8n', t, .4);
        }
      }},
    stream:{bpm:128, swing:0, vinyl:0, root:48, prog:[[0,3,7],[-4,0,3],[-2,2,5],[-5,-2,2]],
      step(t, s, bar, ch, r){
        const b = s % 16, L = A.intensity;
        if (b % 4 === 0) inst.kick.triggerAttackRelease('C1', '8n', t);
        if (b % 2 === 0 || L >= 2) inst.bass.triggerAttackRelease(mtf(r + ch[0] - 12 + (b % 4 === 2 ? 12 : 0)), '16n', t, .75);
        if (L >= 1) { if (b === 4 || b === 12) inst.snare.triggerAttackRelease('16n', t); inst.hat.triggerAttackRelease('32n', t, b % 2 ? .3 : .7); }
        if (L >= 2) inst.arp.triggerAttackRelease(mtf(r + 24 + ch[s % 3] + (s % 6 > 2 ? 12 : 0)), '32n', t, .5);
        if (L >= 3) {
          if (b === 0) inst.pad.triggerAttackRelease(chordN(r + 12, ch).map(mtf), '1n', t, .6);
          const mel = [7,null,10,7,12,null,10,null,7,null,5,3,5,null,3,null];
          if (mel[b] != null && bar % 2 === 0) inst.lead.triggerAttackRelease(mtf(r + 24 + mel[b]), '16n', t, .55);
        }
        if (L >= 1 && (b === 2 || b === 10)) inst.keys.triggerAttackRelease(chordN(r + 12, ch).map(mtf), '16n', t, .35);
      }},
    tension:{bpm:150, swing:0, vinyl:0, root:45, prog:[[0,3,7],[1,4,8]],
      step(t, s, bar, ch, r){
        const b = s % 16;
        inst.bass.triggerAttackRelease(mtf(r + ch[0] - 12), '32n', t, b % 4 === 0 ? 1 : .55);
        if (b % 4 === 0) inst.kick.triggerAttackRelease('C1', '8n', t);
        if (b % 2 === 1) inst.hat.triggerAttackRelease('32n', t, .6);
        if (b === 0) inst.arp.triggerAttackRelease(mtf(r + 24 + ch[2]), '8n', t, .7);
      }},
    ester:{bpm:84, swing:.15, vinyl:.12, root:50, prog:[[0,3,7],[-4,0,3],[1,5,8],[-5,-1,2]],
      step(t, s, bar, ch, r){
        const b = s % 16;
        if (b === 0 || b === 9) inst.kick.triggerAttackRelease('A0', '4n', t, .9);
        if (b === 8) inst.snare.triggerAttackRelease('8n', t, .4);
        if (b === 0) inst.dbass.triggerAttackRelease(mtf(r + ch[0] - 24), '2n', t, .8);
        if (b === 0) inst.pad.triggerAttackRelease(chordN(r, ch).map(mtf), '1n', t, .5);
        if (b % 4 === 3 && Math.random() < .5) inst.bell.triggerAttackRelease(mtf(r + 24 + [0,1,3,7,8][Math.floor(Math.random()*5)]), '8n', t, .35);
      }},
    night:{bpm:70, swing:.3, vinyl:.06, root:55, prog:[[0,4,7,11],[-3,0,4,7],[-7,-3,0,4],[-5,-1,2,5]],
      step(t, s, bar, ch, r){
        const b = s % 16;
        if (b === 0) inst.keys.triggerAttackRelease(chordN(r, ch).map(mtf), '1n', t, .45);
        if (b % 4 === 2) inst.bell.triggerAttackRelease(mtf(r + 12 + ch[(s/4|0) % ch.length]), '8n', t, .3);
        if (b === 0) inst.bass.triggerAttackRelease(mtf(r + ch[0] - 12), '2n', t, .4);
      }}
  };

  function stopLoop(){
    if (loop) { loop.dispose(); loop = null; }
    try { inst.keys.releaseAll(); inst.pad.releaseAll(); } catch(e){}
  }
  A.music = function(id){
    if (!A.ok) { A._pending = id; return; }
    if (curTrack === id) return;
    curTrack = id;
    stopLoop();
    if (!id || !TRACKS[id]) { A._vinylGain.gain.rampTo(0, .5); return; }
    const T = TRACKS[id];
    Tone.Transport.bpm.value = T.bpm;
    Tone.Transport.swing = T.swing; Tone.Transport.swingSubdivision = '16n';
    A._vinylGain.gain.rampTo(T.vinyl, .8);
    musicBus.volume.cancelScheduledValues(Tone.now());
    musicBus.volume.value = -40; musicBus.volume.rampTo(db(A.vol.music), .6);
    step = 0;
    loop = new Tone.Loop(time => {
      const bar = Math.floor(step / 16);
      const ch = T.prog[bar % T.prog.length];
      try { T.step(time, step, bar, ch, T.root); } catch(e){}
      if (A.onBeat && step % 4 === 0) { const st = step; Tone.Draw.schedule(() => A.onBeat(st / 4), time); }
      step++;
    }, '16n').start('+0.05');
  };
  A.current = () => curTrack;
  A.setIntensity = function(n){ A.intensity = n; if (A.ok) A.musicFilter.frequency.rampTo(n >= 0 ? 20000 : 600, .4); };
  A.duck = function(on){ if (A.ok) musicBus.volume.rampTo(on ? db(A.vol.music * .3) : db(A.vol.music), .25); };
  A.muffle = function(on){ if (A.ok) A.musicFilter.frequency.rampTo(on ? 500 : 20000, .3); };

  A.jingle = function(kind){
    if (!A.ok) return;
    const n = Tone.now() + .02;
    const seqs = {
      win:[72,76,79,84,88], lose:[67,63,60,55], level:[72,79,84,91], coin:[84,91], meme:[76,79,83,88],
      week:[60,64,67,72,76,79,84], strike:[50,49,48,47]
    };
    (seqs[kind] || seqs.win).forEach((m, i) => inst.bell.triggerAttackRelease(mtf(m), '8n', n + i * .085, .7));
  };

  /* ---------- ритм-игра: композиция песни ---------- */
  A.buildSong = function(song){
    const keyRoot = {C:48, 'C#':49, D:50, E:52, F:53, G:55, A:57, B:59}[song.key] || 57;
    const phrases = song.mel.split('|').map(p => p.trim().split(/\s+/).map(x => x === '.' ? null : parseInt(x, 10)));
    const spb = 60 / song.bpm, bar = spb * 4;
    const plan = [
      {k:'intro', ph:null}, {k:'intro', ph:null},
      {k:'verse', ph:0}, {k:'verse', ph:1}, {k:'verse', ph:2}, {k:'verse', ph:3},
      {k:'verse2', ph:0}, {k:'verse2', ph:1}, {k:'verse2', ph:2}, {k:'verse2', ph:3},
      {k:'chorus', ph:2, up:12}, {k:'chorus', ph:3, up:12}, {k:'chorus', ph:2, up:12}, {k:'chorus', ph:3, up:12},
      {k:'bridge', ph:1}, {k:'bridge', ph:0},
      {k:'chorus', ph:2, up:12}, {k:'chorus', ph:3, up:12}, {k:'chorus', ph:0, up:12}, {k:'chorus', ph:3, up:12},
      {k:'outro', ph:null}, {k:'outro', ph:null}
    ];
    const notes = [];
    plan.forEach((p, bi) => {
      if (p.ph == null) return;
      const ph = phrases[p.ph % phrases.length];
      ph.forEach((v, i) => {
        if (v == null) return;
        let t = bi * bar + i * spb / 2;
        notes.push({t, midi: keyRoot + 12 + v + (p.up || 0), bar:bi, sec:p.k, idx:i});
        if (p.k === 'verse2' && i % 2 === 1 && song.diff >= 2 && ph[i] != null && Math.random() < .35) {
          notes.push({t: t + spb / 4, midi: keyRoot + 12 + v + 2, bar:bi, sec:p.k, idx:i + .5, grace:true});
        }
      });
    });
    return {song, plan, notes, spb, bar, keyRoot, length: plan.length * bar};
  };
  A.playSong = function(built, startAt){
    if (!A.ok) return;
    stopLoop(); curTrack = 'song:' + built.song.id; A._vinylGain.gain.rampTo(0, .3);
    musicBus.volume.cancelScheduledValues(Tone.now()); musicBus.volume.value = db(A.vol.music);
    Tone.Transport.stop(); Tone.Transport.cancel(0); Tone.Transport.position = 0;
    Tone.Transport.bpm.value = built.song.bpm; Tone.Transport.swing = 0;
    const {plan, spb, bar, keyRoot, song} = built;
    const prog = song.prog;
    const minor = song.mode === 'minor';
    plan.forEach((p, bi) => {
      const t0 = bi * bar, ch = prog[bi % prog.length];
      const big = p.k === 'chorus', quiet = p.k === 'intro' || p.k === 'outro' || p.k === 'bridge';
      Tone.Transport.schedule(time => { inst.pad.triggerAttackRelease(ch.map(n => mtf(keyRoot + n)), bar * .95, time, quiet ? .4 : .6); }, t0);
      for (let i = 0; i < 8; i++) {
        const tt = t0 + i * spb / 2;
        Tone.Transport.schedule(time => {
          if (i % 2 === 0) inst.kick.triggerAttackRelease('C1', '8n', time, big ? 1 : .8);
          else if (big || song.bpm > 130) inst.hat.triggerAttackRelease('32n', time, .5);
          if (i === 2 || i === 6) inst.snare.triggerAttackRelease('16n', time, quiet ? .3 : .8);
          else if (!quiet || p.k === 'bridge') inst.hat.triggerAttackRelease('32n', time, .35);
          inst.bass.triggerAttackRelease(mtf(keyRoot + ch[0] - 12 + (i % 4 === 3 ? 12 : 0)), '16n', time, .75);
          if (big && (i === 1 || i === 3 || i === 5 || i === 7)) inst.keys.triggerAttackRelease(ch.map(n => mtf(keyRoot + 12 + n)), '16n', time, .35);
          if (p.k === 'outro' || p.k === 'intro') inst.arp.triggerAttackRelease(mtf(keyRoot + 24 + ch[i % 3]), '16n', time, .45);
        }, tt);
      }
    });
    built.notes.forEach(n => {
      Tone.Transport.schedule(time => inst.lead.triggerAttackRelease(mtf(n.midi), n.grace ? '32n' : '8n', time, .75), n.t);
    });
    Tone.Transport.start(Tone.now() + (startAt || .1));
  };
  A.songTime = function(){ return Tone.Transport.seconds; };
  A.stopSong = function(){
    if (!A.ok) return;
    Tone.Transport.stop(); Tone.Transport.cancel(0); curTrack = null;
    try { inst.pad.releaseAll(); inst.keys.releaseAll(); } catch(e){}
    Tone.Transport.start('+0.05');
  };
  A.pauseSong = function(p){ if (!A.ok) return; if (p) Tone.Transport.pause(); else Tone.Transport.start(); };

  /* ---------- голос (бормотание в стиле Animal Crossing) ---------- */
  A.babble = function(text, voice, onSyl){
    const letters = (text || '').replace(/[^a-zа-яё0-9]/gi, '');
    const n = Math.min(60, Math.ceil(letters.length / 2));
    const per = voice === 'mikhalych' ? .11 : voice === 'ester' ? .085 : .068;
    const dur = n * per;
    if (A.ok && A.vol.voice > 0) {
      const now = Tone.now() + .02;
      const base = voice === 'mikhalych' ? 43 : voice === 'ester' ? 60 : 76;
      const syn = voice === 'mikhalych' ? inst.mikhVoice : voice === 'ester' ? inst.esterVoice : inst.voice;
      const low = 'аоуыэaou', high = 'иеёюяie';
      const shout = /[!?]{1}/.test(text) && text === text.toUpperCase();
      for (let i = 0; i < n; i++) {
        const ch = letters[i * 2].toLowerCase();
        let m = base + (high.includes(ch) ? 3 : low.includes(ch) ? -2 : 0) + Math.round((Math.random() - .5) * 4) + (shout ? 5 : 0);
        if (i === n - 1 && /\?\s*$/.test(text)) m += 4;
        const t = now + i * per;
        try { syn.triggerAttackRelease(mtf(m), per * .7, t, .8); if (voice !== 'ester' && voice !== 'mikhalych' && i % 3 === 0) inst.voice2.triggerAttackRelease(mtf(m + 12), per * .4, t, .3); } catch(e){}
      }
    }
    if (onSyl) {
      for (let i = 0; i < n; i++) setTimeout(() => onSyl(i, n), i * per * 1000);
    }
    return dur;
  };

  return A;
})();
