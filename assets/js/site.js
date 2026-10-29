/* ZACCOFFEE — every page: the header and the menu on narrow screens. */
(() => {
  "use strict";

  const root = document.documentElement;
  const head = document.querySelector(".site-head");
  const hero = document.querySelector(".hero");

  // Over the film the header is transparent; it turns solid once the film has scrolled away.
  if (head && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => head.classList.toggle("is-solid", !entry.isIntersecting),
      { rootMargin: `-${head.offsetHeight}px 0px 0px 0px` },
    ).observe(hero);
  }

  const menu = document.getElementById("menu");
  const menuBtn = document.querySelector(".site-head__menu");
  if (menu && menuBtn && typeof menu.showModal === "function") {
    menuBtn.addEventListener("click", () => {
      menu.showModal();
      root.classList.add("menu-open");
      menuBtn.setAttribute("aria-expanded", "true");
    });
    menu.querySelector(".menu__close").addEventListener("click", () => menu.close());
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu.close()));
    menu.addEventListener("close", () => {
      root.classList.remove("menu-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  }
})();
