# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Security & Access Control Unit Test Suite
Simulates ACL evaluations for each of the 6 operational roles:
1. Club Administrator
2. Front Desk / Staff
3. Sales / CRM Staff
4. Shop / Inventory Staff
5. Bar / POS Staff
6. Manager / Owner

Validates authorized actions and verifies that unauthorized actions are strictly rejected.
"""

import sys
import csv
import os

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class AccessDeniedError(Exception):
    pass

class ACLSecurityHarness:
    def __init__(self, csv_path):
        self.rules = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or row[0].startswith('#') or row[0] == 'id':
                    continue
                # row: [id, name, model_id, group_id, r, w, c, u]
                self.rules.append({
                    'id': row[0].strip(),
                    'model': row[2].strip().replace('model_', '').replace('_', '.'),
                    'group': row[3].strip(),
                    'read': int(row[4].strip()) == 1,
                    'write': int(row[5].strip()) == 1,
                    'create': int(row[6].strip()) == 1,
                    'unlink': int(row[7].strip()) == 1
                })

        # Group hierarchy
        self.hierarchy = {
            'group_club_front_desk': ['group_club_front_desk'],
            'group_club_crm_staff': ['group_club_crm_staff'],
            'group_club_shop_staff': ['group_club_shop_staff'],
            'group_club_bar_staff': ['group_club_bar_staff'],
            'group_club_manager': [
                'group_club_manager',
                'group_club_front_desk',
                'group_club_crm_staff',
                'group_club_shop_staff',
                'group_club_bar_staff'
            ],
            'group_club_administrator': [
                'group_club_administrator',
                'group_club_manager',
                'group_club_front_desk',
                'group_club_crm_staff',
                'group_club_shop_staff',
                'group_club_bar_staff'
            ]
        }

    def check_permission(self, role_group, model_name, operation):
        """
        operation: 'read', 'write', 'create', 'unlink'
        """
        implied_groups = self.hierarchy.get(role_group, [role_group])
        for rule in self.rules:
            if rule['model'] == model_name and rule['group'] in implied_groups:
                if rule[operation]:
                    return True
        return False

    def execute_action(self, role_group, model_name, operation, action_name):
        allowed = self.check_permission(role_group, model_name, operation)
        if not allowed:
            raise AccessDeniedError(f"Access Denied: Role '{role_group}' is not permitted to perform '{operation}' on '{model_name}' ({action_name}).")
        return True


def run_tests():
    print("=" * 80)
    print("CHAMPIONS CLUB — ROLE-BASED ACCESS CONTROL & SECURITY TEST SUITE")
    print("=" * 80)

    csv_path = os.path.join(os.path.dirname(__file__), '..', 'champions_club', 'security', 'ir.model.access.csv')
    harness = ACLSecurityHarness(csv_path)

    test_results = []

    def record_test(role, action, expected, actual, passed):
        test_results.append({
            'role': role,
            'action': action,
            'expected': expected,
            'actual': actual,
            'status': 'PASS' if passed else 'FAIL'
        })

    # -------------------------------------------------------------------------
    # 1. FRONT DESK / STAFF ROLE TESTS
    # -------------------------------------------------------------------------
    print("\n[ROLE 1] Front Desk / Staff:")
    # Authorized actions
    try:
        harness.execute_action('group_club_front_desk', 'club.member', 'read', 'View Member Profiles')
        harness.execute_action('group_club_front_desk', 'club.booking', 'create', 'Create Court Booking')
        harness.execute_action('group_club_front_desk', 'club.court', 'read', 'View Court Availability')
        print("  ✓ Authorized actions: Read members, create bookings, view court availability -> ALLOWED")
        record_test("Front Desk", "Read members & create bookings", "Allowed", "Allowed", True)
    except AccessDeniedError as e:
        record_test("Front Desk", "Read members & create bookings", "Allowed", str(e), False)

    # Unauthorized action: Delete Membership Plan Configuration
    blocked = False
    try:
        harness.execute_action('group_club_front_desk', 'club.membership.plan', 'unlink', 'Delete Plan')
    except AccessDeniedError:
        blocked = True
    print(f"  ✓ Unauthorized action (Delete Membership Plan) -> {'BLOCKED (Access Denied)' if blocked else 'ALLOWED (Security Leak!)'}")
    record_test("Front Desk", "Delete Membership Plan", "Access Denied", "Access Denied" if blocked else "Allowed", blocked)

    # -------------------------------------------------------------------------
    # 2. SALES / CRM STAFF ROLE TESTS
    # -------------------------------------------------------------------------
    print("\n[ROLE 2] Sales / CRM Staff:")
    try:
        harness.execute_action('group_club_crm_staff', 'club.enquiry', 'create', 'Create Visitor Enquiry')
        harness.execute_action('group_club_crm_staff', 'club.enquiry', 'write', 'Log Follow-up & Send Quote')
        harness.execute_action('group_club_crm_staff', 'club.member', 'create', 'Convert Lead to Member')
        print("  ✓ Authorized actions: Create enquiry, log follow-up, send quote, convert to member -> ALLOWED")
        record_test("CRM Staff", "Manage Enquiries & Convert Leads", "Allowed", "Allowed", True)
    except AccessDeniedError as e:
        record_test("CRM Staff", "Manage Enquiries & Convert Leads", "Allowed", str(e), False)

    # Unauthorized action: Modify Pro Shop Stock Directly
    blocked = False
    try:
        harness.execute_action('group_club_crm_staff', 'club.product', 'write', 'Modify Inventory Stock')
    except AccessDeniedError:
        blocked = True
    print(f"  ✓ Unauthorized action (Modify Inventory Stock) -> {'BLOCKED (Access Denied)' if blocked else 'ALLOWED'}")
    record_test("CRM Staff", "Modify Inventory Stock Directly", "Access Denied", "Access Denied" if blocked else "Allowed", blocked)

    # -------------------------------------------------------------------------
    # 3. SHOP / INVENTORY STAFF ROLE TESTS
    # -------------------------------------------------------------------------
    print("\n[ROLE 3] Shop / Inventory Staff:")
    try:
        harness.execute_action('group_club_shop_staff', 'club.product', 'write', 'Update Shelf Stock')
        harness.execute_action('group_club_shop_staff', 'club.shop.order', 'create', 'Create Counter Sales Order')
        print("  ✓ Authorized actions: Manage products, process sales orders -> ALLOWED")
        record_test("Shop Staff", "Manage Inventory & Sales Orders", "Allowed", "Allowed", True)
    except AccessDeniedError as e:
        record_test("Shop Staff", "Manage Inventory & Sales Orders", "Allowed", str(e), False)

    # Unauthorized action: Create Court Booking
    blocked = False
    try:
        harness.execute_action('group_club_shop_staff', 'club.booking', 'create', 'Create Court Booking')
    except AccessDeniedError:
        blocked = True
    print(f"  ✓ Unauthorized action (Create Court Booking) -> {'BLOCKED (Access Denied)' if blocked else 'ALLOWED'}")
    record_test("Shop Staff", "Create Court Booking", "Access Denied", "Access Denied" if blocked else "Allowed", blocked)

    # -------------------------------------------------------------------------
    # 4. BAR / POS STAFF ROLE TESTS
    # -------------------------------------------------------------------------
    print("\n[ROLE 4] Bar / POS Staff:")
    try:
        harness.execute_action('group_club_bar_staff', 'club.bar.order', 'create', 'Process Bar Order')
        harness.execute_action('group_club_bar_staff', 'club.bar.tab', 'create', 'Open Member Tab')
        harness.execute_action('group_club_bar_staff', 'club.bar.table', 'write', 'Update Table Seating')
        print("  ✓ Authorized actions: Create bar orders, open tabs, manage table status -> ALLOWED")
        record_test("Bar/POS Staff", "Create Orders & Manage Tabs", "Allowed", "Allowed", True)
    except AccessDeniedError as e:
        record_test("Bar/POS Staff", "Create Orders & Manage Tabs", "Allowed", str(e), False)

    # Unauthorized action: Delete Closed Shift Records
    blocked = False
    try:
        harness.execute_action('group_club_bar_staff', 'club.bar.shift', 'unlink', 'Delete Shift Records')
    except AccessDeniedError:
        blocked = True
    print(f"  ✓ Unauthorized action (Delete Closed Shift Records) -> {'BLOCKED (Access Denied)' if blocked else 'ALLOWED'}")
    record_test("Bar/POS Staff", "Delete Historical Shift Records", "Access Denied", "Access Denied" if blocked else "Allowed", blocked)

    # -------------------------------------------------------------------------
    # 5. MANAGER / OWNER ROLE TESTS
    # -------------------------------------------------------------------------
    print("\n[ROLE 5] Manager / Owner:")
    try:
        harness.execute_action('group_club_manager', 'club.dashboard', 'read', 'View Operational KPI Dashboard')
        harness.execute_action('group_club_manager', 'club.employee.leave', 'write', 'Approve Employee Leave')
        harness.execute_action('group_club_manager', 'club.bar.shift', 'write', 'Reconcile Daily Shift Revenue')
        print("  ✓ Authorized actions: Executive dashboard, leave approvals, shift closing reconciliations -> ALLOWED")
        record_test("Manager/Owner", "Dashboard & Shift Reconciliation", "Allowed", "Allowed", True)
    except AccessDeniedError as e:
        record_test("Manager/Owner", "Dashboard & Shift Reconciliation", "Allowed", str(e), False)

    # Unauthorized action: Delete Court Setup without Administrator Rights
    blocked = False
    try:
        harness.execute_action('group_club_manager', 'club.court', 'unlink', 'Delete Court Facility')
    except AccessDeniedError:
        blocked = True
    print(f"  ✓ Guarded action (Delete Court Arena Facility) -> {'BLOCKED (Access Denied)' if blocked else 'ALLOWED'}")
    record_test("Manager/Owner", "Delete Core Court Facility", "Access Denied", "Access Denied" if blocked else "Allowed", blocked)

    # -------------------------------------------------------------------------
    # 6. CLUB ADMINISTRATOR ROLE TESTS
    # -------------------------------------------------------------------------
    print("\n[ROLE 6] Club Administrator:")
    try:
        harness.execute_action('group_club_administrator', 'club.membership.plan', 'unlink', 'Delete Plan')
        harness.execute_action('group_club_administrator', 'club.court', 'unlink', 'Delete Court')
        harness.execute_action('group_club_administrator', 'club.dashboard', 'read', 'Full Dashboard Access')
        print("  ✓ Full CRUD and system configuration access -> ALLOWED")
        record_test("Administrator", "Full System CRUD & Configuration", "Allowed", "Allowed", True)
    except AccessDeniedError as e:
        record_test("Administrator", "Full System CRUD & Configuration", "Allowed", str(e), False)

    print("\n" + "=" * 80)
    print("SECURITY ROLE VALIDATION SUMMARY TABLE")
    print("=" * 80)
    print(f"{'Role':<18} | {'Action':<35} | {'Expected':<15} | {'Actual':<15} | {'Status'}")
    print("-" * 95)
    for r in test_results:
        print(f"{r['role']:<18} | {r['action']:<35} | {r['expected']:<15} | {r['actual']:<15} | {r['status']}")

    all_passed = all(r['status'] == 'PASS' for r in test_results)
    assert all_passed, "Some security role tests failed!"
    print("\n✓ ALL 12 SECURITY ROLE ACTIONS & ACCESS RESTRICTIONS PASSED WITH 100% SUCCESS!")


if __name__ == '__main__':
    run_tests()
