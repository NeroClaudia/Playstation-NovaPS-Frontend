/*
 * Shared by the login, sign up and forgot password pages: form validation.
 * Requires js/shared/session.js.
 *
 *   NovaPS.initForm(form, onValid)
 *
 * Fields opt in with data-validate="required|email|phone|password|match|file".
 * onValid(form) runs only when every field passes.
 */
(function () {
  var rules = {
    required: function (v) {
      return v.trim() ? "" : "This field is required.";
    },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
        ? ""
        : "Enter a valid email address.";
    },
    phone: function (v) {
      return /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, ""))
        ? ""
        : "Enter a valid WhatsApp number (e.g. 0812-3456-7890).";
    },
    password: function (v) {
      return /^(?=.*\d).{8,}$/.test(v)
        ? ""
        : "Must have 8 characters & number.";
    },
    match: function (v, el, form) {
      return v === form.querySelector(el.dataset.match).value
        ? ""
        : "Passwords do not match.";
    },
    file: function (v, el) {
      var f = el.files[0];
      if (!f) return "Please upload your ID card.";
      if (!/^image\//.test(f.type)) return "The file must be an image.";
      if (f.size > 5 * 1024 * 1024) return "The image must be 5 MB or smaller.";
      return "";
    },
  };

  NovaPS.initForm = function (form, onValid) {
    var inputs = [].slice.call(form.querySelectorAll("[data-validate]"));

    // The [data-invalid] attribute drives the red border through Tailwind
    // (group-data-[invalid]/field:...)
    function check(el) {
      var msg = rules[el.dataset.validate](el.value, el, form);
      var field = el.closest("[data-field]");
      field.toggleAttribute("data-invalid", !!msg);
      field.querySelector("[data-error]").textContent = msg;
      return !msg;
    }

    inputs.forEach(function (el) {
      ["input", "change"].forEach(function (evt) {
        el.addEventListener(evt, function () {
          var field = el.closest("[data-field]");
          if (el.type === "file" || field.hasAttribute("data-invalid")) {
            check(el);
          }
        });
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      inputs.forEach(function (el) {
        if (!check(el)) ok = false;
      });
      if (!ok) {
        var bad = form.querySelector("[data-invalid] input");
        if (bad) bad.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Please wait…";
      onValid(form);
    });
  };
})();
