# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ClubMembershipPlan(models.Model):
    _name = 'club.membership.plan'
    _description = 'Sports Club Membership Plan'
    _order = 'sequence, name'

    name = fields.Char(
        string='Plan Name',
        required=True,
        help="Name of the membership plan (e.g. Gold, Silver, Junior)"
    )
    code = fields.Selection([
        ('gold', 'Gold (Premium, Full Access)'),
        ('silver', 'Silver (Standard Access)'),
        ('junior', 'Junior (Under 18, Discounted)')
    ], string='Plan Tier Code', required=True, default='silver')
    sequence = fields.Integer(string='Sequence', default=10)
    description = fields.Text(string='Description / Entitlements Overview')

    # Configurable Financial Terms (Not Hardcoded)
    fee_amount = fields.Float(
        string='Membership Fee (Configurable)',
        digits=(10, 2),
        default=0.0,
        help="Configurable subscription fee amount. Defined by club administration."
    )
    billing_period = fields.Selection([
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annual', 'Annual'),
        ('custom', 'Custom Duration')
    ], string='Billing Period (Configurable)', default='annual', required=True)

    validity_duration_days = fields.Integer(
        string='Default Validity (Days)',
        default=365,
        help="Default number of days membership is valid upon enrollment"
    )

    # Entitlements - Court Rates (Configurable)
    court_rate_policy = fields.Selection([
        ('free', 'Zero / Free Court Access'),
        ('discounted', 'Discounted Member Rate'),
        ('standard', 'Standard Court Rate')
    ], string='Court Rate Policy', default='discounted', required=True)

    court_hourly_rate = fields.Float(
        string='Court Hourly Rate (Configurable)',
        digits=(10, 2),
        default=0.0,
        help="Hourly court booking rate for this plan. Configurable by management."
    )

    # Entitlements - Discounts (Configurable)
    shop_discount_percent = fields.Float(
        string='Pro Shop Discount % (Configurable)',
        digits=(5, 2),
        default=0.0,
        help="Percentage discount automatically applied on gear shop purchases"
    )

    bar_discount_percent = fields.Float(
        string='Bar & Cafeteria Discount % (Configurable)',
        digits=(5, 2),
        default=0.0,
        help="Percentage discount automatically applied on bar and cafeteria orders"
    )

    allow_running_tab = fields.Boolean(
        string='Allow Running Bar Tab',
        default=False,
        help="Allow member to open a bar/cafeteria tab and settle upon departure"
    )

    active = fields.Boolean(string='Active', default=True)
    member_count = fields.Integer(string='Active Members', compute='_compute_member_count')

    @api.depends()
    def _compute_member_count(self):
        member_obj = self.env['club.member']
        for plan in self:
            plan.member_count = member_obj.search_count([
                ('plan_id', '=', plan.id),
                ('state', 'in', ['active', 'expiring'])
            ])
