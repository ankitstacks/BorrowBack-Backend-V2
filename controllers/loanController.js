const pool = require("../config/db");

// LEND ITEM
const lendItem = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            item_id,
            person_id,
            expected_return_at,
            notes
        } = req.body;

        if (!item_id || !person_id) {
            return res.status(400).json({
                success: false,
                message: "Item and person are required"
            });
        }

        const item = await pool.query(
            `SELECT id FROM items
             WHERE id = $1 AND user_id = $2`,
            [item_id, userId]
        );

        if (item.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        const person = await pool.query(
            `SELECT id FROM people
             WHERE id = $1 AND user_id = $2`,
            [person_id, userId]
        );

        if (person.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Person not found"
            });
        }

        const activeLoan = await pool.query(
            `SELECT id FROM loans
             WHERE item_id = $1
             AND user_id = $2
             AND returned_at IS NULL`,
            [item_id, userId]
        );

        if (activeLoan.rowCount > 0) {
            return res.status(409).json({
                success: false,
                message: "This item is already lent out"
            });
        }

        const result = await pool.query(
            `INSERT INTO loans (
                user_id, item_id, person_id,
                expected_return_at, notes
            )
            VALUES (
                $1, $2, $3, $4, $5
            )
            RETURNING *`,
            [
                userId,
                item_id,
                person_id,
                expected_return_at || null,
                notes || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Item lent successfully",
            loan: result.rows[0]
        });
    } catch (error) {
        console.error("Lend Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to lend item"
        });
    }
};

// GET ACTIVE LOANS
const getActiveLoans = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.id, l.item_id, l.person_id,
                    l.lent_at, l.expected_return_at, l.notes,
                    i.name AS item_name,
                    p.name AS person_name
             FROM loans l
             JOIN items i ON i.id = l.item_id
             JOIN people p ON p.id = l.person_id
             WHERE l.user_id = $1
               AND l.returned_at IS NULL
             ORDER BY l.lent_at DESC`,
            [req.user.userId]
        );

        return res.json({
            success: true,
            loans: result.rows
        });
    } catch (error) {
        console.error("Active Loans Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch active loans"
        });
    }
};

// GET OVERDUE LOANS
const getOverdueLoans = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.id, l.item_id, l.person_id,
                    l.lent_at, l.expected_return_at, l.notes,
                    i.name AS item_name,
                    p.name AS person_name
             FROM loans l
             JOIN items i ON i.id = l.item_id
             JOIN people p ON p.id = l.person_id
             WHERE l.user_id = $1
               AND l.returned_at IS NULL
               AND l.expected_return_at < CURRENT_TIMESTAMP
             ORDER BY l.expected_return_at ASC`,
            [req.user.userId]
        );

        return res.json({
            success: true,
            loans: result.rows
        });
    } catch (error) {
        console.error("Overdue Loans Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch overdue loans"
        });
    }
};

// GET RETURNED LOANS
const getReturnedLoans = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.id, l.item_id, l.person_id,
                    l.lent_at, l.expected_return_at,
                    l.returned_at, l.notes,
                    i.name AS item_name,
                    i.category,
                    p.name AS person_name,
                    p.phone
             FROM loans l
             JOIN items i ON i.id = l.item_id
             JOIN people p ON p.id = l.person_id
             WHERE l.user_id = $1
               AND l.returned_at IS NOT NULL
             ORDER BY l.returned_at DESC`,
            [req.user.userId]
        );

        return res.status(200).json({
            success: true,
            message: "Returned loans fetched successfully",
            loans: result.rows
        });
    } catch (error) {
        console.error("Returned Loans Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch returned loans"
        });
    }
};

// RETURN ITEM
const returnItem = async (req, res) => {
    try {
        const loanId = Number(req.params.id);

        if (!Number.isInteger(loanId) || loanId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid loan ID"
            });
        }

        const result = await pool.query(
            `UPDATE loans
             SET returned_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND user_id = $2
               AND returned_at IS NULL
             RETURNING *`,
            [loanId, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Active loan not found"
            });
        }

        return res.json({
            success: true,
            message: "Item returned successfully",
            loan: result.rows[0]
        });
    } catch (error) {
        console.error("Return Item Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to return item"
        });
    }
};

module.exports = {
    lendItem,
    getActiveLoans,
    getOverdueLoans,
    getReturnedLoans,
    returnItem
};