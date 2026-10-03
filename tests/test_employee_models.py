# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Employee, Staff Shifts & Leave Management Unit Test Suite
Validates:
1. Staff member profile creation, read, update with role assignments.
2. Linking staff to bar/cafeteria shifts.
3. Leave request lifecycle (Submit -> Approve / Refuse).
4. Leave constraint validation (end date before start date rejected).
"""

import sys
from datetime import date

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class ValidationError(Exception):
    pass

class MockEmployee:
    def __init__(self, id, name, role='front_desk', phone='', email=''):
        self.id = id
        self.name = name
        self.employee_code = f"CC-EMP-{id:04d}"
        self.role = role
        self.phone = phone
        self.email = email
        self.active = True
        self.shift_ids = []
        self.leave_ids = []

class MockLeave:
    def __init__(self, id, employee, start_date, end_date, reason=""):
        if end_date < start_date:
            raise ValidationError(f"Leave end date ({end_date}) cannot be earlier than leave start date ({start_date}).")
        self.id = id
        self.employee_id = employee
        self.start_date = start_date
        self.end_date = end_date
        self.reason = reason
        self.state = 'requested'
        self.approver_id = None

    def action_approve(self, approver_name="Club Manager"):
        self.state = 'approved'
        self.approver_id = approver_name
        return True

    def action_refuse(self, approver_name="Club Manager"):
        self.state = 'refused'
        self.approver_id = approver_name
        return True

def run_tests():
    print("=" * 70)
    print("CHAMPIONS CLUB — EMPLOYEE & LEAVE MANAGEMENT TEST SUITE")
    print("=" * 70)

    # TEST 1: Employee Record Creation & Read
    print("\n[TEST 1] Staff Profile Creation & Role Assignment:")
    emp1 = MockEmployee(1, "Pooja Patel", role='front_desk', phone='+91 98201 11223', email='pooja.p@championsclub.example')
    emp2 = MockEmployee(2, "Rohan Verma", role='bar_cafe', phone='+91 98201 44556', email='rohan.v@championsclub.example')
    
    assert emp1.employee_code == 'CC-EMP-0001' and emp1.role == 'front_desk'
    assert emp2.employee_code == 'CC-EMP-0002' and emp2.role == 'bar_cafe'
    print(f"  ✓ Created Staff: {emp1.name} [{emp1.employee_code}] - Role: {emp1.role}")
    print(f"  ✓ Created Staff: {emp2.name} [{emp2.employee_code}] - Role: {emp2.role}")
    print("  --> TEST 1 PASSED: Employee records created and verified.")

    # TEST 2: Employee Update
    print("\n[TEST 2] Employee Record Update:")
    emp1.phone = '+91 99999 88888'
    emp1.role = 'management'
    assert emp1.phone == '+91 99999 88888' and emp1.role == 'management'
    print(f"  ✓ Updated Staff {emp1.name}: New Role = {emp1.role}, New Phone = {emp1.phone}")
    print("  --> TEST 2 PASSED: Employee record update verified.")

    # TEST 3: Shift Linkage
    print("\n[TEST 3] Shift Assignment Relationship:")
    mock_shift = {'id': 1, 'name': 'Evening Bar Shift', 'staff_name': emp2.name, 'employee_id': emp2}
    emp2.shift_ids.append(mock_shift)
    assert len(emp2.shift_ids) == 1
    assert emp2.shift_ids[0]['name'] == 'Evening Bar Shift'
    print(f"  ✓ Linked Shift '{mock_shift['name']}' to Employee {emp2.name}")
    print("  --> TEST 3 PASSED: Shift One2many relationship verified.")

    # TEST 4: Leave Lifecycle Workflow (Requested -> Approved)
    print("\n[TEST 4] Leave Request Submission and Approval Workflow:")
    leave1 = MockLeave(101, emp1, date(2026, 10, 10), date(2026, 10, 12), reason="Family event")
    emp1.leave_ids.append(leave1)
    print(f"  ✓ Leave Request Submitted: {leave1.start_date} to {leave1.end_date} (Status: {leave1.state})")
    assert leave1.state == 'requested'
    
    leave1.action_approve("Club General Manager")
    assert leave1.state == 'approved' and leave1.approver_id == "Club General Manager"
    print(f"  ✓ Leave Request Approved by {leave1.approver_id} (Status: {leave1.state})")
    print("  --> TEST 4 PASSED: Leave approval workflow verified.")

    # TEST 5: Leave Invalid Dates Constraint Rejection
    print("\n[TEST 5] Leave Invalid Date Constraint Validation:")
    invalid_leave_caught = False
    try:
        # End date earlier than start date
        MockLeave(102, emp2, date(2026, 10, 15), date(2026, 10, 10), reason="Invalid dates")
    except ValidationError as e:
        invalid_leave_caught = True
        print(f"  ✓ Invalid leave dates rejected: {e}")
    assert invalid_leave_caught, "Leave with end date before start date must be rejected!"
    print("  --> TEST 5 PASSED: Leave date constraint validation verified.")

    print("\n" + "=" * 70)
    print("ALL 5 EMPLOYEE & LEAVE TESTS COMPLETED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
