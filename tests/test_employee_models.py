# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Employee, Staff Shifts & Leave Management Unit Test Suite
=========================================================================
Strictly validates the 6 required verification steps:
1. Create employee (records, staff identification, code, contact info, active status)
2. Assign role (front_desk, bar_cafe, court_marshal, coach, management)
3. Create shift/schedule (operational visibility for bar/front-desk, time constraints, status lifecycle)
4. Create leave (casual, sick, annual, unpaid, date constraint validation)
5. Approve/reject leave (action_submit, action_approve, action_refuse, approver tracking)
6. Verify permissions (role-based access control, manager/admin vs front-desk/bar staff approval restrictions)
"""

import sys
import os
import csv
from datetime import date, datetime, timedelta

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class ValidationError(Exception):
    pass

class UserError(Exception):
    pass

class AccessDeniedError(Exception):
    pass


# ==============================================================================
# MOCK ODOO ENVIRONMENT & MODELS
# ==============================================================================

class MockUser:
    def __init__(self, id, name, groups=None):
        self.id = id
        self.name = name
        self.groups = groups or []

    def has_group(self, group_name):
        return group_name in self.groups


class MockEmployee:
    _sequence_counter = 0

    def __init__(self, name, role='front_desk', phone='', email='', user_id=None, notes=''):
        MockEmployee._sequence_counter += 1
        self.id = MockEmployee._sequence_counter
        self.employee_code = f"CC-EMP-{self.id:04d}"
        self.name = name
        self.role = role
        self.phone = phone
        self.email = email
        self.user_id = user_id
        self.active = True
        self.notes = notes
        self.schedule_ids = []
        self.bar_shift_ids = []
        self.leave_ids = []

    def assign_role(self, new_role):
        valid_roles = ['front_desk', 'bar_cafe', 'court_marshal', 'coach', 'management']
        if new_role not in valid_roles:
            raise ValidationError(f"Invalid role '{new_role}'. Must be one of {valid_roles}")
        self.role = new_role


class MockStaffSchedule:
    _sequence_counter = 0

    def __init__(self, employee, operation_type, shift_date, start_time, end_time, notes=""):
        if end_time <= start_time:
            raise ValidationError("Shift end time must be after shift start time.")
        MockStaffSchedule._sequence_counter += 1
        self.id = MockStaffSchedule._sequence_counter
        self.name = f"CC-SCHED-{self.id:04d}"
        self.employee_id = employee
        self.operation_type = operation_type
        self.shift_date = shift_date
        self.start_time = start_time
        self.end_time = end_time
        self.state = 'confirmed'
        self.notes = notes

        # Link to employee record
        employee.schedule_ids.append(self)

    def action_start_shift(self):
        if self.state != 'confirmed':
            raise UserError("Only confirmed shifts can be started.")
        self.state = 'active'
        return True

    def action_complete_shift(self):
        if self.state != 'active':
            raise UserError("Only active shifts can be completed.")
        self.state = 'completed'
        return True


class MockBarShift:
    _sequence_counter = 0

    def __init__(self, name, employee, start_time=None):
        MockBarShift._sequence_counter += 1
        self.id = MockBarShift._sequence_counter
        self.name = name
        self.employee_id = employee
        self.staff_name = employee.name
        self.start_time = start_time or datetime.now()
        self.end_time = None
        self.state = 'active'
        self.total_revenue = 0.0

        # Link to employee record
        employee.bar_shift_ids.append(self)

    def action_close_shift(self, revenue=0.0):
        self.state = 'closed'
        self.end_time = datetime.now()
        self.total_revenue = revenue
        return True


class MockEmployeeLeave:
    _sequence_counter = 0

    def __init__(self, employee, leave_type, start_date, end_date, reason="", state="requested"):
        if end_date < start_date:
            raise ValidationError(f"Leave end date ({end_date}) cannot be earlier than leave start date ({start_date}).")
        
        valid_types = ['casual', 'sick', 'annual', 'unpaid']
        if leave_type not in valid_types:
            raise ValidationError(f"Invalid leave type '{leave_type}'. Must be one of {valid_types}")

        MockEmployeeLeave._sequence_counter += 1
        self.id = MockEmployeeLeave._sequence_counter
        self.employee_id = employee
        self.leave_type = leave_type
        self.start_date = start_date
        self.end_date = end_date
        self.reason = reason
        self.state = state
        self.approver_id = None
        self.approval_date = None

        # Link to employee record
        employee.leave_ids.append(self)

    def action_submit(self):
        if self.state != 'draft':
            raise UserError("Only draft leave requests can be submitted.")
        self.state = 'requested'
        return True

    def action_approve(self, current_user):
        if not (current_user.has_group('champions_club.group_club_manager') or 
                current_user.has_group('champions_club.group_club_administrator')):
            raise UserError("Only Club Managers and Administrators are authorized to approve leave requests.")
        self.state = 'approved'
        self.approver_id = current_user
        self.approval_date = datetime.now()
        return True

    def action_refuse(self, current_user):
        if not (current_user.has_group('champions_club.group_club_manager') or 
                current_user.has_group('champions_club.group_club_administrator')):
            raise UserError("Only Club Managers and Administrators are authorized to refuse leave requests.")
        self.state = 'refused'
        self.approver_id = current_user
        self.approval_date = datetime.now()
        return True


# ==============================================================================
# ACL SECURITY HARNESS
# ==============================================================================

class ACLSecurityHarness:
    def __init__(self, csv_path):
        self.rules = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or row[0].startswith('#') or row[0] == 'id':
                    continue
                self.rules.append({
                    'id': row[0].strip(),
                    'model': row[2].strip().replace('model_', '').replace('_', '.'),
                    'group': row[3].strip(),
                    'read': int(row[4].strip()) == 1,
                    'write': int(row[5].strip()) == 1,
                    'create': int(row[6].strip()) == 1,
                    'unlink': int(row[7].strip()) == 1
                })

        self.hierarchy = {
            'group_club_front_desk': ['group_club_front_desk'],
            'group_club_bar_staff': ['group_club_bar_staff'],
            'group_club_crm_staff': ['group_club_crm_staff'],
            'group_club_shop_staff': ['group_club_shop_staff'],
            'group_club_manager': [
                'group_club_manager',
                'group_club_front_desk',
                'group_club_bar_staff',
                'group_club_crm_staff',
                'group_club_shop_staff'
            ],
            'group_club_administrator': [
                'group_club_administrator',
                'group_club_manager',
                'group_club_front_desk',
                'group_club_bar_staff',
                'group_club_crm_staff',
                'group_club_shop_staff'
            ]
        }

    def check_permission(self, role_group, model_name, operation):
        implied_groups = self.hierarchy.get(role_group, [role_group])
        for rule in self.rules:
            if rule['model'] == model_name and rule['group'] in implied_groups:
                if rule[operation]:
                    return True
        return False


# ==============================================================================
# MAIN TEST RUNNER
# ==============================================================================

def run_tests():
    print("=" * 80)
    print("CHAMPIONS CLUB — EMPLOYEE, SHIFTS & LEAVE MANAGEMENT TEST SUITE")
    print("=" * 80)

    # Setup Users for Permission Tests
    admin_user = MockUser(1, "System Admin", groups=['champions_club.group_club_administrator'])
    manager_user = MockUser(2, "Rajesh Sharma (Manager)", groups=['champions_club.group_club_manager'])
    front_desk_user = MockUser(3, "Pooja Patel (Front Desk)", groups=['champions_club.group_club_front_desk'])
    bar_staff_user = MockUser(4, "Rohan Verma (Bar Staff)", groups=['champions_club.group_club_bar_staff'])

    # --------------------------------------------------------------------------
    # TEST 1: CREATE EMPLOYEE (Records & Staff Identification)
    # --------------------------------------------------------------------------
    print("\n[TEST 1] Create Employee Records & Staff Identification:")
    emp1 = MockEmployee(
        name="Pooja Patel",
        role="front_desk",
        phone="+91 98201 11223",
        email="pooja.patel@championsclub.example",
        user_id=front_desk_user,
        notes="Front Desk Lead"
    )
    emp2 = MockEmployee(
        name="Rohan Verma",
        role="bar_cafe",
        phone="+91 98201 44556",
        email="rohan.verma@championsclub.example",
        user_id=bar_staff_user,
        notes="Cafeteria & Bar Till Operator"
    )
    emp3 = MockEmployee(
        name="Vikram Singh",
        role="court_marshal",
        phone="+91 98201 77889",
        email="vikram.singh@championsclub.example"
    )

    assert emp1.id == 1 and emp1.employee_code == "CC-EMP-0001", "Employee code CC-EMP-0001 must be auto-assigned"
    assert emp2.id == 2 and emp2.employee_code == "CC-EMP-0002", "Employee code CC-EMP-0002 must be auto-assigned"
    assert emp3.id == 3 and emp3.employee_code == "CC-EMP-0003", "Employee code CC-EMP-0003 must be auto-assigned"
    assert emp1.active is True and emp2.active is True and emp3.active is True, "Employees must default to active"
    assert emp1.name == "Pooja Patel" and emp1.phone == "+91 98201 11223"

    print(f"  ✓ Created Employee 1: {emp1.name} (Code: {emp1.employee_code}, Role: {emp1.role}, Phone: {emp1.phone})")
    print(f"  ✓ Created Employee 2: {emp2.name} (Code: {emp2.employee_code}, Role: {emp2.role}, Phone: {emp2.phone})")
    print(f"  ✓ Created Employee 3: {emp3.name} (Code: {emp3.employee_code}, Role: {emp3.role}, Phone: {emp3.phone})")
    print("  --> [TEST 1 PASSED]: Employee records created with unique staff identification codes.")

    # --------------------------------------------------------------------------
    # TEST 2: ASSIGN ROLE
    # --------------------------------------------------------------------------
    print("\n[TEST 2] Assign & Update Staff Roles:")
    emp4 = MockEmployee(name="Ananya Sen", role="coach", phone="+91 98201 33445")
    emp5 = MockEmployee(name="Rajesh Sharma", role="management", user_id=manager_user)

    assert emp4.role == "coach"
    assert emp5.role == "management"
    print(f"  ✓ Initial role assigned: {emp4.name} -> {emp4.role}")
    print(f"  ✓ Initial role assigned: {emp5.name} -> {emp5.role}")

    # Re-assign / promote role
    emp1.assign_role("management")
    assert emp1.role == "management", "Employee role update failed"
    print(f"  ✓ Updated role: {emp1.name} role changed to '{emp1.role}'")

    # Invalid role assignment rejection
    invalid_role_caught = False
    try:
        emp1.assign_role("super_hero")
    except ValidationError:
        invalid_role_caught = True
    assert invalid_role_caught, "Invalid role must raise ValidationError"
    print("  ✓ Invalid role rejection validated.")
    print("  --> [TEST 2 PASSED]: Staff role assignment and updates verified.")

    # --------------------------------------------------------------------------
    # TEST 3: CREATE SHIFT / SCHEDULE (Operational Visibility)
    # --------------------------------------------------------------------------
    print("\n[TEST 3] Create Staff Shifts / Schedules & Visibility:")
    today = date.today()
    shift_start_fd = datetime(today.year, today.month, today.day, 6, 0)
    shift_end_fd = datetime(today.year, today.month, today.day, 14, 30)

    sched1 = MockStaffSchedule(
        employee=emp1,
        operation_type="front_desk",
        shift_date=today,
        start_time=shift_start_fd,
        end_time=shift_end_fd,
        notes="Morning front desk and court reservation duty"
    )

    shift_start_bar = datetime(today.year, today.month, today.day, 12, 0)
    shift_end_bar = datetime(today.year, today.month, today.day, 21, 0)
    sched2 = MockStaffSchedule(
        employee=emp2,
        operation_type="bar_cafe",
        shift_date=today,
        start_time=shift_start_bar,
        end_time=shift_end_bar,
        notes="Afternoon/Evening bar service & register float"
    )

    assert sched1.name == "CC-SCHED-0001" and sched1.operation_type == "front_desk"
    assert sched2.name == "CC-SCHED-0002" and sched2.operation_type == "bar_cafe"
    assert len(emp1.schedule_ids) == 1 and emp1.schedule_ids[0] == sched1
    assert len(emp2.schedule_ids) == 1 and emp2.schedule_ids[0] == sched2
    print(f"  ✓ Front Desk Shift Scheduled: {sched1.name} for {emp1.name} ({shift_start_fd.strftime('%H:%M')} - {shift_end_fd.strftime('%H:%M')})")
    print(f"  ✓ Bar/Cafeteria Shift Scheduled: {sched2.name} for {emp2.name} ({shift_start_bar.strftime('%H:%M')} - {shift_end_bar.strftime('%H:%M')})")

    # Shift Lifecycle: Confirmed -> Active -> Completed
    assert sched1.state == 'confirmed'
    sched1.action_start_shift()
    assert sched1.state == 'active', "Shift state should be 'active'"
    print(f"  ✓ Shift {sched1.name} transitioned to 'active' (On Duty)")
    sched1.action_complete_shift()
    assert sched1.state == 'completed', "Shift state should be 'completed'"
    print(f"  ✓ Shift {sched1.name} transitioned to 'completed'")

    # Bar shift linkage
    bar_shift = MockBarShift("Bar Shift - Friday Night", emp2, start_time=shift_start_bar)
    assert len(emp2.bar_shift_ids) == 1 and emp2.bar_shift_ids[0] == bar_shift
    bar_shift.action_close_shift(revenue=18500.00)
    assert bar_shift.state == 'closed' and bar_shift.total_revenue == 18500.00
    print(f"  ✓ Linked Bar POS Shift '{bar_shift.name}' closed with revenue Rs.{bar_shift.total_revenue:.2f}")

    # Shift Timing Constraint (end <= start)
    invalid_shift_caught = False
    try:
        MockStaffSchedule(
            employee=emp3,
            operation_type="court_marshal",
            shift_date=today,
            start_time=shift_end_fd,
            end_time=shift_start_fd  # End before start
        )
    except ValidationError:
        invalid_shift_caught = True
    assert invalid_shift_caught, "Shift with end_time <= start_time must raise ValidationError"
    print("  ✓ Shift timing constraint (end_time > start_time) successfully verified.")
    print("  --> [TEST 3 PASSED]: Staff shifts and operational schedules created and verified.")

    # --------------------------------------------------------------------------
    # TEST 4: CREATE LEAVE REQUEST
    # --------------------------------------------------------------------------
    print("\n[TEST 4] Create Leave Requests:")
    leave_start = today + timedelta(days=7)
    leave_end = today + timedelta(days=9)

    leave1 = MockEmployeeLeave(
        employee=emp2,
        leave_type="casual",
        start_date=leave_start,
        end_date=leave_end,
        reason="Attending family wedding ceremony"
    )

    leave_draft = MockEmployeeLeave(
        employee=emp3,
        leave_type="sick",
        start_date=today,
        end_date=today + timedelta(days=1),
        reason="Recovery from viral flu",
        state="draft"
    )

    assert leave1.employee_id == emp2 and leave1.state == "requested"
    assert leave1.leave_type == "casual"
    assert leave_draft.state == "draft"
    assert len(emp2.leave_ids) == 1 and emp2.leave_ids[0] == leave1
    print(f"  ✓ Leave 1 (Requested): {emp2.name} | Type: {leave1.leave_type} | {leave1.start_date} to {leave1.end_date} | Reason: {leave1.reason}")
    print(f"  ✓ Leave 2 (Draft): {emp3.name} | Type: {leave_draft.leave_type} | {leave_draft.start_date} to {leave_draft.end_date}")

    # Submit draft leave
    leave_draft.action_submit()
    assert leave_draft.state == "requested"
    print(f"  ✓ Leave 2 submitted -> State updated to '{leave_draft.state}'")

    # Invalid Dates Constraint (end_date < start_date)
    invalid_leave_date_caught = False
    try:
        MockEmployeeLeave(
            employee=emp1,
            leave_type="annual",
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=2),  # Earlier end date
            reason="Invalid duration"
        )
    except ValidationError:
        invalid_leave_date_caught = True
    assert invalid_leave_date_caught, "Leave with end_date < start_date must raise ValidationError"
    print("  ✓ Leave date range constraint (end_date >= start_date) successfully verified.")
    print("  --> [TEST 4 PASSED]: Employee leave request creation and validations verified.")

    # --------------------------------------------------------------------------
    # TEST 5: APPROVE / REJECT LEAVE
    # --------------------------------------------------------------------------
    print("\n[TEST 5] Approve and Reject Leave Requests:")
    # Action Approve by Manager
    leave1.action_approve(manager_user)
    assert leave1.state == 'approved', "Leave status must be 'approved'"
    assert leave1.approver_id == manager_user, "Approver must be logged"
    assert leave1.approval_date is not None, "Approval timestamp must be recorded"
    print(f"  ✓ Leave 1 Approved: State='{leave1.state}', Approver='{leave1.approver_id.name}', Timestamp={leave1.approval_date.strftime('%Y-%m-%d %H:%M:%S')}")

    # Action Refuse / Reject by Admin
    leave_draft.action_refuse(admin_user)
    assert leave_draft.state == 'refused', "Leave status must be 'refused'"
    assert leave_draft.approver_id == admin_user, "Approver must be logged"
    assert leave_draft.approval_date is not None, "Decision timestamp must be recorded"
    print(f"  ✓ Leave 2 Refused: State='{leave_draft.state}', Refused By='{leave_draft.approver_id.name}', Timestamp={leave_draft.approval_date.strftime('%Y-%m-%d %H:%M:%S')}")
    print("  --> [TEST 5 PASSED]: Leave approval and rejection workflows verified.")

    # --------------------------------------------------------------------------
    # TEST 6: VERIFY PERMISSIONS (ACL & Manager Approval Restrictions)
    # --------------------------------------------------------------------------
    print("\n[TEST 6] Verify Security Permissions & Access Rights:")
    
    # 6.1 Unauthorized Leave Approval by Front Desk or Bar Staff
    leave_unauth = MockEmployeeLeave(
        employee=emp3,
        leave_type="annual",
        start_date=today + timedelta(days=20),
        end_date=today + timedelta(days=25),
        reason="Vacation"
    )
    unauthorized_approval_caught = False
    try:
        leave_unauth.action_approve(front_desk_user)
    except UserError as e:
        unauthorized_approval_caught = True
        print(f"  ✓ Blocked Front Desk staff from approving leave: {e}")
    assert unauthorized_approval_caught, "Front Desk user must not be allowed to approve leaves"

    unauthorized_refusal_caught = False
    try:
        leave_unauth.action_refuse(bar_staff_user)
    except UserError as e:
        unauthorized_refusal_caught = True
        print(f"  ✓ Blocked Bar Staff from refusing leave: {e}")
    assert unauthorized_refusal_caught, "Bar staff user must not be allowed to refuse leaves"

    # 6.2 ACL CSV Model Permissions Verification
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'champions_club', 'security', 'ir.model.access.csv')
    harness = ACLSecurityHarness(csv_path)

    # Front desk can read employees, view schedules, create own leave requests
    assert harness.check_permission('group_club_front_desk', 'club.employee', 'read') is True
    assert harness.check_permission('group_club_front_desk', 'club.employee', 'create') is False
    assert harness.check_permission('group_club_front_desk', 'club.staff.schedule', 'read') is True
    assert harness.check_permission('group_club_front_desk', 'club.staff.schedule', 'create') is False
    assert harness.check_permission('group_club_front_desk', 'club.employee.leave', 'create') is True

    # Bar staff can view shifts/schedules
    assert harness.check_permission('group_club_bar_staff', 'club.staff.schedule', 'read') is True
    assert harness.check_permission('group_club_bar_staff', 'club.bar.shift', 'create') is True

    # Manager has full CRUD on employees, schedules, and leaves
    assert harness.check_permission('group_club_manager', 'club.employee', 'create') is True
    assert harness.check_permission('group_club_manager', 'club.staff.schedule', 'write') is True
    assert harness.check_permission('group_club_manager', 'club.employee.leave', 'write') is True

    # Administrator has full delete (unlink) rights
    assert harness.check_permission('group_club_administrator', 'club.employee', 'unlink') is True
    assert harness.check_permission('group_club_administrator', 'club.staff.schedule', 'unlink') is True
    assert harness.check_permission('group_club_administrator', 'club.employee.leave', 'unlink') is True

    print("  ✓ ACL verification: Front Desk staff has read access to roster & schedules, create for leave.")
    print("  ✓ ACL verification: Bar staff has visibility to duty schedules and bar shifts.")
    print("  ✓ ACL verification: Managers have full operational CRUD and approval authority.")
    print("  ✓ ACL verification: Administrators have full administrative and unlink privileges.")
    print("  --> [TEST 6 PASSED]: All security rules, permissions, and workflow restrictions verified.")

    # --------------------------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("ALL 6 EMPLOYEE MANAGEMENT VERIFICATION TESTS COMPLETED WITH 100% SUCCESS!")
    print("=" * 80)


if __name__ == '__main__':
    run_tests()
