/**
 * CHAMPIONS CLUB — Pro Shop & Shared Inventory Controller
 * Implements single unified shared stock shelf, online (sofa) vs counter sales,
 * low-stock awareness alerts, pickup / delivery fulfillment, and cancellation stock restoration.
 * Communicates with real Odoo backend endpoints via ClubAPI.
 */

let productsCache = [];

async function getProductsAsync(category = null) {
  try {
    if (window.ClubAPI) {
      const live = await window.ClubAPI.getProducts(category);
      if (live && live.length > 0) {
        productsCache = live;
        return live;
      }
    }
  } catch (err) {
    console.warn('Backend products fetch failed, using local store:', err.message);
  }
  if (window.ClubDataStore) {
    productsCache = window.ClubDataStore.getProducts();
    return productsCache;
  }
  return [];
}

function getShopOrders() {
  if (window.ClubDataStore) {
    return window.ClubDataStore.getShopOrders();
  }
  return [];
}

function saveShopOrders(orders) {
  if (window.ClubDataStore) {
    window.ClubDataStore.saveShopOrders(orders);
  }
}

let cart = [];
let currentCategoryFilter = 'all';

const CATEGORY_DEFAULT_IMAGES = {
  rackets: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=400&q=80',
  balls: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=400&q=80',
  cricket: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=400&q=80',
  shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
  apparel: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=400&q=80',
  accessories: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=400&q=80'
};

function getProductFallbackSvg(category) {
  const icon = category === 'rackets' ? '🏸' : category === 'balls' ? '🎾' : category === 'shoes' ? '👟' : category === 'apparel' ? '👕' : category === 'accessories' ? '🎽' : '📦';
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="16" fill="#121826"/><rect x="2" y="2" width="116" height="116" rx="14" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-opacity="0.35"/><circle cx="60" cy="60" r="32" fill="#d4af37" fill-opacity="0.08"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="34">${icon}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
}

function updateCategoryFilterCounts(allProducts) {
  const counts = {
    all: allProducts.length,
    rackets: allProducts.filter(p => p.category === 'rackets').length,
    balls: allProducts.filter(p => p.category === 'balls').length,
    shoes: allProducts.filter(p => p.category === 'shoes').length,
    apparel: allProducts.filter(p => p.category === 'apparel').length,
    accessories: allProducts.filter(p => p.category === 'accessories').length
  };

  for (const [cat, count] of Object.entries(counts)) {
    const el = document.getElementById(`chip-count-${cat}`);
    if (el) el.textContent = count;
  }
}

