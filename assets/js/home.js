/* ZACCOFFEE — home page: the client's film, then their logo video, then the start screen (the gold logo and its menu).
 *
 * - The script in <head> decides before the first paint whether the intro shows (class "intro-on"): not when the
 *   address has a #hash (links back from inner pages), not for reduced motion, not when the admin set it to "off",
 *   and with "first" only on someone's first visit. ?intro always shows it.
 * - The film starts muted (browsers only allow sound after a tap): "Sound on" turns the sound on, and it stays on
 *   for the logo video.
 * - When the film ends, the logo video plays in its place: out of the film's dark end the light grey comes up, the
 *   screen round the picture with it, the logo settles and the menu rises. Its last frame is the start screen, so when
 *   it ends the intro melts away and the home page is there, its menu clickable.
 * - "Skip intro" or Esc: straight to the home page. If the browser won't play the film it goes to the logo video, if
 *   it won't play that either (e.g. iPhone in Low Power Mode), the home page is there at once.
 * - "Watch the film" on the start screen plays it all again, from the start.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const intro = document.getElementById("intro");
  if (!intro) return;
  const SEEN_KEY = "zac:film-seen";

  const film = intro.querySelector(".intro__film");
  const video = intro.querySelector(".intro__video");
  const soundBtn = intro.querySelector(".intro__sound");
  const soundLabel = soundBtn.querySelector(".btn__label");
  const skipBtn = intro.querySelector(".intro__skip");
  const bar = intro.querySelector(".intro__bar span");
  const mode = intro.dataset.mode;
  const fps = Number(intro.dataset.fps) || 24;
  const fade = Number(intro.dataset.fade) || 1;
  const page = () => Array.from(document.body.children).filter((el) => el !== intro && el.tagName !== "SCRIPT");
  let active = false;
  let cur = film; // the film while it plays, then the logo video
  let frame = 0;
  let fadeFrame = 0;
  let leaving = 0;

  // the picture's shape: the screen's until a video has loaded, then the file the browser picked
  const setShape = (tall) => {
    intro.dataset.shape = tall ? "tall" : "wide";
  };
  setShape(matchMedia("(orientation: portrait)").matches);
  [film, video].forEach((v) => v.addEventListener("loadedmetadata", () => {
    if (v === cur) setShape(v.videoHeight > v.videoWidth);
  }));

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode: the film may show again next time */
    }
  };

  const fadeVolume = (to, ms, done) => {
    cancelAnimationFrame(fadeFrame);
    const v = cur;
    const from = v.volume;
    const t0 = performance.now();
    const step = (now) => {
      // a frame's timestamp can be a little earlier than t0, and volume outside 0..1 throws
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      v.volume = Math.min(1, Math.max(0, from + (to - from) * k));
      if (k < 1) fadeFrame = requestAnimationFrame(step);
      else if (done) done();
    };
    fadeFrame = requestAnimationFrame(step);
  };

  const updateSound = () => {
    const on = !cur.muted;
    soundBtn.classList.toggle("is-on", on);
    soundBtn.setAttribute("aria-pressed", String(on));
    soundLabel.textContent = on ? "Sound off" : "Sound on";
  };

  // the screen round the logo video comes up from espresso with the video's own fade-in (the same curve as
  // tools/video/intro_menu.py), and the buttons turn dark once it is light
  const setLight = (light) => {
    intro.style.setProperty("--light", light.toFixed(3));
    intro.classList.toggle("is-light", light > 0.5);
  };

  const tick = () => {
    if (!active) return;
    if (cur === video) {
      const k = Math.min(1, Math.max(0, (video.currentTime * fps + 1) / fade));
      setLight(k * k * (3 - 2 * k));
    }
    if (cur.duration > 0) {
      bar.style.transform = `scaleX(${Math.min(1, cur.currentTime / cur.duration)})`;
    }
    frame = requestAnimationFrame(tick);
  };

  const load = (v) => {
    const list = v.querySelectorAll("source");
    if (list[0].getAttribute("src")) return;
    list.forEach((s) => s.setAttribute("src", s.dataset.src));
    v.preload = "auto";
    v.load();
  };

  // the film has ended: the logo video in its place, with the sound as it was
  async function toVideo() {
    if (!active || cur === video) return;
    cancelAnimationFrame(frame);
    film.pause();
    video.muted = film.muted;
    video.volume = film.volume;
    cur = video;
    intro.classList.remove("is-film");
    if (video.videoWidth) setShape(video.videoHeight > video.videoWidth);
    bar.style.transform = "scaleX(0)";
    load(video);
    if (video.currentTime > 0) video.currentTime = 0;
    try {
      await video.play();
    } catch {
      finish();
    }
  }

  async function show() {
    if (active) return;
    active = true;
    clearTimeout(leaving);
    intro.classList.remove("is-leaving");
    root.classList.add("intro-on");
    page().forEach((el) => {
      el.inert = true;
    });
    cur = film;
    intro.classList.add("is-film");
    setLight(0);
    load(film);
    if (film.currentTime > 0) film.currentTime = 0;
    [film, video].forEach((v) => {
      v.muted = true;
    });
    updateSound();
    bar.style.transform = "scaleX(0)";
    skipBtn.focus({ preventScroll: true });
    try {
      await film.play();
    } catch {
      toVideo();
    }
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    if (mode === "first") markSeen();
    if (!cur.muted && !cur.paused) fadeVolume(0, 700);
    intro.classList.add("is-leaving");
    page().forEach((el) => {
      el.inert = false;
    });
    leaving = setTimeout(() => {
      [film, video].forEach((v) => {
        v.pause();
        v.muted = true;
      });
      root.classList.remove("intro-on");
      document.getElementById("start-title")?.focus({ preventScroll: true });
    }, 900);
  }

  [film, video].forEach((v) => v.addEventListener("playing", () => {
    if (v !== cur) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
    if (v === film) load(video); // the logo video ready by the time the film ends
  }));
  film.addEventListener("ended", toVideo);
  video.addEventListener("ended", finish);
  // the browser tries the <source> list in order; give up only when the last one fails. Before load() sets their
  // src the browser also reports each source as failed: those don't count
  const onLastFails = (v, then) => {
    const list = v.querySelectorAll("source");
    const last = list[list.length - 1];
    last.addEventListener("error", () => {
      if (last.getAttribute("src") && v === cur) then();
    });
  };
  onLastFails(film, toVideo);
  onLastFails(video, finish);

  skipBtn.addEventListener("click", finish);
  // leaving for a section: this page's place in the history becomes #start, so "Back" returns to the start screen
  // and not to the film, even where the browser doesn't keep the page as it was left
  document.querySelectorAll(".start__link").forEach((link) => {
    link.addEventListener("click", () => {
      if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#start`);
    });
  });
  // "Watch the film" on the start screen: it all again, without reloading (the link itself is ?intro)
  document.querySelectorAll("[data-intro-replay]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show();
    });
  });
  soundBtn.addEventListener("click", () => {
    const v = cur;
    if (v.muted) {
      v.volume = 0;
      v.muted = false;
      if (v.paused && !v.ended) v.play().catch(() => {});
      fadeVolume(1, 1200);
    } else {
      fadeVolume(0, 400, () => {
        v.muted = true;
        updateSound();
      });
    }
    updateSound();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) finish();
  });
  // back from another page: the page as it was left; a video stopped halfway goes on
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !active || !cur.paused || cur.ended) return;
    cur.play().catch(finish);
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
