(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const dec = n => n.toFixed(1).replace('.', ',');

  /* QR: условный рисунок, не настоящий код */
  function drawQR(svg, seed) {
    const N = 25, cells = [];
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const finder = (x, y) => {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++)
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i > 1 && i < 5 && j > 1 && j < 5)) cells.push([x + i, y + j]);
    };
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!inFinder(x, y) && rnd() > .52) cells.push([x, y]);
    svg.innerHTML = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('');
    svg.setAttribute('fill', '#111214');
  }
  $$('.qr').forEach((svg, i) => drawQR(svg, 7331 + i * 911));

  /* бейдж меняет гостей */
  const people = [
    ['Айгерим Садыкова', 'KazMunai Systems', 'vip'], ['Данияр Ахметов', 'Astana Hub', 'part'],
    ['Ольга Ким', 'Forbes Kazakhstan', 'press'], ['Ерлан Жумабеков', 'Samruk Energy', 'speaker'],
    ['Мадина Нурланова', 'Kaspi Pay', 'part'], ['Тимур Исаев', 'DJEDAI', 'staff'],
    ['Арман Касымов', 'QazaqGaz', 'vip'], ['Жанар Омарова', 'Kursiv Media', 'press']
  ];
  const band = { part: 'Участник · зал А', vip: 'VIP · все зоны', press: 'Пресса · пресс-центр', speaker: 'Спикер · сцена', staff: 'Организатор' };
  let pi = 0;
  function setBadge([name, org, s]) {
    const parts = name.split(' ');
    $('#badgeName').innerHTML = parts.join('<br>');
    $('#badgeOrg').textContent = org;
    $('#badgeAva').textContent = parts.map(w => w[0]).join('').slice(0, 2);
    const st = $('#badgeStatus'); st.dataset.s = s; st.textContent = band[s];
  }
  if (!reduce) setInterval(() => { if (!document.hidden) setBadge(people[++pi % people.length]); }, 3500);

  /* наклон бейджа за курсором */
  const badge = $('#badge'), visual = $('.hero__visual');
  if (!reduce && matchMedia('(hover: hover)').matches) {
    visual.addEventListener('pointermove', e => {
      const r = badge.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      badge.classList.add('is-tilt');
      badge.style.transform = `perspective(900px) rotateY(${x * 16}deg) rotateX(${-y * 10}deg) rotate(${x * 3}deg)`;
    });
    visual.addEventListener('pointerleave', () => { badge.style.transform = ''; badge.classList.remove('is-tilt'); });
  }

  /* процесс: вкладки */
  const tabs = $$('.flow__tabs [role=tab]'), panels = $$('.panel');
  let cur = 0, auto = !reduce, timerRaf;
  function show(i) {
    cur = i;
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    panels.forEach((p, k) => p.classList.toggle('is-on', k === i));
    if (i === 1) runTimer();
  }
  function runTimer() {
    cancelAnimationFrame(timerRaf);
    const el = $('#stepTimer'), t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / 1500);
      el.textContent = dec(7.5 * (1 - Math.pow(1 - k, 2)));
      if (k < 1) timerRaf = requestAnimationFrame(step);
    };
    timerRaf = requestAnimationFrame(step);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { auto = false; show(i); });
    t.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault(); auto = false;
      const n = (cur + d + tabs.length) % tabs.length; show(n); tabs[n].focus();
    });
  });
  let flowVisible = false;
  new IntersectionObserver(([en]) => { flowVisible = en.isIntersecting; }).observe($('.flow'));
  setInterval(() => { if (auto && flowVisible && !document.hidden) show((cur + 1) % tabs.length); }, 5200);

  /* появление при прокрутке, полосы очередей, график */
  const series = [40, 95, 210, 420, 610, 720, 560, 410, 300, 240, 190, 160, 210, 260, 180, 130, 90, 70, 50, 30];
  const chart = $('#chart'), tip = $('#chartTip'), max = Math.max(...series);
  const label = i => { const m = 8 * 60 + i * 15; return `${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  chart.innerHTML = series.map((v, i) => `<i data-i="${i}"${v === max ? ' class="peak"' : ''}></i>`).join('');
  $('#chartAxis').innerHTML = [0, 4, 8, 12, 16, 19].map(i => `<span>${label(i)}</span>`).join('');
  const growChart = () => $$('i', chart).forEach((b, i) => setTimeout(() => { b.style.height = series[i] / max * 100 + '%'; }, reduce ? 0 : i * 35));
  chart.addEventListener('pointerover', e => {
    const b = e.target.closest('i'); if (!b) return;
    const i = +b.dataset.i;
    tip.textContent = `${label(i)}–${label(i + 1)} · ${fmt(series[i])} гостей`;
  });
  chart.addEventListener('pointerleave', () => { tip.textContent = 'Наведите на столбец'; });

  const targets = $$('.sec-head, .cols article, .flow, .b, .calc, .dash, .clients');
  if (!reduce) targets.forEach(el => el.classList.add('rv-up'));
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    if (en.target.matches('.dash')) growChart();
    io.unobserve(en.target);
  }), { threshold: .15 });
  targets.forEach(el => io.observe(el));

  /* расчёт */
  const guests = $('#cGuests'), win = $('#cWindow'), pre = $('#cPre');
  let last = {};
  function calc() {
    const G = +guests.value, W = +win.value, P = +pre.value / 100;
    [guests, win, pre].forEach(r => r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%'));
    $('#oGuests').textContent = fmt(G);
    $('#oWindow').textContent = dec(W);
    $('#oPre').textContent = Math.round(P * 100) + '%';

    // зарегистрированный онлайн ≈ 8 с у стойки, без регистрации ≈ 30 с
    const avg = P * 8 + (1 - P) * 30;
    const perStation = 3600 / avg;
    // половина гостей приходит в первой половине заезда
    const peakRate = (G * .5) / (W / 2);
    const stations = Math.max(2, Math.ceil(peakRate / perStation * 1.1));
    const rho = peakRate / (stations * perStation);
    const wait = Math.max(1, Math.round(avg * rho / (1 - rho) / 60));
    const staff = stations + Math.ceil(stations / 5);

    $('#rStations').textContent = stations;
    $('#rStaff').textContent = staff;
    $('#rAvg').textContent = dec(avg) + ' с';
    $('#rQueue').textContent = 'до ' + wait + ' мин';
    last = { G, W, P, stations, staff };
  }
  [guests, win, pre].forEach(el => el.addEventListener('input', calc));
  calc();

  $('#calcToForm').addEventListener('click', () => {
    const t = $('#comment');
    if (t.value.trim()) return;
    t.value = `Около ${fmt(last.G)} гостей, основной заезд ${dec(last.W)} ч, онлайн-регистрация ${Math.round(last.P * 100)}%. ` +
      `По расчёту на сайте: ${last.stations} стоек, ${last.staff} регистраторов.`;
  });

  /* мобильное меню */
  const header = $('.header'), burger = $('.burger');
  burger.addEventListener('click', () => burger.setAttribute('aria-expanded', header.classList.toggle('is-open')));
  $$('.menu a').forEach(a => a.addEventListener('click', () => { header.classList.remove('is-open'); burger.setAttribute('aria-expanded', false); }));

  /* форма */
  const form = $('#form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach(f => {
      const v = f.value.trim();
      const bad = !v || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) || (f.type === 'tel' && v.replace(/\D/g, '').length < 10);
      f.closest('.inp').classList.toggle('is-err', bad);
      if (bad && ok) { f.focus(); ok = false; }
    });
    if (ok) $('.form__done', form).hidden = false;
  });
  form.addEventListener('input', e => e.target.closest('.inp')?.classList.remove('is-err'));
})();
