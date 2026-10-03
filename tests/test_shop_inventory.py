# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Pro Shop & Unified Shared Inventory Test Suite
Validates the 9 sequential inventory and sales requirements:
1. Create product (Name, Category from problem statement, List Price, Alert Level, Active)
2. Add stock (Inventory update to unified shelf)
3. Counter sale (In-club walk-in purchase deduction)
4. Verify stock (Stock becomes 10 - 2 = 8)
5. Online order (Home/Sofa purchase drawing from EXACT SAME stock record)
6. Verify same stock (Stock becomes 8 - 3 = 5)
7. Attempt excess order (Attempting to order more than available stock is rejected)
8. Low-stock condition (Stock <= threshold triggers low-stock awareness alert)
9. Cancel/refund behavior (Cancelled order restores inventory back to shared shelf)
"""

import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class ValidationError(Exception):
    pass

class MockProduct:
    def __init__(self, id, name, category, price, alert_level=5, initial_stock=0.0, default_code=''):
        # Validate Category against problem statement: Rackets, Balls, Shoes, Accessories, Apparel
        valid_categories = ['rackets', 'balls', 'shoes', 'accessories', 'apparel']
        if category not in valid_categories:
            raise ValidationError(f"Invalid category '{category}'. Must be one of {valid_categories}.")

        self.id = id
        self.name = name
        self.default_code = default_code or f"CC-SKU-{id:03d}"
        self.category = category
        self.list_price = price
        self.qty_on_hand = float(initial_stock)
        self.min_stock_alert_level = float(alert_level)
        self.active = True

    @property
    def is_low_stock(self):
        """Dynamic low-stock awareness computation."""
        return self.qty_on_hand <= self.min_stock_alert_level

    def action_update_stock(self, new_qty):
        """Staff action to update unified physical inventory level."""
        if new_qty < 0:
            raise ValidationError("Stock on hand cannot be negative.")
        self.qty_on_hand = float(new_qty)
        return self.qty_on_hand


class ShopEngine:
    def __init__(self):
        self.orders = []
        self._next_id = 1

    def create_and_confirm_order(self, channel, fulfillment_type, customer_name, items, delivery_address=None, member_id=None):
        """
        Processes counter purchase or online order using the single unified shelf inventory.
        Items: list of (MockProduct, qty)
        """
        if fulfillment_type == 'delivery' and not delivery_address:
            raise ValidationError("Delivery Address is required for Home Delivery orders.")

        if not items:
            raise ValidationError("Cart cannot be empty.")

        # 1. Atomic Stock Validation on Unified Shelf
        for product, qty in items:
            if qty <= 0:
                raise ValidationError("Quantity must be strictly greater than zero.")
            if product.qty_on_hand < qty:
                raise ValidationError(
                    f"INSUFFICIENT_STOCK_ERROR: Product '{product.name}' only has {int(product.qty_on_hand)} units available on unified shelf. Requested: {int(qty)}."
                )

        # 2. Atomic Stock Deduction from Shared Shelf
        for product, qty in items:
            product.qty_on_hand -= float(qty)

        total_amount = sum(product.list_price * qty for product, qty in items)

        order_record = {
            'id': self._next_id,
            'name': f"CC-SO-{self._next_id:04d}",
            'channel': channel,  # 'counter' or 'online'
            'fulfillment_type': fulfillment_type,  # 'immediate', 'pickup', 'delivery'
            'customer_name': customer_name,
            'customer_type': 'member' if member_id else 'guest',
            'member_id': member_id,
            'delivery_address': delivery_address,
            'items': items,
            'total_amount': total_amount,
            'state': 'completed' if fulfillment_type == 'immediate' else 'confirmed'
        }
        self.orders.append(order_record)
        self._next_id += 1
        return order_record

    def cancel_order(self, order_id):
        """Cancels order and restores deducted inventory back to the unified shelf."""
        for o in self.orders:
            if o['id'] == order_id:
                if o['state'] in ['confirmed', 'ready', 'completed']:
                    for product, qty in o['items']:
                        product.qty_on_hand += float(qty)
                o['state'] = 'cancelled'
                return o
        raise ValueError(f"Order ID {order_id} not found.")


def run_tests():
    print("=" * 80)
    print("CHAMPIONS CLUB — PRO SHOP & UNIFIED INVENTORY TEST SUITE (1 TO 9)")
    print("=" * 80)

    engine = ShopEngine()
    results = []

    def report_test(num, title, input_desc, expected_desc, actual_desc, status):
        print(f"\n[TEST {num}] {title}")
        print(f"  INPUT:    {input_desc}")
        print(f"  EXPECTED: {expected_desc}")
        print(f"  ACTUAL:   {actual_desc}")
        print(f"  STATUS:   {status}")
        results.append((f"TEST {num}", title, status))

    # -------------------------------------------------------------------------
    # TEST 1: Create Product
    # -------------------------------------------------------------------------
    p_racket = MockProduct(
        id=1,
        name="Pro Tour Carbon Tennis Racket",
        category="rackets",
        price=8500.0,
        alert_level=5,
        initial_stock=0.0,
        default_code="CC-RCK-01"
    )
    actual_1 = f"Product Created: {p_racket.name} [SKU: {p_racket.default_code}], Category: {p_racket.category.title()}, Price: ₹ {p_racket.list_price:.2f}, Stock: {int(p_racket.qty_on_hand)}"
    passed_1 = (p_racket.name == "Pro Tour Carbon Tennis Racket" and p_racket.category == "rackets" and p_racket.qty_on_hand == 0.0)
    report_test(
        1, "Create Product",
        "Name: 'Pro Tour Carbon Tennis Racket', Category: 'rackets', Price: ₹ 8500.00, Min Alert: 5, Initial Stock: 0",
        "Product record created in catalog with stock=0, category='rackets', active=True",
        actual_1,
        "PASS" if passed_1 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 2: Add Stock
    # -------------------------------------------------------------------------
    p_racket.action_update_stock(10)
    actual_2 = f"Stock Updated: {p_racket.name} now has {int(p_racket.qty_on_hand)} units on the unified shelf"
    passed_2 = (p_racket.qty_on_hand == 10.0)
    report_test(
        2, "Add Stock",
        f"Product: {p_racket.name}, Action: action_update_stock(10)",
        "Unified shelf stock on hand updated to exactly 10 units",
        actual_2,
        "PASS" if passed_2 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 3: Counter Sale
    # -------------------------------------------------------------------------
    order_counter = engine.create_and_confirm_order(
        channel='counter',
        fulfillment_type='immediate',
        customer_name='Marcus Walk-in Guest',
        items=[(p_racket, 2)]
    )
    actual_3 = f"Counter Order {order_counter['name']} Confirmed: Sold 2 units at counter, Total: ₹ {order_counter['total_amount']:.2f}, Status: {order_counter['state']}"
    passed_3 = (order_counter['state'] == 'completed' and order_counter['channel'] == 'counter')
    report_test(
        3, "Counter Sale",
        f"Channel: Counter, Customer: Marcus Walk-in Guest, Item: 2x {p_racket.name}",
        "Order confirmed and fulfilled immediately; stock deducted from unified shelf",
        actual_3,
        "PASS" if passed_3 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 4: Verify Stock After Counter Sale
    # -------------------------------------------------------------------------
    actual_4 = f"Current Stock on Shelf: {int(p_racket.qty_on_hand)} units (Expected: 10 - 2 = 8)"
    passed_4 = (p_racket.qty_on_hand == 8.0)
    report_test(
        4, "Verify Stock After Counter Sale",
        "Query product.qty_on_hand after counter sale of 2 units",
        "Stock on hand = 8 units",
        actual_4,
        "PASS" if passed_4 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 5: Online Order (Home / Sofa Order)
    # -------------------------------------------------------------------------
    order_online = engine.create_and_confirm_order(
        channel='online',
        fulfillment_type='delivery',
        customer_name='David Vance (Gold Member)',
        items=[(p_racket, 3)],
        delivery_address='42 Champions Way, Suite 300, Sports City',
        member_id=101
    )
    actual_5 = f"Online Order {order_online['name']} Confirmed: 3 units for {order_online['customer_name']}, Delivery: '{order_online['delivery_address']}', Total: ₹ {order_online['total_amount']:.2f}"
    passed_5 = (order_online['state'] == 'confirmed' and order_online['channel'] == 'online')
    report_test(
        5, "Online Order",
        f"Channel: Online, Fulfillment: Home Delivery, Customer: David Vance, Item: 3x {p_racket.name}",
        "Online order placed from sofa draws from the EXACT SAME unified inventory shelf",
        actual_5,
        "PASS" if passed_5 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 6: Verify Same Stock After Online Order
    # -------------------------------------------------------------------------
    actual_6 = f"Current Shared Stock on Shelf: {int(p_racket.qty_on_hand)} units (Expected: 8 - 3 = 5)"
    passed_6 = (p_racket.qty_on_hand == 5.0)
    report_test(
        6, "Verify Same Stock",
        "Query product.qty_on_hand after online order of 3 units",
        "Shared stock on hand = 5 units (proving single unified inventory source)",
        actual_6,
        "PASS" if passed_6 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 7: Attempt Excess Order
    # -------------------------------------------------------------------------
    excess_caught = False
    actual_7 = ""
    try:
        engine.create_and_confirm_order(
            channel='online',
            fulfillment_type='pickup',
            customer_name='Excess Buyer',
            items=[(p_racket, 10)]
        )
    except ValidationError as e:
        excess_caught = True
        actual_7 = f"Rejection Caught: {e}"
    passed_7 = excess_caught and (p_racket.qty_on_hand == 5.0)
    report_test(
        7, "Attempt Excess Order",
        f"Attempt to order 10 units of {p_racket.name} when only {int(p_racket.qty_on_hand)} remain on unified shelf",
        "Server-side INSUFFICIENT_STOCK_ERROR blocking transaction; stock remains 5 units",
        actual_7,
        "PASS" if passed_7 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 8: Low-Stock Condition
    # -------------------------------------------------------------------------
    is_low_stock_flag = p_racket.is_low_stock
    actual_8 = f"Stock on hand: {int(p_racket.qty_on_hand)}, Alert Threshold: {int(p_racket.min_stock_alert_level)}, Is Low Stock Flag: {is_low_stock_flag}"
    passed_8 = (is_low_stock_flag is True)
    report_test(
        8, "Low-Stock Condition",
        f"Stock on hand ({int(p_racket.qty_on_hand)}) <= Alert Threshold ({int(p_racket.min_stock_alert_level)})",
        "Low-stock condition evaluated as TRUE; product flagged for staff inventory awareness",
        actual_8,
        "PASS" if passed_8 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 9: Cancel / Refund Stock Restoration Behavior
    # -------------------------------------------------------------------------
    stock_before_cancel = p_racket.qty_on_hand
    cancelled_order = engine.cancel_order(order_online['id'])
    stock_after_cancel = p_racket.qty_on_hand
    actual_9 = f"Order {cancelled_order['name']} Cancelled (State: {cancelled_order['state']}). Stock before: {int(stock_before_cancel)} -> Stock restored: {int(stock_after_cancel)} (+3 units)"
    passed_9 = (cancelled_order['state'] == 'cancelled' and stock_after_cancel == 8.0)
    report_test(
        9, "Cancel / Stock Restoration Behavior",
        f"Cancel Online Order {order_online['name']} (3 units of {p_racket.name})",
        "Order marked Cancelled; 3 units returned to unified shelf; stock restored from 5 to 8",
        actual_9,
        "PASS" if passed_9 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # SUMMARY TABLE
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("PRO SHOP & UNIFIED INVENTORY VALIDATION SUMMARY (TESTS 1 TO 9)")
    print("=" * 80)
    print(f"{'Test':<8} | {'Description':<45} | {'Status'}")
    print("-" * 80)
    for code, title, status in results:
        print(f"{code:<8} | {title:<45} | {status}")
    print("=" * 80)
    assert all(st == "PASS" for _, _, st in results), "All tests must pass!"
    print(f"✓ ALL {len(results)} SHOP & INVENTORY TESTS COMPLETED WITH 100% SUCCESS!\n")

if __name__ == '__main__':
    run_tests()
