# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError
from datetime import timedelta

class ClubEnquiry(models.Model):
    _name = 'club.enquiry'
    _description = 'Champions Club Visitor Enquiry & CRM Lead'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'enquiry_date desc, id desc'

    name = fields.Char(string='Enquiry Reference', readonly=True, copy=False, default='New')
    partner_name = fields.Char(string='Visitor Full Name', required=True, tracking=True)
    email = fields.Char(string='Email Address', tracking=True)
    phone = fields.Char(string='Phone / WhatsApp', required=True, tracking=True)

    # Lead Source
    source = fields.Selection([
        ('website', 'Website Enquiry'),
        ('walkin', 'Front Desk / Walk-in'),
        ('phone', 'Phone / WhatsApp'),
        ('referral', 'Member Referral'),
        ('staff', 'Staff Sourced')
    ], string='Source', default='website', required=True, tracking=True)

    # Lead Pipeline Stages: 5 Strict Standard Stages
    stage = fields.Selection([
        ('new', 'New Enquiry'),
        ('contacted', 'Contacted'),
        ('followup', 'Follow-up'),
        ('quote', 'Quote'),
        ('converted', 'Converted')
    ], string='Pipeline Stage', default='new', required=True, tracking=True)

    # Staff Assignment
    user_id = fields.Many2one(
        'res.users',
        string='Assigned Staff',
        default=lambda self: self.env.user,
        tracking=True,
        help="Staff member responsible for following up on this enquiry."
    )

    # Interest & Quotation
    interested_plan_id = fields.Many2one(
        'club.membership.plan',
        string='Interested Membership Plan',
        tracking=True,
        help="Plan of interest (Gold, Silver, or Junior)."
    )
    quote_amount = fields.Float(
        string='Quoted Amount (₹)',
        digits=(10, 2),
        default=0.0,
        help="Configurable quotation sent to prospective member derived from plan fee."
    )
    quote_sent = fields.Boolean(string='Quote Sent', default=False, tracking=True)
    quote_notes = fields.Text(string='Quote Details & Terms')

    # Activity & Notes
    message = fields.Text(string='Visitor Enquiry Message')
    notes = fields.Text(string='Internal Staff Notes')
    followup_notes = fields.Text(string='Follow-up Log', tracking=True)
    enquiry_date = fields.Datetime(string='Enquiry Received At', default=fields.Datetime.now, required=True)

    # Resulting Member Conversion & Contact Association
    partner_id = fields.Many2one('res.partner', string='Associated Contact', tracking=True)
    member_id = fields.Many2one('club.member', string='Converted Member Profile', readonly=True, tracking=True)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('club.enquiry') or 'CC-ENQ'
            # Auto-populate quote amount from plan fee if not specified
            if not vals.get('quote_amount') and vals.get('interested_plan_id'):
                plan = self.env['club.membership.plan'].browse(vals['interested_plan_id'])
                if plan.exists():
                    vals['quote_amount'] = plan.fee_amount
        return super(ClubEnquiry, self).create(vals_list)

    def action_mark_contacted(self):
        """Staff reached out to visitor."""
        self.write({'stage': 'contacted'})
        return True

    def action_log_followup(self, notes):
        """Logs a follow-up interaction and updates pipeline stage."""
        self.ensure_one()
        current_log = self.followup_notes or ''
        timestamp = fields.Datetime.now()
        staff_name = self.env.user.name if self.env.user else 'Staff'
        new_entry = f"[{timestamp}] Follow-up by {staff_name}: {notes}\n"
        self.write({
            'followup_notes': new_entry + current_log,
            'stage': 'followup'
        })
        return True

    def action_send_quote(self, quote_amount=None, notes=None):
        """Generates quotation based on configured plan fee and moves to quote stage."""
        self.ensure_one()
        vals = {
            'quote_sent': True,
            'stage': 'quote'
        }
        if quote_amount is not None:
            vals['quote_amount'] = quote_amount
        elif self.interested_plan_id:
            vals['quote_amount'] = self.interested_plan_id.fee_amount
        if notes:
            vals['quote_notes'] = notes
        self.write(vals)
        return True

    def action_convert_to_member(self):
        """
        Converts the enquiry into an active club member.
        Reuses existing res.partner / club.member records to prevent duplicates.
        """
        self.ensure_one()
        if self.member_id:
            raise ValidationError(f"Enquiry is already converted to member: {self.member_id.name} ({self.member_id.member_code}).")

        if not self.interested_plan_id:
            raise ValidationError("Please assign an Interested Membership Plan before converting to member.")

        today = fields.Date.today()
        duration = self.interested_plan_id.validity_duration_days or 365
        end_date = today + timedelta(days=duration)

        # 1. Check if an existing member record matches phone or email
        member_domain = []
        if self.phone and self.email:
            member_domain = ['|', ('phone', '=', self.phone), ('email', '=', self.email)]
        elif self.phone:
            member_domain = [('phone', '=', self.phone)]
        elif self.email:
            member_domain = [('email', '=', self.email)]

        existing_member = self.env['club.member'].search(member_domain, limit=1) if member_domain else False

        if existing_member:
            # Associate existing member without creating duplicate
            self.env['club.member.history'].create({
                'member_id': existing_member.id,
                'activity_type': 'note',
                'description': f"Enquiry {self.name} ({self.source}) associated with existing member profile. Plan: {self.interested_plan_id.name}."
            })
            self.write({
                'member_id': existing_member.id,
                'partner_id': existing_member.partner_id.id if existing_member.partner_id else False,
                'stage': 'converted'
            })
            return {
                'name': 'Existing Member Profile',
                'type': 'ir.actions.act_window',
                'res_model': 'club.member',
                'res_id': existing_member.id,
                'view_mode': 'form',
                'target': 'current',
            }

        # 2. Check if an existing res.partner exists to prevent contact duplication
        partner_domain = []
        if self.phone and self.email:
            partner_domain = ['|', ('phone', '=', self.phone), ('email', '=', self.email)]
        elif self.phone:
            partner_domain = [('phone', '=', self.phone)]
        elif self.email:
            partner_domain = [('email', '=', self.email)]

        existing_partner = self.env['res.partner'].sudo().search(partner_domain, limit=1) if partner_domain else False

        if existing_partner:
            partner = existing_partner
        else:
            partner = self.env['res.partner'].sudo().create({
                'name': self.partner_name,
                'email': self.email or '',
                'phone': self.phone or ''
            })

        # 3. Create new member profile linked to the partner
        new_member = self.env['club.member'].create({
            'name': self.partner_name,
            'email': self.email,
            'phone': self.phone,
            'partner_id': partner.id,
            'plan_id': self.interested_plan_id.id,
            'start_date': today,
            'end_date': end_date,
            'notes': f"Converted from Enquiry {self.name} (Source: {self.source}). Quoted fee: ₹ {self.quote_amount:.2f}."
        })

        # 4. Log initial history event
        staff_label = self.user_id.name if self.user_id else 'Front Desk'
        self.env['club.member.history'].create({
            'member_id': new_member.id,
            'activity_type': 'signup',
            'description': f"Enrolled via Enquiry {self.name} (Source: {self.source}). Assigned Staff: {staff_label}. Plan: {self.interested_plan_id.name}."
        })

        self.write({
            'member_id': new_member.id,
            'partner_id': partner.id,
            'stage': 'converted'
        })

        return {
            'name': 'New Member Profile',
            'type': 'ir.actions.act_window',
            'res_model': 'club.member',
            'res_id': new_member.id,
            'view_mode': 'form',
            'target': 'current',
        }
