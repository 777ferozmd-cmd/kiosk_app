// ============================================================
// KIOSK APP — SECURE, CLEAN, PRODUCTION-READY
// ============================================================

// --- Security: Block dev tools on public kiosk ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U') ||
        (e.ctrlKey && e.key === 'S')
    ) {
        e.preventDefault();
    }
});

// --- Supabase Config (public/anon key only — safe for frontend) ---
const SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase config in window.CONFIG');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- XSS Sanitization ---
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
}

// --- Helpers ---
function generateOrderNumber() {
    return `KIOSK-${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function updateLucide() {
    if (window.lucide) window.lucide.createIcons();
}

function showToast(message, icon = 'check-circle') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${sanitize(message)}</span>`;
    container.appendChild(toast);
    updateLucide();
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- State ---
let state = {
    appName: 'KIOSK',
    view: 'welcome',
    orderType: null,
    selectedCategory: 'Burgers',
    cart: [],
    products: [],      // Source of truth for prices — always server-fetched
    discount: 50,
    editingCartItem: null,
    selectedPayment: null,
    showBillDetails: false,
    isSubmitting: false,
    lastOrderNumber: null,
    autoResetTimer: null
};

// --- Price Integrity: Always compute from server-fetched product catalog ---
function getBasePrice(productId) {
    const p = state.products.find(p => p.id === productId);
    return p ? Number(p.price) : 0;
}

function getAddOnsPrice(selectedAddOns) {
    return selectedAddOns.reduce((sum, a) => sum + Number(a.price || 0), 0);
}

function calculateTotals() {
    const subtotal = state.cart.reduce((sum, item) => {
        const base = getBasePrice(item.product.id);
        const addOns = getAddOnsPrice(item.details?.selectedAddOns || []);
        return sum + (base + addOns) * item.quantity;
    }, 0);
    const tax = subtotal * 0.05;
    const discount = state.discount || 0;
    const total = Math.max(0, (subtotal + tax) - discount);
    return { subtotal, tax, discount, total };
}

// --- Categories ---
const categoryData = [
    { name: 'Burgers', icon: 'sandwich' },
    { name: 'Pizzas', icon: 'pizza' },
    { name: 'Fried Chicken & Sides', icon: 'drumstick' },
    { name: 'Beverages & Desserts', icon: 'cup-soda' }
];

// --- View Rendering ---
const viewContainer = document.getElementById('view-container');

function render() {
    if (viewContainer) viewContainer.style.opacity = '0';
    setTimeout(() => {
        try {
            switch (state.view) {
                case 'welcome': renderWelcome(); break;
                case 'menu': renderMenu(); break;
                case 'checkout': renderCheckout(); break;
                case 'success': renderSuccess(); break;
            }
            updateCartUI();
            updateLucide();
            setTimeout(() => { if (viewContainer) viewContainer.style.opacity = '1'; }, 50);
        } catch (err) {
            console.error('Render error:', err);
            if (viewContainer) viewContainer.style.opacity = '1';
        }
    }, 200);
}

function renderWelcome() {
    viewContainer.innerHTML = `
        <div class="screen welcome-screen">
            <h1 class="hero-logo">${sanitize(state.appName)}</h1>
            <h2 style="font-size:1.75rem;font-weight:700;margin-bottom:2rem;color:#4A5568;">Ready to Order?</h2>
            <div class="type-buttons">
                <div class="type-card" onclick="setOrderType('dine-in')">
                    <i data-lucide="utensils" size="48" color="var(--primary)"></i>
                    <h3 style="font-size:1.5rem;">Dine In</h3>
                    <p class="text-muted" style="font-size:0.9rem;">Eat here at the restaurant</p>
                </div>
                <div class="type-card" onclick="setOrderType('takeaway')">
                    <i data-lucide="shopping-bag" size="48" color="var(--primary)"></i>
                    <h3 style="font-size:1.5rem;">Takeaway</h3>
                    <p class="text-muted" style="font-size:0.9rem;">Quickly grab and go</p>
                </div>
            </div>
        </div>
    `;
}

function renderMenu() {
    const filteredProducts = state.products.filter(p => p.category === state.selectedCategory);
    const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

    viewContainer.innerHTML = `
        <div class="screen menu-screen">
            <header class="menu-header">
                <button class="icon-btn-plain" onclick="setView('welcome')"><i data-lucide="arrow-left" size="22" color="#1A1A1A"></i></button>
                <h1 class="menu-header h1">Menu</h1>
                <div style="display:flex;gap:0.75rem;align-items:center;">
                    <div class="order-type-pill">
                        <i data-lucide="${state.orderType === 'dine-in' ? 'utensils' : 'shopping-bag'}" size="16"></i>
                        ${state.orderType === 'dine-in' ? 'Dine-in' : 'Takeaway'}
                    </div>
                    <button class="icon-btn-plain" onclick="toggleCart(true)" style="position:relative;background:#F1F5F9;border-radius:50%;padding:0.6rem;">
                        <i data-lucide="shopping-bag" size="22" color="#1A1A1A"></i>
                        ${cartCount > 0 ? `<span class="badge">${cartCount}</span>` : ''}
                    </button>
                </div>
            </header>
            <aside class="sidebar">
                ${categoryData.map(cat => `
                    <div class="category-item ${cat.name === state.selectedCategory ? 'active' : ''}" onclick="setSelectedCategory('${sanitize(cat.name)}')">
                        <i data-lucide="${cat.icon}" size="24"></i>
                        <span>${sanitize(cat.name)}</span>
                    </div>
                `).join('')}
            </aside>
            <main class="menu-content">
                <div style="margin-bottom:2rem;">
                    <h1 style="font-size:2rem;">Classic ${sanitize(state.selectedCategory)}</h1>
                    <p class="text-muted" style="font-size:1.1rem;margin-top:0.25rem;">Our signature selection</p>
                </div>
                <div class="product-grid">
                    ${filteredProducts.length === 0 ? '<p class="text-muted">No items in this category yet.</p>' :
                    filteredProducts.map((p, i) => `
                        <div class="product-card ${!p.is_available ? 'sold-out' : ''}" style="animation:fadeUp 0.3s ease-out forwards;animation-delay:${i * 0.03}s;">
                            ${!p.is_available ? '<div class="sold-out-badge">SOLD OUT</div>' : ''}
                            <img src="${sanitize(p.image)}" alt="${sanitize(p.name)}" class="product-image" loading="lazy">
                            <div class="product-info">
                                <h3>${sanitize(p.name)}</h3>
                                <p class="product-desc" style="font-size:0.9rem;color:#718096;margin:0.25rem 0 0.75rem 0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${sanitize(p.desc)}</p>
                                <span class="product-price">${formatCurrency(p.price)}</span>
                                <div style="margin-top:auto;padding-top:1rem;">
                                    <button class="btn-add-circle" onclick="${p.is_available ? `handleAddItemClick('${p.id}')` : ''}" ${!p.is_available ? 'disabled style="background:#e2e8f0;color:#a0aec0;cursor:not-allowed;"' : ''}>
                                        <i data-lucide="${!p.is_available ? 'ban' : 'plus'}" size="18"></i> ${!p.is_available ? 'Unavailable' : 'Add'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </main>
        </div>
    `;
}

function renderCheckout() {
    const { subtotal, tax, discount, total } = calculateTotals();
    const isUPI = state.selectedPayment === 'upi';
    const itemCount = state.cart.reduce((s, i) => s + i.quantity, 0);

    viewContainer.innerHTML = `
        <div class="screen checkout-screen">
            <header class="checkout-header">
                <button class="icon-btn-plain" onclick="setView('menu');toggleCart(true);"><i data-lucide="arrow-left" size="24"></i></button>
                <h1>Checkout</h1>
                <div style="width:40px;"></div>
            </header>
            <div class="checkout-body">
                <section class="checkout-section">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
                        <h2 style="margin:0;font-size:1rem;font-weight:800;color:#1A202C;">Your Items</h2>
                        <span style="background:#F1F5F9;padding:0.4rem 0.8rem;border-radius:12px;font-size:0.75rem;font-weight:800;color:#475569;">${itemCount} Item${itemCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="checkout-items-list">
                        ${state.cart.map(item => {
                            const addOns = item.details?.selectedAddOns?.length > 0 ? item.details.selectedAddOns.map(a => sanitize(a.name)).join(', ') : '';
                            const adjustments = item.details?.selectedAdjustments?.length > 0 ? item.details.selectedAdjustments.map(a => sanitize(a)).join(', ') : '';
                            const meta = [addOns, adjustments].filter(Boolean).join(' · ');
                            const base = getBasePrice(item.product.id);
                            const addOnsPrice = getAddOnsPrice(item.details?.selectedAddOns || []);
                            const itemTotal = (base + addOnsPrice) * item.quantity;
                            return `
                            <div class="checkout-item-row">
                                <img src="${sanitize(item.product.image)}" alt="${sanitize(item.product.name)}" class="checkout-item-img">
                                <div class="checkout-item-details">
                                    <p class="checkout-item-name">${sanitize(item.product.name)}</p>
                                    ${meta ? `<p class="checkout-item-meta">${meta}</p>` : ''}
                                    <p class="checkout-item-qty">Qty: ${item.quantity}</p>
                                </div>
                                <span class="checkout-item-price">${formatCurrency(itemTotal)}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </section>
                <section class="checkout-section">
                    <h2 style="margin:0 0 1rem 0;font-size:1rem;font-weight:800;color:#1A202C;">Bill Summary</h2>
                    <div class="checkout-summary-card">
                        <div class="checkout-summary-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
                        <div class="checkout-summary-row"><span>Tax (5%)</span><span>${formatCurrency(tax)}</span></div>
                        ${discount > 0 ? `<div class="checkout-summary-row" style="color:#48BB78;"><span>Discount</span><span>-${formatCurrency(discount)}</span></div>` : ''}
                        <div class="checkout-summary-row" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed #CBD5E0;color:#1A202C;font-size:1rem;font-weight:900;">
                            <span>Total Amount</span><span>${formatCurrency(total)}</span>
                        </div>
                    </div>
                </section>
                <section class="checkout-section">
                    <h2 class="section-title"><i data-lucide="user" size="18"></i> Customer Details</h2>
                    <div class="form-group">
                        <label class="input-label">FULL NAME</label>
                        <input type="text" placeholder="Your name" id="customer-name" class="form-input" autocomplete="off" maxlength="60">
                        <span id="error-name" class="field-error"></span>
                    </div>
                    <div class="form-group">
                        <label class="input-label">PHONE NUMBER</label>
                        <input type="tel" placeholder="10-digit phone" id="customer-phone" class="form-input" maxlength="10" inputmode="numeric" autocomplete="off">
                        <span id="error-phone" class="field-error"></span>
                    </div>
                    <div class="form-group">
                        <label class="input-label">SPECIAL INSTRUCTIONS (OPTIONAL)</label>
                        <textarea id="order-notes" class="form-input notes-textarea" placeholder="e.g. No onion, extra spicy..." rows="2" maxlength="200"></textarea>
                    </div>
                </section>
                <section class="checkout-section" style="margin-bottom:2rem;">
                    <h2 class="section-title"><i data-lucide="shield-check" size="18"></i> Choose Payment Method</h2>
                    <div class="payment-options">
                        <div class="payment-card ${isUPI ? 'active' : ''}" onclick="selectPayment('upi')">
                            <div class="payment-card-header">
                                <div style="display:flex;align-items:center;gap:1rem;">
                                    <div class="method-icon"><i data-lucide="smartphone" size="20"></i></div>
                                    <div>
                                        <p style="font-weight:800;color:#1A202C;margin:0;font-size:1rem;">UPI</p>
                                        <p style="font-size:0.75rem;color:#718096;margin:0;">Google Pay, PhonePe, Paytm</p>
                                    </div>
                                </div>
                                <div class="radio-new ${isUPI ? 'active' : ''}"></div>
                            </div>
                            <div class="upi-apps ${isUPI ? '' : 'collapsed'}">
                                <div class="upi-app"><div class="upi-icon-wrapper"><img src="https://www.vectorlogo.zone/logos/google_pay/google_pay-icon.svg" alt="GPay"></div><span style="font-size:0.7rem;font-weight:700;color:#4A5568;margin-top:0.5rem;display:block;text-align:center;">GPay</span></div>
                                <div class="upi-app"><div class="upi-icon-wrapper"><img src="https://download.logo.wine/logo/PhonePe/PhonePe-Logo.wine.png" alt="PhonePe" style="width:44px;object-fit:contain;"></div><span style="font-size:0.7rem;font-weight:700;color:#4A5568;margin-top:0.5rem;display:block;text-align:center;">PhonePe</span></div>
                                <div class="upi-app"><div class="upi-icon-wrapper"><img src="https://upload.wikimedia.org/wikipedia/commons/4/42/Paytm_logo.png" alt="Paytm" style="width:40px;"></div><span style="font-size:0.7rem;font-weight:700;color:#4A5568;margin-top:0.5rem;display:block;text-align:center;">Paytm</span></div>
                            </div>
                        </div>
                        <div class="payment-card ${state.selectedPayment === 'cards' ? 'active' : ''}" style="margin-top:1rem;" onclick="selectPayment('cards')">
                            <div class="payment-card-header">
                                <div style="display:flex;align-items:center;gap:1rem;">
                                    <div class="method-icon"><i data-lucide="credit-card" size="20"></i></div>
                                    <div>
                                        <p style="font-weight:800;color:#1A202C;margin:0;font-size:1rem;">Net Banking / Cards / Wallets</p>
                                        <p style="font-size:0.75rem;color:#718096;margin:0;">Visa, Mastercard, RuPay, etc.</p>
                                    </div>
                                </div>
                                <div class="radio-new ${state.selectedPayment === 'cards' ? 'active' : ''}"></div>
                            </div>
                        </div>
                    </div>
                </section>
                <div id="checkout-error-banner" class="checkout-error-banner hidden"></div>
            </div>
            <div class="checkout-footer-new">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <p style="font-size:0.75rem;color:#64748B;font-weight:800;text-transform:uppercase;">Total Amount</p>
                        <p style="font-size:1.75rem;font-weight:900;color:#1A1A1A;margin:0;">${formatCurrency(total)}</p>
                    </div>
                    <button id="place-order-btn" class="btn btn-primary" style="padding:1.25rem 2.5rem;border-radius:20px;font-weight:900;font-size:1.1rem;" onclick="placeOrder()" ${state.isSubmitting ? 'disabled' : ''}>
                        ${state.isSubmitting ? '<span class="btn-spinner"></span> PLACING...' : 'PLACE ORDER'}
                    </button>
                </div>
            </div>
        </div>
    `;
    updateLucide();
}

function selectPayment(type) {
    state.selectedPayment = state.selectedPayment === type ? null : type;
    renderCheckout();
}

async function placeOrder() {
    if (state.isSubmitting) return;

    const errorName = document.getElementById('error-name');
    const errorPhone = document.getElementById('error-phone');
    const errorBanner = document.getElementById('checkout-error-banner');
    if (errorName) errorName.textContent = '';
    if (errorPhone) errorPhone.textContent = '';
    if (errorBanner) errorBanner.classList.add('hidden');

    // --- Input validation ---
    const rawName = (document.getElementById('customer-name')?.value || '').trim();
    const rawPhone = (document.getElementById('customer-phone')?.value || '').trim();
    const rawNotes = (document.getElementById('order-notes')?.value || '').trim();

    const name = sanitize(rawName);
    const phone = sanitize(rawPhone);
    const notes = sanitize(rawNotes);

    let hasError = false;
    if (!name || name.length < 2) {
        if (errorName) errorName.textContent = 'Please enter your name (min 2 characters)';
        hasError = true;
    } else if (name.length > 60) {
        if (errorName) errorName.textContent = 'Name is too long (max 60 characters)';
        hasError = true;
    }
    if (!phone) {
        if (errorPhone) errorPhone.textContent = 'Phone is required';
        hasError = true;
    } else if (!/^\d{10}$/.test(phone)) {
        if (errorPhone) errorPhone.textContent = 'Enter a valid 10-digit number';
        hasError = true;
    }
    if (state.cart.length === 0) {
        showToast('Your cart is empty', 'alert-circle');
        return;
    }
    if (hasError) return;

    // --- Lock submission immediately ---
    state.isSubmitting = true;
    const btn = document.getElementById('place-order-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> PLACING...'; }

    // --- Price integrity: compute server-side prices from fetched product catalog ---
    const orderId = generateUUID();
    const orderNumber = generateOrderNumber();
    const { subtotal, tax, discount, total } = calculateTotals();

    // Validate totals are sane numbers
    if (isNaN(subtotal) || subtotal < 0 || isNaN(total) || total < 0) {
        showToast('Order calculation error. Please try again.', 'alert-circle');
        state.isSubmitting = false;
        if (btn) { btn.disabled = false; btn.innerHTML = 'PLACE ORDER'; }
        return;
    }

    const orderData = {
        id: orderId,
        order_number: orderNumber,
        customer_name: name,
        phone: phone,
        notes: notes.slice(0, 200) || null,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        total_amount: parseFloat(total.toFixed(2)),
        status: 'pending'
    };

    // Build items using ONLY server-fetched prices
    const orderItems = state.cart.map(item => {
        const base = getBasePrice(item.product.id);
        const addOns = getAddOnsPrice(item.details?.selectedAddOns || []);
        const addOnsLabel = item.details?.selectedAddOns?.length > 0
            ? item.details.selectedAddOns.map(a => sanitize(a.name)).join(', ') : null;
        const adjustmentsLabel = item.details?.selectedAdjustments?.length > 0
            ? item.details.selectedAdjustments.map(a => sanitize(a)).join(', ') : null;
        const extras = [addOnsLabel, adjustmentsLabel].filter(Boolean).join(' | ') || null;
        const unitPrice = base + addOns;
        return {
            order_id: orderId,
            product_name: sanitize(item.product.name),
            add_ons: extras,
            quantity: Math.max(1, parseInt(item.quantity)),
            unit_price: parseFloat(unitPrice.toFixed(2)),
            item_total: parseFloat((unitPrice * item.quantity).toFixed(2))
        };
    });

    try {
        // Insert order
        const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(orderData)
        });
        if (!orderRes.ok) throw new Error(`Order insert failed: ${await orderRes.text()}`);

        // Insert order items
        const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(orderItems)
        });
        if (!itemsRes.ok) throw new Error(`Items insert failed: ${await itemsRes.text()}`);

        state.lastOrderNumber = orderNumber;
        resetCartAndPayment();
        showToast('Order Placed Successfully!', 'check');
        setView('success');
    } catch (err) {
        console.error('Order failed:', err);
        state.isSubmitting = false;
        if (btn) { btn.disabled = false; btn.innerHTML = 'PLACE ORDER'; }
        if (errorBanner) {
            errorBanner.textContent = 'Something went wrong. Please try again.';
            errorBanner.classList.remove('hidden');
        }
        showToast('Order failed. Try again.', 'alert-circle');
    }
}

function resetCartAndPayment() {
    state.cart = [];
    state.selectedPayment = null;
    state.showBillDetails = false;
    state.editingCartItem = null;
    state.isSubmitting = false;
}

function renderSuccess() {
    if (state.autoResetTimer) { clearTimeout(state.autoResetTimer); state.autoResetTimer = null; }
    const orderNum = state.lastOrderNumber || 'KIOSK-0000';
    viewContainer.innerHTML = `
        <div class="screen success-screen" style="align-items:center;justify-content:center;text-align:center;">
            <div class="success-check-circle"><i data-lucide="check" size="44"></i></div>
            <h1 style="font-size:2.25rem;margin-bottom:0.5rem;color:#1A202C;">Order Placed!</h1>
            <p class="text-muted" style="font-size:1rem;margin-bottom:1.5rem;">Thank you for your order</p>
            <div class="success-order-number">${sanitize(orderNum)}</div>
            <p style="font-size:1rem;color:#4A5568;font-weight:600;margin-bottom:2.5rem;">Please wait for your order at the counter</p>
            <button class="btn btn-primary" style="padding:1rem 3rem;border-radius:999px;font-weight:800;font-size:1rem;" onclick="resetApp()">Start New Order</button>
            <div class="auto-reset-bar-container"><div class="auto-reset-bar"></div></div>
            <p style="font-size:0.75rem;color:#94A3B8;margin-top:0.5rem;">Auto-resets in 15 seconds</p>
        </div>
    `;
    state.autoResetTimer = setTimeout(resetApp, 15000);
}

// --- Logic ---
function setView(view) { state.view = view; render(); }
function setOrderType(type) { state.orderType = type; setView('menu'); }
function setSelectedCategory(cat) { state.selectedCategory = cat; render(); }

function handleAddItemClick(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.is_available) return;
    if (product.hasCustomization) {
        state.editingCartItem = {
            id: `new-${Date.now()}`,
            product: { ...product },
            quantity: 1,
            details: { selectedAddOns: [], selectedAdjustments: [] }
        };
        renderModal();
    } else {
        addToCart(productId);
    }
}

function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.is_available) return;
    state.cart.push({
        id: `item-${Date.now()}`,
        product: { ...product },
        quantity: 1,
        details: { selectedAddOns: [], selectedAdjustments: [] }
    });
    showToast(`${product.name} added!`);
    updateBadge();
    updateCartUI();
}

