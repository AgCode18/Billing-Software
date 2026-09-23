import express from "express";

import {
  getDashboard,
} from "../controllers/admin.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import businessMiddleware from "../middleware/business.middleware.js";

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  businessMiddleware,
  getDashboard
);

export default router;