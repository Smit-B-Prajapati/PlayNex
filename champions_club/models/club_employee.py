# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class ClubEmployee(models.Model):
    _name = 'club.employee'
    _description = 'Champions Club Staff Member'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name'

    name = fields.Char(string='Staff Name', required=True, tracking=True)
    employee_code = fields.Char(string='Staff ID', readonly=True, copy=False, default='New')
    user_id = fields.Many2one('res.users', string='Related User Account', tracking=True)
    
    role = fields.Selection([
        ('front_desk', 'Front Desk & Reception'),
        ('bar_cafe', 'Bar & Cafeteria Staff'),
        ('court_marshal', 'Court Operations & Equipment'),
        ('coach', 'Sports Coach / Trainer'),
        ('management', 'Club Management / Operations')
    ], string='Role / Department', required=True, default='front_desk', tracking=True)

    phone = fields.Char(string='Phone / WhatsApp', tracking=True)
    email = fields.Char(string='Email Address', tracking=True)
    active = fields.Boolean(string='Active Staff', default=True)

    # Linked Shifts and Leave records
    shift_ids = fields.One2many('club.bar.shift', 'employee_id', string='Assigned Shifts')
    leave_ids = fields.One2many('club.employee.leave', 'employee_id', string='Leave Requests')
    
    notes = fields.Text(string='Staff Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('employee_code', 'New') == 'New':
                vals['employee_code'] = self.env['ir.sequence'].next_by_code('club.employee') or 'CC-EMP'
        return super(ClubEmployee, self).create(vals_list)


class ClubEmployeeLeave(models.Model):
    _name = 'club.employee.leave'
    _description = 'Champions Club Employee Leave Record'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'start_date desc'

    employee_id = fields.Many2one('club.employee', string='Staff Member', required=True, tracking=True)
    start_date = fields.Date(string='Leave Start Date', required=True, default=fields.Date.context_today)
    end_date = fields.Date(string='Leave End Date', required=True, default=fields.Date.context_today)
    reason = fields.Text(string='Leave Reason')
    
    state = fields.Selection([
        ('draft', 'To Submit'),
        ('requested', 'Pending Approval'),
        ('approved', 'Approved'),
        ('refused', 'Refused')
    ], string='Status', default='requested', tracking=True)

    approver_id = fields.Many2one('res.users', string='Approved By', readonly=True, tracking=True)

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for leave in self:
            if leave.start_date and leave.end_date and leave.end_date < leave.start_date:
                raise ValidationError("Leave end date cannot be earlier than leave start date.")

    def action_approve(self):
        self.write({
            'state': 'approved',
            'approver_id': self.env.user.id
        })
        return True

    def action_refuse(self):
        self.write({
            'state': 'refused',
            'approver_id': self.env.user.id
        })
        return True
