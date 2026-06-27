const { Router } = require("express");
const { createPayment, getAllPayments, getOnePayment, updatePayment, deletePayment } = require("./payments.controller");


const router = Router();



router.post('/payments', createPayment);
router.get('/payments', getAllPayments);
router.get('/payments/:id', getOnePayment);
router.patch('/payments/:id', updatePayment);
router.delete('/payments/:id', deletePayment);

module.exports = router;