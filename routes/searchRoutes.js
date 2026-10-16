
const express = require("express");
const { smartSearch } = require("../controllers/searchController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

// GET /api/search?q=Who%20has%20my%20calculator
router.get("/", smartSearch);

// POST /api/search with { "query": "Who has my calculator?" }
router.post("/", smartSearch);

module.exports = router;
