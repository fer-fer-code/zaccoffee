/* ZACCOFFEE — home page: the client's film first, then the main page with the sections.
 *
 * - The script in <head> decides before the first paint whether the film shows (class "intro-on"): not when the
 *   address has a #hash (links back from inner pages), not for reduced motion, not when the admin set it to "off",
 *   and with "first" only on someone's first visit. ?intro always shows it.
 * - The film starts muted (browsers only allow sound after a tap): "Sound on" turns the sound on. If the browser
 *   refuses to start it at all (e.g. iPhone in Low Power Mode), a Play button appears and plays it with sound.
 * - When the film ends, or on "Skip intro" / Esc, it fades out and the main page is there.
 * - "Watch the film" on the main page plays it again, with sound (it's a tap, so browsers allow it).
 * - The cup clip further down loads when it comes near the screen and plays only while it is on screen (a still
 *   picture for people who asked for reduced motion).
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const intro = document.getElementById("intro");
  const start = document.getElementById("start");
  const SEEN_KEY = "zac:film-seen";

  // the photos of the first screen start moving once the main page is on screen
  const showMain = () => root.classList.add("start-in");

  if (intro) {
    const video = intro.querySelector(".intro__video");
    const sources = Array.from(video.querySelectorAll("source"));
    const soundBtn = intro.querySelector(".intro__sound");
    const soundLabel = soundBtn.querySelector(".btn__label");
    const skipBtn = intro.querySelector(".intro__skip");
    const playBtn = intro.querySelector(".intro__play");
    const bar = intro.querySelector(".intro__bar span");
    const filmBtn = document.querySelector("[data-play-film]");
    const mode = intro.dataset.mode;
    const page = () => Array.from(document.body.children).filter((el) => el !== intro && el.tagName !== "SCRIPT");
    let active = false;
    let frame = 0;
    let fadeFrame = 0;

    const markSeen = () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* private mode: the film may show again next time */
      }
    };

    const fadeVolume = (to, ms, done) => {
      cancelAnimationFrame(fadeFrame);
      const from = video.volume;
      const t0 = performance.now();
      const step = (now) => {
        // a frame's timestamp can be a little earlier than t0, and volume outside 0..1 throws
        const k = Math.min(1, Math.max(0, (now - t0) / ms));
        video.volume = Math.min(1, Math.max(0, from + (to - from) * k));
        if (k < 1) fadeFrame = requestAnimationFrame(step);
        else if (done) done();
      };
      fadeFrame = requestAnimationFrame(step);
    };

    const updateSound = () => {
      const on = !video.muted;
      soundBtn.classList.toggle("is-on", on);
      soundBtn.setAttribute("aria-pressed", String(on));
      soundLabel.textContent = on ? "Sound off" : "Sound on";
    };

    const tick = () => {
      if (!active) return;
      if (video.duration > 0) {
        bar.style.transform = `scaleX(${Math.min(1, video.currentTime / video.duration)})`;
      }
      frame = requestAnimationFrame(tick);
    };

    const load = () => {
      if (sources[0].getAttribute("src")) return;
      sources.forEach((s) => s.setAttribute("src", s.dataset.src));
      video.preload = "auto";
      video.load();
    };

    const waitForTap = () => {
      intro.classList.add("is-waiting");
      playBtn.hidden = false;
      playBtn.focus({ preventScroll: true });
    };

    async function show(withSound) {
      active = true;
      intro.classList.remove("is-leaving");
      root.classList.add("intro-on");
      page().forEach((el) => {
        el.inert = true;
      });
      playBtn.hidden = true;
      load();
      try {
        video.currentTime = 0;
      } catch {
        /* not loaded yet: it starts from the beginning anyway */
      }
      video.volume = 1;
      video.muted = !withSound;
      updateSound();
      skipBtn.focus({ preventScroll: true });
      try {
        await video.play();
      } catch {
        if (!active) return;
        if (!video.muted) {
          // sound refused: try muted, then wait for a tap
          video.muted = true;
          updateSound();
          try {
            await video.play();
            return;
          } catch {
            /* fall through */
          }
        }
        if (active) waitForTap();
      }
    }

    function finish() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frame);
      if (mode === "first") markSeen();
      if (!video.muted && !video.paused) fadeVolume(0, 700);
      intro.classList.add("is-leaving");
      page().forEach((el) => {
        el.inert = false;
      });
      showMain();
      setTimeout(() => {
        if (active) return; // "Watch the film" was pressed during the fade
        video.pause();
        video.muted = true;
        root.classList.remove("intro-on");
        intro.classList.remove("is-leaving", "is-waiting");
        bar.style.transform = "scaleX(0)";
        start?.querySelector("#start-title")?.focus({ preventScroll: true });
      }, 900);
    }

    video.addEventListener("playing", () => {
      intro.classList.remove("is-waiting");
      playBtn.hidden = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    });
    video.addEventListener("ended", finish);
    // the browser tries the <source> list in order; give up only when the last one fails
    sources[sources.length - 1].addEventListener("error", finish);

    skipBtn.addEventListener("click", finish);
    soundBtn.addEventListener("click", () => {
      if (video.muted) {
        video.volume = 0;
        video.muted = false;
        if (video.paused) video.play().catch(() => {});
        fadeVolume(1, 1200);
      } else {
        fadeVolume(0, 400, () => {
          video.muted = true;
          updateSound();
        });
      }
      updateSound();
    });
    playBtn.addEventListener("click", () => {
      video.muted = false;
      video.volume = 1;
      updateSound();
      video.play().catch(finish);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && active) finish();
    });

    if (filmBtn) {
      filmBtn.hidden = false;
      filmBtn.addEventListener("click", () => show(true));
    }

    if (root.classList.contains("intro-on")) {
      // remove ?intro from the address, so a reload follows the normal rule again
      const url = new URL(location.href);
      if (url.searchParams.has("intro")) {
        url.searchParams.delete("intro");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      show(false);
    } else {
      showMain();
    }
  } else {
    showMain();
  }

  const clip = document.querySelector(".moment__video");
  if (clip && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          clip.pause();
          return;
        }
        if (!clip.querySelector("source[src]")) {
          clip.querySelectorAll("source").forEach((s) => s.setAttribute("src", s.dataset.src));
          clip.load();
        }
        clip.play().catch(() => {});
      },
      { rootMargin: "200px 0px" },
    ).observe(clip);
  }
})();
