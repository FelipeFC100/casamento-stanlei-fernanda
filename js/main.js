(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  let motionReady = false;

  /* ---------- Acessos: a escolha vale só para esta visita ---------- */
  function goTop() {
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }
  function setRole(role) {
    if (role) root.dataset.role = role; else delete root.dataset.role;
    goTop();
    requestAnimationFrame(() => { if (motionReady) buildMotion(); });
  }
  $$('[data-role]', $('#gate')).forEach(b => b.addEventListener('click', () => setRole(b.dataset.role)));
  $$('.swap').forEach(b => b.addEventListener('click', () => setRole(null)));

  /* ---------- Contagem regressiva ---------- */
  const WEDDING = new Date('2027-08-15T15:30:00-03:00').getTime();
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    let d = Math.max(0, WEDDING - Date.now());
    const days = Math.floor(d / 864e5); d -= days * 864e5;
    const h = Math.floor(d / 36e5); d -= h * 36e5;
    const m = Math.floor(d / 6e4); d -= m * 6e4;
    $('#cd').textContent = days;
    $('#ch').textContent = pad(h);
    $('#cm').textContent = pad(m);
    $('#cs').textContent = pad(Math.floor(d / 1e3));
  }
  tick(); setInterval(tick, 1000);

  /* ---------- Adicionar ao calendário (.ics) ---------- */
  $('#addCal').addEventListener('click', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stanlei e Fernanda//PT',
      'BEGIN:VEVENT', 'UID:casamento-sf-20270815@stanlei-fernanda',
      'DTSTAMP:20261015T000000Z', 'DTSTART:20270815T183000Z', 'DTEND:20270815T193000Z',
      'SUMMARY:Casamento Stanlei & Fernanda',
      'LOCATION:Praia do Estaleiro\\, Balneário Camboriú/SC',
      'DESCRIPTION:Cerimônia às 15:30. Depois\\, recepção no Salão Indaiá\\, Itapema/SC.',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'casamento-stanlei-fernanda.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  /* ---------- Fundo controlado pelo scroll ---------- */
  const video = $('#bgVideo');
  const photo = $('#bgPhoto');
  let mode = 'photo';           // vira 'video' quando assets/video/praia.mp4 existir
  let current = 0;              // posição suavizada (0..1)

  video.addEventListener('loadedmetadata', () => {
    mode = 'video';
    video.hidden = false;
    photo.style.display = 'none';
  });
  video.addEventListener('error', () => { mode = 'photo'; });
  video.src = 'assets/video/praia.mp4';
  video.load();

  // iOS: o primeiro toque "destrava" o vídeo para aceitar seek.
  addEventListener('touchstart', () => {
    if (mode !== 'video') return;
    const p = video.play();
    if (p && p.then) p.then(() => video.pause()).catch(() => {});
  }, { once: true, passive: true });

  // Sem vídeo: a foto "caminha" pela faixa limpa (sem o texto do save the date).
  const IMG_W = 900, IMG_H = 1600, Y_MIN = 600, Y_MAX = 1300, COUPLE_X = 430;
  function placePhoto(p) {
    const vw = innerWidth, vh = innerHeight;
    // Aproxima devagar enquanto rola (zoom 1x a 1.4x) e caminha pela areia.
    const s = Math.max(vw / IMG_W, vh / (Y_MAX - Y_MIN)) * (1 + 0.4 * p);
    const winW = vw / s, winH = vh / s;
    const y0 = Y_MIN + p * Math.max(0, Y_MAX - winH - Y_MIN);
    const half = winW / 2;
    const cx = Math.min(IMG_W - half, Math.max(half, COUPLE_X + (p - 0.5) * 140));
    photo.style.width = IMG_W * s + 'px';
    photo.style.height = IMG_H * s + 'px';
    photo.style.transform = `translate3d(${-(cx - half) * s}px,${-y0 * s}px,0)`;
  }

  function frame() {
    const max = Math.max(1, root.scrollHeight - innerHeight);
    const target = Math.min(1, Math.max(0, scrollY / max));
    current += (target - current) * (reduce ? 1 : 0.14);
    if (Math.abs(target - current) < 0.0005) current = target;
    if (mode === 'video' && video.duration) {
      const t = current * video.duration;
      if (Math.abs(video.currentTime - t) > 1 / 60) video.currentTime = t;
    } else {
      placePhoto(current);
    }
  }

  /* ---------- Animações 3D (GSAP) ---------- */
  const splits = new Map();
  function split(el, by) {
    if (splits.has(el)) return splits.get(el);
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const out = [];
    text.split(/(\s+)/).forEach(token => {
      if (/^\s+$/.test(token)) { el.appendChild(document.createTextNode(' ')); return; }
      const word = document.createElement('span');
      word.style.cssText = 'display:inline-block;white-space:nowrap';
      word.setAttribute('aria-hidden', 'true');
      if (by === 'chars') {
        Array.from(token).forEach(ch => {
          const c = document.createElement('span');
          c.textContent = ch;
          c.style.display = 'inline-block';
          word.appendChild(c);
          out.push(c);
        });
      } else {
        word.textContent = token;
        out.push(word);
      }
      el.appendChild(word);
    });
    splits.set(el, out);
    return out;
  }

  // Recria os gatilhos depois de cada troca de acesso, já com o layout final.
  let ctx;
  function buildMotion() {
    if (ctx) ctx.revert();
    ctx = gsap.context(() => {
      gsap.from('.hero .kicker, .hero .monogram, .hero .names, .hero .date, .hero .place, .hero .gate, .hero .greet', {
        opacity: 0, y: 18, duration: 0.9, ease: 'power3.out', stagger: 0.1,
      });

      $$('[data-split="chars"]').forEach(el => {
        gsap.from(split(el, 'chars'), {
          opacity: 0, rotateX: -80, z: -120, y: 20, transformOrigin: '50% 100%',
          duration: 0.9, ease: 'power3.out', stagger: 0.03,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      });

      $$('[data-split="words"]').forEach(el => {
        gsap.from(split(el, 'words'), {
          opacity: 0, rotateX: -60, z: -60, y: 14, transformOrigin: '50% 100%', stagger: 0.15, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 85%', end: 'center 45%', scrub: 0.5 },
        });
      });

      const presets = {
        fade: { opacity: 0, y: 20 },
        '3d': { opacity: 0, rotateX: -25, z: -100, y: 30, transformOrigin: '50% 100%' },
        photo: { opacity: 0, rotateY: -20, z: -140, y: 40, scale: 0.94 },
      };
      $$('[data-reveal]').forEach(el => {
        gsap.from(el, {
          ...presets[el.dataset.reveal], duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        });
      });
    });
    ScrollTrigger.refresh();
  }

  function initMotion() {
    gsap.registerPlugin(ScrollTrigger);

    // Lenis só com mouse. No celular o scroll nativo é mais fluido.
    if (window.Lenis && finePointer && !reduce) {
      const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      window.__lenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    gsap.ticker.add(frame);
    addEventListener('resize', () => ScrollTrigger.refresh());

    if (reduce) return;
    motionReady = true;
    buildMotion();
  }

  if (window.gsap && window.ScrollTrigger) initMotion();
  else {
    // Bibliotecas não carregaram: o conteúdo aparece normal, só o fundo acompanha o scroll.
    addEventListener('scroll', frame, { passive: true });
    frame();
  }
})();
