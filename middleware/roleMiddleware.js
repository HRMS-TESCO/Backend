/**
 * Role-based access control.
 * Usage: router.post('/', protect, authorize('Admin', 'HR'), handler)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authenticated'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403);
      return next(
        new Error(
          `Role '${req.user.role}' is not allowed to access this resource`
        )
      );
    }
    next();
  };
};

module.exports = { authorize };
