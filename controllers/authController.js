const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const pool = require("../config/db");


// ============================================================
// EMAIL TRANSPORTER
// ============================================================

const mailTransporter = nodemailer.createTransport({

    host: "smtp.gmail.com",

    port: 465,

    secure: true,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD
    }

});


// ============================================================
// HELPER FUNCTIONS
// ============================================================

const normalizeEmail = (email) => {
    return email.trim().toLowerCase();
};


const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};


const generateOtp = () => {
    return crypto
        .randomInt(100000, 1000000)
        .toString();
};


// ============================================================
// SIGNUP
// ============================================================

const signup = async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;


        // ------------------------------------------
        // VALIDATION
        // ------------------------------------------

        if (
            !name ||
            !email ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, email and password are required"

            });

        }


        const normalizedName =
            name.trim();

        const normalizedEmail =
            normalizeEmail(email);


        if (!normalizedName) {

            return res.status(400).json({

                success: false,

                message:
                    "Name cannot be empty"

            });

        }


        if (!isValidEmail(normalizedEmail)) {

            return res.status(400).json({

                success: false,

                message:
                    "Please enter a valid email address"

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must be at least 6 characters"

            });

        }


        // ------------------------------------------
        // CHECK EXISTING USER
        // ------------------------------------------

        const existingUser =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [normalizedEmail]
            );


        if (existingUser.rows.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    "An account with this email already exists"

            });

        }


        // ------------------------------------------
        // HASH PASSWORD
        // ------------------------------------------

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        // ------------------------------------------
        // INSERT USER
        // ------------------------------------------

        const result =
            await pool.query(
                `
                INSERT INTO users
                (
                    name,
                    email,
                    password_hash
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                RETURNING
                    id,
                    name,
                    email,
                    created_at
                `,
                [
                    normalizedName,
                    normalizedEmail,
                    passwordHash
                ]
            );


        const user =
            result.rows[0];


        return res.status(201).json({

            success: true,

            message:
                "Account created successfully",

            user

        });


    } catch (error) {

        console.error(
            "❌ Signup error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error during signup"

        });

    }

};


// ============================================================
// LOGIN
// ============================================================

