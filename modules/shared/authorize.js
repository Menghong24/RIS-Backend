const ALLOWED_ROLES = [
  "admin",
  "teacher",
  "user"
];

const normalizeRole = (role) => {
  return String(role || "")
    .trim()
    .toLowerCase();
};

exports.authorize = (roles = []) => {
  const allowedRoles = Array.isArray(roles)
    ? roles
    : [roles];

  const normalizedAllowedRoles = [
    ...new Set(
      allowedRoles
        .map(normalizeRole)
        .filter((role) =>
          ALLOWED_ROLES.includes(role)
        )
    )
  ];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        err: "Unauthorized: No user found"
      });
    }

    if (normalizedAllowedRoles.length === 0) {
      return res.status(403).json({
        err: "No valid roles are allowed for this route"
      });
    }

    const userRole = normalizeRole(
      req.user.role
    );

    if (!ALLOWED_ROLES.includes(userRole)) {
      return res.status(403).json({
        err: "Invalid user role"
      });
    }

    if (
      !normalizedAllowedRoles.includes(
        userRole
      )
    ) {
      return res.status(403).json({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់មុខងារនេះទេ"
      });
    }

    return next();
  };
};