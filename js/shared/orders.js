/*
 * Shared order system: units (stock, prices), orders, 5-minute payment timer.
 * Requires js/shared/session.js.
 *
 * DEMO ONLY - everything lives in this browser's localStorage, so every
 * visitor has their own data. A real backend/database must own this data.
 *
 * Available units are always CALCULATED, never stored:
 *   available = total - maintenance - rented
 * where "rented" = units inside orders that are not_paid, pending, shipped or
 * complete (not returned yet). Canceled, rejected and returned orders free
 * their units automatically.
 *
 *   NovaPS.units.all / get / set            (admin "Unit" page)
 *   NovaPS.stock.get(unit)                  available units
 *   NovaPS.orders.create / pay / cancel / get / all / unpaid / sweep   (customer)
 *   NovaPS.orders.adminAll / adminGet / adminAct                       (admin)
 *   NovaPS.summaryRows + NovaPS.renderRows  order summary lists
 *   NovaPS.money / formatDate / formatTime / formatDays / formatClock
 */
(function () {
  var ORDERS_KEY = "novaps_orders";
  var UNITS_KEY = "novaps_units";
  var PAY_WINDOW_MS = 5 * 60 * 1000;
  var DAY_MS = 24 * 60 * 60 * 1000;

  // Statuses that keep a unit busy
  var ACTIVE = ["not_paid", "pending", "shipped", "complete"];

  var BASE = {
    ps4: {
      name: "PS4",
      label: "PS 4",
      price: 50000,
      total: 10,
      maintenance: 0,
    },
    ps5: {
      name: "PS5",
      label: "PS 5",
      price: 200000,
      total: 2,
      maintenance: 0,
    },
  };

  NovaPS.MAX_DAYS = 7;
  NovaPS.MAX_UNITS = 2;
  NovaPS.LOW_STOCK = 3;

  // Order statuses as customers see them
  NovaPS.STATUS = {
    not_paid: { label: "Not Paid", text: "text-amber-600" },
    pending: { label: "Pending", text: "text-indigo-500" },
    shipped: { label: "Shipped", text: "text-sky-600" },
    complete: { label: "Complete", text: "text-green-600" },
    returned: { label: "Complete", text: "text-green-600" }, // rental finished
    canceled: { label: "Canceled", text: "text-orange-700" },
    rejected: { label: "Rejected", text: "text-red-600" },
  };

  /* ---------- storage ---------- */

  function read(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function owner() {
    return (NovaPS.profile.get().email || "").toLowerCase();
  }

  function allOrders() {
    return read(ORDERS_KEY, []);
  }

  /* ---------- units: prices + stock ---------- */

  function savedUnits() {
    var saved = read(UNITS_KEY, {});
    var all = {};
    Object.keys(BASE).forEach(function (unit) {
      all[unit] = Object.assign({}, BASE[unit], saved[unit] || {});
    });
    return all;
  }

  function rentedCount(unit) {
    var count = 0;
    allOrders().forEach(function (order) {
      if (ACTIVE.indexOf(order.status) === -1) return;
      order.items.forEach(function (item) {
        if (item.unit === unit) count++;
      });
    });
    return count;
  }

  function unitInfo(unit) {
    var data = savedUnits()[unit];
    var rented = rentedCount(unit);
    return {
      name: data.name,
      label: data.label,
      price: data.price,
      total: data.total,
      maintenance: data.maintenance,
      rented: rented,
      available: Math.max(0, data.total - data.maintenance - rented),
    };
  }

  // PRODUCTS[unit].price always follows the price set by the admin
  var PRODUCTS = {};
  Object.keys(BASE).forEach(function (unit) {
    Object.defineProperty(PRODUCTS, unit, {
      enumerable: true,
      get: function () {
        return {
          name: BASE[unit].name,
          label: BASE[unit].label,
          price: savedUnits()[unit].price,
        };
      },
    });
  });
  NovaPS.PRODUCTS = PRODUCTS;

  NovaPS.units = {
    all: function () {
      NovaPS.orders.sweep();
      var all = {};
      Object.keys(BASE).forEach(function (unit) {
        all[unit] = unitInfo(unit);
      });
      return all;
    },
    get: function (unit) {
      NovaPS.orders.sweep();
      return unitInfo(unit);
    },
    // patch = { price, total, maintenance } (admin). Throws a readable error.
    set: function (unit, patch) {
      if (!BASE[unit]) throw new Error("Unknown unit.");
      var next = {
        price: Number(patch.price),
        total: Number(patch.total),
        maintenance: Number(patch.maintenance),
      };
      Object.keys(next).forEach(function (key) {
        if (!Number.isInteger(next[key]) || next[key] < 0) {
          throw new Error("Please enter whole numbers (0 or more).");
        }
      });
      if (next.price < 1000)
        throw new Error("The price per day must be at least Rp 1.000.");
      if (next.total > 999) throw new Error("The total unit is too large.");
      if (next.maintenance > next.total) {
        throw new Error("Maintenance cannot be more than the total unit.");
      }
      NovaPS.orders.sweep();
      var rented = rentedCount(unit);
      if (next.total - next.maintenance < rented) {
        throw new Error(
          rented +
            " unit(s) are rented right now. Total minus maintenance cannot be lower than that.",
        );
      }
      var saved = read(UNITS_KEY, {});
      saved[unit] = next;
      write(UNITS_KEY, saved);
      return unitInfo(unit);
    },
  };

  NovaPS.stock = {
    get: function (unit) {
      return NovaPS.units.get(unit).available;
    },
  };

  /* ---------- orders ---------- */

  // Cancel an order that is still "not_paid" (its units are free again,
  // because "canceled" is not an active status)
  function cancelInPlace(order, reason, type) {
    order.status = "canceled";
    order.canceledAt = new Date().toISOString();
    order.cancelReason = reason;
    order.cancelType = type; // "user" or "expired"
  }

  // Auto-cancel every unpaid order whose 5 minutes are over
  function sweep() {
    var orders = allOrders();
    var changed = false;
    orders.forEach(function (order) {
      if (order.status === "not_paid" && order.expiresAt <= Date.now()) {
        cancelInPlace(order, "Payment time expired", "expired");
        changed = true;
      }
    });
    if (changed) write(ORDERS_KEY, orders);
  }

  function makeId() {
    var d = new Date();
    var pad2 = function (n) {
      return String(n).padStart(2, "0");
    };
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return (
      "NV-" +
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      "-" +
      rand
    );
  }

  function total(items) {
    return items.reduce(function (sum, item) {
      return sum + item.price;
    }, 0);
  }

  function newestFirst(list) {
    return list.sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  function findMine(orders, id) {
    return orders.filter(function (o) {
      return o.id === id && o.owner === owner();
    })[0];
  }

  NovaPS.orders = {
    sweep: sweep,

    // Orders of the logged-in user, newest first
    all: function () {
      sweep();
      var me = owner();
      return newestFirst(
        allOrders().filter(function (o) {
          return o.owner === me;
        }),
      );
    },

    get: function (id) {
      sweep();
      return findMine(allOrders(), id) || null;
    },

    // The order waiting for payment (a user may only have one at a time)
    unpaid: function () {
      return (
        NovaPS.orders.all().filter(function (o) {
          return o.status === "not_paid";
        })[0] || null
      );
    },

    // data = { customer, items: [{ unit, days }], notes }
    create: function (data) {
      sweep();
      if (NovaPS.users.isBlocked(owner())) {
        throw new Error(
          "Your account has been blocked. Please contact the admin.",
        );
      }
      if (NovaPS.orders.unpaid())
        throw new Error("Please finish your unpaid order first.");

      var items = data.items.map(function (item) {
        var product = PRODUCTS[item.unit];
        var days = Number(item.days);
        if (!product || !(days >= 1 && days <= NovaPS.MAX_DAYS)) {
          throw new Error("Invalid unit or rental duration.");
        }
        return { unit: item.unit, days: days, price: product.price * days };
      });
      if (!items.length || items.length > NovaPS.MAX_UNITS)
        throw new Error("Invalid number of units.");

      // Stock check: every unit in the order must be available
      var need = {};
      items.forEach(function (item) {
        need[item.unit] = (need[item.unit] || 0) + 1;
      });
      Object.keys(need).forEach(function (unit) {
        if (need[unit] > unitInfo(unit).available) {
          throw new Error("Not enough " + BASE[unit].name + " in stock.");
        }
      });

      // The new order itself reserves the units (they count as "rented")
      var now = Date.now();
      var order = {
        id: makeId(),
        owner: owner(),
        customer: data.customer,
        items: items,
        notes: data.notes || "",
        total: total(items),
        status: "not_paid",
        createdAt: new Date(now).toISOString(),
        expiresAt: now + PAY_WINDOW_MS,
      };
      var orders = allOrders();
      orders.push(order);
      write(ORDERS_KEY, orders);
      return order;
    },

    // proof = data URL of the payment proof picture
    pay: function (id, proof) {
      sweep();
      var orders = allOrders();
      var order = findMine(orders, id);
      if (!order) throw new Error("Order not found.");
      if (order.status !== "not_paid")
        throw new Error("This order can no longer be paid.");
      order.status = "pending";
      order.paidAt = new Date().toISOString();
      order.proof = proof;
      if (!write(ORDERS_KEY, orders))
        throw new Error("Could not save the payment proof.");
      return order;
    },

    cancel: function (id, reason) {
      sweep();
      var orders = allOrders();
      var order = findMine(orders, id);
      if (!order || order.status !== "not_paid")
        throw new Error("This order cannot be canceled.");
      cancelInPlace(order, reason, "user");
      write(ORDERS_KEY, orders);
      return order;
    },

    // Keep the orders of a user whose email was changed in My Profile
    renameOwner: function (oldEmail, newEmail) {
      var orders = allOrders();
      orders.forEach(function (o) {
        if (o.owner === (oldEmail || "").toLowerCase())
          o.owner = newEmail.toLowerCase();
      });
      write(ORDERS_KEY, orders);
    },

    msLeft: function (order) {
      return order.expiresAt - Date.now();
    },

    /* ----- admin (the real admin check must live on the server) ----- */

    adminAll: function () {
      sweep();
      return newestFirst(allOrders());
    },

    adminGet: function (id) {
      sweep();
      return (
        allOrders().filter(function (o) {
          return o.id === id;
        })[0] || null
      );
    },

    /*
     * pending  --accept--> shipped      --deliver--> complete --return--> returned
     * pending  --reject--> rejected (reason required)
     */
    adminAct: function (id, action, reason) {
      sweep();
      var orders = allOrders();
      var order = orders.filter(function (o) {
        return o.id === id;
      })[0];
      if (!order) throw new Error("Order not found.");

      var now = new Date().toISOString();
      var from = {
        accept: "pending",
        reject: "pending",
        deliver: "shipped",
        return: "complete",
      }[action];
      if (!from) throw new Error("Unknown action.");
      if (order.status !== from)
        throw new Error("This order is no longer " + from + ".");

      if (action === "accept") {
        order.status = "shipped";
        order.shippedAt = now;
      } else if (action === "reject") {
        if (!reason || reason.trim().length < 5)
          throw new Error("Please write the reason (at least 5 characters).");
        order.status = "rejected";
        order.rejectedAt = now;
        order.rejectReason = reason.trim();
      } else if (action === "deliver") {
        var longest = Math.max.apply(
          null,
          order.items.map(function (i) {
            return i.days;
          }),
        );
        order.status = "complete";
        order.completedAt = now;
        order.dueAt = Date.now() + longest * DAY_MS; // the rental starts now
      } else {
        order.status = "returned";
        order.returnedAt = now;
        order.returnedLate = Date.now() > (order.dueAt || 0);
      }
      write(ORDERS_KEY, orders);
      return order;
    },
  };

  /* ---------- formatting ---------- */

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  NovaPS.money = function (n) {
    return "Rp " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  NovaPS.formatDate = function (iso) {
    var d = new Date(iso);
    return (
      pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear()
    );
  };
  NovaPS.formatTime = function (iso) {
    var d = new Date(iso);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  NovaPS.formatDays = function (n) {
    return n + (n === 1 ? " day" : " days");
  };
  // 299000 ms -> "4:59" (or "04:59" when padMinutes is true)
  NovaPS.formatClock = function (ms, padMinutes) {
    var secs = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(secs / 60);
    return (padMinutes ? pad(minutes) : minutes) + ":" + pad(secs % 60);
  };

  /* ---------- order summary lists ---------- */

  /*
   * data = { customer: { fullname, address }, items: [{ unit, days, price }], total }
   * header = rows shown first (Status, Order ID ...); data.extra = rows after Address
   * (Date ...). headerDivider draws a line after them (default: only with 2+ units).
   */
  NovaPS.summaryRows = function (data, header, headerDivider) {
    var rows = [];
    (header || []).forEach(function (r) {
      rows.push(r);
    });
    rows.push({ label: "Customer", value: data.customer.fullname });
    rows.push({ label: "Address", value: data.customer.address });
    if (data.extra) {
      data.extra.forEach(function (r) {
        rows.push(r);
      });
    }

    var many = data.items.length > 1;
    if (headerDivider === undefined ? many : headerDivider)
      rows.push({ divider: true });

    data.items.forEach(function (item, i) {
      if (i > 0) rows.push({ divider: true });
      rows.push({
        label: many ? "Unit #" + (i + 1) : "Unit",
        value: BASE[item.unit].name,
      });
      rows.push({ label: "Duration", value: NovaPS.formatDays(item.days) });
      if (many) rows.push({ label: "Price", value: NovaPS.money(item.price) });
    });

    rows.push({ divider: true });
    rows.push({ label: "Total", value: NovaPS.money(data.total), total: true });
    return rows;
  };

  // Plain text only (textContent), so user input can never inject HTML
  NovaPS.renderRows = function (container, rows) {
    container.textContent = "";
    rows.forEach(function (row) {
      var el = document.createElement("div");
      if (row.divider) {
        el.className = "my-1.5 border-t border-slate-300";
      } else {
        el.className = row.total
          ? "flex justify-between gap-4 pt-1.5 font-display font-bold text-black"
          : "flex justify-between gap-4 py-0.5 text-base";
        var label = document.createElement("span");
        var value = document.createElement("span");
        label.textContent = row.label;
        value.textContent = row.value;
        value.className = "text-right break-words " + (row.valueClass || "");
        el.appendChild(label);
        el.appendChild(value);
      }
      container.appendChild(el);
    });
  };
})();
