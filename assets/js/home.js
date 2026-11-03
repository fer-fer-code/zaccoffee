/* ZACCOFFEE — home page: the client's film first, then the start screen (the gold logo and its menu).
 *
 * - The script in <head> decides before the first paint whether the film shows (class "intro-on"): not when the
 *   address has a #hash (links back from inner pages), not for reduced motion, not when the admin set it to "off",
 *   and with "first" only on someone's first visit. ?intro always shows it.
 * - The film starts muted (browsers only allow sound after a tap): "Sound on" turns the sound on.
 * - When it ends, on "Skip intro" or Esc, it fades out over the start screen. If the browser won't play it (e.g.
 *   iPhone in Low Power Mode), the start screen is there at once.
 * - "Watch the film" on the start screen plays it again, from the start.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const intro = document.getElementById("intro");
  if (!intro) return;
  const SEEN_KEY = "zac:film-seen";

  const film = intro.querySelector(".intro__film");
  const sources = Array.from(film.querySelectorAll("source"));
  const soundBtn = intro.querySelector(".intro__sound");
  const soundLabel = soundBtn.querySelector(".btn__label");
  const skipBtn = intro.querySelector(".intro__skip");
  const bar = intro.querySelector(".intro__bar span");
  const mode = intro.dataset.mode;
  const page = () => Array.from(document.body.children).filter((el) => el !== intro && el.tagName !== "SCRIPT");
  let active = false;
  let frame = 0;
  let fadeFrame = 0;
  let leaving = 0;

  // the film's shape: the screen's until it has loaded, then the file the browser picked
  const setShape = (tall) => {
    intro.dataset.shape = tall ? "tall" : "wide";
  };
  setShape(matchMedia("(orientation: portrait)").matches);
  film.addEventListener("loadedmetadata", () => setShape(film.videoHeight > film.videoWidth));

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode: the film may show again next time */
    }
  };

  const fadeVolume = (to, ms, done) => {
    cancelAnimationFrame(fadeFrame);
    const from = film.volume;
    const t0 = performance.now();
    const step = (now) => {
      // a frame's timestamp can be a little earlier than t0, and volume outside 0..1 throws
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      film.volume = Math.min(1, Math.max(0, from + (to - from) * k));
      if (k < 1) fadeFrame = requestAnimationFrame(step);
      else if (done) done();
    };
    fadeFrame = requestAnimationFrame(step);
  };

  const updateSound = () => {
    const on = !film.muted;
    soundBtn.classList.toggle("is-on", on);
    soundBtn.setAttribute("aria-pressed", String(on));
    soundLabel.textContent = on ? "Sound off" : "Sound on";
  };

  const tick = () => {
    if (!active) return;
    if (film.duration > 0) {
      bar.style.transform = `scaleX(${Math.min(1, film.currentTime / film.duration)})`;
    }
    frame = requestAnimationFrame(tick);
  };

  const load = () => {
    if (sources[0].getAttribute("src")) return;
    sources.forEach((s) => s.setAttribute("src", s.dataset.src));
    film.preload = "auto";
    film.load();
  };

  async function show() {
    if (active) return;
    active = true;
    clearTimeout(leaving);
    intro.classList.remove("is-leaving");
    root.classList.add("intro-on");
    page().forEach((el) => {
      el.inert = true;
    });
    load();
    if (film.currentTime > 0) film.currentTime = 0;
    film.muted = true;
    updateSound();
    bar.style.transform = "scaleX(0)";
    skipBtn.focus({ preventScroll: true });
    try {
      await film.play();
    } catch {
      finish();
    }
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    if (mode === "first") markSeen();
    if (!film.muted && !film.paused) fadeVolume(0, 700);
    intro.classList.add("is-leaving");
    page().forEach((el) => {
      el.inert = false;
    });
    leaving = setTimeout(() => {
      film.pause();
      film.muted = true;
      root.classList.remove("intro-on");
      document.getElementById("start-title")?.focus({ preventScroll: true });
    }, 900);
  }

  film.addEventListener("playing", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  });
  film.addEventListener("ended", finish);
  // the browser tries the <source> list in order; give up only when the last one fails. Before load() sets their
  // src the browser also reports each source as failed: those don't count
  const last = sources[sources.length - 1];
  last.addEventListener("error", () => {
    if (last.getAttribute("src")) finish();
  });

  skipBtn.addEventListener("click", finish);
  // leaving for a section: this page's place in the history becomes #start, so "Back" returns to the start screen
  // and not to the film, even where the browser doesn't keep the page as it was left
  document.querySelectorAll(".start__link").forEach((link) => {
    link.addEventListener("click", () => {
      if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#start`);
    });
  });
  // "Watch the film" on the start screen: the film again, without reloading (the link itself is ?intro)
  document.querySelectorAll("[data-intro-replay]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show();
    });
  });
  soundBtn.addEventListener("click", () => {
    if (film.muted) {
      film.volume = 0;
      film.muted = false;
      if (film.paused && !film.ended) film.play().catch(() => {});
      fadeVolume(1, 1200);
    } else {
      fadeVolume(0, 400, () => {
        film.muted = true;
        updateSound();
      });
    }
    updateSound();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) finish();
  });
  // back from another page: the page as it was left; a film stopped halfway goes on
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !active || !film.paused || film.ended) return;
    film.play().catch(finish);
  });

  if (root.classList.contains("intro-on")) {
    // remove ?intro from the address, so a reload follows the normal rule again
    const url = new URL(location.href);
    if (url.searchParams.has("intro")) {
      url.searchParams.delete("intro");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    show();
  }
})();
