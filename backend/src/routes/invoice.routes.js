import express from "express";

import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice,
  addPayment,
  getInvoicePayments,
  finalizeInvoice,
  reversePayment,
  printInvoice,
} from "../controllers/invoice.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import businessMiddleware from "../middleware/business.middleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Authentication + Business Isolation
|--------------------------------------------------------------------------
*/

router.use(authMiddleware);
router.use(businessMiddleware);

/*
|--------------------------------------------------------------------------
| Invoice Routes
|--------------------------------------------------------------------------
*/

// Create invoice
router.post("/", createInvoice);

// Get all invoices
router.get("/", getInvoices);

// Get single invoice
router.get("/:id", getInvoiceById);

// Update draft invoice
router.patch("/:id", updateInvoice);

// Cancel invoice
router.patch("/:id/cancel", cancelInvoice);

/*
|--------------------------------------------------------------------------
| Payment Routes
|--------------------------------------------------------------------------
*/

// Add payment
router.post("/:id/payments", addPayment);

// Get invoice payments
router.get("/:id/payments", getInvoicePayments);



/*
|--------------------------------------------------------------------------
| INVOICES
|--------------------------------------------------------------------------
*/

router.post("/", createInvoice);

router.get("/", getInvoices);

router.get("/:id", getInvoiceById);

router.patch("/:id", updateInvoice);

router.patch("/:id/cancel", cancelInvoice);

/*
|--------------------------------------------------------------------------
| PAYMENTS
|--------------------------------------------------------------------------
*/

router.post("/:id/payments", addPayment);

router.get("/:id/payments", getInvoicePayments);
router.patch("/:id/payments/:paymentId/reverse",reversePayment);

router.patch("/:id/finalize",finalizeInvoice);

router.get(
  "/:id/print",
  printInvoice
);
export default router;
