# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Bar & Cafeteria POS Test Suite
Validates:
1. Create Order: Ticket generation and initialization
2. Add Items: Item selection and quantity accumulation
3. Assign Table: Table occupancy tracking (Available -> Occupied)
4. Member Discount: Dynamic tier discount calculation (Gold 15%, Silver 10%, Junior 5%)
5. Non-Member / Walk-in: Full standard pricing (0% discount)
6. Cash Payment Method
7. Card Payment Method
8. UPI / Digital QR Payment Method
9. Close Order & Settle Tab: Release table back to Available
10. Verify Revenue: Daily bar revenue calculated strictly from actual transaction records
"""

import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class ValidationError(Exception):
    pass

class MockMember:
    def __init__(self, id, name, bar_discount_percent, has_active_benefits=True):
        self.id = id
        self.name = name
        self.bar_discount_percent = float(bar_discount_percent)
        self.has_active_benefits = has_active_benefits

class MockTable:
    def __init__(self, id, name, number=1):
        self.id = id
        self.name = name
        self.table_number = number
        self.state = 'available'  # 'available', 'occupied', 'reserved'

class MockItem:
    def __init__(self, id, name, category, price):
        self.id = id
        self.name = name
        self.category = category  # 'beverage', 'food', 'nutrition'
        self.price = float(price)

class BarPOSEngine:
    def __init__(self):
        self.orders = []
        self.tabs = []
        self.shifts = []
        self._next_order_id = 1
        self._next_tab_id = 1

    def create_order(self, customer_type='walkin', table=None, member=None, guest_name=None):
        """Creates a new bar order in draft state and binds to table."""
        if customer_type == 'member' and not member:
            raise ValidationError("Member record must be provided for member order.")
        
        # Calculate discount from configured membership rules
        discount_pct = 0.0
        if customer_type == 'member' and member and member.has_active_benefits:
            discount_pct = member.bar_discount_percent

        if table:
            table.state = 'occupied'

        order = {
            'id': self._next_order_id,
            'name': f"CC-BAR-{self._next_order_id:04d}",
            'customer_type': customer_type,
            'member': member,
            'guest_name': guest_name or (member.name if member else 'Walk-in Guest'),
            'table': table,
            'items': [],
            'subtotal': 0.0,
            'discount_percent': discount_pct,
            'discount_amount': 0.0,
            'amount_total': 0.0,
            'payment_method': None,
            'state': 'draft'
        }
        self.orders.append(order)
        self._next_order_id += 1
        return order

    def add_item_to_order(self, order, item, qty=1):
        """Adds menu item to order and recalculates line items and totals."""
        if order['state'] not in ['draft', 'confirmed']:
            raise ValidationError("Cannot add items to closed/paid orders.")
        if qty <= 0:
            raise ValidationError("Item quantity must be positive.")

        order['items'].append({'item': item, 'qty': qty, 'unit_price': item.price, 'subtotal': item.price * qty})
        
        # Recompute totals
        subtotal = sum(i['subtotal'] for i in order['items'])
        discount_amt = (subtotal * order['discount_percent']) / 100.0 if order['discount_percent'] > 0 else 0.0
        order['subtotal'] = subtotal
        order['discount_amount'] = discount_amt
        order['amount_total'] = subtotal - discount_amt
        return order

    def process_payment_and_close(self, order, payment_method):
        """Processes payment via Cash, Card, or UPI, closes order and frees table."""
        if payment_method not in ['cash', 'card', 'upi']:
            raise ValidationError(f"Unsupported payment method '{payment_method}'. Must be Cash, Card, or UPI.")
        if not order['items']:
            raise ValidationError("Cannot close an empty order.")

        order['payment_method'] = payment_method
        order['state'] = 'paid'

        # Release table if no other active orders on table
        if order['table']:
            other_active = any(
                o['id'] != order['id'] and o['table'] and o['table'].id == order['table'].id and o['state'] not in ['paid', 'cancelled']
                for o in self.orders
            )
            if not other_active:
                order['table'].state = 'available'

        return order

    def open_member_tab(self, member, table=None):
        """Opens a member running tab."""
        if not member.has_active_benefits:
            raise ValidationError("Cannot open a running tab for an inactive or expired membership.")

        if table:
            table.state = 'occupied'

        tab = {
            'id': self._next_tab_id,
            'name': f"CC-TAB-{self._next_tab_id:04d}",
            'member': member,
            'table': table,
            'discount_percent': member.bar_discount_percent,
            'orders': [],
            'subtotal': 0.0,
            'discount_amount': 0.0,
            'amount_total': 0.0,
            'payment_method': None,
            'state': 'open'
        }
        self.tabs.append(tab)
        self._next_tab_id += 1
        return tab

    def add_order_to_tab(self, tab, items):
        """Appends drinks/food rounds to an open tab."""
        if tab['state'] != 'open':
            raise ValidationError("Cannot add orders to a closed tab.")

        sub = sum(item.price * qty for item, qty in items)
        order_entry = {
            'id': self._next_order_id,
            'name': f"CC-BAR-{self._next_order_id:04d}",
            'tab_id': tab['id'],
            'member': tab['member'],
            'table': tab['table'],
            'items': [{'item': item, 'qty': qty, 'subtotal': item.price * qty} for item, qty in items],
            'subtotal': sub,
            'state': 'tabbed'
        }
        self.orders.append(order_entry)
        self._next_order_id += 1
        tab['orders'].append(order_entry)

        # Recalculate tab total
        tab_sub = sum(o['subtotal'] for o in tab['orders'])
        tab_disc = (tab_sub * tab['discount_percent']) / 100.0 if tab['discount_percent'] > 0 else 0.0
        tab['subtotal'] = tab_sub
        tab['discount_amount'] = tab_disc
        tab['amount_total'] = tab_sub - tab_disc
        return order_entry

    def settle_and_close_tab(self, tab, payment_method):
        """Settles member tab with Cash, Card, or UPI and releases table."""
        if payment_method not in ['cash', 'card', 'upi']:
            raise ValidationError("Settlement payment method must be Cash, Card, or UPI.")

        tab['payment_method'] = payment_method
        tab['state'] = 'closed'
        for o in tab['orders']:
            o['state'] = 'paid'
            o['payment_method'] = payment_method

        if tab['table']:
            tab['table'].state = 'available'
        return tab

    def calculate_daily_revenue(self):
        """Calculates revenue strictly from active, completed transactions."""
        cash = 0.0
        card = 0.0
        upi = 0.0

        for o in self.orders:
            if o.get('tab_id'):
                continue  # Avoid double counting; accounted for in tab settlement
            if o['state'] == 'paid':
                if o['payment_method'] == 'cash':
                    cash += o['amount_total']
                elif o['payment_method'] == 'card':
                    card += o['amount_total']
                elif o['payment_method'] == 'upi':
                    upi += o['amount_total']

        for t in self.tabs:
            if t['state'] == 'closed':
                if t['payment_method'] == 'cash':
                    cash += t['amount_total']
                elif t['payment_method'] == 'card':
                    card += t['amount_total']
                elif t['payment_method'] == 'upi':
                    upi += t['amount_total']

        return {
            'cash': cash,
            'card': card,
            'upi': upi,
            'total': cash + card + upi
        }


def run_tests():
    print("=" * 80)
    print("CHAMPIONS CLUB — COMPLETE BAR & CAFETERIA POS TEST SUITE")
    print("=" * 80)

    # Master Entities (Configurable Plans & Demo Menu Items clearly labeled)
    member_gold = MockMember(101, "David Vance (Gold)", bar_discount_percent=15.0)
    member_silver = MockMember(102, "Elena Rostova (Silver)", bar_discount_percent=10.0)
    
    table_1 = MockTable(1, "Courtside Table 1", number=1)
    table_2 = MockTable(2, "Veranda Table 2", number=2)

    item_shake = MockItem(1, "[DEMO DATA] Post-Match Whey Protein Shake", "nutrition", 280.0)
    item_sandwich = MockItem(2, "[DEMO DATA] Club Sandwich", "food", 320.0)
    item_lime = MockItem(3, "[DEMO DATA] Fresh Lime Soda", "beverage", 120.0)

    engine = BarPOSEngine()
    results = []

    def report_test(num, title, input_desc, expected_desc, actual_desc, status):
        print(f"\n[TEST {num}] {title}")
        print(f"  INPUT:    {input_desc}")
        print(f"  EXPECTED: {expected_desc}")
        print(f"  ACTUAL:   {actual_desc}")
        print(f"  STATUS:   {status}")
        results.append((f"TEST {num}", title, status))

    # -------------------------------------------------------------------------
    # TEST 1: Create Order
    # -------------------------------------------------------------------------
    o1 = engine.create_order(customer_type='walkin', guest_name="Alex Smith")
    actual_1 = f"Order Created: {o1['name']}, Customer: '{o1['guest_name']}', State: {o1['state']}"
    passed_1 = (o1['name'].startswith("CC-BAR") and o1['state'] == 'draft')
    report_test(
        1, "Create Order",
        "Customer: Alex Smith (Walk-in), Type: Direct Order",
        "Draft order ticket initialized with unique sequence reference",
        actual_1,
        "PASS" if passed_1 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 2: Add Items
    # -------------------------------------------------------------------------
    engine.add_item_to_order(o1, item_lime, qty=2)
    actual_2 = f"Items Added: 2x {item_lime.name} @ ₹ {item_lime.price:.2f} each -> Subtotal: ₹ {o1['subtotal']:.2f}"
    passed_2 = (len(o1['items']) == 1 and o1['subtotal'] == 240.0)
    report_test(
        2, "Add Items",
        f"Item: 2x '{item_lime.name}' (Price: ₹ 120.00)",
        "Order subtotal updated to ₹ 240.00",
        actual_2,
        "PASS" if passed_2 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 3: Assign Table & Verify Occupancy
    # -------------------------------------------------------------------------
    init_table_state = table_1.state
    o2 = engine.create_order(customer_type='member', member=member_gold, table=table_1)
    table_occupied_state = table_1.state
    actual_3 = f"Table 1 Initial: {init_table_state} -> Assigned to Order {o2['name']} -> Table State: {table_occupied_state}"
    passed_3 = (init_table_state == 'available' and table_occupied_state == 'occupied')
    report_test(
        3, "Assign Table",
        f"Table: {table_1.name}, Order: {o2['name']}",
        "Table state transitions from Available to Occupied",
        actual_3,
        "PASS" if passed_3 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 4: Member Discount (Automatic Tier Calculation)
    # -------------------------------------------------------------------------
    engine.add_item_to_order(o2, item_sandwich, qty=1)  # 320
    engine.add_item_to_order(o2, item_shake, qty=1)     # 280 -> subtotal = 600
    # Gold member gets 15% discount: 600 * 0.15 = 90 -> total = 510
    actual_4 = f"Subtotal: ₹ {o2['subtotal']:.2f}, Plan: Gold (15%), Discount: - ₹ {o2['discount_amount']:.2f}, Net Due: ₹ {o2['amount_total']:.2f}"
    passed_4 = (o2['discount_percent'] == 15.0 and o2['discount_amount'] == 90.0 and o2['amount_total'] == 510.0)
    report_test(
        4, "Member Discount",
        f"Member: {member_gold.name}, Subtotal: ₹ 600.00, Tier: Gold (Configured 15% bar discount)",
        "Automatic discount of 15% (₹ 90.00) applied; Total due = ₹ 510.00",
        actual_4,
        "PASS" if passed_4 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 5: Non-Member / Walk-in Pricing (0% Discount)
    # -------------------------------------------------------------------------
    actual_5 = f"Customer: {o1['guest_name']} (Walk-in), Subtotal: ₹ {o1['subtotal']:.2f}, Discount: {o1['discount_percent']}%, Total Due: ₹ {o1['amount_total']:.2f}"
    passed_5 = (o1['discount_percent'] == 0.0 and o1['amount_total'] == 240.0)
    report_test(
        5, "Non-Member Pricing",
        "Walk-in Guest, Subtotal: ₹ 240.00",
        "Standard retail pricing with 0% discount applied; Total due = ₹ 240.00",
        actual_5,
        "PASS" if passed_5 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 6: Cash Payment Method
    # -------------------------------------------------------------------------
    engine.process_payment_and_close(o1, payment_method='cash')
    actual_6 = f"Order {o1['name']} Paid via CASH: Amount ₹ {o1['amount_total']:.2f}, State: {o1['state']}"
    passed_6 = (o1['state'] == 'paid' and o1['payment_method'] == 'cash')
    report_test(
        6, "Cash Payment",
        f"Order: {o1['name']}, Amount: ₹ 240.00, Method: Cash",
        "Transaction settled via Cash; Order state marked 'paid'",
        actual_6,
        "PASS" if passed_6 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 7: Card Payment Method
    # -------------------------------------------------------------------------
    o3 = engine.create_order(customer_type='member', member=member_silver)
    engine.add_item_to_order(o3, item_sandwich, qty=1)  # 320 - 10% (32) = 288
    engine.process_payment_and_close(o3, payment_method='card')
    actual_7 = f"Order {o3['name']} Paid via CARD: Subtotal ₹ {o3['subtotal']:.2f}, Disc (10%): - ₹ {o3['discount_amount']:.2f}, Paid: ₹ {o3['amount_total']:.2f}, State: {o3['state']}"
    passed_7 = (o3['state'] == 'paid' and o3['payment_method'] == 'card' and o3['amount_total'] == 288.0)
    report_test(
        7, "Card Payment",
        f"Member: {member_silver.name}, Amount: ₹ 288.00, Method: Card",
        "Transaction settled via Card; Order state marked 'paid'",
        actual_7,
        "PASS" if passed_7 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 8: UPI / Digital Method
    # -------------------------------------------------------------------------
    engine.process_payment_and_close(o2, payment_method='upi')
    actual_8 = f"Order {o2['name']} Paid via UPI QR/VPA: Amount ₹ {o2['amount_total']:.2f}, State: {o2['state']}"
    passed_8 = (o2['state'] == 'paid' and o2['payment_method'] == 'upi' and o2['amount_total'] == 510.0)
    report_test(
        8, "UPI Payment",
        f"Order: {o2['name']}, Amount: ₹ 510.00, Method: UPI",
        "Transaction settled via UPI digital payment; Order state marked 'paid'",
        actual_8,
        "PASS" if passed_8 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 9: Running Tab Accumulation, Close Order & Free Table
    # -------------------------------------------------------------------------
    tab = engine.open_member_tab(member_gold, table=table_2)
    # Round 1: 2 Shakes (560)
    engine.add_order_to_tab(tab, [(item_shake, 2)])
    # Round 2: 2 Sandwiches (640)
    engine.add_order_to_tab(tab, [(item_sandwich, 2)])
    # Total subtotal = 1200. Gold 15% disc = 180. Net total = 1020.
    table_2_state_during = table_2.state
    engine.settle_and_close_tab(tab, payment_method='card')
    table_2_state_after = table_2.state
    actual_9 = f"Tab {tab['name']} accumulated ₹ {tab['subtotal']:.2f}, Gold Disc (15%): - ₹ {tab['discount_amount']:.2f}, Settled: ₹ {tab['amount_total']:.2f} via CARD. Table 2 State: {table_2_state_during} -> {table_2_state_after}"
    passed_9 = (tab['state'] == 'closed' and tab['amount_total'] == 1020.0 and table_2_state_after == 'available')
    report_test(
        9, "Close Order & Settle Tab",
        f"Tab: {tab['name']} (2 rounds ordered), Settlement: Card, Table: {table_2.name}",
        "Tab settled, all round orders closed, and Table freed back to Available",
        actual_9,
        "PASS" if passed_9 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST 10: Verify Revenue
    # -------------------------------------------------------------------------
    rev = engine.calculate_daily_revenue()
    # Expected Breakdown:
    # Cash: o1 (240.00)
    # Card: o3 (288.00) + tab (1020.00) = 1308.00
    # UPI:  o2 (510.00)
    # Total = 240 + 1308 + 510 = 2058.00
    actual_10 = f"Cash: ₹ {rev['cash']:.2f}, Card: ₹ {rev['card']:.2f}, UPI: ₹ {rev['upi']:.2f} -> Total Daily Bar Revenue: ₹ {rev['total']:.2f}"
    passed_10 = (rev['cash'] == 240.0 and rev['card'] == 1308.0 and rev['upi'] == 510.0 and rev['total'] == 2058.0)
    report_test(
        10, "Verify Revenue",
        "Calculate total revenue from actual completed POS orders and closed tabs",
        "Exact breakdown: Cash ₹ 240.00, Card ₹ 1308.00, UPI ₹ 510.00, Total ₹ 2058.00",
        actual_10,
        "PASS" if passed_10 else "FAIL"
    )

    # -------------------------------------------------------------------------
    # SUMMARY TABLE
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("BAR & CAFETERIA POS VALIDATION SUMMARY (TESTS 1 TO 10)")
    print("=" * 80)
    print(f"{'Test':<8} | {'Description':<45} | {'Status'}")
    print("-" * 80)
    for code, title, status in results:
        print(f"{code:<8} | {title:<45} | {status}")
    print("=" * 80)
    assert all(st == "PASS" for _, _, st in results), "All tests must pass!"
    print(f"✓ ALL {len(results)} BAR POS TESTS COMPLETED WITH 100% SUCCESS!\n")

if __name__ == '__main__':
    run_tests()
