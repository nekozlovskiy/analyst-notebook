/* Прогон практикума в настоящем браузере (Pyodide, sql.js).
   Передать в browser_evaluate целиком, заменив LESSON_ID на id урока.
   Страница — http://localhost:8781/index.html#LESSON_ID при ширине 390 px
   (browser_resize 390×844). Для каждого шага: проверка заготовки (должна
   не пройти), затем решения (должно пройти); в конце — основная задача.
   Возвращает статусы, ширину страницы и правый край таблиц — всё должно
   быть не шире 390. Практикум, уже пройденный в этом origin, не
   перепроверить: откройте другой origin (127.0.0.1 вместо localhost). */
async () => {
  const ID = "LESSON_ID";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(500);
  const L = window.CONTENT[ID], P = L.practicum;
  const box = document.getElementById("practiceBox");
  const res = [];
  for (let n = 0; n < P.steps.length; n++) {
    let li;
    for (let t = 0; t < 50 && !(li = box.querySelector('.st.open[data-n="' + n + '"]')); t++) await sleep(200);
    if (!li) { res.push({ n: n + 1, err: "шаг не открыт — уже пройден в этом origin?" }); break; }
    li.scrollIntoView();
    const tryCode = async code => {
      const cur = box.querySelector('.st.open[data-n="' + n + '"]');
      if (code !== null) cur.querySelector(".CodeMirror").CodeMirror.setValue(code);
      cur.querySelector(".st-status").className = "status st-status";
      cur.querySelector(".st-status").textContent = "";
      cur.querySelector(".st-check").click();
      for (let t = 0; t < 900; t++) {
        await sleep(200);
        const c2 = box.querySelector('.st[data-n="' + n + '"]');
        if (!c2 || !c2.classList.contains("open")) return "passed";
        const s = c2.querySelector(".st-status");
        if (s && s.textContent.trim() && !/Выполняю|Готовлю/.test(c2.querySelector(".st-res").textContent))
          return s.textContent.trim().slice(0, 120);
      }
      return "timeout";
    };
    const r = { n: n + 1 };
    r.maxRight = Array.from(li.querySelectorAll(".ba, .ba-side, pre, .order"))
      .map(e => Math.round(e.getBoundingClientRect().right)).reduce((a, b) => Math.max(a, b), 0);
    r.starter = await tryCode(null);
    if (r.starter !== "passed") r.solution = await tryCode(P.steps[n].solution);
    r.pageW = document.documentElement.scrollWidth;
    res.push(r);
  }
  await sleep(800);
  const fin = document.getElementById("practiceFinal").textContent.trim().slice(0, 60);
  let main = "нет основной задачи с кодом";
  const cmEl = document.querySelector("#s-task .CodeMirror");
  if (cmEl && L.solution) {
    cmEl.CodeMirror.setValue(L.solution);
    const run = document.getElementById("runBtn");
    if (run) {
      run.click();
      for (let t = 0; t < 300; t++) {
        await sleep(200);
        const box2 = document.getElementById("outBox");
        if (box2 && box2.textContent.trim() && !/Выполняю|Готовлю|Поднимаю/.test(box2.textContent)) break;
      }
    }
    document.getElementById("checkBtn").click();
    await sleep(2000);
    main = document.getElementById("status").textContent.trim().slice(0, 60);
  }
  return { viewport: window.innerWidth, res, fin, main, pageW: document.documentElement.scrollWidth };
}
