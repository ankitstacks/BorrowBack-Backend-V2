const express = require("express");

const {
    addItem,
    getItems,
    deleteItem
} = require("../controllers/itemController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.post("/", addItem);
router.get("/", getItems);
router.delete("/:id", deleteItem);

module.exports = router;
