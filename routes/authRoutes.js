const express = require("express");

const {
    signup,
    login,
    getMe,
    forgotPassword,
    verifyResetOtp,
    resetPassword
} = require("../controllers/authController");

const authenticateToken =
    require("../middleware/authMiddleware");

const router =
    express.Router();


// ============================================================
// AUTH ROUTES
// ============================================================

router.post(
    "/signup",
    signup
);


router.post(
    "/login",
    login
);


router.get(
    "/me",
    authenticateToken,
    getMe
);


// ============================================================
// PASSWORD RESET
// ============================================================

router.post(
    "/forgot-password",
    forgotPassword
);


router.post(
    "/verify-otp",
    verifyResetOtp
);


router.post(
    "/reset-password",
    resetPassword
);


module.exports = router;