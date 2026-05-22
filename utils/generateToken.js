const jwt = require('jsonwebtoken');

/**
 * Sign a JWT for an authenticated user.
 * Accepts both JWT_EXPIRE and JWT_EXPIRES_IN env names.
 */
const generateToken = (user) => {
  const expiresIn =
    process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

module.exports = generateToken;
