
const express = require("express");

const {
    addPerson,
    getPeople,
    deletePerson
} = require("../controllers/peopleController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.post("/", addPerson);
router.get("/", getPeople);
router.delete("/:id", deletePerson);

module.exports = router;