async function renderCatalog() {
  const container = document.getElementById('product-grid-container');
  if (!container) return;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--cc-text-muted);">
      <div class="cc-spinner" style="margin: 0 auto 0.75rem;"></div>
      Loading inventory from Odoo backend...
    </div>
  `;

  const products = await getProductsAsync(null);
  updateCategoryFilterCounts(products);

  container.innerHTML = '';

  const filtered = products.filter(p => {
    if (currentCategoryFilter !== 'all' && p.category !== currentCategoryFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--cc-text-muted); background: var(--cc-bg-surface); border-radius: var(--cc-radius-lg); border: 1px dashed var(--cc-border-medium);">
        <div style="font-size: 24px; margin-bottom: 6px;">📦</div>
        <strong style="display: block; font-size: 15px; color: var(--cc-text-primary);">No products found</strong>
        <span style="font-size: 13px;">No items currently listed under '${currentCategoryFilter}'.</span>
      </div>
    `;
    return;
  }

  filtered.forEach(product => {
    const isLowStock = product.stock <= (product.min_alert || product.minAlert || 5) && product.stock > 0;
    const isOutOfStock = product.stock <= 0;

    let imgSrc = product.image;
    if (!imgSrc || imgSrc.trim() === '') {
      imgSrc = CATEGORY_DEFAULT_IMAGES[product.category] || CATEGORY_DEFAULT_IMAGES.rackets;
    }
    const fallbackSvg = getProductFallbackSvg(product.category);

    const card = document.createElement('div');
    card.className = 'cc-product-card';
    card.innerHTML = `
      <div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: 0.75rem;">
        <!-- Small Product Image Thumbnail Beside Listing -->
        <div class="cc-product-thumb-box">
          <img src="${imgSrc}" alt="${product.name}" class="cc-product-thumb-img" onerror="this.onerror=null; this.src='${fallbackSvg}';">
        </div>
        
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; gap: 6px;">
            <span class="cc-eyebrow" style="font-size: 10px; margin-bottom: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.sku} &bull; ${product.category.toUpperCase()}</span>
            <div>
              ${isOutOfStock ? `
                <span class="cc-badge cc-badge-danger" style="font-size: 9px; padding: 2px 6px;">Out of Stock</span>
              ` : isLowStock ? `
                <span class="cc-badge cc-badge-warning" style="font-size: 9px; padding: 2px 6px;"><span class="cc-pulse-dot"></span> Low (${product.stock})</span>
              ` : `
                <span class="cc-badge cc-badge-active" style="font-size: 9px; padding: 2px 6px;">In Stock (${product.stock})</span>
              `}
            </div>
          </div>
          <h3 class="cc-heading-4" style="margin-bottom: 0; font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--cc-text-primary);">${product.name}</h3>
        </div>
      </div>

      <p class="cc-body-xs" style="color: var(--cc-text-muted); margin-bottom: 1rem; flex-grow: 1; font-size: 12px; line-height: 1.45;">${product.description || product.desc || 'Premium sports equipment on shared shelf.'}</p>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--cc-border-subtle); padding-top: 0.75rem;">
        <div>
          <span style="font-size: 10px; color: var(--cc-text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Sales Price</span>
          <div class="cc-text-mono" style="font-size: 1.18rem; font-weight: 800; color: var(--cc-gold-400);">₹ ${product.price.toLocaleString()}</div>
        </div>
        <button class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill ${isOutOfStock ? 'is-disabled' : ''}" 
                onclick="addToCart('${product.id}')" ${isOutOfStock ? 'disabled' : ''}>
          + Add to Cart
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function getActiveMemberDiscount() {
  if (typeof window !== 'undefined' && window.ClubMemberAuth && window.ClubMemberAuth.isMember()) {
    const mem = window.ClubMemberAuth.getMember();
    if (!mem || mem.state === 'cancelled' || mem.state === 'expired' || mem.state === 'inactive') {
      return { percent: 0, member: mem, isCancelled: true };
    }
    const plan = (mem.plan || mem.tier_code || 'gold').toLowerCase();
    if (plan === 'gold') return { percent: 15, member: mem };
    if (plan === 'silver') return { percent: 10, member: mem };
    if (plan === 'junior') return { percent: 15, member: mem };
    return { percent: 10, member: mem };
  }
  return { percent: 0, member: null };
}

function renderShopMemberBanner() {
  const memberDisc = getActiveMemberDiscount();
  const nameInput = document.getElementById('customer-name-input');
  const bannerContainer = document.getElementById('shop-member-discount-banner');

  if (memberDisc.member) {
    if (nameInput && (!nameInput.value || nameInput.value === 'David Vance')) {
      nameInput.value = memberDisc.member.name;
    }
    if (bannerContainer) {
      if (memberDisc.isCancelled) {
        bannerContainer.style.display = 'block';
        bannerContainer.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); padding: 8px 12px; border-radius: var(--cc-radius-md); font-size: 12px; color: var(--cc-text-primary); display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span>👤 Member: <strong>${memberDisc.member.name}</strong> <span class="cc-badge cc-badge-danger" style="font-size: 9px; margin-left: 6px;">CANCELLED</span></span>
            <span style="font-size: 11px; color: var(--cc-text-muted);">Standard Walk-in Rates Apply</span>
          </div>
        `;
      } else {
        bannerContainer.style.display = 'block';
        bannerContainer.innerHTML = `
          <div style="background: rgba(212, 175, 55, 0.12); border: 1px solid var(--cc-gold-500); padding: 8px 12px; border-radius: var(--cc-radius-md); font-size: 12px; color: var(--cc-text-primary); display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span>👤 Shopping as <strong>${memberDisc.member.name}</strong> (${(memberDisc.member.plan || 'Gold').toUpperCase()} Tier)</span>
            <span class="cc-badge cc-badge-gold" style="font-size: 10px;">${memberDisc.percent}% Member Discount Applied</span>
          </div>
        `;
      }
    }
  } else {
    if (bannerContainer) bannerContainer.style.display = 'none';
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const countBadge = document.getElementById('cart-item-count-badge');
  const totalDisplay = document.getElementById('cart-total-amount');
  if (!container) return;

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const rawTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const memberDisc = getActiveMemberDiscount();
  const discAmount = (rawTotal * memberDisc.percent) / 100.0;
  const netTotal = rawTotal - discAmount;

  if (countBadge) countBadge.textContent = `${totalQty} Item${totalQty === 1 ? '' : 's'}`;
  if (totalDisplay) {
    if (memberDisc.percent > 0 && discAmount > 0) {
      totalDisplay.innerHTML = `<span style="font-size: 0.9rem; text-decoration: line-through; color: var(--cc-text-muted); margin-right: 6px;">₹ ${rawTotal.toLocaleString()}</span> ₹ ${netTotal.toLocaleString()}`;
    } else {
      totalDisplay.textContent = `₹ ${rawTotal.toLocaleString()}`;
    }
  }

  if (cart.length === 0) {
    container.innerHTML = '<p class="cc-body-xs" style="color: var(--cc-text-muted); padding: 12px 0;">Your cart is currently empty. Click "+ Add to Cart" on any product.</p>';
    return;
  }

  container.innerHTML = '';
  cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cc-cart-item';
    div.innerHTML = `
      <div style="max-width: 170px;">
        <div style="font-weight: 700; color: var(--cc-text-primary); font-size: 12px;">${item.name}</div>
        <div class="cc-text-mono" style="font-size: 11px; color: var(--cc-text-muted);">₹ ${item.price} &times; ${item.qty}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="cc-btn cc-btn-secondary" style="padding: 2px 8px; font-size: 11px; height: 24px;" onclick="changeCartQty('${item.id}', -1)">-</button>
        <span class="cc-text-mono" style="font-weight: 800; font-size: 12px;">${item.qty}</span>
        <button class="cc-btn cc-btn-secondary" style="padding: 2px 8px; font-size: 11px; height: 24px;" onclick="changeCartQty('${item.id}', 1)">+</button>
      </div>
    `;
    container.appendChild(div);
  });
}

