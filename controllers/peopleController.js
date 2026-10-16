const pool = require("../config/db");

// ADD PERSON
const addPerson = async (req, res) => {
    let client;

    try {
        const userId = req.user.userId;
        const { name, phone, notes } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Person name is required"
            });
        }

        const cleanName = name.trim();
        const cleanPhone =
            typeof phone === "string" && phone.trim()
                ? phone.trim()
                : null;
        const cleanNotes =
            typeof notes === "string" && notes.trim()
                ? notes.trim()
                : null;

        // Normalize phone for duplicate detection.
        const normalizedName = cleanName.toLowerCase();
        const normalizedPhone = cleanPhone
            ? cleanPhone.replace(/[\s()-]/g, "")
            : null;

        client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Serialize requests for the same user/person identity.
            const lockKey = `${normalizedName}|${normalizedPhone || ""}`;

            await client.query(
                "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
                [String(userId), lockKey]
            );

            // Prevent duplicate name + phone combinations.
            const duplicate = await client.query(
                `SELECT id, name, phone, notes, created_at
                 FROM people
                 WHERE user_id = $1
                   AND LOWER(TRIM(name)) = $2
                   AND (
                     regexp_replace(COALESCE(phone, ''), '[[:space:]()-]', '', 'g')
                   ) = COALESCE($3, '')
                 ORDER BY id ASC
                 LIMIT 1`,
                [userId, normalizedName, normalizedPhone]
            );

            if (duplicate.rowCount > 0) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    success: false,
                    message: "This person is already saved.",
                    person: duplicate.rows[0]
                });
            }

            const result = await client.query(
                `INSERT INTO people (user_id, name, phone, notes)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, phone, notes, created_at`,
                [userId, cleanName, cleanPhone, cleanNotes]
            );

            await client.query("COMMIT");

            return res.status(201).json({
                success: true,
                message: "Person added successfully",
                person: result.rows[0]
            });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Add Person Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add person"
        });
    }
};

// GET ALL PEOPLE
const getPeople = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, phone, notes, created_at
             FROM people
             WHERE user_id = $1
             ORDER BY name ASC, id ASC`,
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

// DELETE PERSON
const deletePerson = async (req, res) => {
    try {
        const personId = Number(req.params.id);

        if (!Number.isSafeInteger(personId) || personId <= 0) {
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

        // Avoid deleting a person if lending history prevents deletion.
        if (error.code === "23503") {
            return res.status(409).json({
                success: false,
                message: "This person has lending history and cannot be deleted."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to delete person"
        });
    }
};

module.exports = {
    addPerson,
    getPeople,
    deletePerson
};