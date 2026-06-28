const normalizeRole = (role) => {
  return String(role || "").trim().toLowerCase();
};

exports.authorize = (roles = []) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  const normalizedAllowedRoles = allowedRoles
    .map((role) => normalizeRole(role))
    .filter(Boolean);

  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        err: "Unauthorized: No user found"
      });
    }

    if (normalizedAllowedRoles.length === 0) {
      return res.status(403).json({
        err: "No roles are allowed for this route"
      });
    }

    const userRole = normalizeRole(user.role);

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់មុខងារនេះទេ"
      });
    }

    next();
  };
};