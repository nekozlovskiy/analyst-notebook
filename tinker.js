/* ============================================================
   Песочницы в теории («покрути»): модуль Tinker

   Не путать с объектом Sandbox в app.js — это страница «Песочница»
   со свободным редактором.

   Данные — window.TINKER (блок FIGS в content-mN.js, пишет
   инструменты/figs.py). draw[id](data, i) рисует положение i
   ползунка строкой SVG, label[id](data, i) — строка чисел и текст
   для диктора. Положения ползунка — data.pos, засечки — data.ticks
   ([номер, подпись]), подпись ползунка — data.name. Это чистые функции: их проверяет checkfigs.js в node.
   mount(root) заменяет статичную схему живой — вызывает app.js
   после Figs.mount. Нет данных или функции — остаётся статичная.
   ============================================================ */

window.Tinker = (function () {
  function fmt(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  function histPath(cnt, X, base, h) {
    const hi = Math.max.apply(null, cnt) || 1;
    let d = "M" + X(0).toFixed(1) + " " + base;
    cnt.forEach(function (c, k) {
      const y = (base - h * c / hi).toFixed(1);
      d += " L" + X(k).toFixed(1) + " " + y + " L" + X(k + 1).toFixed(1) + " " + y;
    });
    return d + " L" + X(cnt.length).toFixed(1) + " " + base;
  }

  const label = {
    "clt-means": function (data, i) {
      const n = data.pos[i], sd = fmt(data.sd[i]), sdf = fmt(data.sdf[i]);
      return { text: "n = " + n + " · разброс " + sd + " · σ/√n " + sdf   /* короче — не переносится на телефоне */,
               aria: "n = " + n + ", разброс " + sd };
    },
    "roc-steps": function (data, i) {
      const tp = data.tp[i], fp = data.fp[i], thr = pct(data.pos[i]);
      const prec = tp + fp ? Math.round(100 * tp / (tp + fp)) + "%" : "—";
      const rec = Math.round(100 * tp / data.npos) + "%";
      return { text: "порог " + thr + " · полнота " + rec + " · точность " + prec,
               aria: "порог " + thr + ": поймано " + tp + " из " + data.npos + ", ложных тревог " +
                     fp + " из " + data.nneg };
    },
    "power-bells": function (data, i) {
      const n = fmt(data.pos[i]), pw = share(data.power[i]), m = data.mde[i] * 100,
            mde = (m >= 10 ? Math.round(m) : pct(m.toFixed(1))) + "%";   /* 37%, но 8,3% */
      return { text: "n = " + n + " · мощность " + pw + " · MDE " + mde,
               aria: n + " на группу: мощность " + pw + ", ловим эффект от " + mde };
    },
    "window-frame": function (data, i) {
      const sp = data.span[i], k = sp[1] - sp[0] + 1, sum = data.sums[i][data.rows.length - 1];
      const rows = k + (k === 1 ? " строка" : " строки");
      return { text: "в рамке " + rows + " · сумма " + sum,
               aria: "ROWS BETWEEN " + data.frames[i][0] + " " + data.frames[i][1] + ": в рамке последней строки " +
                     rows + ", сумма " + sum };
    },
    "gd-steps": function (data, i) {
      const lr = pct(data.pos[i]), n = data.bottom[i];
      const tail = n === null ? "расходится" : "до дна " + n + " " + steps(n);
      return { text: "шаг " + lr + " · " + tail, aria: "шаг " + lr + ": " + tail };
    }
  };

  function steps(n) {                               /* 1 шаг, 2 шага, 5 шагов, 21 шаг, 113 шагов */
    const d = n % 10, h = n % 100;
    return d === 1 && h !== 11 ? "шаг" : d >= 2 && d <= 4 && (h < 12 || h > 14) ? "шага" : "шагов";
  }

  function share(v) {                               /* 0,999 → «99,9%», а не «100%» */
    return (v >= .995 ? pct((v * 100).toFixed(1)) : Math.round(v * 100)) + "%";
  }

  function pct(v) { return String(v).replace(".", ","); }

  const draw = {
    "clt-means": function (data, i) {
      const x1 = 330, base = 170, h = 128;
      const X = function (k) { return x1 * k * data.step / data.top; };   /* k — номер корзины */
      const Xv = function (v) { return x1 * v / data.top; };              /* v — рубли */
      let s = '<svg class="fig-svg" viewBox="-4 0 340 236" role="img" aria-label="' +
              label["clt-means"](data, i).aria + '">';
      s += '<text class="f-hd" x="0" y="14" font-size="12.5">средние 2000 выборок, руб.</text>';
      s += '<path class="f-raw" d="' + histPath(data.bins[0], X, base, h) + '"/>';
      s += '<path class="f-pen" d="' + histPath(data.bins[i], X, base, h) + '"/>';
      s += '<line class="f-row" x1="0" y1="' + base + '" x2="' + x1 + '" y2="' + base + '"/>';
      s += '<path class="f-soft" d="M' + Xv(data.mean).toFixed(1) + ' 26 V' + (base + 4) + '"/>';
      s += '<text class="f-sub" x="' + (Xv(data.mean) + 4).toFixed(1) + '" y="30" font-size="10.5">среднее ' +
           fmt(data.mean) + '</text>';
      [0, 5000, 10000].forEach(function (v) {
        s += '<text class="f-sub" x="' + Xv(v).toFixed(1) + '" y="' + (base + 16) + '" font-size="10.5" text-anchor="' +
             (v ? "middle" : "start") + '">' + fmt(v) + '</text>';
      });
      s += '<text class="f-sub" x="330" y="' + (base + 32) + '" font-size="10.5" text-anchor="end">серым — сами чеки</text>';
      s += '<text class="f-note" x="0" y="' + (base + 56) + '" font-size="15">двигайте n — колокол сужается как √n</text>';
      return s + "</svg>";
    },
    "power-bells": function (data, i) {
      const x1 = 330, top = 44, base = 190, ph = 118, d = data.d, lo = data.lo, hi = data.hi;
      const se0 = data.se0[i], se1 = data.se1[i], c = data.c[i];
      const X = function (v) { return x1 * (v - lo) / (hi - lo); };
      const H = function (v, m, sd) { return base - ph * Math.exp(-Math.pow((v - m) / sd, 2) / 2); };
      function bell(m, sd) {
        let p = "";
        for (let k = 0; k <= 220; k++) {
          const v = lo + k * (hi - lo) / 220;
          p += (k ? " L" : "M") + X(v).toFixed(1) + " " + H(v, m, sd).toFixed(1);
        }
        return p;
      }
      let s = '<svg class="fig-svg" viewBox="-4 0 340 270" role="img" aria-label="' +
              label["power-bells"](data, i).aria + '">';
      s += '<text class="f-hd" x="0" y="14" font-size="12.5">разница конверсий B − A, п.п.</text>';
      s += '<path class="f-raw" d="' + bell(0, se0) + '"/>';
      s += '<path class="f-pen" d="' + bell(d, se1) + '"/>';
      /* β: штриховка под колоколом «эффект есть» левее порога */
      for (let v = lo; v < Math.min(c, hi); v += 4 * (hi - lo) / x1) {
        const y = H(v, d, se1);
        if (base - y > ph * .03)
          s += '<line class="f-soft" x1="' + X(v).toFixed(1) + '" y1="' + base + '" x2="' + X(v).toFixed(1) +
               '" y2="' + y.toFixed(1) + '"/>';
      }
      s += '<line class="f-row" x1="0" y1="' + base + '" x2="' + x1 + '" y2="' + base + '"/>';
      const cx = Math.min(X(c), x1);
      s += '<path class="f-box" d="M' + cx.toFixed(1) + ' ' + (top + 8) + ' V' + base + '"/>';
      s += '<text class="f-sub" x="' + (cx > x1 - 40 ? cx - 3 : cx + 3).toFixed(1) + '" y="' + (top + 16) +
           '" font-size="10.5"' + (cx > x1 - 40 ? ' text-anchor="end"' : '') + '>порог</text>';
      s += '<text class="f-sub" x="' + (X(0) - 6).toFixed(1) + '" y="' + (top + 4) +
           '" font-size="10.5" text-anchor="end">эффекта нет</text>';
      s += '<text class="f-pen-t" x="' + (X(d) + 6).toFixed(1) + '" y="' + (top + 4) +
           '" font-size="11.5">эффект +10%</text>';
      [-.01, 0, .01].forEach(function (v) {
        s += '<line class="f-row" x1="' + X(v).toFixed(1) + '" y1="' + base + '" x2="' + X(v).toFixed(1) +
             '" y2="' + (base + 4) + '"/>';
        s += '<text class="f-sub" x="' + X(v).toFixed(1) + '" y="' + (base + 16) +
             '" font-size="10.5" text-anchor="middle">' + (v < 0 ? "−1" : v > 0 ? "+1" : "0") + '</text>';
      });
      s += '<text class="f-sub" x="' + x1 + '" y="' + (base + 32) + '" font-size="10.5" text-anchor="end">штриховка — β</text>';
      s += '<text class="f-note" x="0" y="' + (base + 56) + '" font-size="15">больше людей — уже колокола,</text>';
      s += '<text class="f-note" x="0" y="' + (base + 74) + '" font-size="15">и эффект пропускают реже</text>';
      return s + "</svg>";
    },
    "window-frame": function (data, i) {
      const w = 282, y = 44, hh = 22, rh = 26, sp = data.span[i], f = data.frames[i];
      const cols = [8, 54, 190, 274], n = data.rows.length, bottom = y + hh + rh * n;
      let s = '<svg class="fig-svg" viewBox="-4 0 340 ' + (bottom + 58) + '" role="img" aria-label="' +
              label["window-frame"](data, i).aria + '">';
      s += '<text class="f-t" x="0" y="14" font-size="11.5">ROWS BETWEEN ' + f[0] + '</text>';
      s += '<text class="f-t" x="0" y="30" font-size="11.5">' + f[1] + '</text>';
      s += '<rect class="f-box" x="0" y="' + y + '" width="' + w + '" height="' + (hh + rh * n) + '" rx="5"/>';
      ["user_id", "order_date", "revenue", "в рамке"].forEach(function (t, c) {
        s += '<text class="f-sub" x="' + cols[c] + '" y="' + (y + 15) + '" font-size="10.5"' +
             (c > 1 ? ' text-anchor="end"' : '') + '>' + t + '</text>';
      });
      data.rows.forEach(function (r, k) {
        const top = y + hh + k * rh, ty = top + rh / 2 + 4.5, inside = k >= sp[0] && k <= sp[1];
        s += '<line class="f-row" x1="0" y1="' + top + '" x2="' + w + '" y2="' + top + '"/>';
        s += '<text class="f-t" x="' + cols[0] + '" y="' + ty + '" font-size="12.5">' + r[0] + '</text>';
        s += '<text class="f-t" x="' + cols[1] + '" y="' + ty + '" font-size="12.5">' + r[1] + '</text>';
        s += '<text class="' + (inside ? "f-pen-t" : "f-t") + '" x="' + cols[2] + '" y="' + ty +
             '" font-size="12.5" text-anchor="end">' + r[2] + '</text>';
        s += '<text class="' + (k === n - 1 ? "f-pen-t" : "f-t") + '" x="' + cols[3] + '" y="' + ty +
             '" font-size="12.5" text-anchor="end">' + data.sums[i][k] + '</text>';
      });
      /* граница окон — ручкой: дальше неё рамка не заходит */
      const cut = y + hh + data.cut * rh;
      s += '<line class="f-pen" x1="0" y1="' + cut + '" x2="' + w + '" y2="' + cut + '"/>';
      /* скобка рамки последней строки */
      const a = y + hh + sp[0] * rh + 3, b = y + hh + (sp[1] + 1) * rh - 3;
      s += '<path class="f-pen" d="M' + (w + 5) + ' ' + a + ' h7 V' + b + ' h-7"/>';
      s += '<text class="f-sub" x="' + (w + 15) + '" y="' + ((a + b) / 2 + 4) + '" font-size="10.5">рамка</text>';
      s += '<text class="f-note" x="0" y="' + (bottom + 28) + '" font-size="15">' + f[2] + '</text>';
      return s + "</svg>";
    },
    "gd-steps": function (data, i) {
      const lim = data.lim, x1 = 330, top = 40, base = 196, ph = base - top;
      const X = function (v) { return (x1 * (v + lim) / (2 * lim)).toFixed(1); };
      const Y = function (v) { return (base - ph * v * v / (lim * lim)).toFixed(1); };
      let s = '<svg class="fig-svg" viewBox="-4 0 340 270" role="img" aria-label="' +
              label["gd-steps"](data, i).aria + '">';
      s += '<text class="f-hd" x="0" y="14" font-size="12.5">десять шагов спуска по чаше L = b²</text>';
      let bowl = "";
      for (let k = 0; k <= 60; k++) {
        const v = -lim + 2 * lim * k / 60;
        bowl += (k ? " L" : "M") + X(v) + " " + Y(v);
      }
      s += '<path class="f-soft" d="' + bowl + '"/>';
      s += '<line class="f-row" x1="0" y1="' + base + '" x2="' + x1 + '" y2="' + base + '"/>';
      s += '<line class="f-row" x1="' + X(0) + '" y1="' + base + '" x2="' + X(0) + '" y2="' + (base + 4) + '"/>';
      s += '<text class="f-sub" x="' + X(0) + '" y="' + (base + 16) + '" font-size="10.5" text-anchor="middle">минимум</text>';
      /* путь до первой точки за краем чаши: дальше рисовать некуда */
      const pts = [];
      for (let k = 0; k < data.paths[i].length && Math.abs(data.paths[i][k]) <= lim; k++) pts.push(data.paths[i][k]);
      s += '<path class="f-pen" d="' + pts.map(function (v, k) { return (k ? "L" : "M") + X(v) + " " + Y(v); }).join(" ") + '"/>';
      pts.forEach(function (v, k) {
        s += '<circle class="' + (k ? "f-pen-fill" : "f-sub") + '" cx="' + X(v) + '" cy="' + Y(v) + '" r="' +
             (k ? 2.4 : 3.2) + '"/>';
      });
      s += '<text class="f-sub" x="' + (+X(-1) - 7) + '" y="' + (+Y(-1) + 4) + '" font-size="10.5" text-anchor="end">старт</text>';
      if (pts.length < data.paths[i].length) {
        const last = pts[pts.length - 1], right = last < 0;   /* следующая точка — на другом склоне */
        s += '<text class="f-pen-t" x="' + (right ? x1 : 0) + '" y="' + (top - 6) + '" font-size="11.5"' +
             (right ? ' text-anchor="end"' : '') + '>ушёл за край на ' + pts.length + '-м шаге</text>';   /* pts[k] — после k шагов */
      }
      s += '<text class="f-sub" x="' + x1 + '" y="' + (base + 16) + '" font-size="10.5" text-anchor="end">дно — |b| &lt; 0,01</text>';
      s += '<text class="f-note" x="0" y="' + (base + 50) + '" font-size="15">' + data.notes[i] + '</text>';
      return s + "</svg>";
    },
    "roc-steps": function (data, i) {
      const x0 = 44, yb = 236, side = 190, cx = 300, ry = (side - 10) / data.pts.length;
      const X = function (f) { return (x0 + side * f).toFixed(1); };
      const Y = function (t) { return (yb - side * t).toFixed(1); };
      const tp = data.tp[i], fp = data.fp[i], t = data.pos[i];
      let s = '<svg class="fig-svg" viewBox="-4 0 340 324" role="img" aria-label="' +
              label["roc-steps"](data, i).aria + '">';
      s += '<text class="f-hd" x="0" y="14" font-size="12.5">доля пойманных покупателей</text>';
      s += '<rect class="f-box" x="' + x0 + '" y="' + Y(1) + '" width="' + side + '" height="' + side + '" rx="0"/>';
      s += '<line class="f-soft" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(1) + '"/>';
      [0, .5, 1].forEach(function (v) {
        s += '<text class="f-sub" x="' + (x0 - 6) + '" y="' + (+Y(v) + 4) + '" font-size="10.5" text-anchor="end">' +
             v * 100 + '%</text>';
        s += '<text class="f-sub" x="' + X(v) + '" y="' + (yb + 16) + '" font-size="10.5" text-anchor="middle">' +
             v * 100 + '%</text>';
      });
      s += '<text class="f-sub" x="' + X(1) + '" y="' + (yb + 32) + '" font-size="10.5" text-anchor="end">доля ложных тревог</text>';
      let a = 0, b = 0, d = "M" + X(0) + " " + Y(0);
      data.pts.forEach(function (p) {
        if (p[1]) a++; else b++;
        d += " L" + X(b / data.nneg) + " " + Y(a / data.npos);
      });
      s += '<path class="f-pen" d="' + d + '"/>';
      const px = +X(fp / data.nneg), py = +Y(tp / data.npos);
      s += '<circle class="f-pen-fill" cx="' + px + '" cy="' + py + '" r="4"/>';
      /* подпись точки — внутрь квадрата: у правого края влево, у верхнего вниз */
      const right = fp / data.nneg > .6, low = tp / data.npos < .15;
      s += '<text class="f-pen-t" x="' + (right ? px - 8 : px + 8) + '" y="' + (low ? py - 8 : py + 16) +
           '" font-size="11.5"' + (right ? ' text-anchor="end"' : '') + '>порог ' + pct(t) + '</text>';
      s += '<text class="f-hd" x="' + X(.5) + '" y="' + Y(.12) + '" font-size="12.5" text-anchor="middle">AUC = ' +
           pct(data.auc.toFixed(2)) + '</text>';
      s += '<text class="f-sub" x="' + cx + '" y="' + (+Y(1) - 8) + '" font-size="10.5" text-anchor="middle">оценки</text>';
      data.pts.forEach(function (p, k) {
        const yy = +Y(1) + 10 + k * ry, cls = p[1] ? "f-pen-t" : "f-sub", fs = p[1] ? 11.5 : 10.5;
        s += '<text class="' + cls + '" x="' + (cx - 6) + '" y="' + (yy + 4).toFixed(1) + '" font-size="' + fs +
             '" text-anchor="end">' + pct(p[0].toFixed(2)) + '</text>';
        s += '<text class="' + cls + '" x="' + (cx + 6) + '" y="' + (yy + 4).toFixed(1) + '" font-size="11.5">' +
             (p[1] ? "↑" : "→") + '</text>';
      });
      const k = tp + fp, ly = (+Y(1) + 10 + (k - .5) * ry).toFixed(1);   /* черта под последним взятым */
      s += '<line class="f-pen" x1="' + (cx - 34) + '" y1="' + ly + '" x2="' + (cx + 22) + '" y2="' + ly + '"/>';
      s += '<text class="f-note" x="0" y="' + (yb + 60) + '" font-size="15">выше черты — «купит»: поймано ' + tp +
           ' из ' + data.npos + ',</text>';
      s += '<text class="f-note" x="0" y="' + (yb + 78) + '" font-size="15">ложных тревог ' + fp + ' из ' +
           data.nneg + '</text>';
      return s + "</svg>";
    }
  };

  function mount(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("figure[data-fig]"), function (f) {
      const id = f.getAttribute("data-fig"), data = (window.TINKER || {})[id];
      if (!data || !draw[id] || !label[id] || f.querySelector(".tnk")) return;
      const last = data.pos.length - 1;
      const box = document.createElement("div");
      box.className = "tnk";
      box.innerHTML = '<div class="tnk-pic"></div>' +
        '<input class="tnk-range" type="range" min="0" max="' + last + '" step="1" value="' + data.start +
        '" aria-label="' + data.name + '">' +
        '<div class="tnk-ticks" aria-hidden="true">' + data.ticks.map(function (t) {
          return '<span style="left:' + (100 * t[0] / last) + '%">' + t[1] + '</span>';
        }).join("") + '</div>' +
        '<p class="tnk-read" aria-hidden="true"></p>';
      const pic = box.querySelector(".tnk-pic"), range = box.querySelector(".tnk-range"),
            read = box.querySelector(".tnk-read");
      function show(i) {
        const l = label[id](data, i);
        pic.innerHTML = draw[id](data, i);
        read.textContent = l.text;
        range.setAttribute("aria-valuetext", l.aria);
      }
      range.addEventListener("input", function () { show(+range.value); });
      const old = f.querySelector("svg.fig-svg");
      if (old) old.replaceWith(box); else f.insertBefore(box, f.firstChild);
      const cap = f.querySelector("figcaption");
      if (cap && data.caption) cap.textContent = data.caption;
      show(data.start);
    });
  }

  return { draw: draw, label: label, mount: mount };
})();
