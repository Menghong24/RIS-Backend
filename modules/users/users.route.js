const { Router } = require("express");
const { createUser, loginUser, getProfile, logOut, findAllUser, deleteUser, updateUser } = require("./users.controller");
const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const router = Router()

router.post("/user/signup", createUser)
router.get("/user/profile", protect , getProfile)
router.post("/user/login", loginUser)
router.post("/user/logout", protect, logOut)
router.get("/user", protect, authorize(["admin"]), findAllUser)
router.delete("/user/:id", protect, authorize(["admin"]), deleteUser)
router.patch("/user/:id", protect, authorize(["admin"]), updateUser)

module.exports = router