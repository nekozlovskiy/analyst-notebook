/* ============================================================
   Работа без интернета.

   Этот файл не подключают к странице тегом script — его
   регистрирует app.js, и браузер запускает его отдельно, между
   страницей и сетью. Здесь нет ни окна, ни DOM.

   Курс — это набор файлов, которые внутри одной версии не
   меняются. Их можно один раз положить в кеш браузера и дальше
   открывать с диска: тогда урок в метро, в самолёте и на даче
   открывается ровно так же, как дома.

   Оболочка (страница, стили, скрипт, карта курса) попадает в кеш
   при установке. Содержимое модулей и учебная база весят вместе
   около трёх мегабайт, поэтому кешируются по мере чтения — или
   целиком, если на странице прогресса нажали «сохранить курс».

   Стратегия — «сначала кеш». Имя кеша содержит версию: при выходе
   новой старый кеш удаляется целиком, поэтому отдать устаревший
   файл попросту неоткуда.

   ВАЖНО: выпуская новую версию курса, поменяйте VERSION — иначе
   у тех, кто уже заходил, останется старая страница из кеша.
   ============================================================ */

const VERSION = "2026-09-16";
const CACHE = "notebook-" + VERSION;

/* На своей машине курс правят и обновляют страницу — и «сначала кеш»
   тогда показывал бы вчерашний файл, пока не сменишь VERSION. Поэтому
   на localhost порядок обратный: сначала сеть, кеш — как запасной
   выход. Работать без интернета это не мешает, проверять — тоже. */
const DEV = self.location.hostname === "localhost" ||
            self.location.hostname === "127.0.0.1";

/* Без этих файлов страница не откроется вообще. */
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./lessons.js",
  "./content-core.js",
  "./app.js",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", function (e) {
  /* Новая версия готовится в стороне и ждёт: страница, открытая
     сейчас, продолжает работать со старым кешом до перезагрузки. */
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Python приносит с собой движок на десятки мегабайт. Держать его
   в кеше курса нечестно по отношению к диску, поэтому пропускаем
   мимо: питоновские уроки при первом запуске просят интернет. */
function tooHeavy(url) {
  return url.pathname.indexOf("/pyodide/") >= 0;
}

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (tooHeavy(url)) return;

  /* Кладём в кеш удачные ответы. Непрозрачный ответ CDN (шрифт без
     заголовков CORS) тоже годится: отдать его браузеру мы сможем,
     а читать его нам и не нужно. */
  function fromNet(r) {
    return fetch(r).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(r, copy); });
      }
      return res;
    });
  }

  /* Интернета нет и в кеше пусто. Переход по адресу отдаём оболочкой,
     остальное честно падает: и загрузчик уроков, и движки умеют
     сказать, что связи нет. */
  function lastResort(err) {
    if (req.mode === "navigate") return caches.match("./index.html");
    throw err;
  }

  e.respondWith(
    DEV
      ? fromNet(req).catch(function (err) {
          return caches.match(req).then(function (hit) { return hit || lastResort(err); });
        })
      : caches.match(req).then(function (hit) {
          return hit || fromNet(req).catch(lastResort);
        })
  );
});
