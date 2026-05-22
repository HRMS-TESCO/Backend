const express = require('express');
const asyncHandler = require('express-async-handler');

const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { registerRules, loginRules } = require('../validators/authValidator');

const router = express.Router();

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
router.post(
  '/register',
  registerRules,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { name, email, password, role, employeeId, department, designation } = req.body;
    const exists = await User.findOne({ email });
    if (exists) {
      res.status(409);
      throw new Error('User with this email already exists');
    }
    const user = await User.create({
      name, email, password, role, employeeId, department, designation,
    });
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user),
      },
    });
  })
);

/**
 * @desc    Login user and get JWT
 * @route   POST /api/auth/login
 * @access  Public
 */
router.post(
  '/login',
  loginRules,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user),
      },
    });
  })
);

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: req.user });
  })
);

module.exports = router;
