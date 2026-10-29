/* ZACCOFFEE — home page: the film at the top, music on request, the directory and its photos.
 *
 * - The film plays on its own (muted, looping) and pauses while it is scrolled out of view.
 * - Browsers only allow sound after a tap, so music is a separate track behind the "Music" button.
 * - Visitors who asked their system for reduced motion get the still poster instead of the film.
 * - Scrolling away from the film fades the logo and lets the film sink into the page (--p on .hero).
 * - Pointing at a section in the directory shows that section's photo.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const start = document.getElementById("start");
  if (!hero) return;

  const video = hero.querySelector(".hero__video");
  const music = hero.querySelector(".hero__music");
  const soundBtn = hero.querySelector(".hero__sound");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canObserve = "IntersectionObserver" in window;

  let heroVisible = true;
  if (reduced) {
    video.removeAttribute("autoplay");
    video.pause();
  } else if (canObserve) {
    new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0 },
    ).observe(hero);
  }

  // the one scroll moment: 0 at the top, 1 when 60% of the film has scrolled away
  if (!reduced) {
    let queued = false;
    const update = () => {
      queued = false;
      const p = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.6)));
      hero.style.setProperty("--p", p.toFixed(3));
    };
    window.addEventListener(
      "scroll",
      () => {
        if (queued || !heroVisible) return;
        queued = true;
        requestAnimationFrame(update);
      },
      { passive: true },
    );
    update();
  }

  // Music fades in and out here rather than in the file: the track ("Amberlight" by Scott Buckley,
  // CC BY 4.0) stays unedited. iOS ignores volume changes and simply starts and stops it.
  if (music && soundBtn) {
    const label = soundBtn.querySelector(".btn__label");
    const LEVEL = 0.8;
    let wantOn = false;
    let frame = 0;
    const ramp = (to, ms, done) => {
      cancelAnimationFrame(frame);
      const from = music.volume;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        music.volume = from + (to - from) * k;
        if (k < 1) frame = requestAnimationFrame(step);
        else if (done) done();
      };
      frame = requestAnimationFrame(step);
    };
    const sync = () => {
      soundBtn.classList.toggle("is-on", wantOn);
      soundBtn.setAttribute("aria-pressed", String(wantOn));
      label.textContent = wantOn ? "Music on" : "Music off";
    };
    soundBtn.hidden = false;
    soundBtn.addEventListener("click", () => {
      wantOn = !wantOn;
      sync();
      if (wantOn) {
        if (music.paused) music.volume = 0;
        music
          .play()
          .then(() => ramp(LEVEL, 2000))
          .catch(() => {
            wantOn = false;
            sync();
          });
      } else {
        ramp(0, 700, () => music.pause());
      }
    });
    sync();
  }

  if (!start) return;

  // the photos start moving when the directory comes into view
  if (canObserve) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        root.classList.add("start-in");
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(start);
  } else {
    root.classList.add("start-in");
  }

  const slides = start.querySelector(".slides");
  if (!slides || !matchMedia("(hover: hover)").matches) return;

  const bySlug = new Map(Array.from(slides.querySelectorAll(".slide"), (img) => [img.dataset.slide, img]));
  let releaseTimer;
  const pick = (slug) => {
    const img = bySlug.get(slug);
    if (!img) return;
    clearTimeout(releaseTimer);
    slides.classList.add("is-picking");
    bySlug.forEach((el) => el.classList.toggle("is-picked", el === img));
  };
  // a short delay, so moving between two names does not flash the slideshow back in
  const release = () => {
    releaseTimer = setTimeout(() => {
      slides.classList.remove("is-picking");
      bySlug.forEach((el) => el.classList.remove("is-picked"));
    }, 350);
  };
  start.querySelectorAll(".directory a").forEach((link) => {
    link.addEventListener("mouseenter", () => pick(link.dataset.slide));
    link.addEventListener("focus", () => pick(link.dataset.slide));
    link.addEventListener("mouseleave", release);
    link.addEventListener("blur", release);
  });
})();
