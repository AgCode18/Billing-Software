import prisma from "../config/prisma.js";

/* =========================================================
   HELPERS
========================================================= */

const toNumber = (value) => {
  return Number(value || 0);
};

const round = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

const getDateRange = (from, to) => {
  let startDate;
  let endDate;

  if (from) {
    startDate = new Date(from);

    if (Number.isNaN(startDate.getTime())) {
      throw new Error("Invalid from date");
    }

    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  if (to) {
    endDate = new Date(to);

    if (Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid to date");
    }

    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }

  if (startDate > endDate) {
    throw new Error("From date cannot be greater than to date");
  }

  return {
    startDate,
    endDate,
  };
};

/*
 * Only finalized invoices participate in
 * sales/report calculations.
 *
 * DRAFT and CANCELLED are excluded.
 */
const reportInvoiceWhere = (businessId, startDate, endDate) => ({
  businessId,

  invoiceDate: {
    gte: startDate,
    lte: endDate,
  },

  status: {
    in: ["FINAL", "PARTIALLY_PAID", "PAID"],
  },
});

/* =========================================================
   1. REPORT DASHBOARD
========================================================= */

export const getReportDashboard = async (req, res) => {
  try {
    const businessId = req.businessId;

    const { from, to } = req.query;

    const { startDate, endDate } = getDateRange(from, to);

    const invoices = await prisma.invoice.findMany({
      where: reportInvoiceWhere(businessId, startDate, endDate),

      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        taxAmount: true,
        discountAmount: true,
        status: true,
        paymentStatus: true,
      },
    });

    let totalSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    let paidInvoices = 0;
    let partiallyPaidInvoices = 0;
    let pendingInvoices = 0;

    for (const invoice of invoices) {
      totalSales += toNumber(invoice.totalAmount);

      totalTax += toNumber(invoice.taxAmount);

      totalDiscount += toNumber(invoice.discountAmount);

      totalPaid += toNumber(invoice.paidAmount);

      totalOutstanding += toNumber(invoice.dueAmount);

      if (invoice.paymentStatus === "PAID") {
        paidInvoices++;
      } else if (invoice.paymentStatus === "PARTIAL") {
        partiallyPaidInvoices++;
      } else {
        pendingInvoices++;
      }
    }

    const [totalProducts, totalCategories] = await Promise.all([
      prisma.product.count({
        where: {
          businessId,
        },
      }),

      prisma.category.count({
        where: {
          businessId,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        dateRange: {
          from: startDate,
          to: endDate,
        },

        invoices: {
          total: invoices.length,
          paid: paidInvoices,
          partiallyPaid: partiallyPaidInvoices,
          pending: pendingInvoices,
        },

        sales: {
          totalSales: round(totalSales),
          totalTax: round(totalTax),
          totalDiscount: round(totalDiscount),
        },

        payments: {
          totalPaid: round(totalPaid),
          totalOutstanding: round(totalOutstanding),
        },

        products: totalProducts,
        categories: totalCategories,
      },
    });
  } catch (error) {
    console.error("REPORT DASHBOARD ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch report dashboard",
    });
  }
};

/* =========================================================
   2. SALES REPORT
========================================================= */

export const getSalesReport = async (req, res) => {
  try {
    const businessId = req.businessId;

    const { from, to } = req.query;

    const { startDate, endDate } = getDateRange(from, to);

    const invoices = await prisma.invoice.findMany({
      where: reportInvoiceWhere(businessId, startDate, endDate),

      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        customerName: true,

        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,

        paymentStatus: true,
        status: true,
      },

      orderBy: {
        invoiceDate: "desc",
      },
    });

    const data = invoices.map((invoice) => ({
      id: invoice.id,

      invoiceNumber: invoice.invoiceNumber,

      invoiceDate: invoice.invoiceDate,

      customerName: invoice.customerName,

      subtotal: toNumber(invoice.subtotal),

      taxAmount: toNumber(invoice.taxAmount),

      discountAmount: toNumber(invoice.discountAmount),

      totalAmount: toNumber(invoice.totalAmount),

      paidAmount: toNumber(invoice.paidAmount),

      dueAmount: toNumber(invoice.dueAmount),

      paymentStatus: invoice.paymentStatus,

      status: invoice.status,
    }));

    const summary = data.reduce(
      (acc, invoice) => {
        acc.subtotal += invoice.subtotal;

        acc.taxAmount += invoice.taxAmount;

        acc.discountAmount += invoice.discountAmount;

        acc.totalAmount += invoice.totalAmount;

        acc.paidAmount += invoice.paidAmount;

        acc.dueAmount += invoice.dueAmount;

        return acc;
      },
      {
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
      },
    );

    Object.keys(summary).forEach((key) => {
      summary[key] = round(summary[key]);
    });

    return res.status(200).json({
      success: true,

      data: {
        dateRange: {
          from: startDate,
          to: endDate,
        },

        summary,

        invoices: data,
      },
    });
  } catch (error) {
    console.error("SALES REPORT ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch sales report",
    });
  }
};

