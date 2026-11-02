/* Sign up page. Requires js/shared/session.js and js/shared/validation.js. */
(function () {
  var form = document.getElementById("signup-form");

  // ID card preview
  var upload = form.querySelector("[data-upload]");
  var fileInput = upload.querySelector("input");
  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    var isImage = !!file && /^image\//.test(file.type);
    if (isImage) upload.querySelector("img").src = URL.createObjectURL(file);
    upload.toggleAttribute("data-has-image", isImage);
  });

  NovaPS.initForm(form, function () {
    var email = form.querySelector('[type="email"]').value.trim();

    // TODO: send the sign up data (including the ID card image) to the backend API.
    setTimeout(function () {
      NovaPS.login(email);
      location.href = "../index.html";
    }, 600);
  });
})();
