/* ============================================================
   Песочницы в теории («покрути»): модуль Tinker

   Не путать с объектом Sandbox в app.js — это страница «Песочница»
   со свободным редактором.

   Данные — window.TINKER (блок FIGS в content-mN.js, пишет
   инструменты/figs.py). draw[id](data, i) рисует положение i
   ползунка строкой SVG, label[id](data, i) — строка чисел и текст
   для диктора. Это чистые функции: их проверяет checkfigs.js в node.
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
      const n = data.ns[i], sd = fmt(data.sd[i]), sdf = fmt(data.sdf[i]);
      return { text: "n = " + n + " · разброс " + sd + " · σ/√n " + sdf   /* короче — не переносится на телефоне */,
               aria: "n = " + n + ", разброс " + sd };
    }
  };

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
    }
  };

  function mount(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("figure[data-fig]"), function (f) {
      const id = f.getAttribute("data-fig"), data = (window.TINKER || {})[id];
      if (!data || !draw[id] || !label[id] || f.querySelector(".tnk")) return;
      const last = data.ns.length - 1;
      const box = document.createElement("div");
      box.className = "tnk";
      box.innerHTML = '<div class="tnk-pic"></div>' +
        '<input class="tnk-range" type="range" min="0" max="' + last + '" step="1" value="' + data.start +
        '" aria-label="Размер выборки n">' +
        '<div class="tnk-ticks" aria-hidden="true">' + data.ticks.map(function (t) {
          return '<span style="left:' + (100 * data.ns.indexOf(t) / last) + '%">' + t + '</span>';
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
