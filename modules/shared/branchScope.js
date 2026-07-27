const mongoose = require("mongoose");

const toIdString = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  const id = toIdString(value);

  return Boolean(id) &&
    mongoose.Types.ObjectId.isValid(id);
};

const getRequestedBranchId = (req) => {
  return (
    toIdString(req.params?.branchId) ||
    toIdString(req.query?.branchId) ||
    toIdString(req.query?.branch) ||
    toIdString(req.body?.branchId) ||
    toIdString(req.body?.branch) ||
    ""
  );
};

const branchScope = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).send({
        err: "Unauthorized: No user found"
      });
    }

    const role = String(req.user.role || "")
      .trim()
      .toLowerCase();

    const userBranchId = toIdString(
      req.user.branch
    );

    const requestedBranchId =
      getRequestedBranchId(req);

    const globalAdmin =
      req.user.isGlobalAdmin === true ||
      (role === "admin" && !userBranchId);

    /*
      Global admin:
      - Can access all branches.
      - Can optionally select one branch.
    */
    if (globalAdmin) {
      if (
        requestedBranchId &&
        !isValidObjectId(requestedBranchId)
      ) {
        return res.status(400).send({
          err: "branchId មិនត្រឹមត្រូវ"
        });
      }

      req.branchId =
        requestedBranchId || null;

      req.branchFilter = requestedBranchId
        ? {
            branch: requestedBranchId
          }
        : {};

      return next();
    }

    /*
      Non-global users must belong to a branch.
    */
    if (
      !userBranchId ||
      !isValidObjectId(userBranchId)
    ) {
      return res.status(403).send({
        err: "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
      });
    }

    /*
      Prevent branch admins, teachers and users
      from requesting another branch.
    */
    if (
      requestedBranchId &&
      !isValidObjectId(requestedBranchId)
    ) {
      return res.status(400).send({
        err: "branchId មិនត្រឹមត្រូវ"
      });
    }

    if (
      requestedBranchId &&
      requestedBranchId !== userBranchId
    ) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យសាខានេះទេ"
      });
    }

    req.branchId = userBranchId;

    req.branchFilter = {
      branch: userBranchId
    };

    return next();
  } catch (error) {
    return res.status(500).send({
      err:
        error.message ||
        "Internal server error"
    });
  }
};

module.exports = {
  branchScope,
  getRequestedBranchId,
  toIdString,
  isValidObjectId
};