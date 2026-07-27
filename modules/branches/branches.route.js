const { Router } = require("express");

const {
  createBranch,
  getBranches,
  getBranch,
  updateBranch,
  deleteBranch
} = require("./branches.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const router = Router();

/*
  POST /branches

  Only global admin can create a branch.
  The controller checks that the admin account has no assigned branch.
*/
router.post(
  "/branches",
  protect,
  authorize("admin"),
  createBranch
);

/*
  GET /branches

  Global admin:
  - Can view all branches
  - Can search, filter and paginate

  Branch admin:
  - Can only view their assigned branch
*/
router.get(
  "/branches",
  protect,
  authorize("admin"),
  getBranches
);

/*
  GET /branches/:id

  Global admin:
  - Can view any branch

  Branch admin:
  - Can only view their assigned branch
*/
router.get(
  "/branches/:id",
  protect,
  authorize("admin"),
  getBranch
);

/*
  PATCH /branches/:id

  Global admin:
  - Can update all branch fields

  Branch admin:
  - Can update only general information for their branch
*/
router.patch(
  "/branches/:id",
  protect,
  authorize("admin"),
  updateBranch
);

/*
  DELETE /branches/:id

  Only global admin can archive a branch.
  The controller performs a soft delete by setting status to "archived".
*/
router.delete(
  "/branches/:id",
  protect,
  authorize("admin"),
  deleteBranch
);

module.exports = router;