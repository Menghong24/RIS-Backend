const jwt = require("jsonwebtoken");
const { UserModel } = require("../users/users.model");

const getBearerToken = (authHeader = "") => {
  const [scheme, token] = String(authHeader).trim().split(/\s+/);

  if (String(scheme || "").toLowerCase() !== "bearer") {
    return null;
  }

  return token || null;
};

exports.protect = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).send({
        err: "JWT secret is not configured"
      });
    }

    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).send({
        err: "សូម login ជាមុនសិន"
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload?._id) {
      return res.status(401).send({
        err: "Invalid token"
      });
    }

    const user = await UserModel.findById(payload._id)
      .select("-password")
      .populate("teacher");

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

    req.user = {
      _id: String(user._id),
      username: user.username,
      role: String(user.role || "").toLowerCase(),
      teacher: user.teacher || null,
      isActive: user.isActive
    };

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).send({
        err: "Invalid token"
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).send({
        err: "Token expired"
      });
    }

    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};