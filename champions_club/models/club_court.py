# -*- coding: utf-8 -*-
from odoo import models, fields, api
from datetime import datetime, timedelta, time

class ClubCourt(models.Model):
    _name = 'club.court'
    _description = 'Champions Club Sports Court / Facility'
    _order = 'sport_type, court_number, name'

    name = fields.Char(string='Court Name', required=True, help="e.g. Tennis Court 1 (Clay), Cricket Net Turf 1")
    court_number = fields.Integer(string='Court / Lane Number', required=True, default=1)
    
    # Sports restricted strictly to problem statement: Tennis, Cricket, Badminton
    sport_type = fields.Selection([
        ('tennis', 'Tennis'),
        ('cricket', 'Cricket'),
        ('badminton', 'Badminton')
    ], string='Sport Facility', required=True, default='tennis')

    surface_type = fields.Selection([
        ('clay', 'Clay Court'),
        ('hard', 'Hard Court / Acrylic'),
        ('turf', 'Turf / Pitch'),
        ('synthetic', 'Synthetic Mat (Indoor)')
    ], string='Surface Type', default='hard')

    is_indoor = fields.Boolean(string='Indoor Court', default=False)
    is_floodlit = fields.Boolean(string='Floodlit / Night Lighting', default=True)

    # Configurable walk-in hourly rate
    walkin_hourly_rate = fields.Float(
        string='Walk-in Standard Hourly Rate (Configurable)',
        digits=(10, 2),
        default=0.0,
        help="Standard rate applied to non-member walk-in guests per 1-hour session."
    )

    # Configurable operating hours and slot generation parameters
    opening_hour = fields.Float(
        string='Opening Hour (Configurable)',
        default=6.0,
        help="Configurable facility opening hour in 24h format (e.g. 6.0 for 06:00)"
    )
    closing_hour = fields.Float(
        string='Closing Hour (Configurable)',
        default=23.0,
        help="Configurable facility closing hour in 24h format (e.g. 23.0 for 23:00)"
    )
    slot_interval_minutes = fields.Integer(
        string='Slot Interval Minutes',
        default=30,
        help="New court slot opens every 30 minutes as stated in requirements."
    )

    active = fields.Boolean(string='Active', default=True)
    booking_ids = fields.One2many('club.booking', 'court_id', string='Bookings')

    def get_available_slots(self, target_date, member_id=None):
        """
        Generates authoritative booking slots for this court on the specified date.
        - Sessions last exactly 1 hour.
        - A new slot opens every 30 minutes (e.g. 18:00-19:00, 18:30-19:30, 19:00-20:00).
        - Operating hours are derived from court configuration (not assumed).
        - Active overlapping non-social bookings mark slots as unavailable.
        - Cancelled bookings do not block slots.
        """
        self.ensure_one()
        if isinstance(target_date, str):
            target_date = fields.Date.from_string(target_date)

        # 1. Determine opening and closing boundaries
        start_hour_int = int(self.opening_hour or 6.0)
        start_min_int = int(round(((self.opening_hour or 6.0) - start_hour_int) * 60))
        
        end_hour_int = int(self.closing_hour or 23.0)
        end_min_int = int(round(((self.closing_hour or 23.0) - end_hour_int) * 60))

        current_slot_start = datetime.combine(target_date, time(start_hour_int, start_min_int))
        closing_dt = datetime.combine(target_date, time(end_hour_int, end_min_int))
        session_duration = timedelta(hours=1.0)
        interval = timedelta(minutes=self.slot_interval_minutes or 30)

        # 2. Fetch all active bookings on this court for the day (excluding cancelled)
        day_start = datetime.combine(target_date, time.min)
        day_end = datetime.combine(target_date, time.max)
        
        active_bookings = self.env['club.booking'].sudo().search([
            ('court_id', '=', self.id),
            ('state', 'in', ['draft', 'confirmed']),
            ('start_time', '<=', day_end),
            ('end_time', '>=', day_start)
        ])

        # 3. Resolve Member Pricing vs Walk-in Pricing
        member = None
        if member_id:
            member = self.env['club.member'].sudo().browse(member_id)

        slots = []
        while current_slot_start + session_duration <= closing_dt:
            current_slot_end = current_slot_start + session_duration
            
            # Check for overlapping active non-social booking
            conflicting_booking = False
            is_social = False
            for b in active_bookings:
                if b.is_social_play:
                    if b.start_time < current_slot_end and b.end_time > current_slot_start:
                        is_social = True
                else:
                    if b.start_time < current_slot_end and b.end_time > current_slot_start:
                        conflicting_booking = b
                        break

            # Calculate applicable rate
            if member and member.exists() and member.has_active_benefits:
                plan = member.plan_id
                if plan.court_rate_policy == 'free':
                    rate = 0.0
                else:
                    rate = plan.court_hourly_rate
            else:
                rate = self.walkin_hourly_rate

            slots.append({
                'court_id': self.id,
                'court_name': self.name,
                'sport_type': self.sport_type,
                'start_time': current_slot_start.strftime('%Y-%m-%d %H:%M:%S'),
                'end_time': current_slot_end.strftime('%Y-%m-%d %H:%M:%S'),
                'time_label': f"{current_slot_start.strftime('%H:%M')} – {current_slot_end.strftime('%H:%M')}",
                'duration_hours': 1.0,
                'is_available': (conflicting_booking is False),
                'is_social_play': is_social,
                'conflicting_booking_ref': conflicting_booking.name if conflicting_booking else None,
                'rate_applied': rate
            })

            current_slot_start += interval

        return slots