const login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        const normalizedEmail =
            normalizeEmail(email);


        // ------------------------------------------
        // FIND USER
        // ------------------------------------------

        const userResult =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    password_hash,
                    created_at,
                    last_login_at
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [normalizedEmail]
            );


        if (userResult.rows.length === 0) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        const user =
            userResult.rows[0];


        // ------------------------------------------
        // CHECK PASSWORD
        // ------------------------------------------

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        // ------------------------------------------
        // FAILED LOGIN
        // ------------------------------------------

        if (!passwordMatch) {

            await pool.query(
                `
                INSERT INTO login_history
                (
                    user_id,
                    login_at,
                    success
                )
                VALUES
                (
                    $1,
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                `,
                [user.id]
            );


            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        // ------------------------------------------
        // SUCCESSFUL LOGIN
        // ------------------------------------------

        await pool.query(
            `
            UPDATE users
            SET last_login_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [user.id]
        );


        await pool.query(
            `
            INSERT INTO login_history
            (
                user_id,
                login_at,
                success
            )
            VALUES
            (
                $1,
                CURRENT_TIMESTAMP,
                TRUE
            )
            `,
            [user.id]
        );


        // ------------------------------------------
        // JWT
        // ------------------------------------------

        const token =
            jwt.sign(
                {
                    userId: user.id,
                    email: user.email
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );


        return res.status(200).json({

            success: true,

            message:
                "Login successful",

            token,

            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                created_at:
                    user.created_at,

                last_login_at:
                    user.last_login_at

            }

        });


    } catch (error) {

        console.error(
            "❌ Login error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error during login"

        });

    }

};


// ============================================================
// GET CURRENT USER
// ============================================================

const getMe = async (req, res) => {

    try {

        const userResult =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    created_at,
                    last_login_at
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [req.user.userId]
            );


        if (userResult.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        return res.status(200).json({

            success: true,

            user:
                userResult.rows[0]

        });


    } catch (error) {

        console.error(
            "❌ Get me error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    }

};


// ============================================================
// FORGOT PASSWORD
// ============================================================

const forgotPassword = async (req, res) => {

    const client =
        await pool.connect();


    try {

        const { email } =
            req.body;


        // ------------------------------------------
        // VALIDATION
        // ------------------------------------------

        if (!email) {

            return res.status(400).json({

                success: false,

                message:
                    "Email is required"

            });

        }


        const normalizedEmail =
            normalizeEmail(email);


        if (!isValidEmail(normalizedEmail)) {

            return res.status(400).json({

                success: false,

                message:
                    "Please enter a valid email address"

            });

        }


        // ------------------------------------------
        // FIND USER
        // ------------------------------------------

        const userResult =
            await client.query(
                `
                SELECT
                    id,
                    name,
                    email
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [normalizedEmail]
            );


        /*
         * Security:
         * Don't reveal whether an email exists.
         */

        if (userResult.rows.length === 0) {

            return res.status(200).json({

                success: true,

                message:
                    "If an account exists for this email, a verification OTP has been sent."

            });

        }


        const user =
            userResult.rows[0];


        // ------------------------------------------
        // CHECK 60 SECOND COOLDOWN
        // ------------------------------------------

        const recentOtpResult =
            await client.query(
                `
                SELECT
                    id,
                    last_sent_at
                FROM password_reset_tokens
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                `,
                [user.id]
            );


        if (
            recentOtpResult.rows.length > 0 &&
            recentOtpResult.rows[0].last_sent_at
        ) {

            const lastSentAt =
                new Date(
                    recentOtpResult.rows[0].last_sent_at
                );


            const now =
                new Date();


            const secondsPassed =
                Math.floor(
                    (now - lastSentAt) / 1000
                );


            if (secondsPassed < 60) {

                const remainingSeconds =
                    60 - secondsPassed;


                return res.status(429).json({

                    success: false,

                    message:
                        `Please wait ${remainingSeconds} seconds before requesting another OTP.`,

                    retryAfter:
                        remainingSeconds

                });

            }

        }


        // ------------------------------------------
        // GENERATE OTP
        // ------------------------------------------

        const otp =
            generateOtp();


        console.log(
            `🔐 Password reset OTP generated for ${normalizedEmail}`
        );


        // ------------------------------------------
        // HASH OTP
        // ------------------------------------------

        const otpHash =
            await bcrypt.hash(
                otp,
                12
            );


        // ------------------------------------------
        // OTP EXPIRY
        // 10 MINUTES
        // ------------------------------------------

        const expiresAt =
            new Date(
                Date.now() +
                10 * 60 * 1000
            );


        // ------------------------------------------
        // BEGIN TRANSACTION
        // ------------------------------------------

        await client.query("BEGIN");


        // ------------------------------------------
        // INVALIDATE OLD OTPs
        // ------------------------------------------

        await client.query(
            `
            UPDATE password_reset_tokens
            SET used = TRUE
            WHERE user_id = $1
              AND used = FALSE
            `,
            [user.id]
        );


        // ------------------------------------------
        // CREATE NEW OTP
        // ------------------------------------------

        const tokenResult =
            await client.query(
                `
                INSERT INTO password_reset_tokens
                (
                    user_id,
                    otp_hash,
                    expires_at,
                    used,
                    attempt_count,
                    last_sent_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    FALSE,
                    0,
                    CURRENT_TIMESTAMP
                )
                RETURNING id
                `,
                [
                    user.id,
                    otpHash,
                    expiresAt
                ]
            );


        const resetTokenId =
            tokenResult.rows[0].id;


        // ------------------------------------------
        // SEND EMAIL
        // ------------------------------------------

        await mailTransporter.sendMail({

            from:
                `"BorrowBack" <${process.env.SMTP_USER}>`,

            to:
                normalizedEmail,

            subject:
                "BorrowBack Password Reset Code",

            text: `
Your BorrowBack password reset code is: ${otp}

This code expires in 10 minutes.

You have 3 attempts to enter the correct OTP.

If you did not request a password reset,
please ignore this email.

BorrowBack Password Recovery
            `.trim(),

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: auto;
                    padding: 25px;
                ">

                    <h2 style="
                        color: #4f46e5;
                    ">
                        BorrowBack
                    </h2>

                    <h3>
                        Password Reset Code
                    </h3>

                    <p>
                        Hi <strong>${user.name}</strong>,
                    </p>

                    <p>
                        Your password reset code is:
                    </p>

                    <div style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        margin: 25px 0;
                        padding: 20px;
                        text-align: center;
                        background: #f5f3ff;
                        border-radius: 10px;
                        color: #4f46e5;
                    ">
                        ${otp}
                    </div>

                    <p>
                        This code expires in
                        <strong>10 minutes</strong>.
                    </p>

                    <p>
                        You have
                        <strong>3 attempts</strong>
                        to enter the correct OTP.
                    </p>

                    <p>
                        If you did not request a password reset,
                        please ignore this email.
                    </p>

                    <hr>

                    <p style="
                        color: #9ca3af;
                        font-size: 12px;
                        text-align: center;
                    ">
                        BorrowBack Password Recovery
                    </p>

                </div>
            `

        });


        // ------------------------------------------
        // COMMIT
        // ------------------------------------------

        await client.query("COMMIT");


        console.log(
            `✅ Password reset OTP sent to ${normalizedEmail}`
        );


        return res.status(200).json({

            success: true,

            message:
                "Verification OTP has been sent to your email",

            resetTokenId,

            retryAfter: 60,

            attemptsRemaining: 3

        });


    } catch (error) {

        try {

            await client.query("ROLLBACK");

        } catch (rollbackError) {

            console.error(
                "❌ Rollback error:",
                rollbackError
            );

        }


        console.error(
            "❌ Forgot password error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to send password reset email. Please try again later."

        });

    } finally {

        client.release();

    }

};


// ============================================================
// VERIFY OTP
// ============================================================

const verifyResetOtp = async (req, res) => {

    try {

        const {
            email,
            otp
        } = req.body;


        // ------------------------------------------
        // VALIDATION
        // ------------------------------------------

        if (!email || !otp) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and OTP are required"

            });

        }


        const normalizedEmail =
            normalizeEmail(email);


        const normalizedOtp =
            String(otp).trim();


        if (!isValidEmail(normalizedEmail)) {

            return res.status(400).json({

                success: false,

                message:
                    "Please enter a valid email address"

            });

        }


        if (!/^\d{6}$/.test(normalizedOtp)) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP must be a 6-digit number"

            });

        }


        // ------------------------------------------
        // FIND USER
        // ------------------------------------------

        const userResult =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [normalizedEmail]
            );


        if (userResult.rows.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid or expired OTP"

            });

        }


        const userId =
            userResult.rows[0].id;


        // ------------------------------------------
        // GET LATEST ACTIVE OTP
        // ------------------------------------------

        const tokenResult =
            await pool.query(
                `
                SELECT
                    id,
                    otp_hash,
                    expires_at,
                    used,
                    attempt_count
                FROM password_reset_tokens
                WHERE user_id = $1
                  AND used = FALSE
                ORDER BY created_at DESC
                LIMIT 1
                `,
                [userId]
            );


        if (tokenResult.rows.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid or expired OTP"

            });

        }


        const resetToken =
            tokenResult.rows[0];


        // ------------------------------------------
        // CHECK EXPIRY
        // ------------------------------------------

        if (
            new Date(resetToken.expires_at)
            <= new Date()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP has expired. Please request a new OTP."

            });

        }


        // ------------------------------------------
        // CHECK ATTEMPT LIMIT
        // ------------------------------------------

        if (
            resetToken.attempt_count >= 3
        ) {

            return res.status(429).json({

                success: false,

                message:
                    "Too many incorrect attempts. Please request a new OTP.",

                attemptsRemaining: 0

            });

        }


        // ------------------------------------------
        // COMPARE OTP
        // ------------------------------------------

        const otpMatch =
            await bcrypt.compare(
                normalizedOtp,
                resetToken.otp_hash
            );


        // ------------------------------------------
        // WRONG OTP
        // ------------------------------------------

        if (!otpMatch) {

            const newAttemptCount =
                resetToken.attempt_count + 1;


            // --------------------------------------
            // THIRD WRONG ATTEMPT
            // --------------------------------------

            if (newAttemptCount >= 3) {

                await pool.query(
                    `
                    UPDATE password_reset_tokens
                    SET
                        attempt_count = $1,
                        used = TRUE
                    WHERE id = $2
                    `,
                    [
                        newAttemptCount,
                        resetToken.id
                    ]
                );


                return res.status(429).json({

                    success: false,

                    message:
                        "Too many incorrect attempts. This OTP has been invalidated. Please request a new OTP.",

                    attemptsRemaining: 0

                });

            }


            // --------------------------------------
            // UPDATE ATTEMPT COUNT
            // --------------------------------------

            await pool.query(
                `
                UPDATE password_reset_tokens
                SET attempt_count = $1
                WHERE id = $2
                `,
                [
                    newAttemptCount,
                    resetToken.id
                ]
            );


            const attemptsRemaining =
                3 - newAttemptCount;


            return res.status(400).json({

                success: false,

                message:
                    `Incorrect OTP. You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`,

                attemptsRemaining

            });

        }


        // ------------------------------------------
        // OTP CORRECT
        // ------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "OTP verified successfully",

            resetTokenId:
                resetToken.id,

            attemptsRemaining:
                3 - resetToken.attempt_count

        });


    } catch (error) {

        console.error(
            "❌ Verify OTP error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while verifying OTP"

        });

    }

};


// ============================================================
// RESET PASSWORD
// ============================================================

const resetPassword = async (req, res) => {

    try {

        const {
            email,
            otp,
            newPassword
        } = req.body;


        // ------------------------------------------
        // VALIDATION
        // ------------------------------------------

        if (
            !email ||
            !otp ||
            !newPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email, OTP and new password are required"

            });

        }


        if (newPassword.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "New password must be at least 6 characters"

            });

        }


        const normalizedEmail =
            normalizeEmail(email);


        const normalizedOtp =
            String(otp).trim();


        // ------------------------------------------
        // FIND USER
        // ------------------------------------------

        const userResult =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [normalizedEmail]
            );


        if (userResult.rows.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid password reset request"

            });

        }


        const userId =
            userResult.rows[0].id;


        // ------------------------------------------
        // GET ACTIVE OTP
        // ------------------------------------------

        const tokenResult =
            await pool.query(
                `
                SELECT
                    id,
                    otp_hash,
                    expires_at,
                    used,
                    attempt_count
                FROM password_reset_tokens
                WHERE id = (
                    SELECT id
                    FROM password_reset_tokens
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                `,
                [userId]
            );


        if (tokenResult.rows.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid or expired password reset request"

            });

        }


        const resetToken =
            tokenResult.rows[0];


        // ------------------------------------------
        // CHECK USED
        // ------------------------------------------

        if (resetToken.used) {

            return res.status(400).json({

                success: false,

                message:
                    "This OTP is no longer valid"

            });

        }


        // ------------------------------------------
        // CHECK ATTEMPT LIMIT
        // ------------------------------------------

        if (
            resetToken.attempt_count >= 3
        ) {

            return res.status(429).json({

                success: false,

                message:
                    "Too many incorrect attempts. Please request a new OTP."

            });

        }


        // ------------------------------------------
        // CHECK EXPIRY
        // ------------------------------------------

        if (
            new Date(resetToken.expires_at)
            <= new Date()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP has expired. Please request a new OTP."

            });

        }


        // ------------------------------------------
        // VERIFY OTP AGAIN
        // ------------------------------------------

        const otpMatch =
            await bcrypt.compare(
                normalizedOtp,
                resetToken.otp_hash
            );


        if (!otpMatch) {

            const newAttemptCount =
                resetToken.attempt_count + 1;


            if (newAttemptCount >= 3) {

                await pool.query(
                    `
                    UPDATE password_reset_tokens
                    SET
                        attempt_count = $1,
                        used = TRUE
                    WHERE id = $2
                    `,
                    [
                        newAttemptCount,
                        resetToken.id
                    ]
                );


                return res.status(429).json({

                    success: false,

                    message:
                        "Too many incorrect attempts. Please request a new OTP."

                });

            }


            await pool.query(
                `
                UPDATE password_reset_tokens
                SET attempt_count = $1
                WHERE id = $2
                `,
                [
                    newAttemptCount,
                    resetToken.id
                ]
            );


            return res.status(400).json({

                success: false,

                message:
                    "Invalid OTP"

            });

        }


        // ------------------------------------------
        // HASH NEW PASSWORD
        // ------------------------------------------

        const passwordHash =
            await bcrypt.hash(
                newPassword,
                12
            );


        // ------------------------------------------
        // UPDATE PASSWORD
        // ------------------------------------------

        await pool.query(
            `
            UPDATE users
            SET password_hash = $1
            WHERE id = $2
            `,
            [
                passwordHash,
                userId
            ]
        );


        // ------------------------------------------
        // MARK OTP USED
        // ------------------------------------------

        await pool.query(
            `
            UPDATE password_reset_tokens
            SET used = TRUE
            WHERE id = $1
            `,
            [resetToken.id]
        );


        return res.status(200).json({

            success: true,

            message:
                "Password reset successfully"

        });


    } catch (error) {

        console.error(
            "❌ Reset password error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Server error while resetting password"

        });

    }

};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    signup,

    login,

    getMe,

    forgotPassword,

    verifyResetOtp,

    resetPassword

};