/*
 * Home page: "login required" pop-up and order buttons.
 * Requires js/shared/session.js. The profile menu lives in js/shared/navbar.js.
 */
(function () {
  var modal = document.getElementById("loginModal");
  var lastFocus = null;

  function setModal(open) {
    modal.toggleAttribute("data-open", open); // Tailwind: data-[open]:...
    modal.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("overflow-hidden", open);
  }

  function openModal() {
    lastFocus = document.activeElement;
    setModal(true);
    setTimeout(function () {
      modal.querySelector("a").focus();
    }, 50);
  }

  function closeModal() {
    if (!modal.hasAttribute("data-open")) return;
    setModal(false);
    if (lastFocus) lastFocus.focus();
  }

  // Every "Order Now" / "Choose & Rent" button
  document.querySelectorAll("[data-order]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      if (!NovaPS.isLoggedIn()) {
        openModal();
        return;
      }
      // Logged in: the order form page will be connected here.
    });
  });

  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
})();
