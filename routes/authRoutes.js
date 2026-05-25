// routes/authRoutes.js — Login / Register / Password Reset
const express       = require('express');
const router        = express.Router();
const bcrypt        = require('bcryptjs');
const User          = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect }   = require('../middleware/authMiddleware');
const sendEmail     = require('../utils/sendEmail');

// In-memory OTP store { email: { otp, expiresAt } }
const otpStore = {};

// POST /api/auth/check-email
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const user = await User.findOne({ email: email.toLowerCase() }).select('_id name email');
    return res.status(200).json({ success: true, exists: !!user, next: user ? 'signin' : 'signup', user: user ? { name: user.name, email: user.email } : null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/authenticate — smart signin / signup
router.post('/authenticate', async (req, res) => {
  try {
    const { email, password, name, role, phone } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const existing = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (existing) {
      if (name) {
        return res.status(400).json({ success: false, message: 'An account with this email already exists. Please sign in instead.' });
      }
      if (!existing.isActive) return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
      const match = await existing.matchPassword(password);
      if (!match) return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
      existing.lastLogin = new Date();
      await existing.save();
      const token = generateToken(existing._id, existing.role);
      return res.status(200).json({ success: true, message: 'Sign in successful', token, user: existing.toSafeObject() });
    }

    // New user signup
    if (!name) return res.status(400).json({ success: false, message: 'No account found with this email. Please sign up first.' });
    const newUser = await User.create({ name: name.trim(), email: email.toLowerCase(), password, role: role || 'employee', phone: phone || '' });
    const token   = generateToken(newUser._id, newUser.role);
    return res.status(201).json({ success: true, message: 'Account created successfully', token, user: newUser.toSafeObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/forgot-password — sends 6-digit OTP to user email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email. Please sign up first.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP in memory
    otpStore[email.toLowerCase()] = { otp, expiresAt };

    const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;border-radius:10px;overflow:hidden;">'
      + '<div style="background:#4CAA17;padding:28px 32px;text-align:center;">'
      + '<h2 style="color:#fff;margin:0;font-size:22px;">TESCO Structures HRM</h2>'
      + '<p style="color:#d4f7b0;margin:6px 0 0;font-size:13px;">Human Resource Management System</p>'
      + '</div>'
      + '<div style="padding:32px;text-align:center;">'
      + '<p style="font-size:15px;color:#333;text-align:left;">Hello <strong>' + user.name + '</strong>,</p>'
      + '<p style="font-size:14px;color:#555;line-height:1.6;text-align:left;">Use the OTP below to reset your TESCO HRM password. This code expires in <strong>10 minutes</strong>.</p>'
      + '<div style="background:#fff;border:2px dashed #4CAA17;border-radius:12px;padding:24px;margin:28px 0;display:inline-block;width:100%;box-sizing:border-box;">'
      + '<div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#4CAA17;font-family:monospace;">' + otp + '</div>'
      + '<p style="font-size:12px;color:#aaa;margin:8px 0 0;">One-Time Password — valid for 10 minutes</p>'
      + '</div>'
      + '<p style="font-size:12px;color:#aaa;text-align:center;">If you did not request this, ignore this email.<br/>Account: <strong>' + user.email + '</strong></p>'
      + '</div></div>';

    await sendEmail({ to: user.email, subject: 'TESCO HRM — Your OTP Code', html });

    console.log('[OTP] Sent to:', user.email, '| OTP:', otp);
    return res.status(200).json({
      success: true,
      message: 'OTP sent to ' + user.email + '. Please check your inbox.',
    });
  } catch (err) {
    console.error('[OTP] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

// POST /api/auth/verify-otp — verify OTP, return resetToken
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const record = otpStore[email.toLowerCase()];
    if (!record) return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
    if (Date.now() > record.expiresAt) {
      delete otpStore[email.toLowerCase()];
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // OTP correct — clear it and return reset token
    delete otpStore[email.toLowerCase()];
    const user = await User.findOne({ email: email.toLowerCase() });
    const resetToken = Buffer.from(String(user._id)).toString('hex');

    return res.status(200).json({ success: true, message: 'OTP verified.', resetToken });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || !password) return res.status(400).json({ success: false, message: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const userId = Buffer.from(resetToken, 'hex').toString('utf8').trim();
    const user   = await User.findById(userId);
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    const salt   = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await User.updateOne({ _id: user._id }, { $set: { password: hashed } });
    console.log('[RESET] Password updated for:', user.email);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. Please sign in with your new password.',
    });
  } catch (err) {
    console.error('[RESET] error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
