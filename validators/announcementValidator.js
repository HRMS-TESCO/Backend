const { body } = require('express-validator');

const createAnnouncementRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be 200 characters or less'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('category')
    .optional()
    .isIn(['General', 'Event', 'Benefits', 'Office', 'Policy', 'Holiday'])
    .withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High'])
    .withMessage('Priority must be Low, Medium, or High'),
  body('audience')
    .optional()
    .isIn(['All', 'Admin', 'HR', 'Employee'])
    .withMessage('Invalid audience'),
  body('expiresAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('expiresAt must be a valid date'),
];

const updateAnnouncementRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Content cannot be empty'),
  body('category')
    .optional()
    .isIn(['General', 'Event', 'Benefits', 'Office', 'Policy', 'Holiday']),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('audience').optional().isIn(['All', 'Admin', 'HR', 'Employee']),
];

module.exports = { createAnnouncementRules, updateAnnouncementRules };
