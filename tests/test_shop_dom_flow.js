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

async function testShopOrderFlow() {
  console.log('='.repeat(75));
  console.log('CHAMPIONS CLUB — PRO SHOP PURCHASE FLOW & STOCK REDUCTION TEST');
  console.log('='.repeat(75));

  // 1. Fetch current catalog
  const catalogRes = await postJson('/champions_club/shop/products', {});
  assert(catalogRes.success, 'Fetch products should succeed');
  const racket = catalogRes.products.find(p => p.sku === 'CC-RCK-01' || p.id === 'p1');
  assert(racket, 'Pro Tour Carbon Tennis Racket must exist');
  const initialStock = racket.stock;
  console.log(`1. Initial stock for '${racket.name}': ${initialStock} units`);

  // 2. Buy 1 unit online with Gold Member discount
  console.log(`2. Placing online sofa order for 1 unit by member 'ABC' (Click & Collect)...`);
  const orderRes = await postJson('/champions_club/shop/order/create', {
    channel: 'online',
    fulfillment: 'pickup',
    customer_name: 'ABC',
    member_id: 'ABC',
    items: [{
      product_id: racket.id,
      id: racket.id,
      sku: racket.sku,
      name: racket.name,
      price: racket.price,
      qty: 1
    }]
  });

  assert(orderRes.success, `Order creation should succeed: ${orderRes.error || ''}`);
  assert(orderRes.reference, 'Order reference must be generated');
  console.log(`  ✓ Order confirmed! Reference: ${orderRes.reference}`);
  console.log(`  ✓ Order Total (after Gold Member 15% discount): ₹ ${orderRes.order.total}`);

  // 3. Verify stock in database and in products list decreased
  const afterRes = await postJson('/champions_club/shop/products', {});
  const afterRacket = afterRes.products.find(p => p.sku === 'CC-RCK-01' || p.id === 'p1');
  console.log(`3. Verified updated shelf stock: ${afterRacket.stock} units (Expected: ${initialStock - 1})`);
  assert.strictEqual(afterRacket.stock, initialStock - 1, `Stock must be decreased to ${initialStock - 1}`);
  console.log(`  ✓ PASS: Stock successfully reduced on shared shelf!`);

  // 4. Place a second order for 3 tournament tennis balls
  const balls = afterRes.products.find(p => p.sku === 'CC-BAL-01' || p.id === 'p3');
  assert(balls, 'Tennis balls product must exist');
  const ballsInitialStock = balls.stock;
  console.log(`4. Initial stock for '${balls.name}': ${ballsInitialStock} units`);

  console.log(`   Placing Counter Sale for 3 units of '${balls.name}'...`);
  const ballsOrderRes = await postJson('/champions_club/shop/order/create', {
    channel: 'counter',
    fulfillment: 'immediate',
    customer_name: 'Walk-in Member',
    member_id: null,
    items: [{
      product_id: balls.id,
      id: balls.id,
      sku: balls.sku,
      name: balls.name,
      price: balls.price,
      qty: 3
    }]
  });

  assert(ballsOrderRes.success, 'Counter order should succeed');
  const ballsAfterRes = await postJson('/champions_club/shop/products', {});
  const updatedBalls = ballsAfterRes.products.find(p => p.sku === 'CC-BAL-01' || p.id === 'p3');
  console.log(`   Updated stock for '${updatedBalls.name}': ${updatedBalls.stock} units (Expected: ${ballsInitialStock - 3})`);
  assert.strictEqual(updatedBalls.stock, ballsInitialStock - 3, `Stock must be decreased to ${ballsInitialStock - 3}`);
  console.log(`  ✓ PASS: Counter purchase stock reduction verified!`);

  console.log('='.repeat(75));
  console.log('ALL PRO SHOP INVENTORY REDUCTION TESTS PASSED 100%! ✓');
  console.log('='.repeat(75));
}

testShopOrderFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
