
const pool = require("../config/db");

// ADD ITEM
const addItem = async (req, res) => {
    let client;

    try {
        const userId = req.user.userId;
        const { name, category, notes } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Item name is required"
            });
        }

        const cleanName = name.trim();
        const cleanCategory =
            typeof category === "string" && category.trim()
                ? category.trim()
                : null;
        const cleanNotes =
            typeof notes === "string" && notes.trim()
                ? notes.trim()
                : null;

        client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Prevent concurrent identical insert requests
            // for the same user from passing the check together.
            await client.query(
                "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
                [String(userId), cleanName.toLowerCase()]
            );

            const duplicate = await client.query(
                `SELECT id
                 FROM items
                 WHERE user_id = $1
                   AND LOWER(TRIM(name)) = LOWER($2)
                   AND COALESCE(LOWER(TRIM(category)), '') =
                       COALESCE(LOWER($3), '')
                   AND COALESCE(TRIM(notes), '') =
                       COALESCE($4, '')
                 LIMIT 1`,
                [userId, cleanName, cleanCategory, cleanNotes]
            );

            if (duplicate.rowCount > 0) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    success: false,
                    message: "This item with the same details already exists.",
                    itemId: duplicate.rows[0].id
                });
            }

            const result = await client.query(
                `INSERT INTO items
                    (user_id, name, category, notes)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, category, notes, created_at`,
                [userId, cleanName, cleanCategory, cleanNotes]
            );

            await client.query("COMMIT");

            return res.status(201).json({
                success: true,
                message: "Item added successfully",
                item: result.rows[0]
            });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Add Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add item"
        });
    }
};


// GET ALL ITEMS
const getItems = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                i.id,
                i.name,
                i.category,
                i.notes,
                i.created_at,
                EXISTS (
                    SELECT 1
                    FROM loans l
                    WHERE l.item_id = i.id
                      AND l.user_id = i.user_id
                      AND l.returned_at IS NULL
                ) AS is_lent
             FROM items i
             WHERE i.user_id = $1
             ORDER BY i.created_at DESC, i.id DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        console.error("Get Items Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch items"
        });
    }
};


// DELETE ITEM
const deleteItem = async (req, res) => {
    try {
        const userId = req.user.userId;
        const itemId = Number(req.params.id);

        if (!Number.isSafeInteger(itemId) || itemId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid item ID"
            });
        }

        const existingLoan = await pool.query(
            `SELECT id, returned_at
             FROM loans
             WHERE item_id = $1 AND user_id = $2
             LIMIT 1`,
            [itemId, userId]
        );

        if (existingLoan.rowCount > 0) {
            const hasActiveLoan = existingLoan.rows.some(
                loan => loan.returned_at === null
            );

            return res.status(409).json({
                success: false,
                message: hasActiveLoan
                    ? "Return this item before deleting it."
                    : "This item has lending history and cannot be deleted."
            });
        }

        const result = await pool.query(
            `DELETE FROM items
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [itemId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item deleted successfully"
        });
    } catch (error) {
        console.error("Delete Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete item"
        });
    }
};

module.exports = {
    addItem,
    getItems,
    deleteItem
};
