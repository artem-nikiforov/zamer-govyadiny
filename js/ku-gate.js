/* ══════════════════════════════════════════════════════════════════════
   ОБЯЗАТЕЛЬНЫЕ ТЕСТЫ  ·  ku-gate.js
   ──────────────────────────────────────────────────────────────────────
   Пока студент не ответил на упражнение, всё, что идёт после него на этой
   же странице, скрыто. Пролистать вперёд и подсмотреть разбор нельзя.
   Кнопка перехода к следующей главе лежит в самом низу страницы, поэтому
   она тоже под замком — глава не закрывается, пока тест не пройден.

   РАЗМЕТКУ КУРСОВ НЕ ТРОГАЕТ. Гейты находятся сами, на двух уровнях:

     • страница — прямые дети контейнера главы, внутри которых есть
       .ku-feedback (то есть упражнение с обратной связью);
     • тест — соседние .ku-quiz-q внутри одного контейнера: вопросы
       открываются по одному.

   ЧТО СЧИТАЕТСЯ ОТВЕТОМ
       показалась обратная связь (.ku-feedback.show), либо вопрос помечен
       классом solved, либо упражнение уже зачтено в прогрессе
       (KU.progress.isDone по data-ku-id — иначе после перезагрузки
       студента заперло бы на уже пройденном материале).

       Верность ответа значения не имеет: разбор студент уже прочитал.
       В виджете .ku-quiz-q исключение получается само собой — он
       принимает только верный вариант, неверный просто мигает.

   ИСКЛЮЧЕНИЕ
       data-ku-nogate на блоке — блок не запирает то, что ниже.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var NOTE_CLASS = "ku-gate-note";
  /* Запираем СВОИМ классом, а не атрибутом hidden. У курсов бывает
     собственная пошаговая механика на hidden (zb-step в «Замере
     говядины»): если снимать hidden, все её шаги раскроются разом. */
  var LOCK_CLASS = "ku-gate-locked";
  /* Не всякий гейт — вопрос: бывают блоки «открой все карточки».
     Просить у них «ответь на вопрос» было бы враньём. */
  function noteText(gate) {
    if (gate.querySelector(".us-tile") &&
        !gate.querySelector("[data-correct],[data-ok],[data-us-correct]")) {
      return "Открой все карточки выше, чтобы продолжить";
    }
    return "Ответь на вопрос выше, чтобы открыть продолжение";
  }
  function noteHTML(gate) {
    return '<svg class="ku-ico" aria-hidden="true"><use href="#i-lock"/></svg>' +
           "<span>" + noteText(gate) + "</span>";
  }

  /* ══ 1. ЧТО СЧИТАЕТСЯ ОТВЕТОМ ═══════════════════════════════════════ */
  function doneInProgress(el) {
    var id = el.getAttribute && el.getAttribute("data-ku-id");
    return !!(id && window.KU && window.KU.progress &&
              window.KU.progress.isDone(id));
  }

  /* Зачтено в прогрессе: либо флаг из suspend_data/localStorage, либо
     класс, который ku-scorm.js вешает при восстановлении (decorateDone). */
  function restored(el) {
    return doneInProgress(el) || el.classList.contains("is-done");
  }

  function answered(el) {
    if (el.classList.contains("solved")) return true;
    if (el.querySelector(".ku-feedback.show")) return true;
    if (restored(el)) return true;
    // Отдельный вопрос внутри упражнения, которое целиком уже зачтено.
    // Сам вопрос после перезагрузки «чистый»: курсы не восстанавливают
    // выбранный вариант, только факт прохождения на упражнении.
    var owner = el.closest && el.closest("[data-ku-id]");
    return !!(owner && owner !== el && restored(owner));
  }

  function gateOpen(gate) {
    // Вернулись в курс: упражнение уже пройдено — открываем сразу.
    // Проверять это надо ДО разбора вопросов: после перезагрузки ни один
    // .ku-quiz-q не помечен solved, и блок запирался бы повторно.
    if (restored(gate)) return true;
    // Блок из нескольких вопросов закрыт, пока не отвечен последний.
    var qs = gate.querySelectorAll(".ku-quiz-q");
    if (qs.length) return answered(qs[qs.length - 1]);
    return answered(gate);
  }

  /* ══ 2. РАЗБОР КОНТЕЙНЕРА НА СЕГМЕНТЫ ═══════════════════════════════ */
  function segmentize(container, isGate) {
    var segs = [], cur = null;
    [].slice.call(container.children).forEach(function (el) {
      if (el.classList && el.classList.contains(NOTE_CLASS)) return;
      if (cur) cur.items.push(el);      // всё, что после гейта, — под замком
      if (isGate(el)) { cur = { gate: el, items: [] }; segs.push(cur); }
    });
    if (!segs.length) return null;

    segs.forEach(function (s) {
      var note = document.createElement("div");
      note.className = NOTE_CLASS;
      note.hidden = true;
      note.innerHTML = noteHTML(s.gate);
      s.gate.parentNode.insertBefore(note, s.gate.nextSibling);
      s.note = note;
    });
    return { container: container, segs: segs, blocked: null };
  }

  /* Прячем всё начиная с первого неотвеченного гейта.
     Возвращает индекс этого гейта или -1, если открыто всё. */
  function apply(ctx) {
    var blocked = -1;
    ctx.segs.forEach(function (s, i) {
      if (blocked < 0 && !gateOpen(s.gate)) blocked = i;
    });
    ctx.segs.forEach(function (s, i) {
      var hide = blocked >= 0 && i >= blocked;
      s.items.forEach(function (el) {
        el.classList.toggle(LOCK_CLASS, hide);
      });
      s.note.hidden = blocked !== i;
    });
    return blocked;
  }

  /* ══ 3. СБОР КОНТЕЙНЕРОВ ════════════════════════════════════════════ */
  function isPageGate(el) {
    if (el.hasAttribute("data-ku-nogate")) return false;
    if (el.classList.contains(NOTE_CLASS)) return false;
    return !!el.querySelector(".ku-feedback");
  }
  function isQuizGate(el) {
    return !!(el.classList && el.classList.contains("ku-quiz-q"));
  }

  function collect() {
    var ctxs = [];

    document.querySelectorAll(".ku-page").forEach(function (page) {
      var flow = page.querySelector(".ku-wrap") ||
                 page.querySelector(".ku-section") || page;
      if (!flow.querySelector(".ku-feedback")) return;
      var c = segmentize(flow, isPageGate);
      if (c) ctxs.push(c);
    });

    var seen = [];
    document.querySelectorAll(".ku-quiz-q").forEach(function (q) {
      var p = q.parentNode;
      if (seen.indexOf(p) >= 0) return;
      seen.push(p);
      var own = [].slice.call(p.children).filter(isQuizGate);
      if (own.length < 2) return;
      var c = segmentize(p, isQuizGate);
      if (c) ctxs.push(c);
    });

    return ctxs;
  }

  /* ══ 4. ЗАПУСК ══════════════════════════════════════════════════════ */
  function start() {
    var ctxs = collect();
    if (!ctxs.length) return;

    var mo = null;
    var queued = false;
    function refresh() {
      queued = false;
      ctxs.forEach(function (ctx) {
        var was = ctx.blocked;
        var now = apply(ctx);
        ctx.blocked = now;
        // Замок сдвинулся вперёд — подводим открывшийся кусок под взгляд,
        // иначе на длинной главе студент не замечает продолжения.
        if (was !== null && was >= 0 && now !== was) {
          var opened = ctx.segs[was].items[0];
          if (opened && !opened.classList.contains(LOCK_CLASS) && !opened.hidden) {
            opened.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      });
      // Выбрасываем мутации, которые только что наделали сами, иначе
      // наблюдатель будет будить refresh по кругу.
      if (mo) mo.takeRecords();
    }
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(refresh);
    }

    // Обратная связь включается классом на .ku-feedback, а иногда
    // перерисовкой её содержимого — слушаем и то, и другое.
    mo = new MutationObserver(schedule);
    ctxs.forEach(function (c) {
      mo.observe(c.container, {
        subtree: true, childList: true,
        attributes: true, attributeFilter: ["class"],
      });
    });

    refresh();

    // ku-scorm.js поднимает сохранённый прогресс только на window load и
    // сообщает об этом событием ku:ready. До него isDone() ещё пустой,
    // поэтому пересчитываем замки, когда прогресс уже в памяти.
    document.addEventListener("ku:ready", schedule);
    window.addEventListener("load", schedule);
  }

  // Запираемся на DOMContentLoaded, не дожидаясь картинок и LMS: иначе
  // на медленной сети успевает мелькнуть содержимое за тестом.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
