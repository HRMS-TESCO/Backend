const { body, param } = require('express-validator');

const createPayrollRules = [
  body('employee').isMongoId().withMessage('Valid employee id is required'),
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be 1-12'),
  body('year')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid year'),
  body('basicSalary')
    .isFloat({ min: 0 })
    .withMessage('Basic salary must be a positive number'),
  body('allowances').optional().isObject(),
  body('deductions').optional().isObject(),
  body('status')
    .optional()
    .isIn(['Pending', 'Processed', 'Paid', 'Cancelled']),
  body('paymentMode')
    .optional()
    .isIn(['Bank Transfer', 'Cash', 'Cheque', 'UPI']),
];

const updatePayrollRules = [
  body('basicSalary').optional().isFloat({ min: 0 }),
  body('allowances').optional().isObject(),
  body('deductions').optional().isObject(),
  body('status')
    .optional()
    .isIn(['Pending', 'Processed', 'Paid', 'Cancelled']),
  body('paymentMode')
    .optional()
    .isIn(['Bank Transfer', 'Cash', 'Cheque', 'UPI']),
];

const idParamRule = [param('id').isMongoId().withMessage('Invalid id')];

module.exports = { createPayrollRules, updatePayrollRules, idParamRule };
