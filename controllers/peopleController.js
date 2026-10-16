
const pool = require("../config/db");

// Add a person
const addPerson = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, phone, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Person name is required"
            });
        }

        const result = await pool.query(
            `INSERT INTO people (user_id, name, phone, notes)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, phone, notes, created_at`,
            [
                userId,
                name.trim(),
                phone?.trim() || null,
                notes?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Person added successfully",
            person: result.rows[0]
        });
    } catch (error) {
        console.error("Add Person Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add person"
        });
    }
};

// Get all people for the logged-in user
const getPeople = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, phone, notes, created_at
             FROM people
             WHERE user_id = $1
             ORDER BY name ASC`,
            [req.user.userId]
        );

        return res.status(200).json({
            success: true,
            people: result.rows
        });
    } catch (error) {
        console.error("Get People Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch people"
        });
    }
};

// Delete a person
const deletePerson = async (req, res) => {
    try {
        const personId = Number(req.params.id);

        if (!Number.isInteger(personId) || personId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid person ID"
            });
        }

        const result = await pool.query(
            `DELETE FROM people
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [personId, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Person not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Person deleted successfully"
        });
    } catch (error) {
        console.error("Delete Person Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete person"
        });
    }
};

module.exports = { addPerson, getPeople, deletePerson };