window.addToCart = function(productId) {
  const product = productsCache.find(p => String(p.id) === String(productId));
  if (!product || product.stock <= 0) return;

  const existing = cart.find(i => String(i.id) === String(productId));
  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty++;
    } else {
      if (window.ClubAPI) window.ClubAPI.showError(`Maximum available stock (${product.stock}) reached.`, 'Stock Limit');
    }
  } else {
    cart.push({
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      qty: 1
    });
  }

  renderCart();
};

window.changeCartQty = function(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;

  const product = productsCache.find(p => String(p.id) === String(productId));

  if (delta > 0) {
    if (product && item.qty >= product.stock) {
      if (window.ClubAPI) window.ClubAPI.showError(`Only ${product.stock} units available in stock.`, 'Stock Limit');
      return;
    }
    item.qty++;
  } else {
    item.qty--;
    if (item.qty <= 0) {
      cart = cart.filter(i => String(i.id) !== String(productId));
    }
  }

  renderCart();
};

function renderShopOrders() {
  const tbody = document.getElementById('shop-orders-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const orders = getShopOrders();

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--cc-text-muted); padding: 2rem;">
          No data available
        </td>
      </tr>
    `;
    return;
  }

  orders.forEach(order => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="cc-text-mono" style="font-weight: 800; color: var(--cc-gold-400);">${order.id}</div>
        <div style="font-size: 11px; color: var(--cc-text-muted);">${order.date}</div>
      </td>
      <td>
        <span class="cc-badge ${order.channel === 'online' ? 'cc-badge-junior' : 'cc-badge-gold'}">
          ${order.channel === 'online' ? 'Online (Sofa)' : 'Counter Sale'}
        </span>
      </td>
      <td>
        <div style="font-weight: 700; color: var(--cc-text-primary); font-size: 13px;">${order.customer}</div>
      </td>
      <td>
        <div style="font-size: 12px; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${order.fulfillment}
        </div>
      </td>
      <td>
        <span style="font-size: 12px;">${order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</span>
      </td>
      <td class="cc-text-mono" style="color: var(--cc-neon-green); font-weight: 700;">
        ₹ ${order.total.toLocaleString()}
      </td>
      <td style="text-align: right;">
        ${order.state !== 'cancelled' ? `
          <button class="cc-btn cc-btn-outline-gold cc-btn-sm" onclick="cancelShopOrder('${order.id}')" style="padding: 3px 8px; font-size: 11px; border-color: rgba(239, 68, 68, 0.4); color: #FCA5A5;">
            Cancel &amp; Restore Stock
          </button>
        ` : '<span style="font-size: 11px; color: var(--cc-text-muted);">Restored</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.cancelShopOrder = function(orderId) {
  const orders = getShopOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order || order.state === 'cancelled') return;

  // Restore inventory to shared shelf
  order.items.forEach(item => {
    const product = productsCache.find(p => p.name === item.name || String(p.id) === String(item.id));
    if (product) {
      product.stock += item.qty;
    }
  });

  order.state = 'cancelled';
  if (window.ClubDataStore) {
    window.ClubDataStore.saveProducts(productsCache);
    window.ClubDataStore.saveShopOrders(orders);
  }

  renderCatalog();
  renderShopOrders();
};

document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
  renderCart();
  renderShopOrders();

  // Category Filter Pills
  const catPills = document.querySelectorAll('#shop-category-filters .cc-filter-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      currentCategoryFilter = pill.getAttribute('data-cat');
      renderCatalog();
    });
  });

  // Channel Toggle
  const radioOnline = document.getElementById('radio-channel-online');
  const radioCounter = document.getElementById('radio-channel-counter');
  const sectionFulfillment = document.getElementById('section-fulfillment-select');
  const fulfillmentSelect = document.getElementById('order-fulfillment-type');
  const sectionDeliveryAddress = document.getElementById('section-delivery-address');

  function updateChannelUI() {
    if (radioCounter.checked) {
      if (sectionFulfillment) sectionFulfillment.style.display = 'none';
      if (sectionDeliveryAddress) sectionDeliveryAddress.style.display = 'none';
    } else {
      if (sectionFulfillment) sectionFulfillment.style.display = 'block';
      if (fulfillmentSelect && fulfillmentSelect.value === 'delivery') {
        if (sectionDeliveryAddress) sectionDeliveryAddress.style.display = 'block';
      } else {
        if (sectionDeliveryAddress) sectionDeliveryAddress.style.display = 'none';
      }
    }
  }

  if (radioOnline && radioCounter) {
    radioOnline.addEventListener('change', updateChannelUI);
    radioCounter.addEventListener('change', updateChannelUI);
  }

  if (fulfillmentSelect) {
    fulfillmentSelect.addEventListener('change', () => {
      if (fulfillmentSelect.value === 'delivery') {
        if (sectionDeliveryAddress) sectionDeliveryAddress.style.display = 'block';
      } else {
        if (sectionDeliveryAddress) sectionDeliveryAddress.style.display = 'none';
      }
    });
  }

  // Submit Order
  const btnSubmit = document.getElementById('btn-submit-shop-order');
  const errorBox = document.getElementById('shop-order-error');
  const errorMsg = document.getElementById('shop-error-msg');

  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      if (errorBox) errorBox.style.display = 'none';

      if (cart.length === 0) {
        if (errorBox) {
          errorMsg.textContent = "Your cart is empty. Please select products from the unified shelf.";
          errorBox.style.display = 'flex';
        }
        return;
      }

      const customerName = document.getElementById('customer-name-input').value.trim();
      if (!customerName) {
        if (errorBox) {
          errorMsg.textContent = "Please enter customer / recipient name.";
          errorBox.style.display = 'flex';
        }
        return;
      }

      const isOnline = radioOnline.checked;
      const fulfillment = isOnline && fulfillmentSelect ? fulfillmentSelect.value : 'immediate';
      let deliveryAddress = '';

      if (isOnline && fulfillment === 'delivery') {
        deliveryAddress = document.getElementById('delivery-address-input').value.trim();
        if (!deliveryAddress) {
          if (errorBox) {
            errorMsg.textContent = "Home delivery address is required for doorstep delivery.";
            errorBox.style.display = 'flex';
          }
          return;
        }
      }

      // Check and Deduct Stock from Shared Shelf
      for (const item of cart) {
        const product = productsCache.find(p => String(p.id) === String(item.id));
        if (!product || product.stock < item.qty) {
          if (errorBox) {
            errorMsg.textContent = `Insufficient stock for '${item.name}'. Only ${product ? product.stock : 0} available on the unified shelf.`;
            errorBox.style.display = 'flex';
          }
          return;
        }
      }

      try {
        let orderRef = `CC-SO-00${String(getShopOrders().length + 1).padStart(2, '0')}`;

        // Real Odoo Backend API Call
        if (window.ClubAPI) {
          const apiRes = await window.ClubAPI.createShopOrder({
            channel: isOnline ? 'online' : 'counter',
            fulfillment: fulfillment,
            customer_name: customerName,
            delivery_address: deliveryAddress,
            items: cart.map(i => ({ product_id: i.id, qty: i.qty }))
          });
          if (apiRes && apiRes.reference) {
            orderRef = apiRes.reference;
          }
        }

        // Atomically deduct locally for immediate UI reactivity
        for (const item of cart) {
          const product = productsCache.find(p => String(p.id) === String(item.id));
          if (product) product.stock -= item.qty;
        }

        const orders = getShopOrders();
        const rawAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const memberDisc = getActiveMemberDiscount();
        const discAmount = (rawAmount * memberDisc.percent) / 100.0;
        const totalAmount = rawAmount - discAmount;
        const fulfillmentLabel = !isOnline 
          ? 'Immediate Counter Handover' 
          : fulfillment === 'pickup' 
            ? 'Collect at Club (Click & Collect)' 
            : `Home Delivery (${deliveryAddress})`;

        const newOrder = {
          id: orderRef,
          memberId: memberDisc.member ? (memberDisc.member.id || memberDisc.member.member_id) : 'GUEST',
          channel: isOnline ? 'online' : 'counter',
          customer: customerName,
          fulfillment: fulfillmentLabel,
          items: [...cart],
          total: totalAmount,
          state: !isOnline ? 'completed' : 'confirmed',
          date: '2026-10-03'
        };

        orders.unshift(newOrder);
        if (window.ClubDataStore) {
          window.ClubDataStore.saveProducts(productsCache);
          window.ClubDataStore.saveShopOrders(orders);
        }

        cart = [];

        renderCatalog();
        renderCart();
        renderShopOrders();

        // Show Confirmation Modal
        const modal = document.getElementById('modal-shop-confirmation');
        document.getElementById('confirm-shop-id').textContent = orderRef;
        document.getElementById('confirm-shop-channel').textContent = isOnline ? 'Online (Sofa Order)' : 'Counter Purchase';
        document.getElementById('confirm-shop-fulfillment').textContent = fulfillmentLabel;
        document.getElementById('confirm-shop-customer').textContent = customerName;
        document.getElementById('confirm-shop-total').textContent = `₹ ${totalAmount.toLocaleString()}`;

        if (modal) {
          modal.classList.add('is-open');
          document.body.style.overflow = 'hidden';
        }
      } catch (err) {
        if (errorBox) {
          errorMsg.textContent = err.message;
          errorBox.style.display = 'flex';
        }
      }
    });
  }

  // Check member on load
  renderShopMemberBanner();

  // Expose globally
  window.renderShopMemberBanner = renderShopMemberBanner;
});

// ==========================================
// ADD PRODUCT MODAL, IMAGE PRESETS & LIVE PREVIEW
// ==========================================
window.openShopAddProductModal = function() {
  const modal = document.getElementById('modal-shop-new-product');
  if (modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
};

window.setShopImagePreset = function(presetKey) {
  const url = CATEGORY_DEFAULT_IMAGES[presetKey] || CATEGORY_DEFAULT_IMAGES.rackets;
  const input = document.getElementById('shop-new-prod-image');
  if (input) input.value = url;
  updateShopImagePreview(url);
};

window.updateShopImagePreview = function(url) {
  const imgEl = document.getElementById('shop-new-prod-preview-img');
  const placeholderEl = document.getElementById('shop-new-prod-preview-placeholder');
  if (!imgEl || !placeholderEl) return;
  if (url && url.trim()) {
    imgEl.src = url.trim();
    imgEl.style.display = 'block';
    placeholderEl.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    placeholderEl.style.display = 'block';
  }
};

window.handleCreateShopProduct = function(event) {
  event.preventDefault();
  const name = document.getElementById('shop-new-prod-name')?.value?.trim();
  const category = document.getElementById('shop-new-prod-category')?.value || 'rackets';
  const price = parseFloat(document.getElementById('shop-new-prod-price')?.value || 0);
  const stock = parseInt(document.getElementById('shop-new-prod-stock')?.value || 0);
  const minAlert = parseInt(document.getElementById('shop-new-prod-alert')?.value || 4);
  const desc = document.getElementById('shop-new-prod-desc')?.value?.trim() || 'Premium sports equipment on shared shelf.';
  let image = document.getElementById('shop-new-prod-image')?.value?.trim();
  if (!image) {
    image = CATEGORY_DEFAULT_IMAGES[category] || CATEGORY_DEFAULT_IMAGES.rackets;
  }

  if (!name || price <= 0) {
    alert('Please enter a valid product name and price.');
    return;
  }

  const products = window.ClubDataStore ? window.ClubDataStore.getProducts() : [];
  const skuPrefix = category === 'rackets' ? 'RCK' : category === 'balls' ? 'BAL' : category === 'shoes' ? 'SHOE' : category === 'apparel' ? 'APP' : 'ACC';
  const newSku = `CC-${skuPrefix}-0${products.length + 1}`;

  const newProd = {
    id: `p${products.length + 1}`,
    sku: newSku,
    name,
    category,
    price,
    stock,
    minAlert,
    desc,
    image
  };

  products.push(newProd);
  if (window.ClubDataStore) {
    window.ClubDataStore.saveProducts(products);
  }

  const modal = document.getElementById('modal-shop-new-product');
  if (modal) modal.classList.remove('is-open');
  document.body.style.overflow = '';
  document.getElementById('form-shop-create-product')?.reset();
  updateShopImagePreview('');

  renderCatalog();
  alert(`✓ Product "${name}" (${newSku}) has been added to the shared shelf!`);
};


