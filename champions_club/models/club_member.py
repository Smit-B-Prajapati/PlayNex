# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError
from datetime import date, timedelta

class ClubMember(models.Model):
    _name = 'club.member'
    _description = 'Champions Club Member Profile'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name, id desc'

    name = fields.Char(
        string='Member Full Name',
        required=True,
        tracking=True,
        help="Full legal or registered name of the member"
    )
    member_code = fields.Char(
        string='Member ID',
        readonly=True,
        copy=False,
        default='New',
        help="Unique membership identifier (e.g. CC-MEM-00101)"
    )
    email = fields.Char(string='Email Address', tracking=True)
    phone = fields.Char(string='Phone / WhatsApp Number', tracking=True)
    partner_id = fields.Many2one('res.partner', string='Related Customer Contact', tracking=True)
    
    # Membership Plan & Tier Entitlements
    plan_id = fields.Many2one(
        'club.membership.plan',
        string='Membership Plan',
        required=True,
        tracking=True,
        help="Assigned tier: Gold, Silver, or Junior"
    )
    tier_code = fields.Selection(
        related='plan_id.code',
        string='Tier Code',
        readonly=True
    )

    # Membership Validity & Expiry Tracking (Calculated from Stored Dates)
    start_date = fields.Date(
        string='Membership Start Date',
        required=True,
        default=fields.Date.context_today,
        tracking=True
    )
    end_date = fields.Date(
        string='Membership Expiration Date',
        required=True,
        tracking=True,
        help="Date when the current membership validity expires"
    )
    days_until_expiry = fields.Integer(
        string='Days Remaining',
        compute='_compute_membership_status',
        store=True,
        help="Days remaining until validity expiration"
    )

    # Membership Status: 5 Explicit Technical States
    state = fields.Selection([
        ('draft', 'Draft / Application'),
        ('active', 'Active'),
        ('expiring', 'Expiring Soon'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled')
    ], string='Membership Status', default='active', tracking=True, help="""
    - Draft: Profile created, awaiting onboarding or initial activation.
    - Active: Fully active with >30 days validity remaining; entitled to all tier benefits.
    - Expiring Soon: Active with <=30 days validity remaining; benefits active, flagged for renewal.
    - Expired: Validity date has passed; active membership benefits suspended.
    - Cancelled: Membership terminated or cancelled; active benefits suspended.
    """)

    # Active Benefits Eligibility Flag
    has_active_benefits = fields.Boolean(
        string='Active Member Benefits',
        compute='_compute_membership_status',
        store=True,
        help="True only when status is Active or Expiring Soon. False if Draft, Expired, or Cancelled."
    )

    # 360° Relational History (Actual Stored Database Records)
    history_ids = fields.One2many(
        'club.member.history',
        'member_id',
        string='Club Activity History',
        help="Audit log of signups, check-ins, renewals, plan changes, and staff notes"
    )
    booking_ids = fields.One2many(
        'club.booking',
        'member_id',
        string='Court Bookings History'
    )
    shop_order_ids = fields.One2many(
        'club.shop.order',
        'member_id',
        string='Pro Shop Purchases'
    )
    bar_tab_ids = fields.One2many(
        'club.bar.tab',
        'member_id',
        string='Bar & Cafeteria Tabs'
    )
    bar_order_ids = fields.One2many(
        'club.bar.order',
        'member_id',
        string='POS Bar Orders'
    )

    history_count = fields.Integer(string='History Events Count', compute='_compute_history_count')
    booking_count = fields.Integer(string='Bookings Count', compute='_compute_related_counts')
    shop_order_count = fields.Integer(string='Shop Orders Count', compute='_compute_related_counts')
    bar_tab_count = fields.Integer(string='Bar Tabs Count', compute='_compute_related_counts')

    notes = fields.Text(string='Front Desk / Staff Notes')

    # Quick Entitlement Reference (Read-only computed based on active benefits)
    court_rate_display = fields.Char(string='Court Entitlement', compute='_compute_entitlements')
    shop_discount_display = fields.Char(string='Shop Discount', compute='_compute_entitlements')
    bar_discount_display = fields.Char(string='Bar Discount', compute='_compute_entitlements')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('member_code', 'New') == 'New':
                vals['member_code'] = self.env['ir.sequence'].next_by_code('club.member') or 'CC-MEM'
            # Link or create partner for invoicing
            if not vals.get('partner_id') and vals.get('name'):
                partner = self.env['res.partner'].sudo().create({
                    'name': vals.get('name'),
                    'email': vals.get('email', ''),
                    'phone': vals.get('phone', '')
                })
                vals['partner_id'] = partner.id

        members = super(ClubMember, self).create(vals_list)
        # Log initial registration history event
        for member in members:
            self.env['club.member.history'].create({
                'member_id': member.id,
                'activity_type': 'signup',
                'description': f"Member enrolled under {member.plan_id.name} plan. Validity: {member.start_date} to {member.end_date}."
            })
        return members

    @api.constrains('start_date', 'end_date')
    def _check_validity_dates(self):
        """Rejects invalid date ranges where end date precedes start date."""
        for record in self:
            if record.start_date and record.end_date and record.end_date < record.start_date:
                raise ValidationError(
                    f"Invalid Date Range: Membership expiration date ({record.end_date}) "
                    f"cannot be earlier than start date ({record.start_date})."
                )

    @api.onchange('plan_id', 'start_date')
    def _onchange_plan_or_start_date(self):
        if self.plan_id and self.start_date:
            duration = self.plan_id.validity_duration_days or 365
            self.end_date = self.start_date + timedelta(days=duration)

    @api.depends('end_date', 'state')
    def _compute_membership_status(self):
        """Calculates days remaining from stored dates and evaluates active benefits."""
        today = fields.Date.context_today(self)
        for record in self:
            if not record.end_date:
                record.days_until_expiry = 0
                record.has_active_benefits = False
                if record.state not in ['draft', 'cancelled']:
                    record.state = 'expired'
                continue

            delta = (record.end_date - today).days
            record.days_until_expiry = delta

            # Explicit lifecycle transitions if not manually draft or cancelled
            if record.state not in ['draft', 'cancelled']:
                if delta < 0:
                    record.state = 'expired'
                elif delta <= 30:  # Expiring soon threshold (within 30 days)
                    record.state = 'expiring'
                else:
                    record.state = 'active'

            record.has_active_benefits = (record.state in ['active', 'expiring'])

    @api.depends('history_ids')
    def _compute_history_count(self):
        for record in self:
            record.history_count = len(record.history_ids)

    @api.depends('booking_ids', 'shop_order_ids', 'bar_tab_ids')
    def _compute_related_counts(self):
        for record in self:
            record.booking_count = len(record.booking_ids)
            record.shop_order_count = len(record.shop_order_ids)
            record.bar_tab_count = len(record.bar_tab_ids)

    @api.depends('plan_id', 'state', 'has_active_benefits')
    def _compute_entitlements(self):
        for record in self:
            if record.has_active_benefits and record.plan_id:
                plan = record.plan_id
                if plan.court_rate_policy == 'free':
                    record.court_rate_display = "Free / Included (100% discount)"
                else:
                    record.court_rate_display = f"Member Rate ({plan.court_hourly_rate:.2f}/hr)"
                
                record.shop_discount_display = f"{plan.shop_discount_percent:.1f}% Discount"
                record.bar_discount_display = f"{plan.bar_discount_percent:.1f}% Discount"
            else:
                record.court_rate_display = "Standard Walk-in Rate (No member benefit)"
                record.shop_discount_display = "0% (Membership inactive)"
                record.bar_discount_display = "0% (Membership inactive)"

    # Lifecycle Action Methods
    def action_activate(self):
        """Activates membership from draft state."""
        self.ensure_one()
        self.write({'state': 'active'})
        self._compute_membership_status()
        self.env['club.member.history'].create({
            'member_id': self.id,
            'activity_type': 'renewal',
            'description': f"Membership activated under {self.plan_id.name} plan. Valid until {self.end_date}."
        })
        return True

    def action_cancel_membership(self, reason=None):
        """Terminates membership; active benefits are immediately revoked."""
        self.ensure_one()
        self.write({'state': 'cancelled'})
        self.has_active_benefits = False
        msg = f"Membership cancelled by staff."
        if reason:
            msg += f" Reason: {reason}"
        self.env['club.member.history'].create({
            'member_id': self.id,
            'activity_type': 'note',
            'description': msg
        })
        return True

    def action_renew_membership(self, extension_days=None):
        """Renews membership validity by plan duration or specified days."""
        self.ensure_one()
        duration = extension_days or (self.plan_id.validity_duration_days or 365)
        base_date = max(self.end_date or fields.Date.today(), fields.Date.today())
        new_end_date = base_date + timedelta(days=duration)
        self.write({
            'end_date': new_end_date,
            'state': 'active'
        })
        self._compute_membership_status()
        self.env['club.member.history'].create({
            'member_id': self.id,
            'activity_type': 'renewal',
            'description': f"Membership renewed for {duration} days. Validity extended to {new_end_date}."
        })
        return True

    def action_change_plan(self, new_plan_id):
        """Transitions member to a new tier plan and logs history."""
        self.ensure_one()
        old_plan_name = self.plan_id.name
        self.write({'plan_id': new_plan_id})
        self._compute_entitlements()
        self.env['club.member.history'].create({
            'member_id': self.id,
            'activity_type': 'plan_change',
            'description': f"Membership plan changed from {old_plan_name} to {self.plan_id.name}."
        })
        return True

    def action_log_checkin(self, facility_note=None):
        """Action for staff to quickly log front desk check-in."""
        self.ensure_one()
        desc = f"Front desk check-in on {fields.Date.today()}."
        if facility_note:
            desc += f" Facility/Activity: {facility_note}"
        self.env['club.member.history'].create({
            'member_id': self.id,
            'activity_type': 'checkin',
            'description': desc
        })
        return True

    def action_create_membership_invoice(self):
        """Creates a customer invoice for the membership subscription fee."""
        self.ensure_one()
        if not self.partner_id:
            self.partner_id = self.env['res.partner'].create({
                'name': self.name,
                'email': self.email or '',
                'phone': self.phone or ''
            })
        invoice_vals = {
            'move_type': 'out_invoice',
            'partner_id': self.partner_id.id,
            'invoice_date': fields.Date.today(),
            'narration': f"Membership fee for {self.name} under plan {self.plan_id.name}",
            'invoice_line_ids': [(0, 0, {
                'name': f"Membership Subscription: {self.plan_id.name}",
                'quantity': 1.0,
                'price_unit': self.plan_id.fee_amount,
            })]
        }
        invoice = self.env['account.move'].create(invoice_vals)
        return {
            'name': 'Membership Invoice',
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'res_id': invoice.id,
            'view_mode': 'form',
            'target': 'current',
        }