function updateBadge() {
    const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const btn = document.querySelector('.icon-btn-plain[onclick="toggleCart(true)"]');
    if (!btn) return;
    let badge = btn.querySelector('.badge');
    if (cartCount > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; btn.appendChild(badge); }
        badge.textContent = cartCount;
    } else if (badge) {
        badge.remove();
    }
}

function toggleCart(open) {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (open) { drawer.classList.add('open'); overlay.classList.remove('hidden'); updateCartUI(); }
    else { drawer.classList.remove('open'); overlay.classList.add('hidden'); }
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-msg">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                <p>Your cart is empty</p>
            </div>`;
    } else {
        container.innerHTML = state.cart.map(item => `
            <div class="cart-item-card">
                <img src="${sanitize(item.product.image)}">
                <div class="item-info">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <h3 style="flex:1;padding-right:0.5rem;">${sanitize(item.product.name)}</h3>
                        <button class="icon-btn-plain" onclick="removeFromCart('${item.id}')" style="margin-top:-4px;">
                            <i data-lucide="x" size="18" color="#CBD5E0"></i>
                        </button>
                    </div>
                    <span class="item-price">${formatCurrency(getBasePrice(item.product.id) + getAddOnsPrice(item.details?.selectedAddOns || []))}</span>
                    ${item.details ? `<p class="item-meta">${formatItemMeta(item)}</p>` : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:0.5rem;">
                        ${item.product.hasCustomization ? `<button class="btn-customize" onclick="openCustomizeModal('${item.id}')">Customize</button>` : '<div></div>'}
                        <div class="qty-stepper-new">
                            <button onclick="updateQty('${item.id}', -1)">-</button>
                            <span style="font-weight:800;min-width:20px;text-align:center;font-size:0.9rem;">${item.quantity}</span>
                            <button onclick="updateQty('${item.id}', 1)" class="plus">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const { subtotal, tax, discount, total } = calculateTotals();
    const footer = document.querySelector('.cart-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="cart-total-row">
                <span class="cart-total-label">Total Amount</span>
                <span class="cart-total-value">${formatCurrency(total)}</span>
            </div>
            <div style="display:flex;gap:0.75rem;">
                <button class="btn" style="flex:1;background:#F1F5F9;color:#4A5568;font-size:1rem;font-weight:800;padding:1.25rem;border-radius:20px;border:none;" onclick="toggleCart(false)">Add more</button>
                <button class="btn btn-primary" style="flex:1.5;padding:1.25rem;border-radius:20px;font-weight:900;font-size:1.1rem;border:none;" onclick="setView('checkout');toggleCart(false);">
                    Checkout →
                </button>
            </div>
        `;
    }
    updateLucide();
}

function updateQty(id, delta) {
    const item = state.cart.find(i => i.id === id);
    if (!item) return;
    item.quantity += delta;
    updateBadge();
    if (item.quantity <= 0) removeFromCart(id);
    else updateCartUI();
}

function removeFromCart(id) {
    state.cart = state.cart.filter(i => i.id !== id);
    updateBadge();
    updateCartUI();
}

function formatItemMeta(item) {
    if (!item.details) return '';
    const parts = [];
    if (item.details.selectedAddOns?.length > 0) parts.push('+' + item.details.selectedAddOns.map(a => sanitize(a.name)).join(', '));
    if (item.details.selectedAdjustments?.length > 0) parts.push(item.details.selectedAdjustments.map(a => sanitize(a)).join(', '));
    return parts.join(' | ');
}

// --- Customization Modal ---
const modalContainer = document.getElementById('modal-container');

function openCustomizeModal(itemId) {
    const item = state.cart.find(i => i.id === itemId);
    if (!item) return;
    state.editingCartItem = JSON.parse(JSON.stringify(item)); // deep clone
    renderModal();
}

function renderModal() {
    const item = state.editingCartItem;
    const p = item.product;
    const modalContent = document.querySelector('.modal-card');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2 style="font-size:1.25rem;">Customization</h2>
            <button class="icon-btn-plain" onclick="closeModal()"><i data-lucide="x" size="24"></i></button>
        </div>
        <div class="modal-content">
            ${p.addOns && p.addOns.length > 0 ? `
                <div class="customize-section">
                    <h4>Add Extras</h4>
                    ${p.addOns.map(addon => `
                        <label class="checkbox-item">
                            <input type="checkbox" ${hasSelectedAddOn(addon.name) ? 'checked' : ''} onchange="toggleEditAddOn('${sanitize(addon.name)}', ${Number(addon.price)})">
                            <span class="custom-checkbox"></span>
                            <span class="label-text">${sanitize(addon.name)}</span>
                            <span class="price-tag">+${formatCurrency(addon.price)}</span>
                        </label>`).join('')}
                </div>` : ''}
            ${p.adjustments && p.adjustments.length > 0 ? `
                <div class="customize-section">
                    <h4>Adjustments</h4>
                    ${p.adjustments.map(adj => `
                        <div class="toggle-item">
                            <span style="font-weight:700;">${sanitize(adj)}</span>
                            <label class="switch">
                                <input type="checkbox" ${item.details.selectedAdjustments.includes(adj) ? 'checked' : ''} onchange="toggleEditAdjustment('${sanitize(adj)}')">
                                <span class="slider round"></span>
                            </label>
                        </div>`).join('')}
                </div>` : ''}
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary btn-block" style="padding:1.1rem;border-radius:20px;" onclick="saveCustomization()">
                Apply Changes &nbsp; →
            </button>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    updateLucide();
}

function closeModal() { modalContainer.classList.add('hidden'); state.editingCartItem = null; }
function hasSelectedAddOn(name) { return state.editingCartItem?.details.selectedAddOns.some(a => a.name === name); }

function toggleEditAddOn(name, price) {
    const list = state.editingCartItem.details.selectedAddOns;
    const idx = list.findIndex(a => a.name === name);
    if (idx > -1) list.splice(idx, 1); else list.push({ name, price: Number(price) });
    renderModal();
}

function toggleEditAdjustment(name) {
    const list = state.editingCartItem.details.selectedAdjustments;
    const idx = list.indexOf(name);
    if (idx > -1) list.splice(idx, 1); else list.push(name);
    renderModal();
}

function saveCustomization() {
    const edited = state.editingCartItem;
    if (!edited) return;
    // Do NOT mutate price — it will be computed from catalog at order time
    if (edited.id.startsWith('new-')) {
        edited.id = `item-${Date.now()}`;
        state.cart.push(edited);
        showToast(`${edited.product.name} customized & added!`);
    } else {
        const index = state.cart.findIndex(item => item.id === edited.id);
        if (index !== -1) { state.cart[index] = edited; showToast('Customization updated!'); }
    }
    closeModal();
    updateCartUI();
    updateBadge();
}

function resetApp() {
    if (state.autoResetTimer) { clearTimeout(state.autoResetTimer); state.autoResetTimer = null; }
    state.cart = [];
    state.orderType = null;
    state.selectedPayment = null;
    state.selectedCategory = 'Burgers';
    state.showBillDetails = false;
    state.editingCartItem = null;
    state.isSubmitting = false;
    state.lastOrderNumber = null;
    state.view = 'welcome';
    render();
}

// --- Supabase helpers ---
async function fetchSettings() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.length > 0 && data[0].app_name) {
                state.appName = sanitize(data[0].app_name.toUpperCase());
                document.title = data[0].app_name;
            }
        }
    } catch (e) { console.error('Failed to fetch settings:', e); }
}

async function fetchProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('id,name,category,price,image,desc,has_customization,add_ons,adjustments,is_available')
            .order('category', { ascending: true })
            .order('id', { ascending: true });
        if (error) throw error;
        state.products = data.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: Number(p.price),
            image: p.image,
            desc: p.desc,
            hasCustomization: p.has_customization,
            addOns: p.add_ons || [],
            adjustments: p.adjustments || [],
            is_available: p.is_available
        }));
    } catch (e) { console.error('Error fetching products:', e); }
}

function setupRealtimeProducts() {
    supabaseClient.channel('public:products')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, payload => {
            const updated = payload.new;
            const index = state.products.findIndex(p => p.id === updated.id);
            if (index !== -1) {
                state.products[index].is_available = updated.is_available;
                if (state.view === 'menu') { renderMenu(); updateLucide(); }
            }
        })
        .subscribe();
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    document.getElementById('close-cart')?.addEventListener('click', () => toggleCart(false));
    document.getElementById('drawer-overlay')?.addEventListener('click', () => toggleCart(false));
    await fetchSettings();
    await fetchProducts();
    setupRealtimeProducts();
    render();
});