/* =========================================================
   3. OUTSTANDING REPORT
========================================================= */

export const getOutstandingReport = async (req, res) => {
  try {
    const businessId = req.businessId;

    const invoices = await prisma.invoice.findMany({
      where: {
        businessId,

        status: {
          in: ["FINAL", "PARTIALLY_PAID", "PAID"],
        },

        dueAmount: {
          gt: 0,
        },
      },

      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,

        customerName: true,
        customerPhone: true,
        customerEmail: true,

        totalAmount: true,
        paidAmount: true,
        dueAmount: true,

        paymentStatus: true,
      },

      orderBy: {
        dueDate: "asc",
      },
    });

    const now = new Date();

    let totalOutstanding = 0;
    let overdueAmount = 0;
    let currentAmount = 0;

    const data = invoices.map((invoice) => {
      const dueAmount = toNumber(invoice.dueAmount);

      totalOutstanding += dueAmount;

      let isOverdue = false;

      if (invoice.dueDate) {
        const dueDate = new Date(invoice.dueDate);

        dueDate.setHours(23, 59, 59, 999);

        isOverdue = dueDate < now;
      }

      if (isOverdue) {
        overdueAmount += dueAmount;
      } else {
        currentAmount += dueAmount;
      }

      return {
        id: invoice.id,

        invoiceNumber: invoice.invoiceNumber,

        invoiceDate: invoice.invoiceDate,

        dueDate: invoice.dueDate,

        customerName: invoice.customerName,

        customerPhone: invoice.customerPhone,

        customerEmail: invoice.customerEmail,

        totalAmount: toNumber(invoice.totalAmount),

        paidAmount: toNumber(invoice.paidAmount),

        dueAmount,

        paymentStatus: invoice.paymentStatus,

        isOverdue,
      };
    });

    return res.status(200).json({
      success: true,

      data: {
        summary: {
          totalOutstanding: round(totalOutstanding),

          overdueAmount: round(overdueAmount),

          currentAmount: round(currentAmount),

          invoiceCount: data.length,
        },

        invoices: data,
      },
    });
  } catch (error) {
    console.error("OUTSTANDING REPORT ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch outstanding report",
    });
  }
};

/* =========================================================
   4. GST REPORT
========================================================= */

export const getGstReport = async (req, res) => {
  try {
    const businessId = req.businessId;

    const { from, to } = req.query;

    const { startDate, endDate } = getDateRange(from, to);

    const invoices = await prisma.invoice.findMany({
      where: reportInvoiceWhere(businessId, startDate, endDate),

      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,

        customerName: true,
        customerGst: true,

        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,

        items: {
          select: {
            productName: true,
            sku: true,

            quantity: true,
            unitPrice: true,

            taxRate: true,
            taxAmount: true,

            discountAmount: true,
            totalAmount: true,
          },
        },
      },

      orderBy: {
        invoiceDate: "asc",
      },
    });

    let taxableAmount = 0;
    let totalTax = 0;
    let totalSales = 0;

    const taxBreakdown = {};

    const data = invoices.map((invoice) => {
      const subtotal = toNumber(invoice.subtotal);

      const taxAmount = toNumber(invoice.taxAmount);

      const totalAmount = toNumber(invoice.totalAmount);

      taxableAmount += subtotal;
      totalTax += taxAmount;
      totalSales += totalAmount;

      for (const item of invoice.items) {
        const taxRate = toNumber(item.taxRate);

        const itemTax = toNumber(item.taxAmount);

        const key = taxRate.toFixed(2);

        if (!taxBreakdown[key]) {
          taxBreakdown[key] = {
            taxRate,
            taxableAmount: 0,
            taxAmount: 0,
          };
        }

        const itemGross = toNumber(item.quantity) * toNumber(item.unitPrice);

        const itemDiscount = toNumber(item.discountAmount);

        const itemTaxableAmount = Math.max(0, itemGross - itemDiscount);

        taxBreakdown[key].taxableAmount += itemTaxableAmount;

        taxBreakdown[key].taxAmount += itemTax;
      }

      return {
        id: invoice.id,

        invoiceNumber: invoice.invoiceNumber,

        invoiceDate: invoice.invoiceDate,

        customerName: invoice.customerName,

        customerGst: invoice.customerGst,

        taxableAmount: round(subtotal),

        taxAmount: round(taxAmount),

        totalAmount: round(totalAmount),
      };
    });

    const breakdown = Object.values(taxBreakdown).map((item) => ({
      taxRate: item.taxRate,

      taxableAmount: round(item.taxableAmount),

      taxAmount: round(item.taxAmount),
    }));

    return res.status(200).json({
      success: true,

      data: {
        dateRange: {
          from: startDate,
          to: endDate,
        },

        summary: {
          invoiceCount: invoices.length,

          taxableAmount: round(taxableAmount),

          totalTax: round(totalTax),

          totalSales: round(totalSales),
        },

        taxBreakdown: breakdown,

        invoices: data,
      },
    });
  } catch (error) {
    console.error("GST REPORT ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch GST report",
    });
  }
};
