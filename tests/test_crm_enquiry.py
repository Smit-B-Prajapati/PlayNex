# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — CRM & Enquiry Pipeline Unit Test Suite
Validates the complete 5-stage CRM workflow and 8 authoritative test cases:
1. Website Enquiry (Creation from online form with plan interest and source)
2. Lead Creation (Validation, required fields, reference sequence assignment)
3. Assignment (Staff assignment and attribution)
4. Follow-up (Follow-up logging, timestamps, stage transition)
5. Quote (Quotation calculation from plan fee without price invention, stage transition)
6. Conversion (Lead conversion to active member profile)
7. Member Creation & History Linking (Profile creation, plan validity, audit trail)
8. Duplicate Contact Handling (Prevents orphan partner/member duplicate records)
"""

import sys
from datetime import datetime, date, timedelta

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class ValidationError(Exception):
    pass

class MockPlan:
    def __init__(self, id, name, code, fee, validity_days=365):
        self.id = id
        self.name = name
        self.code = code
        self.fee_amount = fee
        self.validity_duration_days = validity_days

class MockStaff:
    def __init__(self, id, name, role="Advisor"):
        self.id = id
        self.name = name
        self.role = role

class MockPartner:
    def __init__(self, id, name, email, phone):
        self.id = id
        self.name = name
        self.email = email
        self.phone = phone

class MockMember:
    def __init__(self, id, member_code, name, email, phone, partner, plan, start_date, end_date):
        self.id = id
        self.member_code = member_code
        self.name = name
        self.email = email
        self.phone = phone
        self.partner_id = partner
        self.plan_id = plan
        self.start_date = start_date
        self.end_date = end_date
        self.state = 'active'
        self.history = []
        self.notes = ""

class CRMWorkflowEngine:
    def __init__(self):
        self.enquiries = []
        self.partners = []
        self.members = []
        self._next_enq_id = 1
        self._next_partner_id = 1
        self._next_member_id = 101

    def create_enquiry(self, partner_name, phone, email=None, source='website', plan=None, message=None, assigned_staff=None):
        """Creates a CRM Lead / Enquiry (Step 1 & 2)."""
        if not partner_name or not str(partner_name).strip():
            raise ValidationError("Visitor full name is required.")
        if not phone or not str(phone).strip():
            raise ValidationError("Contact phone number is required.")

        ref = f"CC-ENQ-{self._next_enq_id:04d}"
        quote_amt = plan.fee_amount if plan else 0.0

        enquiry = {
            'id': self._next_enq_id,
            'name': ref,
            'partner_name': partner_name.strip(),
            'phone': phone.strip(),
            'email': email.strip() if email else None,
            'source': source,
            'interested_plan': plan,
            'message': message,
            'notes': '',
            'user_id': assigned_staff,
            'stage': 'new',  # Stage 1: New Enquiry
            'quote_sent': False,
            'quote_amount': quote_amt,
            'quote_notes': None,
            'followup_log': [],
            'partner': None,
            'member': None,
            'enquiry_date': datetime.now()
        }
        self.enquiries.append(enquiry)
        self._next_enq_id += 1
        return enquiry

    def assign_staff(self, enquiry, staff):
        """Assigns staff member (Step 3)."""
        if not staff:
            raise ValidationError("Staff entity is required for assignment.")
        enquiry['user_id'] = staff
        return enquiry

    def mark_contacted(self, enquiry):
        """Marks lead contacted (Stage 2: Contacted)."""
        enquiry['stage'] = 'contacted'
        return enquiry

    def log_followup(self, enquiry, note, staff=None):
        """Logs follow-up activity (Step 4, Stage 3: Follow-up)."""
        if not note or not str(note).strip():
            raise ValidationError("Follow-up note cannot be empty.")
        staff_name = staff.name if staff else (enquiry['user_id'].name if enquiry['user_id'] else "Staff")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        log_entry = f"[{timestamp}] Follow-up by {staff_name}: {note.strip()}"
        enquiry['followup_log'].append(log_entry)
        enquiry['stage'] = 'followup'  # Stage 3: Follow-up
        return enquiry

    def send_quote(self, enquiry, quote_amount=None, quote_notes=None):
        """Generates quotation based on configured plan fee (Step 5, Stage 4: Quote)."""
        if quote_amount is not None:
            amt = float(quote_amount)
        elif enquiry['interested_plan']:
            amt = float(enquiry['interested_plan'].fee_amount)
        else:
            raise ValidationError("Cannot generate quote without interested plan or specified amount.")

        enquiry['quote_sent'] = True
        enquiry['quote_amount'] = amt
        enquiry['quote_notes'] = quote_notes or f"Official quote for {enquiry['interested_plan'].name} membership."
        enquiry['stage'] = 'quote'  # Stage 4: Quote
        return enquiry

    def convert_to_member(self, enquiry):
        """
        Converts enquiry into active club member (Step 6, 7 & 8).
        Checks for existing partner/member records to prevent duplicates.
        """
        if enquiry['member']:
            raise ValidationError(f"Enquiry {enquiry['name']} is already converted to member {enquiry['member'].member_code}.")
        if not enquiry['interested_plan']:
            raise ValidationError("Interested membership plan is required for conversion.")

        # 1. Duplicate Contact Check: Check existing club.member by phone or email
        existing_member = None
        for m in self.members:
            if (enquiry['phone'] and m.phone == enquiry['phone']) or (enquiry['email'] and m.email and m.email.lower() == enquiry['email'].lower()):
                existing_member = m
                break

        if existing_member:
            # Associate existing member without creating duplicate
            existing_member.history.append({
                'type': 'note',
                'desc': f"Enquiry {enquiry['name']} ({enquiry['source']}) associated with existing member profile. Plan: {enquiry['interested_plan'].name}."
            })
            enquiry['member'] = existing_member
            enquiry['partner'] = existing_member.partner_id
            enquiry['stage'] = 'converted'
            return existing_member

        # 2. Duplicate Partner Check: Check existing res.partner
        existing_partner = None
        for p in self.partners:
            if (enquiry['phone'] and p.phone == enquiry['phone']) or (enquiry['email'] and p.email and p.email.lower() == enquiry['email'].lower()):
                existing_partner = p
                break

        if existing_partner:
            partner = existing_partner
        else:
            partner = MockPartner(
                id=self._next_partner_id,
                name=enquiry['partner_name'],
                email=enquiry['email'],
                phone=enquiry['phone']
            )
            self.partners.append(partner)
            self._next_partner_id += 1

        # 3. Create new member profile
        today = date.today()
        duration = enquiry['interested_plan'].validity_duration_days
        end_date = today + timedelta(days=duration)
        member_code = f"CC-MEM-{self._next_member_id:05d}"

        new_member = MockMember(
            id=self._next_member_id,
            member_code=member_code,
            name=enquiry['partner_name'],
            email=enquiry['email'],
            phone=enquiry['phone'],
            partner=partner,
            plan=enquiry['interested_plan'],
            start_date=today,
            end_date=end_date
        )
        new_member.notes = f"Converted from Enquiry {enquiry['name']} (Source: {enquiry['source']}). Quoted fee: ₹ {enquiry['quote_amount']:.2f}."
        
        staff_str = enquiry['user_id'].name if enquiry['user_id'] else "Front Desk"
        new_member.history.append({
            'type': 'signup',
            'desc': f"Enrolled via Enquiry {enquiry['name']} (Source: {enquiry['source']}). Assigned Staff: {staff_str}. Plan: {enquiry['interested_plan'].name}."
        })

        self.members.append(new_member)
        self._next_member_id += 1

        enquiry['member'] = new_member
        enquiry['partner'] = partner
        enquiry['stage'] = 'converted'
        return new_member


def run_crm_test_suite():
    print("=" * 75)
    print("CHAMPIONS CLUB — CRM WORKFLOW & ENQUIRY PIPELINE TEST SUITE")
    print("=" * 75)

    # Master Setup: Membership Plans & Staff
    gold_plan = MockPlan(1, "Gold Tier", "gold", fee=24000.0, validity_days=365)
    silver_plan = MockPlan(2, "Silver Tier", "silver", fee=14000.0, validity_days=365)
    junior_plan = MockPlan(3, "Junior Tier", "junior", fee=8000.0, validity_days=365)

    staff_advisor = MockStaff(1, "Pooja Patel", role="Membership Advisor")
    staff_reception = MockStaff(2, "Rohan Verma", role="Front Desk Lead")

    engine = CRMWorkflowEngine()

    # -------------------------------------------------------------
    # TEST 1: Website Enquiry Form Submission
    # -------------------------------------------------------------
    print("\n[TEST 1] Website Enquiry Form Submission:")
    enq_web = engine.create_enquiry(
        partner_name="Siddharth Rao",
        phone="+91 99001 22334",
        email="siddharth.rao@example.com",
        source="website",
        plan=gold_plan,
        message="Interested in Gold plan and weekend tennis court access."
    )
    print(f"  ✓ Reference Created: {enq_web['name']}")
    print(f"  ✓ Source: {enq_web['source']} | Visitor: {enq_web['partner_name']}")
    print(f"  ✓ Initial Stage: '{enq_web['stage']}'")
    assert enq_web['source'] == 'website'
    assert enq_web['stage'] == 'new'
    assert enq_web['quote_amount'] == 24000.0
    print("  --> PASS: Website enquiry successfully created in 'New Enquiry' stage.")

    # -------------------------------------------------------------
    # TEST 2: Backend Lead Creation & Validation
    # -------------------------------------------------------------
    print("\n[TEST 2] Lead Creation & Validation:")
    enq_walkin = engine.create_enquiry(
        partner_name="Ananya Deshmukh",
        phone="+91 98210 44556",
        email="ananya.d@example.com",
        source="walkin",
        plan=silver_plan,
        message="Front desk visitor inquiring about badminton."
    )
    print(f"  ✓ Reference Created: {enq_walkin['name']} (Source: {enq_walkin['source']})")
    assert enq_walkin['name'] == 'CC-ENQ-0002'
    
    # Verify required field constraints
    validation_passed = False
    try:
        engine.create_enquiry(partner_name="", phone="+91 98000 00000")
    except ValidationError as e:
        validation_passed = True
        print(f"  ✓ Blank name rejected: {e}")
    assert validation_passed

    validation_passed2 = False
    try:
        engine.create_enquiry(partner_name="Test Visitor", phone="")
    except ValidationError as e:
        validation_passed2 = True
        print(f"  ✓ Blank phone rejected: {e}")
    assert validation_passed2
    print("  --> PASS: Lead creation and required field validation verified.")

    # -------------------------------------------------------------
    # TEST 3: Staff Assignment & Initial Contact
    # -------------------------------------------------------------
    print("\n[TEST 3] Staff Assignment & Initial Contact:")
    engine.assign_staff(enq_web, staff_advisor)
    print(f"  ✓ Assigned Staff: {enq_web['user_id'].name} ({enq_web['user_id'].role})")
    assert enq_web['user_id'] == staff_advisor

    engine.mark_contacted(enq_web)
    print(f"  ✓ Transitioned Stage: '{enq_web['stage']}'")
    assert enq_web['stage'] == 'contacted'
    print("  --> PASS: Staff assignment and 'Contacted' stage transition verified.")

    # -------------------------------------------------------------
    # TEST 4: Follow-up Activity Logging
    # -------------------------------------------------------------
    print("\n[TEST 4] Follow-up Activity Logging:")
    engine.log_followup(enq_web, "Spoke on WhatsApp; visitor confirmed tennis skill level and requested club walkthrough.", staff=staff_advisor)
    engine.log_followup(enq_web, "Walkthrough completed at 5:00 PM; visitor inspected clay courts and pro shop.", staff=staff_advisor)
    print(f"  ✓ Total Follow-up Entries: {len(enq_web['followup_log'])}")
    print(f"  ✓ Latest Log: {enq_web['followup_log'][-1]}")
    print(f"  ✓ Transitioned Stage: '{enq_web['stage']}'")
    assert len(enq_web['followup_log']) == 2
    assert enq_web['stage'] == 'followup'
    print("  --> PASS: Follow-up activity logging and 'Follow-up' stage verified.")

    # -------------------------------------------------------------
    # TEST 5: Quotation Generation (Derived from Plan Fee)
    # -------------------------------------------------------------
    print("\n[TEST 5] Quotation Generation:")
    # Send quote using plan fee (24,000 INR for Gold) without inventing price
    engine.send_quote(enq_web, quote_notes="Annual Gold Plan with trial session credit.")
    print(f"  ✓ Quote Amount: ₹ {enq_web['quote_amount']:.2f} (Derived from Gold Plan fee)")
    print(f"  ✓ Quote Sent Flag: {enq_web['quote_sent']}")
    print(f"  ✓ Quote Notes: {enq_web['quote_notes']}")
    print(f"  ✓ Transitioned Stage: '{enq_web['stage']}'")
    assert enq_web['quote_sent'] is True
    assert enq_web['quote_amount'] == 24000.0
    assert enq_web['stage'] == 'quote'
    print("  --> PASS: Quotation mechanism and 'Quote' stage verified.")

    # -------------------------------------------------------------
    # TEST 6: Lead Conversion to Member
    # -------------------------------------------------------------
    print("\n[TEST 6] Lead Conversion:")
    converted_member = engine.convert_to_member(enq_web)
    print(f"  ✓ Lead Stage: '{enq_web['stage']}'")
    print(f"  ✓ Converted Member ID: {converted_member.member_code} ({converted_member.name})")
    assert enq_web['stage'] == 'converted'
    assert enq_web['member'] == converted_member
    print("  --> PASS: Lead successfully converted to 'Converted' stage.")

    # -------------------------------------------------------------
    # TEST 7: Member Profile Creation & History Linking
    # -------------------------------------------------------------
    print("\n[TEST 7] Member Creation & 360 History Linking:")
    print(f"  ✓ Member Plan: {converted_member.plan_id.name}")
    print(f"  ✓ Member Validity: {converted_member.start_date} to {converted_member.end_date}")
    print(f"  ✓ Associated Partner ID: {converted_member.partner_id.id} ({converted_member.partner_id.name})")
    print(f"  ✓ Audit Trail Events: {len(converted_member.history)}")
    print(f"  ✓ Signup Log: {converted_member.history[0]['desc']}")
    assert converted_member.plan_id == gold_plan
    assert converted_member.partner_id is not None
    assert "CC-ENQ-0001" in converted_member.history[0]['desc']
    assert converted_member.end_date == converted_member.start_date + timedelta(days=365)
    print("  --> PASS: Member profile, validity calculation, and 360 history linking verified.")

    # -------------------------------------------------------------
    # TEST 8: Duplicate Contact & Member Handling
    # -------------------------------------------------------------
    print("\n[TEST 8] Duplicate Contact & Member Handling:")
    # Scenario A: Block duplicate conversion of an already-converted enquiry
    dup_blocked = False
    try:
        engine.convert_to_member(enq_web)
    except ValidationError as e:
        dup_blocked = True
        print(f"  ✓ Blocked duplicate conversion of same lead: {e}")
    assert dup_blocked

    # Scenario B: Second enquiry submitted by the SAME phone/email visitor
    enq_repeat = engine.create_enquiry(
        partner_name="Siddharth Rao",
        phone="+91 99001 22334",  # Same phone as existing member
        email="siddharth.rao@example.com",
        source="phone",
        plan=gold_plan,
        message="Follow-up inquiry about Junior add-on."
    )
    engine.send_quote(enq_repeat)
    partner_count_before = len(engine.partners)
    member_count_before = len(engine.members)

    # Conversion should reuse existing member/partner without creating duplicates
    matched_member = engine.convert_to_member(enq_repeat)
    partner_count_after = len(engine.partners)
    member_count_after = len(engine.members)

    print(f"  ✓ Repeat Enquiry {enq_repeat['name']} matched Member {matched_member.member_code}")
    print(f"  ✓ Partner Count Before: {partner_count_before} | After: {partner_count_after} (No orphan contact created)")
    print(f"  ✓ Member Count Before: {member_count_before} | After: {member_count_after} (No duplicate member created)")
    assert partner_count_after == partner_count_before
    assert member_count_after == member_count_before
    assert matched_member == converted_member
    assert enq_repeat['stage'] == 'converted'
    print("  --> PASS: Duplicate contact and member prevention verified with 100% accuracy.")

    print("\n" + "=" * 75)
    print("ALL 8 CRM WORKFLOW & PIPELINE TESTS COMPLETED WITH 100% SUCCESS!")
    print("=" * 75)

if __name__ == '__main__':
    run_crm_test_suite()
