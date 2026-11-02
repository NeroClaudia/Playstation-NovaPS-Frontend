/*
 * Shared on every page: login state.
 * DEMO ONLY - the state lives in localStorage. Replace with a real
 * backend/API session later.
 */
(function () {
  var KEY = "novaps_user";

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      return null;
    }
  }

  window.NovaPS = {
    isLoggedIn: function () {
      return !!read();
    },
    login: function (email) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ email: email }));
      } catch (e) {}
    },
    logout: function () {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    },
  };

  // Runs in <head> so the navbar never flashes the wrong state.
  // Tailwind's custom "logged-in:" variant reacts to this class.
  if (NovaPS.isLoggedIn()) {
    document.documentElement.classList.add("logged-in");
  }
})();
