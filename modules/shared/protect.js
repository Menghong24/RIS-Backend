
const jwt = require("jsonwebtoken");

const {
  UserModel
} = require("../users/users.model");

const getBearerToken = (
  authHeader = ""
) => {
  const [scheme, token] = String(
    authHeader
  )
    .trim()
    .split(/\s+/);

  if (
    String(scheme || "").toLowerCase() !==
    "bearer"
  ) {
    return null;
  }

  return token || null;
};

const toIdString = (value) => {
  return String(
    value?._id || value || ""
  ).trim();
};

exports.protect = async (
  req,
  res,
  next
) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).send({
        err: "JWT secret is not configured"
      });
    }

    const token = getBearerToken(
      req.headers.authorization
    );

    if (!token) {
      return res.status(401).send({
        err: "សូម login ជាមុនសិន"
      });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!payload?._id) {
      return res.status(401).send({
        err: "Invalid token"
      });
    }

    /*
      Always load the current user from the database.

      Do not trust role, teacher or branch values
      stored inside an old JWT because they may have
      changed after the token was created.
    */
    const user = await UserModel.findById(
      payload._id
    )
      .select("-password")
      .populate({
        path: "teacher",
        select:
          "khmerName englishName profileImage branch status"
      })
      .populate({
        path: "branch",
        select:
          "branchCode branchName status phone email address"
      });

    if (!user) {
      return res.status(401).send({
        err: "User not found or token expired"
      });
    }

    if (user.isActive === false) {
      return res.status(403).send({
        err: "គណនីនេះត្រូវបានបិទការប្រើប្រាស់"
      });
    }

    const role = String(
      user.role || ""
    )
      .trim()
      .toLowerCase();

    const branchId = toIdString(
      user.branch
    );

    const teacherId = toIdString(
      user.teacher
    );

    /*
      Global admin:
      role = admin
      branch = null

      Branch admin:
      role = admin
      branch = Branch ID

      Teacher/user:
      Must have a Branch ID
    */
    const isGlobalAdmin =
      role === "admin" && !branchId;

    if (
      !isGlobalAdmin &&
      !branchId
    ) {
      return res.status(403).send({
        err: "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
      });
    }

    /*
      Block accounts assigned to disabled
      or archived branches.
    */
    if (
      user.branch &&
      user.branch.status !== "active"
    ) {
      return res.status(403).send({
        err: "សាខានេះត្រូវបានបិទការប្រើប្រាស់"
      });
    }

    if (
      role === "teacher" &&
      !teacherId
    ) {
      return res.status(403).send({
        err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
      });
    }

    /*
      Ensure the teacher profile belongs to
      the same branch as the user account.
    */
    if (
      role === "teacher" &&
      user.teacher?.branch &&
      toIdString(user.teacher.branch) !==
        branchId
    ) {
      return res.status(403).send({
        err: "Teacher profile និង User account មិនស្ថិតក្នុងសាខាដូចគ្នាទេ"
      });
    }

    req.user = {
      _id: String(user._id),
      username: user.username,
      role,
      teacher: user.teacher || null,
      branch: user.branch || null,
      isGlobalAdmin,
      isActive: user.isActive
    };

    return next();
  } catch (error) {
    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).send({
        err: "Token expired"
      });
    }

    if (
      error.name ===
      "JsonWebTokenError"
    ) {
      return res.status(401).send({
        err: "Invalid token"
      });
    }

    if (
      error.name ===
      "NotBeforeError"
    ) {
      return res.status(401).send({
        err: "Token is not active yet"
      });
    }

    return res.status(500).send({
      err:
        error.message ||
        "Internal server error"
    });
  }
}; 
