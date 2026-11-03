/* Order Status page. Requires js/shared/session.js and js/shared/tabs.js. */
(function () {
  // There is no order data yet (no backend), so every tab shows an empty state.
  var messages = {
    all: "You haven’t ordered anything yet",
    "not-paid": "No unpaid orders.",
    packaged: "No packaged orders.",
    shipped: "No shipped orders.",
    complete: "No completed orders yet.",
    canceled: "No canceled orders.",
    rejected: "No rejected orders.",
  };

  var message = document.getElementById("empty-message");
  var cta = document.getElementById("empty-cta");

  NovaPS.initTabs(document.getElementById("tabs"), function (key) {
    message.textContent = messages[key];
    cta.hidden = key !== "all"; // "Order Now" only on the first tab
  });
})();
