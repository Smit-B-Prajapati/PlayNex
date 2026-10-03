# -*- coding: utf-8 -*-
from odoo import models, fields

class ClubMemberHistory(models.Model):
    _name = 'club.member.history'
    _description = 'Member Activity & Club History'
    _order = 'timestamp desc, id desc'

    member_id = fields.Many2one(
        'club.member',
        string='Member',
        required=True,
        ondelete='cascade'
    )
    timestamp = fields.Datetime(
        string='Date & Time',
        default=fields.Datetime.now,
        required=True
    )
    activity_type = fields.Selection([
        ('signup', 'Initial Enrollment'),
        ('renewal', 'Validity Renewal'),
        ('checkin', 'Club Check-in / Visit'),
        ('plan_change', 'Plan Upgrade / Downgrade'),
        ('note', 'Staff Note / Interaction')
    ], string='Activity Type', required=True, default='checkin')
    
    description = fields.Char(string='Details / Log Summary', required=True)
    staff_user_id = fields.Many2one(
        'res.users',
        string='Logged By Staff',
        default=lambda self: self.env.user
    )
