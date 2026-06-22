import { Router } from "express";
import {
  register,
  login,
  logout,
  getMe,
  changePassword,
  deleteAccount,
} from "../controllers/auth.controller";
import { protect } from "../middleware/authGuard";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

// ── Public Routes ────────────────────────────────────────
// @route  POST /api/v1/auth/register
// @desc   Register a new user
// @access Public
router.post("/register", authLimiter, register);

// @route  POST /api/v1/auth/login
// @desc   Login user and get token
// @access Public
router.post("/login", authLimiter, login);

// ── Private Routes ───────────────────────────────────────
// @route  POST /api/v1/auth/logout
// @desc   Logout user and remove FCM token
// @access Private
router.post("/logout", protect, logout);

// @route  GET /api/v1/auth/me
// @desc   Get current logged in user
// @access Private
router.get("/me", protect, getMe);

// @route  PUT /api/v1/auth/change-password
// @desc   Change user password
// @access Private
router.put("/change-password", protect, changePassword);

// @route  DELETE /api/v1/auth/delete-account
// @desc   Delete user account
// @access Private
router.delete("/delete-account", protect, deleteAccount);

export default router;
