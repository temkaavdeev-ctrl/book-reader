/* sim_verbs.js — библиотека сим-глаголов квест-v2 (94333538, screen-quests v2).
 * Три РАЗНЫХ класса интеракции (verb-diversity): choose (lottery) · adjust (anchor) · draw (drawLine).
 * Инварианты: honest-interactive — это РЕАЛЬНЫЕ модели (исход зависит от действия), не PNG+кнопка;
 * no-false-verdict — фидбек описательный («вот что происходит»), никогда «верно/молодец»;
 * reduced-motion уважается; тач+мышь+клавиатура (у draw — честный a11y-фолбэк «показать данные»).
 * API: SIM.lottery(el, params, onDone) · SIM.anchor(el, params, onDone) · SIM.drawLine(el, params, onDone)
 * el — контейнер; params — из бита (interactive.params); onDone(result) — сигнал плееру (шаг сделан).
 * Вёрстка нейтральна (класс sim-*), палитру задаёт страница-хозяин.
 */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function h(tag, cls, html) { var el = document.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ── ГЛАГОЛ 1: lottery (choose) — теория перспектив, зеркальные фреймы Канемана ──────────────
  // Раунд 1 (выигрыши): гарантия vs монетка. Раунд 2 (потери): зеркало. Reveal: асимметрия выбора,
  // БЕЗ вердикта — показываем типовой паттерн (большинство берёт гарантию в выигрышах и риск в потерях).
  function lottery(el, params, onDone) {
    params = params || {};
    var G = +params.gain || 50, R = +params.risk || 100, cur = params.currency || '';
    var picks = {};
    el.innerHTML = '';
    var box = h('div', 'sim sim-lottery');
    el.appendChild(box);
    function round(name, key, optA, optB, next) {
      box.innerHTML = '';
      box.appendChild(h('div', 'sim-k', esc(name)));
      var q = h('div', 'sim-q'); q.textContent = key === 'gain' ? 'Что выбираете?' : 'А теперь — что выбираете?';
      box.appendChild(q);
      var row = h('div', 'sim-opts');
      [optA, optB].forEach(function (o, i) {
        var b = h('button', 'sim-btn', esc(o.label));
        b.setAttribute('type', 'button');
        b.onclick = function () { picks[key] = i === 0 ? 'sure' : 'risk'; next(); };
        row.appendChild(b);
      });
      box.appendChild(row);
    }
    function reveal() {
      box.innerHTML = '';
      box.appendChild(h('div', 'sim-k', 'Ваши ставки'));
      var mine = 'В выигрышах вы взяли ' + (picks.gain === 'sure' ? 'гарантию' : 'риск') +
        ', в потерях — ' + (picks.loss === 'sure' ? 'гарантию' : 'риск') + '.';
      var flip = picks.gain === 'sure' && picks.loss === 'risk';
      var body = flip
        ? 'Тот же расчёт ожидаемой ценности — а выбор перевернулся. Так отвечает большинство: гарантия в выигрышах, риск в потерях. Это и есть асимметрия теории перспектив: потери весят тяжелее, и ради шанса их избежать люди принимают риск, который не взяли бы ради выигрыша.'
        : 'Большинство отвечает иначе: гарантия в выигрышах, риск в потерях — выбор переворачивается при том же расчёте ожидаемой ценности. Ваш паттерн другой — тем интереснее сверить его с механизмом: потери весят тяжелее выигрышей, и ради шанса избежать потери люди чаще принимают риск.';
      box.appendChild(h('div', 'sim-body', esc(mine) + '<br><br>' + esc(body)));
      if (onDone) onDone({ verb: 'lottery', picks: picks, flipped: flip });
    }
    round('Раунд 1 · выигрыши', 'gain',
      { label: 'Получить ' + G + cur + ' гарантированно' },
      { label: 'Монетка: ' + R + cur + ' или ничего' },
      function () {
        round('Раунд 2 · потери', 'loss',
          { label: 'Потерять ' + G + cur + ' гарантированно' },
          { label: 'Монетка: потерять ' + R + cur + ' или ничего' },
          reveal);
      });
  }

  // ── ГЛАГОЛ 2: anchor (adjust) — якорение: слайдер оценки после показанного якоря ─────────────
  // Модель честная: ваша оценка сравнивается с baseline (типовая оценка без якоря, параметр из данных
  // бита). Показываем СДВИГ к якорю — механизм, не оценку человека.
  function anchor(el, params, onDone) {
    params = params || {};
    var A = +params.anchor || 1200, base = +params.baseline || 400,
      min = +params.min || 0, max = +params.max || 2000, item = params.item || 'этот продукт', cur = params.currency || '₽';
    el.innerHTML = '';
    var box = h('div', 'sim sim-anchor');
    el.appendChild(box);
    box.appendChild(h('div', 'sim-k', 'Прикиньте цену'));
    box.appendChild(h('div', 'sim-q', 'Случайное число дня: <b>' + A + cur + '</b>. Теперь — сколько, по-вашему, стоит ' + esc(item) + '?'));
    var out = h('div', 'sim-val', '—');
    var input = h('input', 'sim-range');
    input.type = 'range'; input.min = min; input.max = max; input.step = Math.max(1, Math.round((max - min) / 200));
    input.value = Math.round((min + max) / 2);
    input.setAttribute('aria-label', 'Ваша оценка цены');
    function sync() { out.textContent = input.value + cur; }
    input.addEventListener('input', sync); sync();
    var btn = h('button', 'sim-btn sim-primary', 'Так и оценю');
    btn.setAttribute('type', 'button');
    box.appendChild(input); box.appendChild(out); box.appendChild(btn);
    btn.onclick = function () {
      var v = +input.value;
      box.innerHTML = '';
      box.appendChild(h('div', 'sim-k', 'Где легла ваша оценка'));
      var W = 100;
      function pct(x) { return Math.max(0, Math.min(100, ((x - min) / (max - min)) * W)); }
      var scale = h('div', 'sim-scale');
      scale.innerHTML =
        '<span class="sim-dot sim-dot-base" style="left:' + pct(base).toFixed(1) + '%" title="типовая оценка без якоря"></span>' +
        '<span class="sim-dot sim-dot-you" style="left:' + pct(v).toFixed(1) + '%" title="ваша оценка"></span>' +
        '<span class="sim-dot sim-dot-anchor" style="left:' + pct(A).toFixed(1) + '%" title="якорь"></span>';
      box.appendChild(scale);
      var legend = h('div', 'sim-legend', '<i class="lg-base"></i> без якоря: ~' + base + cur + ' · <i class="lg-you"></i> вы: ' + v + cur + ' · <i class="lg-anchor"></i> якорь: ' + A + cur);
      box.appendChild(legend);
      var pulled = (A > base) ? (v > base) : (v < base);
      var msg = pulled
        ? 'Оценка легла между типовой и якорем — случайное число, не имеющее отношения к цене, сместило суждение. Так работает якорение: первое число задаёт точку отсчёта, и корректировка от неё почти всегда недостаточна.'
        : 'Ваша оценка не потянулась к якорю — реже встречающийся исход. Механизм всё равно стоит знать: в среднем первое показанное число смещает оценки к себе, даже когда все понимают, что оно случайно.';
      box.appendChild(h('div', 'sim-body', esc(msg)));
      if (onDone) onDone({ verb: 'anchor', value: v, anchor: A, baseline: base, pulled: pulled });
    };
  }

  // ── ГЛАГОЛ 3: drawLine (draw) — «нарисуй прогноз до данных» (You-Draw-It) ────────────────────
  // Canvas: человек рисует кривую (например, удержание при росте цены), затем поверх ложится
  // реальная (params.points, нормированные y 0..1 слева направо). Показываем разрыв, не судим.
  // A11y-фолбэк: кнопка «показать данные без рисования» — честный путь без указателя.
  function drawLine(el, params, onDone) {
    params = params || {};
    var pts = params.points && params.points.length ? params.points : [1, .92, .8, .62, .4, .28, .22, .2];
    var xl = params.x_label || '', yl = params.y_label || '', prompt = params.prompt || 'Проведите линию: как поведёт себя кривая?';
    el.innerHTML = '';
    var box = h('div', 'sim sim-draw');
    el.appendChild(box);
    box.appendChild(h('div', 'sim-k', 'Ваш прогноз'));
    box.appendChild(h('div', 'sim-q', esc(prompt)));
    var W = Math.min(560, Math.max(280, (el.clientWidth || 320) - 8)), H = 180, DPR = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.className = 'sim-canvas'; cv.setAttribute('aria-label', 'Полотно прогноза: ведите линию слева направо');
    var ctx = cv.getContext('2d'); ctx.scale(DPR, DPR);
    box.appendChild(cv);
    var hint = h('div', 'sim-legend', (xl || yl) ? esc(yl + (xl && yl ? ' ← по ' : '') + xl) : 'ведите слева направо');
    box.appendChild(hint);
    var skip = h('button', 'sim-btn sim-ghost', 'Показать данные без рисования');
    skip.setAttribute('type', 'button');
    box.appendChild(skip);
    var mine = new Array(Math.round(W)).fill(null), drawing = false, drawn = false;
    function grid() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(128,120,105,.25)'; ctx.lineWidth = 1;
      for (var gy = 0; gy <= 4; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * H / 4); ctx.lineTo(W, gy * H / 4); ctx.stroke(); }
    }
    function strokeMine() {
      ctx.strokeStyle = '#C98A3A'; ctx.lineWidth = 2.5; ctx.beginPath(); var started = false;
      for (var x = 0; x < mine.length; x++) { if (mine[x] == null) continue; if (!started) { ctx.moveTo(x, mine[x]); started = true; } else ctx.lineTo(x, mine[x]); }
      if (started) ctx.stroke();
    }
    grid();
    function pos(ev) { var r = cv.getBoundingClientRect(); var t = ev.touches ? ev.touches[0] : ev; return { x: Math.max(0, Math.min(W - 1, t.clientX - r.left)), y: Math.max(0, Math.min(H, t.clientY - r.top)) }; }
    function put(p) { var xi = Math.round(p.x); mine[xi] = p.y; for (var k = 1; k <= 3; k++) { if (xi - k >= 0 && mine[xi - k] == null) mine[xi - k] = p.y; } grid(); strokeMine(); drawn = true; }
    cv.addEventListener('pointerdown', function (e) { drawing = true; put(pos(e)); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (drawing) { put(pos(e)); e.preventDefault(); } });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { cv.addEventListener(n, function () { if (drawing) { drawing = false; if (drawn) setTimeout(revealBtn, 60); } }); });
    var rb = null;
    function revealBtn() { if (rb) return; rb = h('button', 'sim-btn sim-primary', 'Показать, как было на самом деле'); rb.setAttribute('type', 'button'); rb.onclick = function () { reveal(true); }; box.insertBefore(rb, skip); }
    skip.onclick = function () { reveal(false); };
    function reveal(withMine) {
      if (rb) rb.remove(); skip.remove();
      grid(); if (withMine) strokeMine();
      // реальная кривая
      ctx.strokeStyle = '#2F7D4F'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (var i = 0; i < pts.length; i++) { var x = (i / (pts.length - 1)) * (W - 2) + 1, y = H - pts[i] * (H - 8) - 4; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      var gap = null;
      if (withMine && drawn) {
        var diffs = [], n = 0;
        for (var i2 = 0; i2 < pts.length; i2++) {
          var x2 = Math.round((i2 / (pts.length - 1)) * (W - 2)) + 1;
          if (mine[x2] != null) { var realY = H - pts[i2] * (H - 8) - 4; diffs.push(Math.abs(mine[x2] - realY) / H); n++; }
        }
        if (n) gap = diffs.reduce(function (s, d) { return s + d; }, 0) / n;
      }
      var msg = withMine && gap != null
        ? 'Зелёная — данные, охристая — ваш прогноз. Средний разрыв ~' + Math.round(gap * 100) + '% высоты полотна. Разрыв — не ошибка: он показывает, где интуиция расходится с измеренным, и именно там кривая учит больше всего.'
        : 'Зелёная кривая — данные. Форма важнее точных чисел: посмотрите, где она ломается — там и живёт механизм.';
      box.appendChild(h('div', 'sim-body', esc(msg)));
      if (onDone) onDone({ verb: 'drawLine', drew: !!(withMine && drawn), gap: gap });
    }
  }

  window.SIM = { lottery: lottery, anchor: anchor, drawLine: drawLine, _reduce: reduce };
})();
