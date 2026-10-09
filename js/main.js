(() => {
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const dec = n => n.toFixed(1).replace('.', ',');

  const C = {
    ink: '#263238', muted: '#56636A', floor: '#FAF9F5', floor2: '#F3F2EC', wall: '#D3D7CE', wallD: '#BFC5B8',
    acc: '#3F7564', accSoft: '#DCEBE3', white: '#FFFFFF',
    blue: '#DCE7F7', apricot: '#F8DECB', mint: '#D6ECDF', lilac: '#E6E0F6', butter: '#F5EBC6', street: '#E3E7E0'
  };
  const KINDS = [
    { k: 'part', c: '#6FAE92', w: .62 }, { k: 'vip', c: '#E39A6E', w: .1 },
    { k: 'press', c: '#9A88D6', w: .1 }, { k: 'speaker', c: '#6E9BD6', w: .18 }
  ];
  const pickKind = () => { let r = Math.random(); for (const k of KINDS) if ((r -= k.w) < 0) return k; return KINDS[0]; };
  const FONT = (s, w = 600) => `${w} ${s}px Rubik, system-ui, sans-serif`;

  /* ---------- рисование ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function label(ctx, text, x, y, { size = 14, color = C.muted, align = 'left', weight = 600 } = {}) {
    ctx.font = FONT(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  }
  function pill(ctx, x, y, text, bg = C.ink, fg = C.white) {
    ctx.font = FONT(14); const w = ctx.measureText(text).width + 20;
    rr(ctx, x - w / 2, y - 13, w, 26, 13); ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  }
  function room(ctx, r, { fill, stroke = C.wall, name, lw = 4 }) {
    rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
    if (name) label(ctx, name, r.x + 16, r.y + 22, { color: C.ink });
  }

  /* ---------- сцена на canvas: размер, видимость, цикл ---------- */
  function scene(canvas, { layout, step, draw }) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, visible = false, running = false, last = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      w = r.width; h = r.height; if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); layout(w, h);
      if (!running) render();
    };
    const render = () => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h); };
    const loop = t => {
      if (!visible) { running = false; return; }
      const dt = Math.min(.05, (t - last) / 1000); last = t; step(dt); render(); requestAnimationFrame(loop);
    };
    new ResizeObserver(resize).observe(canvas); resize();
    if (reduce) { for (let i = 0; i < 600; i++) step(1 / 30); render(); return { render }; }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
    }).observe(canvas);
    return { render };
  }

  /* ---------- модель входа: гости, очереди, стойки ---------- */
  class Entrance {
    constructor(o) {
      Object.assign(this, { n: 4, rate: 1, service: 2, speed: 110, pops: true, maxQueue: Infinity, onServe: null, after: null }, o);
      this.agents = []; this.popList = []; this.acc = 0; this.D = [];
    }
    layout(L) { this.L = L; this.rebuild(); }
    setDesks(n) { if (n !== this.n) { this.n = n; this.rebuild(); } }
    rebuild() {
      const L = this.L; if (!L) return;
      const n = this.n, span = L.x1 - L.x0;
      this.D = Array.from({ length: n }, (_, i) => ({ x: n === 1 ? (L.x0 + L.x1) / 2 : L.x0 + span * i / (n - 1), q: [], busy: null, t: 0, svc: 0 }));
      this.dw = Math.max(18, Math.min(64, n > 1 ? span / (n - 1) * .62 : 64));
      for (const a of this.agents) {
        if (a.st === 'svc') { a.st = 'out'; a.path = this.after(a, { x: a.x }, L, this.dw); }
      }
      for (const a of this.agents) if (a.st === 'q') this.join(a);
    }
    load(d) { return d.q.length + (d.busy ? 1 : 0); }
    join(a) {
      let best = this.D[0];
      for (const d of this.D) if (this.load(d) < this.load(best) || (this.load(d) === this.load(best) && Math.random() < .35)) best = d;
      best.q.push(a); a.desk = best; a.st = 'q';
    }
    queued() { let s = 0; for (const d of this.D) s += d.q.length; return s; }
    slot(d, i) {
      const L = this.L, per = Math.max(1, Math.floor((L.deskY - L.gap - L.qTop) / L.sp));
      const col = Math.floor(i / per), row = i % per;
      const off = col === 0 ? 0 : (col % 2 ? 1 : -1) * Math.ceil(col / 2) * Math.min(12, this.dw * .4);
      return [d.x + off, L.deskY - L.gap - row * L.sp];
    }
    step(dt) {
      const L = this.L; if (!L) return;
      this.acc += dt * this.rate;
      while (this.acc >= 1) {
        this.acc--;
        if (this.queued() < this.maxQueue) {
          const k = pickKind();
          const a = { x: L.door[0] + (Math.random() - .5) * L.doorW * .6, y: L.door[1] - 12, c: k.c, k: k.k, st: 'q', path: null };
          this.agents.push(a); this.join(a);
        }
      }
      for (const d of this.D) {
        if (d.busy) {
          d.t += dt;
          if (d.t >= d.svc) {
            const a = d.busy; d.busy = null; a.st = 'out'; a.path = this.after(a, d, L, this.dw);
            if (this.pops) this.popList.push({ x: d.x, y: L.deskY - L.gap - 24 - (this.D.indexOf(d) % 2) * 30, s: dec(6 + Math.random() * 5) + ' с', t: 0 });
            this.onServe && this.onServe(a);
          }
        }
        if (!d.busy && d.q.length) {
          const a = d.q[0], [sx, sy] = this.slot(d, 0);
          if (Math.hypot(a.x - sx, a.y - sy) < 3) { d.q.shift(); d.busy = a; d.t = 0; d.svc = this.service * (.7 + Math.random() * .6); a.st = 'svc'; }
        }
      }
      const sp = this.speed * dt;
      this.agents = this.agents.filter(a => {
        if (a.st === 'idle') { a.life -= dt; return a.life > 0; }
        let tx, ty;
        if (a.st === 'q') [tx, ty] = this.slot(a.desk, a.desk.q.indexOf(a));
        else if (a.st === 'svc') [tx, ty] = this.slot(a.desk, 0);
        else {
          if (!a.path.length) { if (a.stay) { a.st = 'idle'; a.life = a.stay; return true; } return false; }
          [tx, ty] = a.path[0];
        }
        const dx = tx - a.x, dy = ty - a.y, dd = Math.hypot(dx, dy);
        if (dd <= sp) { a.x = tx; a.y = ty; if (a.st === 'out') a.path.shift(); }
        else { a.x += dx / dd * sp; a.y += dy / dd * sp; }
        return true;
      });
      this.popList = this.popList.filter(p => (p.t += dt) < 1.4);
    }
    drawAgents(ctx, r = 6) {
      for (const a of this.agents) {
        ctx.globalAlpha = a.st === 'idle' && a.life < 1 ? Math.max(0, a.life) : 1;
        ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 7); ctx.fillStyle = a.c; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = C.white; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    drawPops(ctx, big) {
      for (const p of this.popList) {
        const k = p.t / 1.4; ctx.globalAlpha = k < .15 ? k / .15 : k > .75 ? (1 - k) / .25 : 1;
        pill(ctx, p.x, p.y - k * 14, big ? '✓ ' + p.s : p.s, big ? C.acc : C.ink);
      }
      ctx.globalAlpha = 1;
    }
    drawDesks(ctx, { brand = false, glow = false } = {}) {
      const L = this.L, w = this.dw;
      for (const d of this.D) {
        rr(ctx, d.x - w / 2, L.deskY - 2, w, 22, 7); ctx.fillStyle = brand ? C.acc : '#C5E3D1'; ctx.fill();
        ctx.lineWidth = glow ? 3 : 2; ctx.strokeStyle = glow ? C.acc : '#8DBFA4'; ctx.stroke();
        ctx.beginPath(); ctx.arc(d.x, L.deskY + 34, Math.min(8, w * .2), 0, 7); ctx.fillStyle = '#B9C6C0'; ctx.fill();
      }
    }
    drawTurnstiles(ctx, glow) {
      const L = this.L, w = this.dw;
      ctx.fillStyle = glow ? C.acc : C.wallD;
      let x = L.x0 - w;
      const gaps = this.D.map(d => d.x + w / 2 + 8).sort((a, b) => a - b);
      for (const g of gaps) { if (g - 10 - x > 4) { rr(ctx, x, L.turnY - 3, g - 10 - x, 6, 3); ctx.fill(); } x = g + 10; }
      if (L.x1 + w - x > 4) { rr(ctx, x, L.turnY - 3, L.x1 + w - x, 6, 3); ctx.fill(); }
    }
    drawLanes(ctx, glow) {
      const L = this.L;
      ctx.strokeStyle = glow ? C.acc : '#E1E3DC'; ctx.lineWidth = glow ? 3 : 2; ctx.setLineDash([2, 8]);
      for (const d of this.D) {
        const o = Math.min(14, this.dw * .45);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d.x + s * o, L.qTop + 10); ctx.lineTo(d.x + s * o, L.deskY - 10); ctx.stroke(); }
      }
      ctx.setLineDash([]);
    }
  }
  const exitAfter = (exitY) => (a, d, L, dw) => {
    const x = d.x + dw / 2 + 8;
    return [[x, L.deskY + 10], [x, L.turnY], [x + (Math.random() - .5) * 16, exitY]];
  };

  /* ---------- A · вход ---------- */
  const liveEl = $('#liveCount'); let live = 4812;
  const entry = new Entrance({
    n: 4, rate: 2, service: 1.6, speed: 130,
    onServe: () => { if (Math.random() < .5) liveEl.textContent = fmt(++live); }
  });
  scene($('#entrySim'), {
    layout(w, h) {
      const wallY = h * .12;
      entry.after = exitAfter(h + 20);
      entry.layout({ wallY, door: [w * .64, wallY + 3], doorW: Math.min(150, w * .28), x0: w * .42, x1: w * .88, deskY: h * .6, gap: 20, sp: 15, qTop: wallY + 24, turnY: h * .78 });
    },
    step: dt => entry.step(dt),
    draw(ctx, w, h) {
      const L = entry.L;
      ctx.fillStyle = C.street; ctx.fillRect(0, 0, w, L.wallY);
      label(ctx, 'Улица', 20, L.wallY / 2);
      ctx.fillStyle = C.wall;
      ctx.fillRect(0, L.wallY, L.door[0] - L.doorW / 2, 6); ctx.fillRect(L.door[0] + L.doorW / 2, L.wallY, w, 6);
      label(ctx, 'Вход', L.door[0], L.wallY - 16, { align: 'center', color: C.ink });
      entry.drawLanes(ctx);
      entry.drawDesks(ctx);
      entry.drawTurnstiles(ctx);
      label(ctx, 'Стойки', L.x0 - entry.dw / 2 - 16, L.deskY + 9, { align: 'right' });
      label(ctx, 'Турникеты', w - 16, L.turnY + 20, { align: 'right' });
      label(ctx, 'В залы ↓', w - 20, h - 18, { align: 'right' });
      entry.drawAgents(ctx);
      entry.drawPops(ctx);
    }
  });

  /* ---------- B · маршрут гостя ---------- */
  const routeBox = $('#routeBox'), base = $('#routeBase'), done = $('#routeDone'), you = $('#you');
  const stops = $$('.stop');
  const total = base.getTotalLength();
  done.style.strokeDasharray = `${total} ${total}`;
  const stopPts = [[140, 40], [860, 330], [140, 620], [860, 910]];
  const stopLen = stopPts.map(([sx, sy]) => {
    let best = 0, bd = Infinity;
    for (let l = 0; l <= total; l += 4) { const p = base.getPointAtLength(l), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = l; } }
    return best;
  });
  let routeTick = false;
  function updateRoute() {
    routeTick = false;
    if (getComputedStyle(base.ownerSVGElement).display === 'none') { stops.forEach(s => s.classList.add('is-reached')); return; }
    const r = routeBox.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * .55 - r.top) / r.height));
    const len = total * p;
    done.style.strokeDashoffset = total - len;
    const pt = base.getPointAtLength(len);
    you.style.transform = `translate(${pt.x / 1000 * r.width}px, ${pt.y / 1200 * r.height}px)`;
    stops.forEach((s, i) => s.classList.toggle('is-reached', len >= stopLen[i] - 6 || reduce));
  }
  addEventListener('scroll', () => { if (!routeTick) { routeTick = true; requestAnimationFrame(updateRoute); } }, { passive: true });
  addEventListener('resize', updateRoute); updateRoute();

  /* ---------- C · залы и легенда ---------- */
  let hl = null, hlAuto = !reduce, hlIdx = -1;
  const hall = new Entrance({ n: 3, rate: 1.5, service: 1.8, speed: 120 });
  let R = {};
  const seats = [];
  scene($('#hallSim'), {
    layout(w, h) {
      const narrow = w < 520;
      R = narrow ? {
        plen: { x: w * .04, y: h * .36, w: w * .44, h: h * .3 },
        vip: { x: w * .52, y: h * .36, w: w * .44, h: h * .3 },
        press: { x: w * .04, y: h * .69, w: w * .44, h: h * .28 },
        expo: { x: w * .52, y: h * .69, w: w * .44, h: h * .28 }
      } : {
        plen: { x: w * .04, y: h * .44, w: w * .56, h: h * .52 },
        vip: { x: w * .66, y: h * .04, w: w * .3, h: h * .27 },
        press: { x: w * .66, y: h * .35, w: w * .3, h: h * .25 },
        expo: { x: w * .66, y: h * .64, w: w * .3, h: h * .32 }
      };
      seats.length = 0;
      const cols = narrow ? 6 : 10, rows = narrow ? 3 : 5;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) seats.push([R.plen.x + R.plen.w * (.1 + .8 * c / (cols - 1)), R.plen.y + R.plen.h * (.32 + .55 * r / (rows - 1))]);
      const corr = narrow ? [w * .5, h * .32] : [w * .5, h * .38];
      const inRoom = (rm, pad = .18) => [rm.x + rm.w * (pad + Math.random() * (1 - 2 * pad)), rm.y + rm.h * (pad + .12 + Math.random() * (1 - 2 * pad - .12))];
      const doorOf = narrow
        ? { plen: [R.plen.x + R.plen.w * .7, R.plen.y], vip: [R.vip.x + R.vip.w * .3, R.vip.y], press: [R.press.x + R.press.w * .7, R.press.y], expo: [R.expo.x + R.expo.w * .3, R.expo.y] }
        : { plen: [R.plen.x + R.plen.w * .7, R.plen.y], vip: [R.vip.x, R.vip.y + R.vip.h * .6], press: [R.press.x, R.press.y + R.press.h * .5], expo: [R.expo.x, R.expo.y + R.expo.h * .3] };
      hall.after = (a, d, L, dw) => {
        const x = d.x + dw / 2 + 8;
        const target = a.k === 'vip' ? 'vip' : a.k === 'press' ? 'press' : a.k === 'speaker' ? 'plen' : (Math.random() < .55 ? 'plen' : 'expo');
        const end = target === 'plen' ? seats[Math.random() * seats.length | 0] : inRoom(R[target]);
        a.stay = 5 + Math.random() * 5;
        return [[x, L.deskY + 10], [x, L.turnY], corr, doorOf[target], end];
      };
      hall.layout(narrow
        ? { door: [w * .5, 0], doorW: 90, x0: w * .22, x1: w * .78, deskY: h * .15, gap: 16, sp: 12, qTop: 22, turnY: h * .28 }
        : { door: [w * .2, 0], doorW: 90, x0: w * .1, x1: w * .38, deskY: h * .22, gap: 18, sp: 14, qTop: 18, turnY: h * .33 });
    },
    step: dt => { hall.step(dt); if (hall.agents.length > 150) hall.agents.splice(0, hall.agents.length - 150); },
    draw(ctx, w, h) {
      const L = hall.L, t = performance.now() / 1000;
      const accessColor = { vip: '#E39A6E', press: '#9A88D6', expo: '#6FAE92', plen: '#6E9BD6' };
      const ac = k => hl === 'access' ? accessColor[k] : C.wall;
      room(ctx, R.plen, { fill: C.blue, name: 'Пленарный зал', stroke: ac('plen') });
      room(ctx, R.vip, { fill: C.apricot, name: 'VIP-лаунж', stroke: ac('vip') });
      room(ctx, R.press, { fill: C.lilac, name: 'Пресс-центр', stroke: ac('press') });
      room(ctx, R.expo, { fill: C.mint, name: 'Выставка', stroke: ac('expo') });
      ctx.fillStyle = 'rgba(38,50,56,.08)';
      for (const [sx, sy] of seats) { ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(38,50,56,.1)';
      for (let i = 0; i < 4; i++) { const ex = R.expo, cw = ex.w * .34; rr(ctx, ex.x + ex.w * .12 + (i % 2) * ex.w * .42, ex.y + ex.h * .36 + (i > 1 ? ex.h * .3 : 0), cw, ex.h * .18, 6); ctx.fill(); }
      rr(ctx, R.vip.x + R.vip.w * .15, R.vip.y + R.vip.h * .55, R.vip.w * .3, 16, 8); ctx.fill();
      rr(ctx, R.vip.x + R.vip.w * .55, R.vip.y + R.vip.h * .55, R.vip.w * .3, 16, 8); ctx.fill();
      rr(ctx, R.press.x + R.press.w * .2, R.press.y + R.press.h * .55, R.press.w * .6, 14, 7); ctx.fill();
      if (hl === 'access') {
        const tag = (rm, t, c) => { ctx.font = FONT(14); pill(ctx, rm.x + 16 + (ctx.measureText(t).width + 20) / 2, rm.y + 52, t, c, C.ink); };
        tag(R.vip, 'Только VIP', '#E39A6E'); tag(R.press, 'Только пресса', '#9A88D6'); tag(R.plen, 'Все гости', '#6E9BD6'); tag(R.expo, 'Все гости', '#6FAE92');
      }
      label(ctx, 'Вход', L.door[0], 12, { align: 'center', color: C.ink });
      if (hl === 'brand') { rr(ctx, L.door[0] - 70, 24, 140, 22, 11); ctx.fillStyle = C.acc; ctx.fill(); label(ctx, 'Ваш бренд', L.door[0], 36, { align: 'center', color: C.white }); }
      hall.drawLanes(ctx, hl === 'queue');
      hall.drawDesks(ctx, { brand: hl === 'brand', glow: hl === 'gear' });
      hall.drawTurnstiles(ctx, hl === 'gear');
      if (hl === 'queue') pill(ctx, (L.x0 + L.x1) / 2, L.qTop + 40, 'Ожидание ≈ 2 мин', C.acc);
      if (hl === 'gear') { pill(ctx, L.x1 + 76, L.deskY + 8, '40 стоек', C.acc); pill(ctx, L.x1 + 84, L.turnY, '12 турникетов', C.acc); }
      if (hl === 'staff') {
        const langs = ['RU · KZ', 'EN · 中文', 'TR · RU'];
        hall.D.forEach((d, i) => pill(ctx, d.x, L.deskY + 62, langs[i], C.acc));
      }
      if (hl === 'soft' || hl === 'data') {
        const sv = hl === 'soft' ? [w * .5, h * .06] : [w * .5, h * .4];
        const from = hl === 'soft' ? hall.D.map(d => [d.x, L.deskY]) : [[R.plen.x + R.plen.w / 2, R.plen.y + 30], [R.vip.x + 20, R.vip.y + R.vip.h / 2], [R.press.x + 20, R.press.y + R.press.h / 2], [R.expo.x + 20, R.expo.y + R.expo.h / 2]];
        ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 30;
        for (const [fx, fy] of from) { ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sv[0], sv[1]); ctx.stroke(); }
        ctx.setLineDash([]);
        pill(ctx, sv[0], sv[1], hl === 'soft' ? 'Сервер DJEDAI · онлайн' : 'Одна база без дублей', C.acc);
      }
      hall.drawAgents(ctx, hl === 'access' ? 7 : 5);
      hall.drawPops(ctx, hl === 'speed');
      if (hl === 'speed') pill(ctx, (L.x0 + L.x1) / 2, L.qTop + 40, 'Бейдж за 10 секунд', C.acc);
    }
  });
  const legendBtns = $$('.legend button');
  const setHl = (key, btn) => { hl = key; legendBtns.forEach(b => b.classList.toggle('is-on', b === btn)); };
  legendBtns.forEach(b => {
    const on = () => { hlAuto = false; setHl(b.dataset.hl, b); };
    b.addEventListener('mouseenter', on); b.addEventListener('focus', on); b.addEventListener('click', on);
  });
  $('.legend').addEventListener('mouseleave', () => { if (!hlAuto) setHl(null, null); });
  setInterval(() => { if (!hlAuto || document.hidden) return; hlIdx = (hlIdx + 1) % legendBtns.length; setHl(legendBtns[hlIdx].dataset.hl, legendBtns[hlIdx]); }, 3500);

  /* ---------- D · симулятор ---------- */
  const guests = $('#cGuests'), win = $('#cWindow'), pre = $('#cPre');
  let userDesks = null, last = {};
  const calcSim = new Entrance({ n: 9, rate: 2, service: 3, pops: false, maxQueue: 180, speed: 140 });
  scene($('#calcSim'), {
    layout(w, h) {
      const wallY = h * .1;
      calcSim.after = exitAfter(h + 20);
      calcSim.layout({ wallY, door: [w / 2, wallY + 3], doorW: Math.min(160, w * .3), x0: w * .08, x1: w * .92, deskY: h * .6, gap: 18, sp: 13, qTop: wallY + 20, turnY: h * .76 });
    },
    step: dt => calcSim.step(dt),
    draw(ctx, w, h) {
      const L = calcSim.L;
      ctx.fillStyle = C.street; ctx.fillRect(0, 0, w, L.wallY);
      ctx.fillStyle = C.wall; ctx.fillRect(0, L.wallY, L.door[0] - L.doorW / 2, 6); ctx.fillRect(L.door[0] + L.doorW / 2, L.wallY, w, 6);
      label(ctx, 'Вход', L.door[0], L.wallY / 2, { align: 'center', color: C.ink });
      calcSim.drawLanes(ctx);
      calcSim.drawDesks(ctx);
      calcSim.drawTurnstiles(ctx);
      calcSim.drawAgents(ctx, calcSim.n > 12 ? 4 : 5);
      if (last.vis && last.vis < last.S) label(ctx, `1 стойка на схеме = ${dec(last.S / last.vis).replace(',0', '')} реальных`, w - 16, L.wallY / 2, { align: 'right', size: 14, weight: 400 });
    }
  });
  function paintRange(r) { r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%'); }
  function calc() {
    const G = +guests.value, W = +win.value, P = +pre.value / 100;
    [guests, win, pre].forEach(paintRange);
    $('#oGuests').textContent = fmt(G); $('#oWindow').textContent = dec(W); $('#oPre').textContent = Math.round(P * 100) + '%';
    // зарегистрированный онлайн ≈ 8 с у стойки, без регистрации ≈ 30 с
    const avg = P * 8 + (1 - P) * 30, perStation = 3600 / avg;
    // половина гостей приходит в первой половине заезда
    const peakRate = (G * .5) / (W / 2);
    const rec = Math.max(2, Math.ceil(peakRate / perStation * 1.1));
    const S = userDesks ?? rec;
    const rho = peakRate / (S * perStation);
    const staff = S + Math.ceil(S / 5);
    $('#rStations').textContent = rec; $('#oDesks').textContent = S;
    $('#rStaff').textContent = staff; $('#rAvg').textContent = dec(avg) + ' с';
    const state = $('#simState');
    if (rho >= 1) { $('#rQueue').textContent = 'растёт без конца'; state.textContent = 'Стоек не хватает — очередь растёт'; state.dataset.s = 'bad'; }
    else {
      const wait = Math.max(1, Math.round(avg * rho / (1 - rho) / 60));
      $('#rQueue').textContent = 'до ' + wait + ' мин';
      state.textContent = rho < .92 ? 'Очередь под контролем' : 'Очередь на пределе'; state.dataset.s = rho < .92 ? 'ok' : 'warn';
    }
    // визуальная модель: 1 секунда схемы = 1 минута события, одна точка = K гостей
    const F = 60, perSec = peakRate / 3600 * F, K = Math.max(1, Math.ceil(perSec / 3));
    const vis = Math.min(S, 16);
    calcSim.rate = perSec / K;
    calcSim.service = K * avg / (S / vis) / F;
    calcSim.setDesks(vis);
    last = { G, W, P, S, rec, staff, vis };
  }
  [guests, win, pre].forEach(el => el.addEventListener('input', calc));
  $('#dMinus').addEventListener('click', () => { userDesks = Math.max(1, (userDesks ?? last.S) - 1); calc(); });
  $('#dPlus').addEventListener('click', () => { userDesks = Math.min(300, (userDesks ?? last.S) + 1); calc(); });
  $('#dReset').addEventListener('click', () => { userDesks = null; calc(); });
  calc();
  $('#calcToForm').addEventListener('click', () => {
    const t = $('#comment'); if (t.value.trim()) return;
    t.value = `Около ${fmt(last.G)} гостей, основной заезд ${dec(last.W)} ч, онлайн-регистрация ${Math.round(last.P * 100)}%. ` +
      `По симулятору на сайте: ${last.S} стоек, ${last.staff} регистраторов.`;
  });

  /* ---------- E · табло из точек ---------- */
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const kindBy = () => { let r = rnd(); for (const k of KINDS) if ((r -= k.w) < 0) return k.c; return KINDS[0].c; };
  const series = [40, 95, 210, 420, 610, 720, 560, 410, 300, 240, 190, 160, 210, 260, 180, 130, 90, 70, 50, 30];
  const tlabel = i => { const m = 8 * 60 + i * 15; return `${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const chart = $('#dotChart');
  chart.innerHTML = series.map((v, i) => {
    const n = Math.max(1, Math.round(v / 40));
    return `<div class="col" data-i="${i}">` + Array.from({ length: n }, (_, j) => `<i style="--c:${kindBy()};transition-delay:${i * 40 + j * 25}ms"></i>`).join('') + '</div>';
  }).join('');
  $('#dotAxis').innerHTML = [0, 4, 8, 12, 16, 19].map(i => `<span>${tlabel(i)}</span>`).join('');
  chart.addEventListener('pointerover', e => {
    const c = e.target.closest('.col'); if (!c) return;
    const i = +c.dataset.i; $('#dotTip').textContent = `${tlabel(i)}–${tlabel(i + 1)} · ${fmt(series[i])} гостей`;
  });
  chart.addEventListener('pointerleave', () => { $('#dotTip').textContent = 'Наведите на столбец'; });
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { chart.classList.add('is-in'); o.disconnect(); } }, { threshold: .3 }).observe(chart);
  const waffle = []; [[KINDS[0].c, 140], [KINDS[1].c, 18], [KINDS[2].c, 16], [KINDS[3].c, 26]].forEach(([c, n]) => { for (let i = 0; i < n; i++) waffle.push(c); });
  $('#waffle').innerHTML = waffle.map(c => `<i style="--c:${c}"></i>`).join('');

  /* ---------- F · залы заказчиков: гуляющие гости ---------- */
  $$('#rooms li').forEach(li => {
    for (let i = 0; i < 3; i++) {
      const g = document.createElement('span'); g.className = 'g'; g.setAttribute('aria-hidden', 'true');
      g.style.left = 10 + Math.random() * 76 + '%'; g.style.top = (i % 2 ? 72 + Math.random() * 10 : 10 + Math.random() * 10) + '%';
      g.style.setProperty('--gc', KINDS[Math.random() * 4 | 0].c);
      g.style.setProperty('--tx', (Math.random() * 40 - 20).toFixed(0) + 'px'); g.style.setProperty('--ty', (Math.random() * 8 - 4).toFixed(0) + 'px');
      g.style.setProperty('--d', (2 + Math.random() * 3).toFixed(1) + 's');
      li.appendChild(g);
    }
  });

  /* ---------- «Вы здесь» и мини-карта ---------- */
  const hereName = $('#hereName'), mmLinks = $$('.mm a');
  const zio = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    hereName.textContent = e.target.dataset.name;
    mmLinks.forEach(a => a.classList.toggle('is-on', a.dataset.for === e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('.zone').forEach(z => zio.observe(z));

  /* ---------- G · инфостойка ---------- */
  const form = $('#form'), walker = $('#walker'), send = $('#send');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach(f => {
      const v = f.value.trim();
      const bad = !v || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) || (f.type === 'tel' && v.replace(/\D/g, '').length < 10);
      f.closest('.inp').classList.toggle('is-err', bad);
      if (bad && ok) { f.focus(); ok = false; }
    });
    if (!ok) return;
    send.disabled = true; send.textContent = 'Отправлено';
    const fr = form.getBoundingClientRect(), br = send.getBoundingClientRect(), dr = $('#deskTop').getBoundingClientRect();
    const sx = br.left - fr.left + br.width / 2 - 9, sy = br.top - fr.top - 12;
    const ex = dr.left - fr.left + dr.width / 2 - 9, ey = dr.top - fr.top - 20;
    let finished = false;
    const finish = () => { if (finished) return; finished = true; $('#deskDone').textContent = 'Заявка принята — ответим в течение рабочего дня.'; };
    setTimeout(finish, 2400);
    if (reduce || getComputedStyle($('.info')).gridTemplateColumns.split(' ').length < 2) { finish(); return; }
    walker.animate([
      { transform: `translate(${sx}px,${sy}px)`, opacity: 0 },
      { transform: `translate(${sx}px,${sy}px)`, opacity: 1, offset: .1 },
      { transform: `translate(${ex}px,${sy}px)`, opacity: 1, offset: .55 },
      { transform: `translate(${ex}px,${ey}px)`, opacity: 1, offset: .95 },
      { transform: `translate(${ex}px,${ey}px)`, opacity: 0 }
    ], { duration: 2200, easing: 'ease-in-out', fill: 'forwards' }).onfinish = finish;
  });
  form.addEventListener('input', e => e.target.closest('.inp')?.classList.remove('is-err'));
})();
