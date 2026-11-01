/* ZACCOFFEE — home page: the client's logo video and its menu first, then the main page with the sections.
 *
 * - The script in <head> decides before the first paint whether the intro shows (class "intro-on"): not when the
 *   address has a #hash (links back from inner pages), not for reduced motion, not when the admin set it to "off",
 *   and with "first" only on someone's first visit. ?intro always shows it.
 * - The video starts muted (browsers only allow sound after a tap): "Sound on" turns the sound on.
 * - Its menu lines are links laid over the picture. #intro-track says where each one is, frame by frame, in parts of
 *   the picture (tools/build_intro_menu.sh); they move with the video and appear once their line has risen into
 *   view. The video stops on the menu, and "Skip intro" becomes "Enter site".
 * - The screen around the picture fades from espresso to the video's grey together with the video's own fade-in.
 * - If the browser won't start the video (e.g. iPhone in Low Power Mode) or can't play it, its last frame shows as
 *   a picture, with the same links.
 * - "Skip intro" / "Enter site", the logo or Esc: the intro fades out and the main page is there.
 * - The cup clip further down loads when it comes near the screen and plays only while it is on screen (a still
 *   picture for people who asked for reduced motion).
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const intro = document.getElementById("intro");
  const start = document.getElementById("start");
  const SEEN_KEY = "zac:film-seen"; // named in the days of the film; kept, so people who saw that aren't asked again

  // the photos of the first screen start moving once the main page is on screen
  const showMain = () => root.classList.add("start-in");

  if (intro) {
    const video = intro.querySelector(".intro__video");
    const sources = Array.from(video.querySelectorAll("source"));
    const soundBtn = intro.querySelector(".intro__sound");
    const soundLabel = soundBtn.querySelector(".btn__label");
    const skipBtn = intro.querySelector(".intro__skip");
    const skipLabel = skipBtn.querySelector(".btn__label");
    const bar = intro.querySelector(".intro__bar span");
    const spots = Array.from(intro.querySelectorAll("[data-track]"));
    const mode = intro.dataset.mode;
    const page = () => Array.from(document.body.children).filter((el) => el !== intro && el.tagName !== "SCRIPT");
    let track = null;
    try {
      track = JSON.parse(document.getElementById("intro-track").textContent);
    } catch {
      /* no track: the video plays without its links */
    }
    const fps = track?.fps ?? 24;
    const lastFrame = (track?.frames ?? 1) - 1;
    let active = false;
    let frame = 0;
    let fadeFrame = 0;

    // the picture's shape: the screen's until the video has loaded, then the file the browser picked
    const setShape = (tall) => {
      intro.dataset.shape = tall ? "tall" : "wide";
    };
    setShape(matchMedia("(orientation: portrait)").matches);
    video.addEventListener("loadedmetadata", () => setShape(video.videoHeight > video.videoWidth));

    const markSeen = () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* private mode: the intro may show again next time */
      }
    };

    // where a link is at frame f: keyframes [frame, left, top, width, height], in straight lines between them
    const at = (keys, f) => {
      if (!keys?.length || f < keys[0][0]) return null;
      let k = 0;
      while (k < keys.length - 1 && keys[k + 1][0] <= f) k += 1;
      const a = keys[k];
      const b = keys[k + 1];
      if (!b) return a.slice(1);
      const t = (f - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t);
    };

    // frame f of the video: the links over it, and the grey around it
    const paint = (f) => {
      const view = track?.[intro.dataset.shape === "tall" ? "portrait" : "landscape"];
      spots.forEach((el) => {
        const r = view ? at(view[el.dataset.track], f) : null;
        if (el.hidden !== !r) el.hidden = !r;
        if (!r) return;
        el.style.left = `${r[0] * 100}%`;
        el.style.top = `${r[1] * 100}%`;
        el.style.width = `${r[2] * 100}%`;
        el.style.height = `${r[3] * 100}%`;
      });
      // the same curve as the video's fade-in (tools/video/intro_menu.py)
      const k = Math.min(1, Math.max(0, (f + 1) / (track?.fade ?? 1)));
      const light = k * k * (3 - 2 * k);
      intro.style.setProperty("--light", light.toFixed(3));
      intro.classList.toggle("is-light", light > 0.5);
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
      paint(video.currentTime * fps);
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

    // the video has stopped on its menu: the links stay where the lines are
    const toEnd = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      paint(lastFrame);
      bar.style.transform = "scaleX(1)";
      intro.classList.add("is-done");
      skipLabel.textContent = "Enter site";
      if (document.activeElement === soundBtn) skipBtn.focus({ preventScroll: true });
      if (mode === "first") markSeen();
    };

    // the browser won't play it: the last frame as a picture, with the same links
    const showStill = () => {
      if (!active) return;
      video.pause();
      intro.classList.add("is-still");
      toEnd();
    };

    async function show() {
      active = true;
      root.classList.add("intro-on");
      page().forEach((el) => {
        el.inert = true;
      });
      load();
      video.muted = true;
      updateSound();
      skipBtn.focus({ preventScroll: true });
      try {
        await video.play();
      } catch {
        showStill();
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
        video.pause();
        video.muted = true;
        root.classList.remove("intro-on");
        start?.querySelector("#start-title")?.focus({ preventScroll: true });
      }, 900);
    }

    video.addEventListener("playing", () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    });
    video.addEventListener("ended", toEnd);
    // the browser tries the <source> list in order; give up only when the last one fails
    sources[sources.length - 1].addEventListener("error", showStill);

    skipBtn.addEventListener("click", finish);
    intro.querySelector(".intro__logo").addEventListener("click", finish);
    intro.querySelectorAll(".intro__link").forEach((link) => {
      link.addEventListener("click", () => {
        if (mode === "first") markSeen();
      });
    });
    soundBtn.addEventListener("click", () => {
      if (video.muted) {
        video.volume = 0;
        video.muted = false;
        if (video.paused && !video.ended) video.play().catch(() => {});
        fadeVolume(1, 1200);
      } else {
        fadeVolume(0, 400, () => {
          video.muted = true;
          updateSound();
        });
      }
      updateSound();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && active) finish();
    });
    // back from a section the menu led to: the page as it was left; a video stopped halfway goes on
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted || !active || !video.paused || video.ended || intro.classList.contains("is-still")) return;
      video.play().catch(showStill);
    });

    if (root.classList.contains("intro-on")) {
      // remove ?intro from the address, so a reload follows the normal rule again
      const url = new URL(location.href);
      if (url.searchParams.has("intro")) {
        url.searchParams.delete("intro");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      show();
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
