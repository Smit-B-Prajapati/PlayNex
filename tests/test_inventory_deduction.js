const http = require('http');
const assert = require('assert');

function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runInventoryDeductionTests() {
  console.log('='.repeat(75));
  console.log('CHAMPIONS CLUB — REAL-TIME INVENTORY DEDUCTION & STOCK RESTORATION SUITE');
  console.log('='.repeat(75));

  // 1. Fetch current products
  const initialRes = await postJson('/champions_club/shop/products', {});
  assert(initialRes.success, 'Fetch products must succeed');
  const products = initialRes.products;
  const targetProduct = products.find(p => p.sku === 'CC-RCK-01' || p.id === 'p1');
  assert(targetProduct, 'Target product CC-RCK-01 must exist');
  const initialStock = targetProduct.stock;
  console.log(`1. Initial stock for '${targetProduct.name}' (${targetProduct.sku}): ${initialStock} units`);

  // 2. Buy 2 units
  const orderQty = 2;
  console.log(`2. Placing order for ${orderQty} units...`);
  const orderRes = await postJson('/champions_club/shop/order/create', {
    channel: 'counter',
    customer_name: 'Inventory Test Buyer',
    items: [{ product_id: targetProduct.id, sku: targetProduct.sku, name: targetProduct.name, qty: orderQty, price: targetProduct.price }]
  });

  assert(orderRes.success, 'Order creation must succeed');
  assert(orderRes.reference, 'Order must have a reference');
  console.log(`  ✓ Order created: ${orderRes.reference}`);

  // 3. Verify stock decreased
  const afterRes = await postJson('/champions_club/shop/products', {});
  const afterProduct = afterRes.products.find(p => p.sku === targetProduct.sku || p.id === targetProduct.id);
  const expectedStock = initialStock - orderQty;
  console.log(`3. Updated stock on shared shelf: ${afterProduct.stock} units (Expected: ${expectedStock})`);
  assert.strictEqual(afterProduct.stock, expectedStock, `Stock must be decreased from ${initialStock} to ${expectedStock}`);
  console.log(`  ✓ PASS: Stock successfully deducted by ${orderQty} units!`);

  // 4. Test Insufficient Stock Protection
  console.log(`4. Testing excessive stock purchase protection (requesting 999 units)...`);
  const excessiveRes = await postJson('/champions_club/shop/order/create', {
    channel: 'online',
    customer_name: 'Overbuy User',
    items: [{ product_id: targetProduct.id, qty: 999, price: targetProduct.price }]
  });
  assert(!excessiveRes.success, 'Excessive purchase must fail');
  assert(excessiveRes.error && excessiveRes.error.includes('Insufficient stock'), 'Must return Insufficient stock error');
  console.log(`  ✓ PASS: Over-order blocked: "${excessiveRes.error}"`);

  // 5. Cancel the order and verify stock restoration
  console.log(`5. Cancelling order ${orderRes.reference} and verifying stock restoration...`);
  const cancelRes = await postJson('/champions_club/shop/order/cancel', {
    order_id: orderRes.reference
  });
  assert(cancelRes.success, 'Order cancellation must succeed');

  const restoredRes = await postJson('/champions_club/shop/products', {});
  const restoredProduct = restoredRes.products.find(p => p.sku === targetProduct.sku || p.id === targetProduct.id);
  console.log(`  Restored stock: ${restoredProduct.stock} units (Expected: ${initialStock})`);
  assert.strictEqual(restoredProduct.stock, initialStock, `Stock must be restored back to ${initialStock}`);
  console.log(`  ✓ PASS: Stock restored back to original shelf balance!`);

  console.log('='.repeat(75));
  console.log('ALL INVENTORY DEDUCTION & RESTORATION AUDITS PASSED 100%! ✓');
  console.log('='.repeat(75));
}

runInventoryDeductionTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
