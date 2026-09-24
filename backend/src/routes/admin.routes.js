import express from "express";

import {
  getAdminDashboard,
  getBusinessProfile,
  updateBusinessProfile,
  getAdminSubscription,
} from "../controllers/admin.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import businessMiddleware from "../middleware/business.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Admin Authentication
|--------------------------------------------------------------------------
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| Business Context
|--------------------------------------------------------------------------
*/

router.use(businessMiddleware);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

router.get(
  "/dashboard",
  getAdminDashboard
);

/*
|--------------------------------------------------------------------------
| Business Profile
|--------------------------------------------------------------------------
*/

router.get(
  "/business-profile",
  getBusinessProfile
);

router.patch(
  "/business-profile",
  updateBusinessProfile
);

/*
|--------------------------------------------------------------------------
| Subscription
|--------------------------------------------------------------------------
*/

router.get(
  "/subscription",
  getAdminSubscription
);

export default router;