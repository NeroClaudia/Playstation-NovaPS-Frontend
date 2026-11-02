/*
 * Home page: "login required" pop-up, order buttons and profile menu.
 * Requires js/shared/session.js.
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

  // Profile dropdown (logout)
  var profileBtn = document.getElementById("profileBtn");
  var profile = profileBtn.parentElement;

  function setProfileOpen(open) {
    profile.toggleAttribute("data-open", open);
    profileBtn.setAttribute("aria-expanded", String(open));
  }

  profileBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    setProfileOpen(!profile.hasAttribute("data-open"));
  });
  document.addEventListener("click", function () {
    setProfileOpen(false);
  });
  document.getElementById("logoutBtn").addEventListener("click", function () {
    NovaPS.logout();
    document.documentElement.classList.remove("logged-in");
  });
})();
