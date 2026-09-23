import express from "express";

import {
  createBusiness,
  getBusinesses,
  getMembershipPlans,
} from "../controllers/superAdmin.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";

const router = express.Router();

router.get(
  "/membership-plans",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getMembershipPlans
);

router.get(
  "/businesses",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getBusinesses
);

router.post(
  "/businesses",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  createBusiness
);

export default router;