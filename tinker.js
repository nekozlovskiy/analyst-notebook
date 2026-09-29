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
    }
  };

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
