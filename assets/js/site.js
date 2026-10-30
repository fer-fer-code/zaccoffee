/* ZACCOFFEE — every page: the header, the menu on narrow screens, and the forms: "Get launch updates" opens its
 * sign-up form in a window; the forms send without leaving the page and show the answer under the button (without
 * this script they still work, as ordinary pages). */
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

  // "Get launch updates": the sign-up form in a window instead of going to its page
  const signup = document.getElementById("signup");
  if (signup && typeof signup.showModal === "function") {
    document.querySelectorAll("[data-signup]").forEach((link) =>
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (menu && menu.open) menu.close();
        signup.showModal();
        signup.querySelector('input[name="email"]').focus();
      }),
    );
    signup.querySelector(".signup-dialog__close").addEventListener("click", () => signup.close());
    // a click on the dimmed page around the window closes it
    signup.addEventListener("click", (event) => {
      if (event.target === signup) signup.close();
    });
  }

  // the forms send in the background and show the answer; the static preview (no server) says so instead
  document.querySelectorAll("form[data-form]").forEach((form) => {
    const status = form.querySelector(".form__status");
    const say = (message, ok) => {
      status.textContent = message;
      status.classList.toggle("is-ok", ok);
      status.classList.toggle("is-error", !ok);
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (root.hasAttribute("data-static")) {
        say("This is a preview copy of the site: the form will work once the site is on its hosting.", false);
        return;
      }
      form.classList.add("is-sending");
      try {
        const response = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        const answer = await response.json();
        say(answer.message, answer.ok);
        if (answer.ok) form.querySelectorAll("input:not([type=hidden]), textarea").forEach((field) => (field.value = ""));
      } catch {
        form.submit();                   // no answer from the page's script: send it the ordinary way
      } finally {
        form.classList.remove("is-sending");
      }
    });
  });
})();
