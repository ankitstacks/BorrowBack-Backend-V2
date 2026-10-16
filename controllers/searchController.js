
const pool = require("../config/db");

// SMART SEARCH
const smartSearch = async (req, res) => {
    try {
        const userId = req.user.userId;
        const rawQuery = String(req.query.q || req.body?.query || "").trim();

        if (!rawQuery) {
            return res.status(400).json({
                success: false,
                message: "Please enter a search query"
            });
        }

        if (rawQuery.length > 200) {
            return res.status(400).json({
                success: false,
                message: "Search query must be under 200 characters"
            });
        }

        const query = rawQuery.toLowerCase().replace(/[?!.,]/g, "").trim();

        let result;

        // Example: "Show my overdue items"
        if (
            query.includes("overdue") ||
            query.includes("late") ||
            query.includes("past due")
        ) {
            result = await pool.query(
                `SELECT l.id, l.lent_at, l.expected_return_at,
                        l.notes, i.name AS item_name,
                        i.category, p.name AS person_name, p.phone
                 FROM loans l
                 JOIN items i ON i.id = l.item_id
                 JOIN people p ON p.id = l.person_id
                 WHERE l.user_id = $1
                   AND l.returned_at IS NULL
                   AND l.expected_return_at IS NOT NULL
                   AND l.expected_return_at < CURRENT_TIMESTAMP
                 ORDER BY l.expected_return_at ASC`,
                [userId]
            );

            return res.json({
                success: true,
                type: "overdue",
                message: result.rows.length
                    ? `Found ${result.rows.length} overdue loan(s)`
                    : "You have no overdue items",
                results: result.rows
            });
        }

        // Example: "Who has my calculator?"
        const itemMatch = query.match(
            /(?:who has|who borrowed|where is|who's got)\s+(?:my\s+)?(.+)/
        );

        if (itemMatch) {
            const itemName = itemMatch[1].trim();

            result = await pool.query(
                `SELECT l.id, l.lent_at, l.expected_return_at,
                        l.notes, i.name AS item_name,
                        i.category, p.name AS person_name, p.phone
                 FROM loans l
                 JOIN items i ON i.id = l.item_id
                 JOIN people p ON p.id = l.person_id
                 WHERE l.user_id = $1
                   AND l.returned_at IS NULL
                   AND i.name ILIKE $2
                 ORDER BY l.lent_at DESC`,
                [userId, `%${itemName}%`]
            );

            return res.json({
                success: true,
                type: "item_holder",
                message: result.rows.length
                    ? `Found ${result.rows.length} matching active loan(s)`
                    : `No one currently has an item matching "${itemName}"`,
                results: result.rows
            });
        }

        // Example: "What does Rahul have?"
        const personMatch = query.match(
            /(?:what does|what has|items with|items borrowed by|show items of)\s+(.+?)\s+(?:have|has|borrowed|got)$/
        );

        if (personMatch) {
            const personName = personMatch[1].trim();

            result = await pool.query(
                `SELECT l.id, l.lent_at, l.expected_return_at,
                        l.notes, i.name AS item_name,
                        i.category, p.name AS person_name, p.phone
                 FROM loans l
                 JOIN items i ON i.id = l.item_id
                 JOIN people p ON p.id = l.person_id
                 WHERE l.user_id = $1
                   AND l.returned_at IS NULL
                   AND p.name ILIKE $2
                 ORDER BY l.lent_at DESC`,
                [userId, `%${personName}%`]
            );

            return res.json({
                success: true,
                type: "person_items",
                message: result.rows.length
                    ? `Found ${result.rows.length} active loan(s)`
                    : `No active loans found for "${personName}"`,
                results: result.rows
            });
        }

        // Fallback: search item and person names together
        result = await pool.query(
            `SELECT l.id, l.lent_at, l.expected_return_at,
                    l.notes, i.name AS item_name,
                    i.category, p.name AS person_name, p.phone
             FROM loans l
             JOIN items i ON i.id = l.item_id
             JOIN people p ON p.id = l.person_id
             WHERE l.user_id = $1
               AND l.returned_at IS NULL
               AND (
                   i.name ILIKE $2 OR
                   p.name ILIKE $2
               )
             ORDER BY l.lent_at DESC`,
            [userId, `%${query}%`]
        );

        return res.json({
            success: true,
            type: "general",
            message: result.rows.length
                ? `Found ${result.rows.length} matching active loan(s)`
                : "No matching active loans found. Try an item or person's name.",
            results: result.rows
        });

    } catch (error) {
        console.error("Smart Search Error:", error);

        return res.status(500).json({
            success: false,
            message: "Smart search failed"
        });
    }
};

module.exports = { smartSearch };
