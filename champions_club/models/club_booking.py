# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError
from datetime import timedelta

class ClubBooking(models.Model):
    _name = 'club.booking'
    _description = 'Court Session Booking'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'start_time desc, id desc'

    name = fields.Char(
        string='Booking Reference',
        readonly=True,
        copy=False,
        default='New'
    )

    court_id = fields.Many2one(
        'club.court',
        string='Court / Facility',
        required=True,
        tracking=True,
        domain="[('active', '=', True)]"
    )
    sport_type = fields.Selection(
        related='court_id.sport_type',
        string='Sport',
        readonly=True,
        store=True
    )

    booking_type = fields.Selection([
        ('member', 'Registered Member'),
        ('walkin', 'Walk-in Guest'),
        ('corporate', 'Business / Corporate Client')
    ], string='Booking Type', required=True, default='member', tracking=True)

    member_id = fields.Many2one(
        'club.member',
        string='Member',
        tracking=True
    )
    partner_id = fields.Many2one(
        'res.partner',
        string='Business Client / Partner Contact',
        tracking=True
    )
    plan_id = fields.Many2one(
        related='member_id.plan_id',
        string='Membership Plan',
        readonly=True,
        store=True
    )

    walkin_name = fields.Char(string='Walk-in Customer Name')
    walkin_phone = fields.Char(string='Walk-in Contact')

    # Slot Scheduling: 1-hour duration with 30-minute interval starts
    start_time = fields.Datetime(
        string='Session Start Time',
        required=True,
        tracking=True
    )
    duration_hours = fields.Float(
        string='Session Duration (Hours)',
        default=1.0,
        help="Court session duration in hours (1.0, 2.0, or 3.0 based on membership plan)."
    )
    end_time = fields.Datetime(
        string='Session End Time',
        compute='_compute_end_time',
        store=True,
        readonly=True
    )

    # Social Play Event Mode (Friday nights shared court)
    is_social_play = fields.Boolean(
        string='Social Play Session',
        default=False,
        help="Designated multi-player shared court session (e.g. Friday night social play)."
    )

    # Configurable Pricing Applied (Hourly Rate * Duration)
    rate_applied = fields.Float(
        string='Applied Rate (Configurable)',
        digits=(10, 2),
        compute='_compute_applied_rate',
        store=True,
        help="Rate calculated dynamically from member plan or standard walk-in rate multiplied by session duration."
    )

    state = fields.Selection([
        ('draft', 'Draft / Reserved'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled')
    ], string='Booking Status', default='confirmed', tracking=True)

    notes = fields.Text(string='Booking Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('club.booking') or 'CC-BK'
        bookings = super(ClubBooking, self).create(vals_list)
        return bookings

    @api.depends('start_time', 'duration_hours')
    def _compute_end_time(self):
        for record in self:
            if record.start_time:
                record.end_time = record.start_time + timedelta(hours=record.duration_hours or 1.0)
            else:
                record.end_time = False

    @api.depends('booking_type', 'member_id', 'court_id', 'duration_hours', 'is_social_play')
    def _compute_applied_rate(self):
        for record in self:
            duration = record.duration_hours or 1.0
            if record.booking_type == 'member' and record.member_id and record.member_id.plan_id:
                plan = record.member_id.plan_id
                if plan.court_rate_policy == 'free':
                    record.rate_applied = 0.0
                else:
                    record.rate_applied = plan.court_hourly_rate * duration
            elif record.court_id:
                record.rate_applied = record.court_id.walkin_hourly_rate * duration
            else:
                record.rate_applied = 0.0

    @api.constrains('booking_type', 'member_id', 'walkin_name')
    def _check_booking_party(self):
        for record in self:
            if record.booking_type == 'member' and not record.member_id:
                raise ValidationError("Member must be selected for member booking type.")
            if record.booking_type == 'walkin' and not record.walkin_name:
                raise ValidationError("Walk-in customer name is required.")

    @api.constrains('start_time', 'duration_hours', 'booking_type', 'member_id')
    def _check_slot_timing(self):
        """
        Server-side validation:
        1. Sessions duration must be positive and not exceed tier maximum:
           - Gold: max 3 hours
           - Silver: max 2 hours
           - Junior: max 1 hour
           - Walk-in: max 1 hour
        2. New court slots open every 30 minutes (must start on :00 or :30 boundary).
        """
        for record in self:
            if not record.start_time:
                continue

            duration = record.duration_hours or 1.0
            if duration <= 0 or duration not in [1.0, 2.0, 3.0]:
                raise ValidationError("Court booking duration must be 1, 2, or 3 hours.")

            if record.booking_type == 'member' and record.member_id:
                plan = record.member_id.plan_id
                max_hours = plan.max_booking_hours if plan and plan.max_booking_hours else (
                    3 if (plan and plan.code == 'gold') else 2 if (plan and plan.code == 'silver') else 1
                )
                if duration > max_hours:
                    plan_name = plan.name if plan else 'Membership'
                    raise ValidationError(
                        f"Duration Limit Exceeded: '{plan_name}' allows a maximum duration of {max_hours} hour(s) per booking. "
                        f"Requested: {int(duration)} hour(s)."
                    )
            elif record.booking_type == 'walkin':
                if duration > 1.0:
                    raise ValidationError("Walk-in guests are limited to a maximum booking duration of 1 hour.")

            if record.start_time.minute not in [0, 30] or record.start_time.second != 0:
                raise ValidationError(
                    f"Invalid slot time ({record.start_time.strftime('%H:%M:%S')}). "
                    "Court booking slots must start on the hour or half-hour (e.g. 17:00, 17:30)."
                )

    @api.constrains('booking_type', 'member_id', 'start_time')
    def _check_membership_validity(self):
        """
        Server-side validation: Member must have an active, non-expired membership on the booking date.
        """
        for record in self:
            if record.booking_type == 'member' and record.member_id and record.start_time:
                booking_date = record.start_time.date()
                if record.member_id.end_date and record.member_id.end_date < booking_date:
                    raise ValidationError(
                        f"Cannot book court: Member '{record.member_id.name}' membership expired on {record.member_id.end_date}. "
                        "Please renew membership validity before booking."
                    )
                if record.member_id.start_date and record.member_id.start_date > booking_date:
                    raise ValidationError(
                        f"Cannot book court: Member '{record.member_id.name}' membership has not started yet (starts {record.member_id.start_date})."
                    )

    @api.constrains('court_id', 'start_time', 'end_time', 'state', 'is_social_play')
    def _check_double_booking(self):
        """
        Server-side validation: Check all consecutive intervals across requested duration.
        If ANY interval overlaps with an existing confirmed booking, REJECT without modifying or replacing existing booking.
        """
        for record in self:
            if record.state == 'cancelled' or record.is_social_play:
                continue

            if not record.court_id or not record.start_time or not record.end_time:
                continue

            domain = [
                ('id', '!=', record.id),
                ('court_id', '=', record.court_id.id),
                ('state', 'in', ['draft', 'confirmed']),
                ('is_social_play', '=', False),
                ('start_time', '<', record.end_time),
                ('end_time', '>', record.start_time),
            ]
            overlapping = self.search(domain)
            if overlapping:
                conflicts = []
                for b in overlapping:
                    b_start = b.start_time.strftime('%H:%M') if b.start_time else 'Start'
                    b_end = b.end_time.strftime('%H:%M') if b.end_time else 'End'
                    conflicts.append(f"{b_start}–{b_end} ({b.name})")
                conflict_desc = ", ".join(conflicts)
                req_start = record.start_time.strftime('%H:%M')
                req_end = record.end_time.strftime('%H:%M')
                raise ValidationError(
                    f"Cannot book {req_start}–{req_end} because {conflict_desc} is already booked."
                )

    @api.constrains('booking_type', 'member_id', 'start_time', 'state')
    def _check_daily_play_limit(self):
        """
        Server-side validation: Each member can play at most twice a day (maximum 2 bookings per member per day).
        Cancelled bookings do not count towards the daily limit.
        """
        for record in self:
            if record.booking_type != 'member' or not record.member_id or not record.start_time:
                continue
            if record.state == 'cancelled':
                continue

            # Compute calendar day boundaries
            booking_date = record.start_time.date()
            day_start = fields.Datetime.to_datetime(f"{booking_date} 00:00:00")
            day_end = fields.Datetime.to_datetime(f"{booking_date} 23:59:59")

            domain = [
                ('id', '!=', record.id),
                ('booking_type', '=', 'member'),
                ('member_id', '=', record.member_id.id),
                ('state', 'in', ['draft', 'confirmed', 'completed']),
                ('start_time', '>=', day_start),
                ('start_time', '<=', day_end),
            ]
            daily_count = self.search_count(domain)
            if daily_count >= 2:
                raise ValidationError(
                    f"Daily Limit Exceeded: Member '{record.member_id.name}' already has {daily_count} bookings on {booking_date}. "
                    "Each member can play at most twice a day."
                )

    def action_confirm(self):
        self.write({'state': 'confirmed'})
        return True

    def action_cancel(self):
        """Cancels booking, immediately freeing the court slot for new reservations."""
        self.write({'state': 'cancelled'})
        return True

    def action_complete(self):
        self.write({'state': 'completed'})
        return True

    def action_create_booking_invoice(self):
        """Creates a customer/client invoice for corporate or walk-in court booking."""
        self.ensure_one()
        partner = self.partner_id or (self.member_id.partner_id if self.member_id else False)
        if not partner and self.walkin_name:
            partner = self.env['res.partner'].create({
                'name': self.walkin_name,
                'phone': self.walkin_phone or ''
            })
            self.partner_id = partner.id

        if not partner:
            raise ValidationError("A customer or business client contact is required to generate an invoice.")

        invoice_vals = {
            'move_type': 'out_invoice',
            'partner_id': partner.id,
            'invoice_date': fields.Date.today(),
            'narration': f"Court booking invoice for {self.court_id.name} on {self.start_time}",
            'invoice_line_ids': [(0, 0, {
                'name': f"Court Session: {self.court_id.name} ({self.start_time} - {self.end_time})",
                'quantity': self.duration_hours or 1.0,
                'price_unit': self.rate_applied,
            })]
        }
        invoice = self.env['account.move'].create(invoice_vals)
        return {
            'name': 'Court Booking Invoice',
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'res_id': invoice.id,
            'view_mode': 'form',
            'target': 'current',
        }

