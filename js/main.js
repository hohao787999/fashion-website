/**
 * E-Commerce Frontend Only (no backend)
 * - Storage: localStorage keys: ecom_products, ecom_users, ecom_session, ecom_carts, ecom_orders
 * - Flow: catalog -> cart -> checkout -> orders -> order-detail
 * - Admin: products CRUD + order status updates
 */

const ECOM = {
  STORAGE: {
    PRODUCTS: "ecom_products",
    USERS: "ecom_users",
    SESSION: "ecom_session",
    CARTS: "ecom_carts",
    ORDERS: "ecom_orders",
    CONTACTS: "ecom_contacts",
  },
  SHIPPING_FLAT: 5,
  TAX_RATE: 0.08,
  ORDER_STATUSES: ["pending", "paid", "shipped", "delivered", "cancelled"],
};

// Legacy seed: 3 products from the original app.
const SEED_PRODUCTS = [
  {
    id: 1,
    name: "T-Shirt",
    price: 20,
    img: "images/p1.jpg",
    description: "Comfortable everyday t-shirt.",
    category: "Tops",
    stock: 25,
  },
  {
    id: 2,
    name: "Jacket",
    price: 50,
    img: "images/p2.jpg",
    description: "Warm and durable jacket for daily wear.",
    category: "Outerwear",
    stock: 15,
  },
  {
    id: 3,
    name: "Shoes",
    price: 70,
    img: "images/p3.jpg",
    description: "Everyday shoes with great comfort.",
    category: "Footwear",
    stock: 10,
  },
  {
    id: 4,
    name: "Hat",
    price: 15,
    img: "images/p4.jpg",
    description: "Stylish hat for sun protection and fashion.",
    category: "Accessories",
    stock: 30,
  },
];

