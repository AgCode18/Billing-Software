import prisma from "../config/prisma.js";

/* =========================================================
   NUMBER HELPERS
========================================================= */

export const toNumber = (value) => {
  return Number(value || 0);
};

export const round = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

/* =========================================================
   INVOICE STATUS
========================================================= */

export const getPaymentStatus = (paidAmount, totalAmount) => {
  const paid = round(paidAmount);
  const total = round(totalAmount);

  if (paid <= 0) {
    return "PENDING";
  }

  if (paid >= total) {
    return "PAID";
  }

  return "PARTIAL";
};

export const getInvoiceStatus = (paidAmount, totalAmount) => {
  const paid = round(paidAmount);
  const total = round(totalAmount);

  if (paid >= total) {
    return "PAID";
  }

  if (paid > 0) {
    return "PARTIALLY_PAID";
  }

  return "FINAL";
};

/* =========================================================
   SAFE INVOICE NUMBER
========================================================= */

export const generateInvoiceNumber = async (tx, businessId) => {
  const business = await tx.business.update({
    where: {
      id: businessId,
    },
    data: {
      invoiceSequence: {
        increment: 1,
      },
    },
    select: {
      invoiceSequence: true,
    },
  });

  return `INV-${String(business.invoiceSequence).padStart(6, "0")}`;
};

/* =========================================================
   FORMAT INVOICE
========================================================= */

export const formatInvoice = (invoice) => {
  return {
    ...invoice,

    subtotal: toNumber(invoice.subtotal),
    taxAmount: toNumber(invoice.taxAmount),
    discountAmount: toNumber(invoice.discountAmount),
    totalAmount: toNumber(invoice.totalAmount),
    paidAmount: toNumber(invoice.paidAmount),
    dueAmount: toNumber(invoice.dueAmount),

    items: invoice.items?.map((item) => ({
      ...item,

      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      taxRate: toNumber(item.taxRate),
      taxAmount: toNumber(item.taxAmount),
      discountAmount: toNumber(item.discountAmount),
      totalAmount: toNumber(item.totalAmount),
    })),

    payments: invoice.payments?.map((payment) => ({
      ...payment,
      amount: toNumber(payment.amount),
    })),
  };
};
