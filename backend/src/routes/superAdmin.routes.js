import express from "express";

import {
  getSuperAdminDashboard,

  getMembershipPlans,
  getMembershipPlanById,
  createMembershipPlan,
  updateMembershipPlan,
  toggleMembershipPlanStatus,

  getBusinesses,
  getBusinessById,
  createBusiness,
  updateBusiness,
  toggleBusinessStatus,
  updateBusinessSubscription,
} from "../controllers/superAdmin.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("SUPER_ADMIN"));

/* =========================================================
   DASHBOARD
========================================================= */

router.get(
  "/dashboard",
  getSuperAdminDashboard
);

/* =========================================================
   MEMBERSHIP PLANS
========================================================= */

router.get(
  "/membership-plans",
  getMembershipPlans
);

router.get(
  "/membership-plans/:id",
  getMembershipPlanById
);

router.post(
  "/membership-plans",
  createMembershipPlan
);

router.patch(
  "/membership-plans/:id",
  updateMembershipPlan
);

router.patch(
  "/membership-plans/:id/status",
  toggleMembershipPlanStatus
);

/* =========================================================
   BUSINESSES
========================================================= */

router.get(
  "/businesses",
  getBusinesses
);

router.get(
  "/businesses/:id",
  getBusinessById
);

router.post(
  "/businesses",
  createBusiness
);

router.patch(
  "/businesses/:id",
  updateBusiness
);

router.patch(
  "/businesses/:id/status",
  toggleBusinessStatus
);

/* =========================================================
   SUBSCRIPTION
========================================================= */

router.patch(
  "/businesses/:id/subscription",
  updateBusinessSubscription
);

export default router;