function showToast(msg) {
  const toast = document.createElement("div");
  toast.innerText = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.background = "black";
  toast.style.color = "white";
  toast.style.padding = "10px";
  toast.style.borderRadius = "8px";
  toast.style.zIndex = "9999";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return "$" + n.toFixed(2).replace(/\.00$/, "");
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  return safeJsonParse(raw, fallback);
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getProducts() {
  let products = loadJSON(ECOM.STORAGE.PRODUCTS, null);
  if (!Array.isArray(products) || products.length === 0) {
    products = SEED_PRODUCTS.map((p) => ({ ...p }));
    saveJSON(ECOM.STORAGE.PRODUCTS, products);
  }
  // Normalize shape (safety against older/invalid data)
  products = products
    .map((p) => ({
      id: Number(p.id),
      name: String(p.name ?? ""),
      price: Number(p.price ?? 0),
      img: String(p.img ?? ""),
      description: String(p.description ?? ""),
      category: String(p.category ?? "Other"),
      stock: Number(p.stock ?? 0),
    }))
    .filter((p) => Number.isFinite(p.id) && p.id > 0);

  saveJSON(ECOM.STORAGE.PRODUCTS, products);
  return products;
}

function getUsers() {
  const users = loadJSON(ECOM.STORAGE.USERS, []);
  return Array.isArray(users) ? users : [];
}

function getSession() {
  const session = loadJSON(ECOM.STORAGE.SESSION, { userId: null });
  if (!session || typeof session !== "object") return { userId: null };
  return { userId: session.userId ?? null };
}

function setSession(userId) {
  saveJSON(ECOM.STORAGE.SESSION, { userId: userId ?? null });
}

function getCartsMap() {
  const carts = loadJSON(ECOM.STORAGE.CARTS, {});
  return carts && typeof carts === "object" ? carts : {};
}

function saveCartsMap(carts) {
  saveJSON(ECOM.STORAGE.CARTS, carts);
}

function getCartForUser(userId) {
  const carts = getCartsMap();
  if (!carts[userId]) carts[userId] = { items: [] };
  saveCartsMap(carts);
  return carts[userId];
}

function setCartForUser(userId, cart) {
  const carts = getCartsMap();
  carts[userId] = cart;
  saveCartsMap(carts);
}

function getOrders() {
  const orders = loadJSON(ECOM.STORAGE.ORDERS, []);
  return Array.isArray(orders) ? orders : [];
}

function saveOrders(orders) {
  saveJSON(ECOM.STORAGE.ORDERS, orders);
}

function getContacts() {
  const contacts = loadJSON(ECOM.STORAGE.CONTACTS, []);
  return Array.isArray(contacts) ? contacts : [];
}

function saveContacts(contacts) {
  saveJSON(ECOM.STORAGE.CONTACTS, contacts);
}

function getSessionUser() {
  const session = getSession();
  const userId = session.userId;
  if (!userId) return null;
  const users = getUsers();
  return users.find((u) => String(u.id) === String(userId)) || null;
}

function redirectToLogin(nextUrl) {
  // Keep it simple for static hosting.
  const url = new URL("login.html", window.location.href);
  if (nextUrl) url.searchParams.set("next", nextUrl);
  window.location.href = url.toString();
}

async function sha256Hex(text) {
  const input = String(text);
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
    // Fallback for older browsers: weak hash (still not plaintext storage, demo only).
    let hash = 5381;
    for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
    return "h" + (hash >>> 0).toString(16);
  }
  const data = new window.TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function requireLoginOrRedirect() {
  const user = getSessionUser();
  if (!user) {
    redirectToLogin(window.location.pathname + window.location.search);
    return null;
  }
  return user;
}

function computeCartTotals(cart, products) {
  const items = cart?.items || [];
  const subtotal = items.reduce((sum, ci) => {
    const p = products.find((x) => Number(x.id) === Number(ci.productId));
    const unit = p ? Number(p.price) : Number(ci.unitPrice ?? 0);
    return sum + unit * Number(ci.qty || 0);
  }, 0);
  const shipping = subtotal > 0 ? ECOM.SHIPPING_FLAT : 0;
  const tax = subtotal > 0 ? subtotal * ECOM.TAX_RATE : 0;
  const total = subtotal + shipping + tax;
  return {
    subtotal,
    shipping,
    tax,
    total,
  };
}

function getCartItemsView(cart, products) {
  return (cart?.items || [])
    .map((ci) => {
      const p = products.find((x) => Number(x.id) === Number(ci.productId));
      if (!p) return null;
      return {
        productId: p.id,
        qty: Number(ci.qty || 0),
        unitPrice: Number(p.price),
        name: p.name,
        img: p.img,
        stock: Number(p.stock),
      };
    })
    .filter(Boolean);
}

function addToCart(productId, qty = 1) {
  const user = requireLoginOrRedirect();
  if (!user) return;

  const products = getProducts();
  const p = products.find((x) => Number(x.id) === Number(productId));
  if (!p) return showToast("Product not found.");
  const stock = Number(p.stock || 0);
  if (stock <= 0) return showToast("Out of stock.");

  const cart = getCartForUser(user.id);
  const items = cart.items || [];
  const target = items.find((i) => Number(i.productId) === Number(productId));
  const requestedQty = Math.max(1, Math.floor(Number(qty || 1)));
  const nextQty = target ? Math.min(stock, Number(target.qty || 0) + requestedQty) : Math.min(stock, requestedQty);

  if (target) target.qty = nextQty;
  else items.push({ productId: Number(productId), qty: nextQty });

  cart.items = items;
  setCartForUser(user.id, cart);
  showToast("Added to cart");
}

function updateCartItemQty(productId, nextQty) {
  const user = requireLoginOrRedirect();
  if (!user) return false;
  const products = getProducts();
  const p = products.find((x) => Number(x.id) === Number(productId));
  if (!p) return false;

  const stock = Number(p.stock || 0);
  const qty = Math.max(1, Math.floor(Number(nextQty || 1)));
  if (stock <= 0) return false;

  const cart = getCartForUser(user.id);
  const items = cart.items || [];
  const target = items.find((i) => Number(i.productId) === Number(productId));
  if (!target) return false;
  target.qty = Math.min(stock, qty);
  cart.items = items;
  setCartForUser(user.id, cart);
  return true;
}

function removeCartItem(productId) {
  const user = requireLoginOrRedirect();
  if (!user) return false;

  const cart = getCartForUser(user.id);
  cart.items = (cart.items || []).filter((i) => Number(i.productId) !== Number(productId));
  setCartForUser(user.id, cart);
  return true;
}

function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  // Detect current page file name (works for paths like /index.html and /folder/index.html)
  const pathName = window.location.pathname || "";
  const lastSegment = pathName.split("/").filter(Boolean).pop() || "index.html";
  const page = lastSegment === "" ? "index.html" : lastSegment;

  const isActive = (file) => page === file;
  const isActiveOrders = () => page === "orders.html" || page === "order-detail.html";

  const user = getSessionUser();
  const isAdmin = user?.role === "admin";

  if (!user) {
    nav.innerHTML = `
      <a class="nav-link ${isActive("index.html") ? "active" : ""}" href="index.html">Home</a>
      <a class="nav-link ${isActive("login.html") ? "active" : ""}" href="login.html">Login</a>
      <a class="nav-link ${isActive("register.html") ? "active" : ""}" href="register.html">Register</a>
      <a class="nav-link ${isActive("cart.html") ? "active" : ""}" href="cart.html">Cart</a>
      <a class="nav-link ${isActive("contact.html") ? "active" : ""}" href="contact.html">Contact</a>
    `;
    return;
  }

  nav.innerHTML = `
    <a class="nav-link ${isActive("index.html") ? "active" : ""}" href="index.html">Home</a>
    <a class="nav-link ${isActive("cart.html") ? "active" : ""}" href="cart.html">Cart</a>
    <a class="nav-link ${isActive("checkout.html") ? "active" : ""}" href="checkout.html">Checkout</a>
    <a class="nav-link ${isActiveOrders() ? "active" : ""}" href="orders.html">Orders</a>
    <a class="nav-link ${isActive("profile.html") ? "active" : ""}" href="profile.html">Profile</a>
    ${isAdmin ? `<a class="nav-link ${isActive("admin.html") ? "active" : ""}" href="admin.html">Admin</a>` : ""}
    <a class="nav-link ${isActive("contact.html") ? "active" : ""}" href="contact.html">Contact</a>
    <button type="button" id="logoutBtn" class="nav-logout">Logout</button>
  `;

  const btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      setSession(null);
      showToast("Logged out");
      window.location.href = "index.html";
    });
  }
}

