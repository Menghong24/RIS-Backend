const { Router } = require("express");
const { createAnnouncement, getAllAnnouncements, getOneAnnouncement, updateAnnouncement, deleteAnnouncement } = require("./announcements.controller");


const router = Router();

router.post('/announcements', createAnnouncement);
router.get('/announcements', getAllAnnouncements);
router.get('/announcements/:id', getOneAnnouncement);
router.patch('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

module.exports = router;