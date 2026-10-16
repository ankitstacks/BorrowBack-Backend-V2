
const express = require("express");

const {
    lendItem,
    getActiveLoans,
    getOverdueLoans,
    getReturnedLoans,
    returnItem
} = require("../controllers/loanController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.post("/", lendItem);

router.get("/active", getActiveLoans);
router.get("/overdue", getOverdueLoans);
router.get("/returned", getReturnedLoans);

router.put("/:id/return", returnItem);

module.exports = router;
