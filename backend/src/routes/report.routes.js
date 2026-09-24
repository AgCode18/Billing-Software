import express from "express";

import {
  getReportDashboard,
  getSalesReport,
  getOutstandingReport,
  getGstReport,
} from "../controllers/report.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import businessMiddleware from "../middleware/business.middleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(businessMiddleware);

/* Dashboard */
router.get(
  "/dashboard",
  getReportDashboard
);

/* Sales */
router.get(
  "/sales",
  getSalesReport
);

/* Outstanding */
router.get(
  "/outstanding",
  getOutstandingReport
);

/* GST */
router.get(
  "/gst",
  getGstReport
);

export default router;