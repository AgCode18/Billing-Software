import prisma from "../config/prisma.js";

import {
  toNumber,
  round,
  getPaymentStatus,
  getInvoiceStatus,
  generateInvoiceNumber,
  formatInvoice,
} from "../utils/invoice.utils.js";

import { generateInvoiceHtml } from "../utils/invoiceTemplate.js";

/* =========================================================
   CREATE INVOICE
========================================================= */

export const createInvoice = async (req, res, next) => {
  try {
    const businessId = req.businessId;

    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerGst,
      invoiceDate,
      dueDate,
      discountAmount = 0,
      paidAmount = 0,
      paymentMethod,
      paymentReferenceNo,
      notes,
      items,
    } = req.body;

    /* -----------------------------------------
       VALIDATION
    ----------------------------------------- */

    if (!customerName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one invoice item is required",
      });
    }

    const discount = round(discountAmount);
    const initialPaidAmount = round(paidAmount);

    if (discount < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount cannot be negative",
      });
    }

    if (initialPaidAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot be negative",
      });
    }

    if (initialPaidAmount > 0 && !paymentMethod) {
      return res.status(400).json({
        success: false,
        message:
          "Payment method is required when paid amount is greater than 0",
      });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      /* -----------------------------------------
         SUBSCRIPTION
      ----------------------------------------- */

      const subscription = await tx.subscription.findUnique({
        where: {
          businessId,
        },
        include: {
          plan: true,
        },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (subscription.status !== "ACTIVE") {
        throw new Error("Business subscription is not active");
      }

      /* -----------------------------------------
         INVOICE LIMIT
      ----------------------------------------- */

      if (subscription.plan.maxInvoices !== null) {
        const invoiceCount = await tx.invoice.count({
          where: {
            businessId,
            status: {
              not: "CANCELLED",
            },
          },
        });

        if (invoiceCount >= subscription.plan.maxInvoices) {
          throw new Error(
            `Invoice limit of ${subscription.plan.maxInvoices} has been reached`,
          );
        }
      }

      /* -----------------------------------------
         PRODUCTS
      ----------------------------------------- */

      const productIds = [
        ...new Set(
          items.filter((item) => item.productId).map((item) => item.productId),
        ),
      ];

      const products = await tx.product.findMany({
        where: {
          businessId,
          id: {
            in: productIds,
          },
          isActive: true,
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      const invoiceItems = [];

      let subtotal = 0;
      let taxAmount = 0;

      /* -----------------------------------------
         CALCULATE ITEMS
      ----------------------------------------- */

      for (const item of items) {
        const quantity = round(item.quantity);

        if (quantity <= 0) {
          throw new Error("Item quantity must be greater than 0");
        }

        let product = null;

        if (item.productId) {
          product = productMap.get(item.productId);

          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }

          if (toNumber(product.stock) < quantity) {
            throw new Error(`Insufficient stock for product: ${product.name}`);
          }
        }

        const productName = product?.name || item.productName?.trim();

        if (!productName) {
          throw new Error("Product name is required");
        }

        const unitPrice = round(
          item.unitPrice !== undefined
            ? item.unitPrice
            : product
              ? product.sellingPrice
              : 0,
        );

        const taxRate = round(
          item.taxRate !== undefined
            ? item.taxRate
            : product
              ? product.taxRate
              : 0,
        );

        const itemDiscount = round(item.discountAmount || 0);

        if (unitPrice < 0) {
          throw new Error(`Invalid unit price for ${productName}`);
        }

        if (taxRate < 0) {
          throw new Error(`Invalid tax rate for ${productName}`);
        }

        if (itemDiscount < 0) {
          throw new Error(`Invalid discount for ${productName}`);
        }

        const grossAmount = round(quantity * unitPrice);

        const taxableAmount = round(Math.max(0, grossAmount - itemDiscount));

        const itemTax = round((taxableAmount * taxRate) / 100);

        const itemTotal = round(taxableAmount + itemTax);

        subtotal = round(subtotal + taxableAmount);
        taxAmount = round(taxAmount + itemTax);

        invoiceItems.push({
          productId: product?.id || null,
          productName,
          sku: product?.sku || item.sku || null,
          unit: product?.unit || item.unit || "PCS",
          quantity,
          unitPrice,
          taxRate,
          taxAmount: itemTax,
          discountAmount: itemDiscount,
          totalAmount: itemTotal,
        });
      }

      /* -----------------------------------------
         TOTALS
      ----------------------------------------- */

      const totalBeforeDiscount = round(subtotal + taxAmount);

      if (discount > totalBeforeDiscount) {
        throw new Error("Invoice discount cannot exceed total amount");
      }

      const totalAmount = round(totalBeforeDiscount - discount);

      if (initialPaidAmount > totalAmount) {
        throw new Error("Paid amount cannot exceed invoice total");
      }

      const dueAmount = round(totalAmount - initialPaidAmount);

      const paymentStatus = getPaymentStatus(initialPaidAmount, totalAmount);

      const status = getInvoiceStatus(initialPaidAmount, totalAmount);

      /* -----------------------------------------
         INVOICE NUMBER
      ----------------------------------------- */

      const invoiceNumber = await generateInvoiceNumber(tx, businessId);

      /* -----------------------------------------
         CREATE INVOICE
      ----------------------------------------- */

      const createdInvoice = await tx.invoice.create({
        data: {
          businessId,
          invoiceNumber,

          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),

          dueDate: dueDate ? new Date(dueDate) : null,

          customerName: customerName.trim(),

          customerPhone: customerPhone?.trim() || null,

          customerEmail: customerEmail?.trim() || null,

          customerAddress: customerAddress?.trim() || null,

          customerGst: customerGst?.trim() || null,

          subtotal,
          taxAmount,
          discountAmount: discount,
          totalAmount,
          paidAmount: initialPaidAmount,
          dueAmount,
          status,
          paymentStatus,

          notes: notes?.trim() || null,

          items: {
            create: invoiceItems,
          },
        },

        include: {
          items: true,
          payments: true,
        },
      });

      /* -----------------------------------------
         REDUCE STOCK
      ----------------------------------------- */

      for (const item of invoiceItems) {
        if (!item.productId) {
          continue;
        }

        await tx.product.update({
          where: {
            id: item.productId,
          },

          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      /* -----------------------------------------
         INITIAL PAYMENT
      ----------------------------------------- */

      if (initialPaidAmount > 0) {
        await tx.payment.create({
          data: {
            businessId,
            invoiceId: createdInvoice.id,
            amount: initialPaidAmount,
            paymentMethod,

            referenceNo: paymentReferenceNo?.trim() || null,
          },
        });
      }

      return tx.invoice.findUnique({
        where: {
          id: createdInvoice.id,
        },

        include: {
          items: true,
          payments: true,
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: formatInvoice(invoice),
    });
  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create invoice",
    });
  }
};

/* =========================================================
   GET INVOICES
========================================================= */

export const getInvoices = async (req, res, next) => {
  try {
    const businessId = req.businessId;

    const { status, paymentStatus, search } = req.query;

    const where = {
      businessId,
    };

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (search?.trim()) {
      where.OR = [
        {
          invoiceNumber: {
            contains: search.trim(),
          },
        },
        {
          customerName: {
            contains: search.trim(),
          },
        },
        {
          customerPhone: {
            contains: search.trim(),
          },
        },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,

      include: {
        items: true,
        payments: true,
      },

      orderBy: {
        invoiceDate: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices.map(formatInvoice),
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   GET INVOICE BY ID
========================================================= */

export const getInvoiceById = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        businessId,
      },

      include: {
        items: true,
        payments: true,

        business: {
          select: {
            id: true,
            name: true,
            ownerName: true,
            email: true,
            phone: true,
            logo: true,
            gstNumber: true,
            panNumber: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: formatInvoice(invoice),
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   UPDATE DRAFT INVOICE
========================================================= */

export const updateInvoice = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id,
        businessId,
      },

      include: {
        items: true,
        payments: true,
      },
    });

    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (existingInvoice.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft invoices can be updated",
      });
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerGst,
      dueDate,
      notes,
      items,
      discountAmount,
    } = req.body;

    /* -----------------------------------------
       CUSTOMER INFORMATION ONLY
    ----------------------------------------- */

    if (!items) {
      const updatedInvoice = await prisma.invoice.update({
        where: {
          id,
        },

        data: {
          ...(customerName !== undefined && {
            customerName: customerName.trim(),
          }),

          ...(customerPhone !== undefined && {
            customerPhone: customerPhone?.trim() || null,
          }),

          ...(customerEmail !== undefined && {
            customerEmail: customerEmail?.trim() || null,
          }),

          ...(customerAddress !== undefined && {
            customerAddress: customerAddress?.trim() || null,
          }),

          ...(customerGst !== undefined && {
            customerGst: customerGst?.trim() || null,
          }),

          ...(dueDate !== undefined && {
            dueDate: dueDate ? new Date(dueDate) : null,
          }),

          ...(notes !== undefined && {
            notes: notes?.trim() || null,
          }),
        },

        include: {
          items: true,
          payments: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Invoice updated successfully",
        data: formatInvoice(updatedInvoice),
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one invoice item is required",
      });
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      /* -----------------------------------
           RESTORE OLD STOCK
        ----------------------------------- */

      for (const oldItem of existingInvoice.items) {
        if (!oldItem.productId) {
          continue;
        }

        await tx.product.update({
          where: {
            id: oldItem.productId,
          },

          data: {
            stock: {
              increment: oldItem.quantity,
            },
          },
        });
      }

      /* -----------------------------------
           PRODUCTS
        ----------------------------------- */

      const productIds = [
        ...new Set(
          items.filter((item) => item.productId).map((item) => item.productId),
        ),
      ];

      const products = await tx.product.findMany({
        where: {
          businessId,

          id: {
            in: productIds,
          },

          isActive: true,
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      let subtotal = 0;
      let taxAmount = 0;

      const invoiceItems = [];

      /* -----------------------------------
           CALCULATE NEW ITEMS
        ----------------------------------- */

      for (const item of items) {
        const quantity = round(item.quantity);

        if (quantity <= 0) {
          throw new Error("Item quantity must be greater than 0");
        }

        const product = item.productId ? productMap.get(item.productId) : null;

        if (item.productId && !product) {
          throw new Error("Product not found");
        }

        if (product && toNumber(product.stock) < quantity) {
          throw new Error(`Insufficient stock for product: ${product.name}`);
        }

        const productName = product?.name || item.productName?.trim();

        if (!productName) {
          throw new Error("Product name is required");
        }

        const unitPrice = round(
          item.unitPrice !== undefined
            ? item.unitPrice
            : product
              ? product.sellingPrice
              : 0,
        );

        const taxRate = round(
          item.taxRate !== undefined
            ? item.taxRate
            : product
              ? product.taxRate
              : 0,
        );

        const itemDiscount = round(item.discountAmount || 0);

        if (unitPrice < 0) {
          throw new Error(`Invalid unit price for ${productName}`);
        }

        if (taxRate < 0) {
          throw new Error(`Invalid tax rate for ${productName}`);
        }

        if (itemDiscount < 0) {
          throw new Error(`Invalid discount for ${productName}`);
        }

        const grossAmount = round(quantity * unitPrice);

        const taxableAmount = round(Math.max(0, grossAmount - itemDiscount));

        const itemTax = round((taxableAmount * taxRate) / 100);

        const itemTotal = round(taxableAmount + itemTax);

        subtotal = round(subtotal + taxableAmount);

        taxAmount = round(taxAmount + itemTax);

        invoiceItems.push({
          productId: product?.id || null,
          productName,

          sku: product?.sku || item.sku || null,

          unit: product?.unit || item.unit || "PCS",

          quantity,
          unitPrice,
          taxRate,
          taxAmount: itemTax,
          discountAmount: itemDiscount,
          totalAmount: itemTotal,
        });
      }

      /* -----------------------------------
           TOTALS
        ----------------------------------- */

      const discount = round(
        discountAmount !== undefined
          ? discountAmount
          : existingInvoice.discountAmount,
      );

      const totalBeforeDiscount = round(subtotal + taxAmount);

      if (discount > totalBeforeDiscount) {
        throw new Error("Discount cannot exceed invoice total");
      }

      const totalAmount = round(totalBeforeDiscount - discount);

      const paidAmount = toNumber(existingInvoice.paidAmount);

      if (paidAmount > totalAmount) {
        throw new Error(
          "Updated invoice total cannot be less than already paid amount",
        );
      }

      const dueAmount = round(totalAmount - paidAmount);

      /* -----------------------------------
           DELETE OLD ITEMS
        ----------------------------------- */

      await tx.invoiceItem.deleteMany({
        where: {
          invoiceId: id,
        },
      });

      /* -----------------------------------
           UPDATE INVOICE
        ----------------------------------- */

      await tx.invoice.update({
        where: {
          id,
        },

        data: {
          customerName:
            customerName !== undefined
              ? customerName.trim()
              : existingInvoice.customerName,

          customerPhone:
            customerPhone !== undefined
              ? customerPhone?.trim() || null
              : existingInvoice.customerPhone,

          customerEmail:
            customerEmail !== undefined
              ? customerEmail?.trim() || null
              : existingInvoice.customerEmail,

          customerAddress:
            customerAddress !== undefined
              ? customerAddress?.trim() || null
              : existingInvoice.customerAddress,

          customerGst:
            customerGst !== undefined
              ? customerGst?.trim() || null
              : existingInvoice.customerGst,

          dueDate:
            dueDate !== undefined
              ? dueDate
                ? new Date(dueDate)
                : null
              : existingInvoice.dueDate,

          notes:
            notes !== undefined ? notes?.trim() || null : existingInvoice.notes,

          subtotal,
          taxAmount,
          discountAmount: discount,
          totalAmount,
          dueAmount,

          items: {
            create: invoiceItems,
          },
        },

        include: {
          items: true,
          payments: true,
        },
      });

      /* -----------------------------------
           DEDUCT NEW STOCK
        ----------------------------------- */

      for (const item of invoiceItems) {
        if (!item.productId) {
          continue;
        }

        await tx.product.update({
          where: {
            id: item.productId,
          },

          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return tx.invoice.findUnique({
        where: {
          id,
        },

        include: {
          items: true,
          payments: true,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Draft invoice updated successfully",
      data: formatInvoice(updatedInvoice),
    });
  } catch (error) {
    console.error("UPDATE INVOICE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update invoice",
    });
  }
};

/* =========================================================
   CANCEL INVOICE
========================================================= */

export const cancelInvoice = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id,
          businessId,
        },

        include: {
          items: true,
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status === "CANCELLED") {
        throw new Error("Invoice is already cancelled");
      }

      /* Restore stock */

      for (const item of invoice.items) {
        if (!item.productId) {
          continue;
        }

        await tx.product.update({
          where: {
            id: item.productId,
          },

          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      return tx.invoice.update({
        where: {
          id,
        },

        data: {
          status: "CANCELLED",
        },

        include: {
          items: true,
          payments: true,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Invoice cancelled successfully",
      data: formatInvoice(result),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel invoice",
    });
  }
};

/* =========================================================
   ADD PAYMENT
========================================================= */

export const addPayment = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const { amount, paymentMethod, paymentDate, referenceNo, notes } = req.body;

    const paymentAmount = round(amount);

    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id,
          businessId,
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status === "CANCELLED") {
        throw new Error("Cannot add payment to cancelled invoice");
      }

      const totalAmount = toNumber(invoice.totalAmount);

      const paidAmount = toNumber(invoice.paidAmount);

      const dueAmount = round(totalAmount - paidAmount);

      if (dueAmount <= 0) {
        throw new Error("Invoice is already fully paid");
      }

      if (paymentAmount > dueAmount) {
        throw new Error(`Payment cannot exceed due amount of ${dueAmount}`);
      }

      const newPaidAmount = round(paidAmount + paymentAmount);

      const newDueAmount = round(totalAmount - newPaidAmount);

      const paymentStatus = getPaymentStatus(newPaidAmount, totalAmount);

      const invoiceStatus = getInvoiceStatus(newPaidAmount, totalAmount);

      const payment = await tx.payment.create({
        data: {
          businessId,
          invoiceId: id,
          amount: paymentAmount,
          paymentMethod,

          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),

          referenceNo: referenceNo?.trim() || null,

          notes: notes?.trim() || null,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: {
          id,
        },

        data: {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          paymentStatus,
          status: invoiceStatus,
        },

        include: {
          items: true,
          payments: true,
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Payment added successfully",

      data: {
        payment: {
          ...result.payment,

          amount: toNumber(result.payment.amount),
        },

        invoice: formatInvoice(result.invoice),
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to add payment",
    });
  }
};

/* =========================================================
   GET INVOICE PAYMENTS
========================================================= */

export const getInvoicePayments = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        businessId,
      },

      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        paymentStatus: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        invoiceId: id,
      },

      orderBy: {
        paymentDate: "desc",
      },
    });

    return res.status(200).json({
      success: true,

      data: {
        invoice: {
          ...invoice,

          totalAmount: toNumber(invoice.totalAmount),

          paidAmount: toNumber(invoice.paidAmount),

          dueAmount: toNumber(invoice.dueAmount),
        },

        payments: payments.map((payment) => ({
          ...payment,

          amount: toNumber(payment.amount),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   FINALIZE DRAFT INVOICE
========================================================= */

export const finalizeInvoice = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id,
          businessId,
        },

        include: {
          items: true,
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status !== "DRAFT") {
        throw new Error("Only draft invoices can be finalized");
      }

      /* -----------------------------------
           CHECK STOCK
        ----------------------------------- */

      for (const item of invoice.items) {
        if (!item.productId) {
          continue;
        }

        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            businessId,
            isActive: true,
          },
        });

        if (!product) {
          throw new Error(`Product not found for ${item.productName}`);
        }

        if (toNumber(product.stock) < toNumber(item.quantity)) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      /* -----------------------------------
           DEDUCT STOCK
        ----------------------------------- */

      for (const item of invoice.items) {
        if (!item.productId) {
          continue;
        }

        await tx.product.update({
          where: {
            id: item.productId,
          },

          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      /* -----------------------------------
           FINALIZE
        ----------------------------------- */

      return tx.invoice.update({
        where: {
          id,
        },

        data: {
          status: "FINAL",

          paymentStatus: getPaymentStatus(
            invoice.paidAmount,
            invoice.totalAmount,
          ),
        },

        include: {
          items: true,
          payments: true,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Invoice finalized successfully",
      data: formatInvoice(result),
    });
  } catch (error) {
    console.error("FINALIZE INVOICE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to finalize invoice",
    });
  }
};

/* =========================================================
   REVERSE PAYMENT
========================================================= */

export const reversePayment = async (req, res, next) => {
  try {
    const businessId = req.businessId;
    const { id, paymentId } = req.params;

    const { reversalReason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id,
          businessId,
        },

        include: {
          payments: true,
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status === "CANCELLED") {
        throw new Error("Cannot reverse payment on a cancelled invoice");
      }

      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          invoiceId: id,
          businessId,
        },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === "REVERSED") {
        throw new Error("Payment is already reversed");
      }

      const paymentAmount = toNumber(payment.amount);

      const currentPaidAmount = toNumber(invoice.paidAmount);

      const newPaidAmount = round(
        Math.max(0, currentPaidAmount - paymentAmount),
      );

      const totalAmount = toNumber(invoice.totalAmount);

      const newDueAmount = round(Math.max(0, totalAmount - newPaidAmount));

      const newPaymentStatus = getPaymentStatus(newPaidAmount, totalAmount);

      let newInvoiceStatus = invoice.status;

      if (newPaidAmount >= totalAmount) {
        newInvoiceStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newInvoiceStatus = "PARTIALLY_PAID";
      } else {
        newInvoiceStatus = "FINAL";
      }

      /* -----------------------------------
           REVERSE PAYMENT
        ----------------------------------- */

      await tx.payment.update({
        where: {
          id: payment.id,
        },

        data: {
          status: "REVERSED",
          reversedAt: new Date(),

          reversalReason: reversalReason || "Payment reversed",
        },
      });

      /* -----------------------------------
           UPDATE INVOICE
        ----------------------------------- */

      const updatedInvoice = await tx.invoice.update({
        where: {
          id: invoice.id,
        },

        data: {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          paymentStatus: newPaymentStatus,
          status: newInvoiceStatus,
        },

        include: {
          items: true,
          payments: true,
        },
      });

      return updatedInvoice;
    });

    return res.status(200).json({
      success: true,
      message: "Payment reversed successfully",
      data: formatInvoice(result),
    });
  } catch (error) {
    console.error("REVERSE PAYMENT ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reverse payment",
    });
  }
};

/* =========================================================
   PRINT INVOICE
========================================================= */

export const printInvoice = async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        businessId,
      },

      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },

        payments: {
          orderBy: {
            paymentDate: "asc",
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const business = await prisma.business.findUnique({
      where: {
        id: businessId,
      },

      select: {
        id: true,
        name: true,
        ownerName: true,
        email: true,
        phone: true,
        logo: true,
        gstNumber: true,
        panNumber: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const html = generateInvoiceHtml({
      invoice,
      business,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(200).send(html);
  } catch (error) {
    console.error("PRINT INVOICE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
    });
  }
};