function initCatalogPage() {
  const container = document.getElementById("product-list");
  if (!container) return;

  const products = getProducts();
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const sortSelect = document.getElementById("sortSelect");
  const productCount = document.getElementById("productCount");

  function render() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const category = categoryFilter?.value || "All";
    const sort = sortSelect?.value || "priceAsc";

    let list = [...products];
    if (q) list = list.filter((p) => String(p.name).toLowerCase().includes(q) || String(p.description).toLowerCase().includes(q));
    if (category !== "All") list = list.filter((p) => p.category === category);

    if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    if (sort === "nameAsc") list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    container.innerHTML = "";
    if (list.length === 0) {
      container.innerHTML = `<p style="padding:40px;text-align:center">No products found.</p>`;
      if (productCount) productCount.innerText = "0";
      return;
    }

    list.forEach((p) => {
      const out = Number(p.stock) <= 0;
      const stockLabel = out ? "Out of stock" : `In stock: ${p.stock}`;
      const card = document.createElement("div");
      card.className = "product";
      card.innerHTML = `
        <img src="${escapeHTML(p.img)}" alt="${escapeHTML(p.name)}" />
        <h3>${escapeHTML(p.name)}</h3>
        <p>${escapeHTML(formatMoney(p.price))}</p>
        <p class="product-description">${escapeHTML(p.description)}</p>
        <a href="javascript:void(0)" class="product-description-toggle" style="display:none">More info...</a>
        <p style="color:#777;font-size:12px">${escapeHTML(stockLabel)}</p>
        <div style="margin-top:10px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="details-link" href="product.html?id=${encodeURIComponent(p.id)}">View</a>
          <button type="button" class="add-to-cart-btn" data-product-id="${escapeHTML(p.id)}" ${out ? "disabled" : ""}>
            ${out ? "Unavailable" : "Add to cart"}
          </button>
        </div>
      `;
      container.appendChild(card);
      
      // Handle more info toggle
      const descEl = card.querySelector(".product-description");
      const toggleEl = card.querySelector(".product-description-toggle");
      if (descEl && toggleEl) {
        // Show toggle only if text is truncated
        const isOverflowing = descEl.scrollHeight > descEl.clientHeight + 2;
        if (isOverflowing) {
          toggleEl.style.display = "inline";
          toggleEl.addEventListener("click", (e) => {
            e.preventDefault();
            const isExpanded = descEl.classList.toggle("expanded");
            toggleEl.innerText = isExpanded ? "Less info" : "More info...";
          });
        }
      }
    });

    if (productCount) productCount.innerText = String(list.length);
  }

  if (categoryFilter) {
    categoryFilter.innerHTML = `<option value="All">All categories</option>`;
    categories.forEach((c) => {
      categoryFilter.innerHTML += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`;
    });
  }

  if (searchInput) searchInput.addEventListener("input", render);
  if (categoryFilter) categoryFilter.addEventListener("change", render);
  if (sortSelect) sortSelect.addEventListener("change", render);

  render();
  // Bind add-to-cart after each render.
  container.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".add-to-cart-btn");
    if (!btn) return;
    const productId = btn.getAttribute("data-product-id");
    if (productId) addToCart(productId, 1);
  });
}

function initProductDetailPage() {
  const root = document.getElementById("product-detail");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  const products = getProducts();
  const p = products.find((x) => Number(x.id) === id);

  if (!p) {
    root.innerHTML = `<p style="padding:40px;text-align:center">Product not found.</p>`;
    return;
  }

  root.innerHTML = `
    <div class="product" style="max-width:720px;margin:40px auto">
      <img src="${escapeHTML(p.img)}" alt="${escapeHTML(p.name)}" />
      <h3>${escapeHTML(p.name)}</h3>
      <p>${escapeHTML(formatMoney(p.price))}</p>
      <p style="color:#333;font-weight:normal;font-size:14px">${escapeHTML(p.description)}</p>
      <p style="color:#777;font-size:12px">Category: ${escapeHTML(p.category)}</p>
      <p style="color:#777;font-size:12px">Stock: ${escapeHTML(p.stock)}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px">
        <button type="button" id="detailAddToCartBtn" ${Number(p.stock) <= 0 ? "disabled" : ""}>Add to cart</button>
        <a href="index.html">Back to catalog</a>
      </div>
    </div>
  `;

  const btn = document.getElementById("detailAddToCartBtn");
  if (btn) {
    btn.addEventListener("click", () => addToCart(p.id, 1));
  }
}

function initCartPage() {
  const container = document.getElementById("cartItems");
  if (!container) return;

  const cartSubtotalEl = document.getElementById("cartSubtotal");
  const cartShippingEl = document.getElementById("cartShipping");
  const cartTaxEl = document.getElementById("cartTax");
  const cartTotalEl = document.getElementById("cartTotal");

  const proceedBtn = document.getElementById("proceedToCheckoutBtn");
  if (proceedBtn) {
    proceedBtn.addEventListener("click", () => {
      const user = requireLoginOrRedirect();
      if (!user) return;
      const next = "checkout.html";
      window.location.href = next;
    });
  }

  const user = requireLoginOrRedirect();
  if (!user) return;

  function render() {
    const products = getProducts();
    const cart = getCartForUser(user.id);
    const viewItems = getCartItemsView(cart, products);

    container.innerHTML = "";
    if (viewItems.length === 0) {
      container.innerHTML = `<p style="padding:40px;text-align:center">Your cart is empty.</p>`;
      if (cartSubtotalEl) cartSubtotalEl.innerText = formatMoney(0);
      if (cartShippingEl) cartShippingEl.innerText = formatMoney(0);
      if (cartTaxEl) cartTaxEl.innerText = formatMoney(0);
      if (cartTotalEl) cartTotalEl.innerText = formatMoney(0);
      return;
    }

    viewItems.forEach((it) => {
      const lineTotal = it.unitPrice * it.qty;
      const row = document.createElement("div");
      row.className = "cart-item";
      row.setAttribute("data-product-id", it.productId);
      row.innerHTML = `
        <div class="cart-item-left">
          <img src="${escapeHTML(it.img)}" alt="${escapeHTML(it.name)}" />
        </div>
        <div class="cart-item-mid">
          <h3>${escapeHTML(it.name)}</h3>
          <p style="color:#777;font-size:12px">Unit: ${escapeHTML(formatMoney(it.unitPrice))}</p>
          <p style="color:#777;font-size:12px">Stock: ${escapeHTML(it.stock)}</p>
        </div>
        <div class="cart-item-right">
          <label style="font-size:12px">Qty</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <input type="number" min="1" step="1" value="${escapeHTML(it.qty)}" class="cart-qty-input" data-cart-qty-input />
            <button type="button" class="cart-update-btn" data-cart-action="update">Update</button>
            <button type="button" class="cart-remove-btn" data-cart-action="remove">Remove</button>
          </div>
          <p style="margin-top:8px;font-weight:bold">${escapeHTML(formatMoney(lineTotal))}</p>
        </div>
      `;
      container.appendChild(row);
    });

    const totals = computeCartTotals(cart, products);
    if (cartSubtotalEl) cartSubtotalEl.innerText = formatMoney(totals.subtotal);
    if (cartShippingEl) cartShippingEl.innerText = formatMoney(totals.shipping);
    if (cartTaxEl) cartTaxEl.innerText = formatMoney(totals.tax);
    if (cartTotalEl) cartTotalEl.innerText = formatMoney(totals.total);
  }

  // Event delegation for quantity update/remove
  container.addEventListener("click", (e) => {
    const actionBtn = e.target?.closest?.("button[data-cart-action]");
    if (!actionBtn) return;
    const action = actionBtn.getAttribute("data-cart-action");
    const row = e.target?.closest?.(".cart-item");
    const productId = row?.getAttribute("data-product-id");
    if (!productId) return;

    if (action === "remove") {
      const ok = removeCartItem(productId);
      if (ok) render();
      else showToast("Failed to remove item.");
      return;
    }

    if (action === "update") {
      const qtyInput = row.querySelector("input[data-cart-qty-input]");
      const nextQty = qtyInput ? qtyInput.value : 1;
      const ok = updateCartItemQty(productId, nextQty);
      if (ok) render();
      else showToast("Invalid quantity or product out of stock.");
    }
  });

  render();
}

function initCheckoutPage() {
  const form = document.getElementById("checkoutForm");
  if (!form) return;

  const msgEl = document.getElementById("checkoutMsg");

  const user = requireLoginOrRedirect();
  if (!user) return;

  const cart = getCartForUser(user.id);
  const products = getProducts();

  const summaryEl = document.getElementById("checkoutSummary");

  function renderSummary() {
    const viewItems = getCartItemsView(cart, products);
    if (!summaryEl) return;
    if (viewItems.length === 0) {
      summaryEl.innerHTML = `<p>Your cart is empty.</p>`;
      return;
    }
    const totals = computeCartTotals(cart, products);
    summaryEl.innerHTML = `
      <div style="padding:15px;background:#fff;border-radius:10px">
        <h3 style="margin-bottom:10px">Order summary</h3>
        ${viewItems
          .map(
            (it) => `
          <div style="display:flex;justify-content:space-between;gap:10px;margin:8px 0">
            <div>${escapeHTML(it.name)} (x${escapeHTML(it.qty)})</div>
            <div>${escapeHTML(formatMoney(it.unitPrice * it.qty))}</div>
          </div>`
          )
          .join("")}
        <hr/>
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>Subtotal</div><div>${escapeHTML(formatMoney(totals.subtotal))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>Shipping</div><div>${escapeHTML(formatMoney(totals.shipping))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>Tax</div><div>${escapeHTML(formatMoney(totals.tax))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;font-weight:bold;margin-top:8px">
          <div>Total</div><div>${escapeHTML(formatMoney(totals.total))}</div>
        </div>
      </div>
    `;
  }

  renderSummary();

  // Real-time validation functions
  const validators = {
    addressName: (value) => {
      if (!value || value.length < 2) return "Name must be at least 2 characters";
      if (!/^[a-zA-Z\s'-]+$/.test(value)) return "Name can only contain letters, spaces, hyphens and apostrophes";
      return "";
    },
    addressLine1: (value) => {
      if (!value || value.length < 5) return "Address must be at least 5 characters";
      return "";
    },
    addressCity: (value) => {
      if (!value) return "City is required";
      if (!/^[a-zA-Z\s'-]+$/.test(value)) return "City can only contain letters, spaces, hyphens and apostrophes";
      return "";
    },
    addressCountry: (value) => {
      if (!value) return "Country is required";
      if (!/^[a-zA-Z\s'-]+$/.test(value)) return "Country can only contain letters, spaces, hyphens and apostrophes";
      return "";
    },
    addressPhone: (value) => {
      if (!value || value.length < 7) return "Phone must be at least 7 characters";
      if (!/^\d[\d\s\-\(\)]{5,}$/.test(value)) return "Phone must contain only numbers, spaces, hyphens and parentheses";
      return "";
    },
    paymentMethod: (value) => {
      if (!value) return "Please select a payment method";
      return "";
    }
  };

  // Attach real-time validation to each field
  Object.keys(validators).forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(`err-${fieldId}`);
    if (!input || !errorEl) return;

    input.addEventListener("blur", () => {
      const error = validators[fieldId](input.value.trim());
      if (error) {
        errorEl.innerText = error;
        errorEl.style.display = "block";
      } else {
        errorEl.style.display = "none";
      }
    });

    input.addEventListener("input", () => {
      const error = validators[fieldId](input.value.trim());
      if (error) {
        errorEl.innerText = error;
        errorEl.style.display = "block";
      } else {
        errorEl.style.display = "none";
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msgEl) msgEl.innerText = "";

    // Validate all fields before submission
    let hasErrors = false;
    Object.keys(validators).forEach((fieldId) => {
      const input = document.getElementById(fieldId);
      const errorEl = document.getElementById(`err-${fieldId}`);
      if (!input || !errorEl) return;

      const error = validators[fieldId](input.value.trim());
      if (error) {
        errorEl.innerText = error;
        errorEl.style.display = "block";
        hasErrors = true;
      } else {
        errorEl.style.display = "none";
      }
    });

    if (hasErrors) return;

    const viewItems = getCartItemsView(cart, products);
    if (viewItems.length === 0) {
      if (msgEl) msgEl.innerText = "Your cart is empty.";
      return;
    }

    // Get validated values
    const addressName = document.getElementById("addressName").value.trim();
    const addressLine1 = document.getElementById("addressLine1").value.trim();
    const addressCity = document.getElementById("addressCity").value.trim();
    const addressCountry = document.getElementById("addressCountry").value.trim();
    const addressPhone = document.getElementById("addressPhone").value.trim();
    const paymentMethod = document.getElementById("paymentMethod").value;

    // Re-check stock before order creation
    const currentProducts = getProducts();
    for (const it of viewItems) {
      const p = currentProducts.find((x) => Number(x.id) === Number(it.productId));
      const stock = Number(p?.stock ?? 0);
      if (stock <= 0) return (msgEl.innerText = `"${it.name}" is out of stock.`);
      if (it.qty > stock) return (msgEl.innerText = `Not enough stock for "${it.name}".`);
    }

    const totals = computeCartTotals(cart, currentProducts);

    // Create order
    const orderId = `ORD-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const order = {
      id: orderId,
      userId: user.id,
      items: viewItems.map((it) => ({
        productId: Number(it.productId),
        qty: Number(it.qty),
        unitPrice: Number(it.unitPrice),
        name: it.name,
      })),
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
      },
      address: {
        name: addressName,
        line1: addressLine1,
        city: addressCity,
        country: addressCountry,
        phone: addressPhone,
      },
      paymentMethod: paymentMethod,
      status: "paid",
      createdAt: new Date().toISOString(),
    };

    // Reduce stock and save
    const nextProducts = currentProducts.map((p) => {
      const match = order.items.find((oi) => Number(oi.productId) === Number(p.id));
      if (!match) return p;
      const nextStock = Number(p.stock) - Number(match.qty);
      return { ...p, stock: nextStock };
    });
    saveJSON(ECOM.STORAGE.PRODUCTS, nextProducts);

    const orders = getOrders();
    orders.push(order);
    saveOrders(orders);

    // Clear cart
    setCartForUser(user.id, { items: [] });

    showToast("Order placed!");
    window.location.href = `order-detail.html?id=${encodeURIComponent(orderId)}`;
  });
}

function initOrdersPage() {
  const listEl = document.getElementById("ordersList");
  if (!listEl) return;

  const user = requireLoginOrRedirect();
  if (!user) return;

  const orders = getOrders()
    .filter((o) => String(o.userId) === String(user.id))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (orders.length === 0) {
    listEl.innerHTML = `<p style="padding:40px;text-align:center">No orders yet.</p>`;
    return;
  }

  listEl.innerHTML = `
    <div style="overflow:auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Status</th>
            <th>Total</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o) => `
            <tr>
              <td>${escapeHTML(o.id)}</td>
              <td>${escapeHTML(o.status)}</td>
              <td>${escapeHTML(formatMoney(o.totals?.total ?? 0))}</td>
              <td>${escapeHTML(new Date(o.createdAt).toLocaleString())}</td>
              <td><a href="order-detail.html?id=${encodeURIComponent(o.id)}">View</a></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function statusTimelineSteps(status) {
  const steps = ["pending", "paid", "shipped", "delivered", "cancelled"];
  const currentIdx = steps.indexOf(status);
  // For cancelled, only mark cancelled as complete.
  if (status === "cancelled") return steps.map((s) => ({ status: s, done: s === "cancelled" }));
  return steps.map((s) => {
    const idx = steps.indexOf(s);
    return { status: s, done: idx <= currentIdx && s !== "cancelled" };
  });
}

function initOrderDetailPage() {
  const root = document.getElementById("order-detail");
  if (!root) return;

  const user = requireLoginOrRedirect();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const orders = getOrders();
  const order = orders.find((o) => String(o.id) === String(id));

  if (!order) {
    root.innerHTML = `<p style="padding:40px;text-align:center">Order not found.</p>`;
    return;
  }

  const isAdmin = user.role === "admin";
  if (String(order.userId) !== String(user.id) && !isAdmin) {
    showToast("Not authorized.");
    window.location.href = "orders.html";
    return;
  }

  const steps = statusTimelineSteps(order.status);
  root.innerHTML = `
    <div style="max-width:900px;margin:40px auto;color:#111">
      <h2>Order ${escapeHTML(order.id)}</h2>
      <p>Status: <b>${escapeHTML(order.status)}</b></p>
      <p>Payment: ${escapeHTML(order.paymentMethod || "")}</p>
      <p>Created: ${escapeHTML(new Date(order.createdAt).toLocaleString())}</p>

      <div style="margin-top:20px;padding:15px;background:#fff;border-radius:10px;color:#111">
        <h3>Shipping address</h3>
        <p>${escapeHTML(order.address?.name || "")}</p>
        <p>${escapeHTML(order.address?.line1 || "")}</p>
        <p>${escapeHTML(order.address?.city || "")}, ${escapeHTML(order.address?.country || "")}</p>
        <p>${escapeHTML(order.address?.phone || "")}</p>
      </div>

      <div style="margin-top:20px;overflow:auto;background:#fff;border-radius:10px;padding:15px">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (it) => `
              <tr>
                <td>${escapeHTML(it.name || "")}</td>
                <td>${escapeHTML(it.qty)}</td>
                <td>${escapeHTML(formatMoney(it.unitPrice))}</td>
                <td>${escapeHTML(formatMoney(Number(it.qty) * Number(it.unitPrice)))}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div style="margin-top:20px;padding:15px;background:#fff;border-radius:10px;color:#111">
        <h3>Totals</h3>
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>Subtotal</div><div>${escapeHTML(formatMoney(order.totals?.subtotal ?? 0))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>Shipping</div><div>${escapeHTML(formatMoney(order.totals?.shipping ?? 0))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>Tax</div><div>${escapeHTML(formatMoney(order.totals?.tax ?? 0))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:10px;font-weight:bold;margin-top:8px">
          <div>Total</div><div>${escapeHTML(formatMoney(order.totals?.total ?? 0))}</div>
        </div>
      </div>

      <div style="margin-top:20px;padding:15px;background:#fff;border-radius:10px;color:#111">
        <h3>Timeline</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${steps
            .map(
              (s) => `
            <div style="padding:8px 10px;border-radius:10px;border:1px solid #ddd;background:${s.done ? "#eaffea" : "#fff"}">
              <b>${escapeHTML(s.status)}</b>
              <div style="font-size:12px;color:#666">${s.done ? "done" : "pending"}</div>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function ensureAdminAccess() {
  const user = requireLoginOrRedirect();
  if (!user) return null;
  if (user.role !== "admin") {
    showToast("Admin access denied.");
    window.location.href = "index.html";
    return null;
  }
  return user;
}

function nextProductId(products) {
  const maxId = products.reduce((m, p) => Math.max(m, Number(p.id || 0)), 0);
  return maxId + 1;
}

function initAdminPage() {
  const root = document.getElementById("adminPageRoot");
  if (!root) return;

  const admin = ensureAdminAccess();
  if (!admin) return;

  const products = getProducts();
  const users = getUsers(); // might be used later

  const productsTable = document.getElementById("adminProductsList");
  const productForm = document.getElementById("adminProductForm");
  const ordersTable = document.getElementById("adminOrdersList");

  const editingIdInput = document.getElementById("adminProductId");
  const nameInput = document.getElementById("adminProductName");
  const priceInput = document.getElementById("adminProductPrice");
  const categoryInput = document.getElementById("adminProductCategory");
  const descriptionInput = document.getElementById("adminProductDescription");
  const imgInput = document.getElementById("adminProductImg");
  const stockInput = document.getElementById("adminProductStock");

  // Keep edit state in memory too, so submit logic doesn't depend solely on hidden input.
  let currentEditId = null;
  const submitBtn = productForm?.querySelector?.('button[type="submit"]') || null;

  function renderProducts() {
    const products = getProducts();
    if (!productsTable) return;

    productsTable.innerHTML = `
      <div style="overflow:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Image</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .sort((a, b) => Number(a.id) - Number(b.id))
              .map(
                (p) => `
              <tr>
                <td>${escapeHTML(p.id)}</td>
                <td>${escapeHTML(p.name)}</td>
                <td>
                  <img class="admin-product-thumb" src="${escapeHTML(p.img)}" alt="${escapeHTML(p.name)}" />
                </td>
                <td>${escapeHTML(p.category)}</td>
                <td>${escapeHTML(formatMoney(p.price))}</td>
                <td>${escapeHTML(p.stock)}</td>
                <td>
                  <button type="button" class="admin-edit-product" data-product-id="${escapeHTML(p.id)}">Edit</button>
                  <button type="button" class="admin-delete-product" data-product-id="${escapeHTML(p.id)}">Delete</button>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function loadProductToForm(productId) {
    const products = getProducts();
    const p = products.find((x) => Number(x.id) === Number(productId));
    if (!p) return;
    currentEditId = String(p.id);
    if (editingIdInput) editingIdInput.value = String(p.id);
    if (nameInput) nameInput.value = p.name;
    if (priceInput) priceInput.value = String(p.price);
    if (categoryInput) categoryInput.value = p.category;
    if (descriptionInput) descriptionInput.value = p.description;
    if (imgInput) imgInput.value = p.img;
    if (stockInput) stockInput.value = String(p.stock);

    if (submitBtn) submitBtn.innerText = "Update product";
    showToast(`Editing product #${p.id}`);
  }

  function resetProductForm() {
    currentEditId = null;
    if (editingIdInput) editingIdInput.value = "";
    if (nameInput) nameInput.value = "";
    if (priceInput) priceInput.value = "";
    if (categoryInput) categoryInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (imgInput) imgInput.value = "";
    if (stockInput) stockInput.value = "";

    if (submitBtn) submitBtn.innerText = "Save product";
  }

  if (productsTable) {
    productsTable.addEventListener("click", (e) => {
      const editBtn = e.target?.closest?.("button.admin-edit-product");
      if (editBtn) {
        const pid = editBtn.getAttribute("data-product-id");
        loadProductToForm(pid);
        return;
      }
      const delBtn = e.target?.closest?.("button.admin-delete-product");
      if (delBtn) {
        const pid = delBtn.getAttribute("data-product-id");
        const ok = window.confirm("Delete this product?");
        if (!ok) return;
        const products = getProducts().filter((p) => String(p.id) !== String(pid));
        saveJSON(ECOM.STORAGE.PRODUCTS, products);
        renderProducts();
      }
    });
  }

  if (productForm) {
    productForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const pid =
        currentEditId != null
          ? Number(currentEditId)
          : editingIdInput?.value
            ? Number(editingIdInput.value)
            : null;
      const name = (nameInput?.value || "").trim();
      const price = Number(priceInput?.value || 0);
      const category = (categoryInput?.value || "").trim();
      const description = (descriptionInput?.value || "").trim();
      const img = (imgInput?.value || "").trim();
      const stock = Math.max(0, Math.floor(Number(stockInput?.value || 0)));

      if (!name || name.length < 2) return showToast("Product name is required.");
      if (!category) return showToast("Category is required.");
      if (!Number.isFinite(price) || price < 0) return showToast("Price must be >= 0.");
      if (!Number.isFinite(stock) || stock < 0) return showToast("Stock must be >= 0.");

      const products = getProducts();
      const nextId = pid && pid > 0 ? pid : nextProductId(products);
      const existing = pid && pid > 0 ? products.find((p) => Number(p.id) === Number(pid)) : null;
      const nextImg = img || existing?.img || "";

      const nextProducts = (() => {
        if (pid && pid > 0) {
          return products.map((p) =>
            Number(p.id) === Number(pid)
              ? { ...p, name, price, category, description, img: nextImg, stock }
              : p
          );
        }
        return products.concat([{ id: nextId, name, price, category, description, img: nextImg, stock }]);
      })();

      saveJSON(ECOM.STORAGE.PRODUCTS, nextProducts);
      renderProducts();
      resetProductForm();
      showToast("Saved product.");
    });
  }

  function renderOrders() {
    const orders = getOrders().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!ordersTable) return;

    ordersTable.innerHTML = `
      <div style="overflow:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>User</th>
              <th>Status</th>
              <th>Totals</th>
              <th>Created</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map((o) => {
                const u = getUsers().find((x) => String(x.id) === String(o.userId));
                const userLabel = u ? u.email : o.userId;
                const current = String(o.status || "pending");
                return `
              <tr data-order-id="${escapeHTML(o.id)}">
                <td>${escapeHTML(o.id)}</td>
                <td>${escapeHTML(userLabel)}</td>
                <td>
                  <select class="admin-order-status-select" data-order-status-select>
                    ${ECOM.ORDER_STATUSES.map(
                      (s) =>
                        `<option value="${escapeHTML(s)}" ${s === current ? "selected" : ""}>${escapeHTML(s)}</option>`
                    ).join("")}
                  </select>
                </td>
                <td>${escapeHTML(formatMoney(o.totals?.total ?? 0))}</td>
                <td>${escapeHTML(new Date(o.createdAt).toLocaleString())}</td>
                <td>
                  <button type="button" class="admin-update-order-status" data-order-status-update>Save</button>
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  if (ordersTable) {
    ordersTable.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-order-status-update]");
      if (!btn) return;

      const row = e.target.closest("tr[data-order-id]");
      const orderId = row?.getAttribute("data-order-id");
      if (!orderId) return;
      const select = row.querySelector("select[data-order-status-select]");
      const newStatus = select?.value;

      if (!ECOM.ORDER_STATUSES.includes(newStatus)) return showToast("Invalid status.");

      const orders = getOrders();
      const order = orders.find((o) => String(o.id) === String(orderId));
      if (!order) return showToast("Order not found.");

      const oldStatus = String(order.status || "pending");
      order.status = newStatus;

      // Restore stock if order is cancelled for the first time
      if (newStatus === "cancelled" && oldStatus !== "cancelled") {
        const products = getProducts();
        const nextProducts = products.map((p) => {
          const match = order.items.find((oi) => Number(oi.productId) === Number(p.id));
          if (!match) return p;
          return { ...p, stock: Number(p.stock) + Number(match.qty) };
        });
        saveJSON(ECOM.STORAGE.PRODUCTS, nextProducts);
      }

      saveOrders(orders);
      renderOrders();
      showToast("Order status updated.");
    });
  }

  // --- Customers section for admin
  const customerCountEl = document.getElementById("adminCustomerCount");
  const customerSearchInput = document.getElementById("adminCustomerSearch");
  const customersListEl = document.getElementById("adminCustomersList");

  function renderCustomers(searchTerm) {
    const users = getUsers().filter((u) => u.role !== "admin");
    const q = String(searchTerm || "").trim().toLowerCase();

    const filtered = q
      ? users.filter((u) => {
          const idMatch = String(u.id || "").toLowerCase().includes(q);
          const nameMatch = String(u.name || "").toLowerCase().includes(q);
          const emailMatch = String(u.email || "").toLowerCase().includes(q);
          return idMatch || nameMatch || emailMatch;
        })
      : users;

    if (customerCountEl) customerCountEl.innerText = String(users.length);

    if (!customersListEl) return;
    if (filtered.length === 0) {
      customersListEl.innerHTML = `<p style="padding:20px;text-align:center">No matching customers found.</p>`;
      return;
    }

    customersListEl.innerHTML = `
      <div style="overflow:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
              .map(
                (u) => `
              <tr>
                <td>${escapeHTML(u.id)}</td>
                <td>${escapeHTML(u.name || "")}</td>
                <td>${escapeHTML(u.email || "")}</td>
                <td>${escapeHTML(u.role || "user")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  if (customerSearchInput) {
    customerSearchInput.addEventListener("input", () => {
      renderCustomers(customerSearchInput.value);
    });
  }

  // Initial render
  renderCustomers();

  // --- Contacts section for admin
  const contactsListEl = document.getElementById("adminContactsList");

  function renderContacts() {
    const contacts = getContacts().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!contactsListEl) return;

    if (contacts.length === 0) {
      contactsListEl.innerHTML = `<p style="padding:20px;text-align:center">No contact messages yet.</p>`;
      return;
    }

    contactsListEl.innerHTML = `
      <div style="overflow:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Message</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            ${contacts
              .map(
                (c) => `
              <tr>
                <td>${escapeHTML(c.name || "")}</td>
                <td>${escapeHTML(c.email || "")}</td>
                <td style="max-width:300px;word-wrap:break-word">${escapeHTML(c.message || "")}</td>
                <td>${escapeHTML(new Date(c.createdAt).toLocaleString())}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  renderProducts();
  renderOrders();
  renderContacts();
}

function initRegisterPage() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const msg = document.getElementById("msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.innerText = "";

    const name = document.getElementById("name")?.value?.trim();
    const email = document.getElementById("email")?.value?.trim().toLowerCase();
    const password = document.getElementById("password")?.value || "";
    const confirmPass = document.getElementById("confirm")?.value || "";

    if (!name || name.length < 2) return (msg.innerText = "Full name is required.");
    if (!email || !email.includes("@") || email.length < 5) return (msg.innerText = "Invalid email.");
    if (!password || password.length < 8) return (msg.innerText = "Password must be at least 8 characters.");
    if (password !== confirmPass) return (msg.innerText = "Passwords do not match.");

    const users = getUsers();
    const exists = users.some((u) => String(u.email).toLowerCase() === email);
    if (exists) return (msg.innerText = "Email already exists.");

    const passHash = await sha256Hex(password);
    const userId =
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      String(Date.now()) + "-" + Math.random().toString(16).slice(2);

    const role = users.length === 0 ? "admin" : "user";
    users.push({ id: userId, name, email, passHash, role });
    saveJSON(ECOM.STORAGE.USERS, users);

    setSession(userId);
    showToast(role === "admin" ? "Registered (admin)!" : "Registered!");
    window.location.href = "index.html";
  });
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const msg = document.getElementById("loginMsg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.innerText = "";

    const emailInput = document.getElementById("loginEmail")?.value?.trim().toLowerCase() || "";
    const passwordInput = document.getElementById("loginPassword")?.value || "";

    // TC01: Validate empty submission
    if (!emailInput || !passwordInput) {
      return (msg.innerText = "Email and password are required");
    }

    // TC02: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) {
      return (msg.innerText = "Invalid email format");
    }

    const users = getUsers();
    const user = users.find((u) => String(u.email).toLowerCase() === emailInput);

    // TC03: Validate credentials (email or password incorrect)
    if (!user) return (msg.innerText = "Invalid email or password");

    const passHash = await sha256Hex(passwordInput);
    if (String(user.passHash) !== String(passHash)) return (msg.innerText = "Invalid email or password");

    // TC05: Valid login - session created and redirect to home
    setSession(user.id);

    // Show success message
    if (msg) {
      msg.innerText = "Login successful!";
      msg.style.color = "#2ecc71";
      msg.style.fontWeight = "bold";
    }

    showToast("Welcome back!");

    // Redirect after 1 second
    setTimeout(() => {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next || "index.html";
    }, 1000);
  });
}

function initProfilePage() {
  const updateBtn = document.getElementById("profileUpdateBtn");
  if (!updateBtn) return;

  const user = requireLoginOrRedirect();
  if (!user) return;

  const nameInput = document.getElementById("profileName");
  const emailInput = document.getElementById("profileEmail");
  if (nameInput) nameInput.value = user.name || "";
  if (emailInput) emailInput.value = user.email || "";

  updateBtn.addEventListener("click", () => {
    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim().toLowerCase();
    if (!name || name.length < 2) return showToast("Name is required.");
    if (!email || !email.includes("@")) return showToast("Invalid email.");

    const users = getUsers();
    const emailTaken = users.some((u) => String(u.id) !== String(user.id) && String(u.email).toLowerCase() === email);
    if (emailTaken) return showToast("Email already in use.");

    const nextUsers = users.map((u) => (String(u.id) === String(user.id) ? { ...u, name, email } : u));
    saveJSON(ECOM.STORAGE.USERS, nextUsers);
    showToast("Profile updated");
    renderNav();
  });
}

function initContactPage() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cname")?.value?.trim();
    const email = document.getElementById("cemail")?.value?.trim();
    const message = document.getElementById("message")?.value?.trim();
    const msg = document.getElementById("cmsg");
    if (!name || !email || !message) {
      if (msg) msg.innerText = "Please fill all fields";
      return;
    }
    // Save contact message
    const contacts = getContacts();
    const contactId = `CONTACT-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    contacts.push({
      id: contactId,
      name,
      email,
      message,
      createdAt: new Date().toISOString(),
    });
    saveContacts(contacts);
    showToast("Message sent successfully!");
    // Clear form
    form.reset();
    if (msg) msg.innerText = "";
  });
}

function initApp() {
  // Ensure base schema exists (seed products on first run).
  getProducts();
  // Ensure users/carts/orders/session keys exist in case other pages rely on them.
  const users = getUsers();
  saveJSON(ECOM.STORAGE.USERS, users);
  saveJSON(ECOM.STORAGE.SESSION, getSession());
  const carts = getCartsMap();
  saveCartsMap(carts);
  const orders = getOrders();
  saveOrders(orders);
  const contacts = getContacts();
  saveContacts(contacts);

  renderNav();

  initCatalogPage();
  initProductDetailPage();
  initRegisterPage();
  initLoginPage();
  initProfilePage();
  initCartPage();
  initCheckoutPage();
  initOrdersPage();
  initOrderDetailPage();
  initAdminPage();
  initContactPage();
}

// Start when DOM is ready (all pages should include <script> after body, but keep safe).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}