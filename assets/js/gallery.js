/* ZACCOFFEE — gallery viewer. Each photo links to its large version, so without JS the link simply opens it. */
(() => {
  "use strict";

  const links = Array.from(document.querySelectorAll(".gallery a"));
  const box = document.querySelector(".lightbox");
  if (!links.length || !box || typeof box.showModal !== "function") return;

  const img = box.querySelector(".lightbox__img");
  const caption = box.querySelector(".lightbox__caption");
  const count = box.querySelector(".lightbox__count");
  const two = (n) => String(n).padStart(2, "0");
  let index = 0;

  function show(i) {
    index = (i + links.length) % links.length;
    const link = links[index];
    const alt = link.querySelector("img").alt;
    img.src = link.href;
    img.alt = alt;
    caption.textContent = alt;
    count.textContent = `${two(index + 1)} / ${two(links.length)}`;
  }

  links.forEach((link, i) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show(i);
      box.showModal();
      document.documentElement.classList.add("menu-open");
    });
  });

  box.querySelector(".lightbox__prev").addEventListener("click", () => show(index - 1));
  box.querySelector(".lightbox__next").addEventListener("click", () => show(index + 1));
  box.querySelector(".lightbox__close").addEventListener("click", () => box.close());
  // a click on the dark area around the photo closes the viewer
  box.addEventListener("click", (event) => {
    if (event.target === box) box.close();
  });
  box.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  });
  box.addEventListener("close", () => {
    document.documentElement.classList.remove("menu-open");
    links[index].focus({ preventScroll: true });
  });
})();
