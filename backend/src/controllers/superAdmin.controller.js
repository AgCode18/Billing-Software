import crypto from "crypto";
import prisma from "../config/prisma.js";
// import generateToken from "../utils/generateToken.js";

/* =========================================================
   DASHBOARD
========================================================= */

export const getSuperAdminDashboard = async (req, res) => {
  try {
    const [
      totalBusinesses,
      activeBusinesses,
      inactiveBusinesses,
      totalPlans,
      activePlans,
      totalAdmins,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.business.count(),

      prisma.business.count({
        where: {
          isActive: true,
        },
      }),

      prisma.business.count({
        where: {
          isActive: false,
        },
      }),

      prisma.membershipPlan.count(),

      prisma.membershipPlan.count({
        where: {
          isActive: true,
        },
      }),

      prisma.user.count({
        where: {
          role: "ADMIN",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "ACTIVE",
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalBusinesses,
        activeBusinesses,
        inactiveBusinesses,
        totalPlans,
        activePlans,
        totalAdmins,
        activeSubscriptions,
      },
    });
  } catch (error) {
    console.error("Get Super Admin Dashboard Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Super Admin dashboard",
    });
  }
};

/* =========================================================
   MEMBERSHIP PLANS
========================================================= */

export const getMembershipPlans = async (req, res) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      orderBy: {
        price: "asc",
      },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    const formattedPlans = plans.map((plan) => ({
      ...plan,
      price: Number(plan.price),
      activeBusinesses: plan._count.subscriptions,
      _count: undefined,
    }));

    return res.status(200).json({
      success: true,
      data: formattedPlans,
    });
  } catch (error) {
    console.error("Get Membership Plans Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch membership plans",
    });
  }
};

export const getMembershipPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.membershipPlan.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...plan,
        price: Number(plan.price),
        activeBusinesses: plan._count.subscriptions,
        _count: undefined,
      },
    });
  } catch (error) {
    console.error("Get Membership Plan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch membership plan",
    });
  }
};

export const createMembershipPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      billingCycle,
      maxProducts,
      maxInvoices,
      gstInvoice,
      pdfInvoice,
      reports,
      advancedReports,
    } = req.body;

    if (!name || price === undefined || !billingCycle) {
      return res.status(400).json({
        success: false,
        message: "name, price and billingCycle are required",
      });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid price",
      });
    }

    if (billingCycle !== "MONTHLY" && billingCycle !== "YEARLY") {
      return res.status(400).json({
        success: false,
        message: "billingCycle must be MONTHLY or YEARLY",
      });
    }

    const existingPlan = await prisma.membershipPlan.findFirst({
      where: {
        name: {
          equals: name.trim(),
        },
      },
    });

    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: "Membership plan already exists",
      });
    }

    const plan = await prisma.membershipPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: numericPrice,
        billingCycle,

        maxProducts:
          maxProducts === "" ||
          maxProducts === null ||
          maxProducts === undefined
            ? null
            : Number(maxProducts),

        maxInvoices:
          maxInvoices === "" ||
          maxInvoices === null ||
          maxInvoices === undefined
            ? null
            : Number(maxInvoices),

        gstInvoice: Boolean(gstInvoice),
        pdfInvoice: Boolean(pdfInvoice),
        reports: Boolean(reports),
        advancedReports: Boolean(advancedReports),

        isActive: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Membership plan created successfully",
      data: {
        ...plan,
        price: Number(plan.price),
      },
    });
  } catch (error) {
    console.error("Create Membership Plan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create membership plan",
    });
  }
};

export const updateMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPlan = await prisma.membershipPlan.findUnique({
      where: {
        id,
      },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    const {
      name,
      description,
      price,
      billingCycle,
      maxProducts,
      maxInvoices,
      gstInvoice,
      pdfInvoice,
      reports,
      advancedReports,
    } = req.body;

    if (billingCycle) {
      if (billingCycle !== "MONTHLY" && billingCycle !== "YEARLY") {
        return res.status(400).json({
          success: false,
          message: "billingCycle must be MONTHLY or YEARLY",
        });
      }
    }

    if (price !== undefined) {
      const numericPrice = Number(price);

      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price",
        });
      }
    }

    if (name) {
      const duplicatePlan = await prisma.membershipPlan.findFirst({
        where: {
          name: name.trim(),
          NOT: {
            id,
          },
        },
      });

      if (duplicatePlan) {
        return res.status(409).json({
          success: false,
          message: "Another plan already uses this name",
        });
      }
    }

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (price !== undefined) {
      updateData.price = Number(price);
    }

    if (billingCycle !== undefined) {
      updateData.billingCycle = billingCycle;
    }

    if (maxProducts !== undefined) {
      updateData.maxProducts =
        maxProducts === "" || maxProducts === null ? null : Number(maxProducts);
    }

    if (maxInvoices !== undefined) {
      updateData.maxInvoices =
        maxInvoices === "" || maxInvoices === null ? null : Number(maxInvoices);
    }

    if (gstInvoice !== undefined) {
      updateData.gstInvoice = Boolean(gstInvoice);
    }

    if (pdfInvoice !== undefined) {
      updateData.pdfInvoice = Boolean(pdfInvoice);
    }

    if (reports !== undefined) {
      updateData.reports = Boolean(reports);
    }

    if (advancedReports !== undefined) {
      updateData.advancedReports = Boolean(advancedReports);
    }

    const plan = await prisma.membershipPlan.update({
      where: {
        id,
      },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Membership plan updated successfully",
      data: {
        ...plan,
        price: Number(plan.price),
      },
    });
  } catch (error) {
    console.error("Update Membership Plan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update membership plan",
    });
  }
};

export const toggleMembershipPlanStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.membershipPlan.findUnique({
      where: {
        id,
      },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    const updatedPlan = await prisma.membershipPlan.update({
      where: {
        id,
      },
      data: {
        isActive: !plan.isActive,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Membership plan ${
        updatedPlan.isActive ? "activated" : "deactivated"
      } successfully`,
      data: updatedPlan,
    });
  } catch (error) {
    console.error("Toggle Membership Plan Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update membership plan status",
    });
  }
};

/* =========================================================
   BUSINESSES
========================================================= */

export const createBusiness = async (req, res) => {
  try {
    const {
      businessName,
      ownerName,
      businessEmail,
      phone,
      logo,
      gstNumber,
      panNumber,
      address,
      city,
      state,
      pincode,
      country,
      adminName,
      adminEmail,
      adminPassword,
      planId,
      startDate,
      endDate,
      autoRenew,
    } = req.body;

    if (
      !businessName ||
      !ownerName ||
      !businessEmail ||
      !phone ||
      !adminName ||
      !adminEmail ||
      !adminPassword ||
      !planId
    ) {
      return res.status(400).json({
        success: false,
        message: "Business, Admin and Plan details are required",
      });
    }

    const existingAdmin = await prisma.user.findUnique({
      where: {
        email: adminEmail,
      },
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin email already exists",
      });
    }

    const plan = await prisma.membershipPlan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive membership plan",
      });
    }

    const hashedPassword = await crypto.hash(adminPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName.trim(),
          ownerName: ownerName.trim(),
          email: businessEmail.trim(),
          phone: phone.trim(),

          logo: logo || null,
          gstNumber: gstNumber || null,
          panNumber: panNumber || null,

          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          country: country || "India",
        },
      });

      const admin = await tx.user.create({
        data: {
          name: adminName.trim(),
          email: adminEmail.trim(),
          password: hashedPassword,
          role: "ADMIN",

          isActive: true,
          mustChangePassword: true,

          businessId: business.id,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,

          status: "ACTIVE",

          startDate: startDate ? new Date(startDate) : new Date(),

          endDate: endDate ? new Date(endDate) : null,

          autoRenew: Boolean(autoRenew),
        },
        include: {
          plan: true,
        },
      });

      return {
        business,
        admin,
        subscription,
      };
    });

    const { password, ...adminWithoutPassword } = result.admin;

    return res.status(201).json({
      success: true,
      message: "Business created successfully",
      data: {
        business: result.business,
        admin: adminWithoutPassword,
        subscription: {
          ...result.subscription,
          plan: {
            ...result.subscription.plan,
            price: Number(result.subscription.plan.price),
          },
        },
        credentials: {
          email: adminEmail,
          password: adminPassword,
        },
      },
    });
  } catch (error) {
    console.error("Create Business Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create business",
    });
  }
};

export const getBusinesses = async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        users: {
          where: {
            role: "ADMIN",
          },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
          },
        },

        subscription: {
          include: {
            plan: true,
          },
        },

        _count: {
          select: {
            users: true,
            products: true,
            categories: true,
          },
        },
      },
    });

    const formattedBusinesses = businesses.map((business) => ({
      ...business,

      subscription: business.subscription
        ? {
            ...business.subscription,
            plan: {
              ...business.subscription.plan,
              price: Number(business.subscription.plan.price),
            },
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      data: formattedBusinesses,
    });
  } catch (error) {
    console.error("Get Businesses Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch businesses",
    });
  }
};

export const getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: {
        id,
      },

      include: {
        users: {
          where: {
            role: "ADMIN",
          },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
          },
        },

        subscription: {
          include: {
            plan: true,
          },
        },

        _count: {
          select: {
            users: true,
            products: true,
            categories: true,
          },
        },
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...business,

        subscription: business.subscription
          ? {
              ...business.subscription,
              plan: {
                ...business.subscription.plan,
                price: Number(business.subscription.plan.price),
              },
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get Business Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch business",
    });
  }
};

export const updateBusiness = async (req, res) => {
  try {
    const { id } = req.params;

    const existingBusiness = await prisma.business.findUnique({
      where: {
        id,
      },
    });

    if (!existingBusiness) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const {
      name,
      ownerName,
      email,
      phone,
      logo,
      gstNumber,
      panNumber,
      address,
      city,
      state,
      pincode,
      country,
    } = req.body;

    const business = await prisma.business.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(ownerName !== undefined && {
          ownerName: ownerName.trim(),
        }),

        ...(email !== undefined && {
          email: email.trim(),
        }),

        ...(phone !== undefined && {
          phone: phone.trim(),
        }),

        ...(logo !== undefined && {
          logo: logo || null,
        }),

        ...(gstNumber !== undefined && {
          gstNumber: gstNumber || null,
        }),

        ...(panNumber !== undefined && {
          panNumber: panNumber || null,
        }),

        ...(address !== undefined && {
          address: address || null,
        }),

        ...(city !== undefined && {
          city: city || null,
        }),

        ...(state !== undefined && {
          state: state || null,
        }),

        ...(pincode !== undefined && {
          pincode: pincode || null,
        }),

        ...(country !== undefined && {
          country: country || null,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Business updated successfully",
      data: business,
    });
  } catch (error) {
    console.error("Update Business Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update business",
    });
  }
};

export const toggleBusinessStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: {
        id,
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const updatedBusiness = await prisma.business.update({
      where: {
        id,
      },
      data: {
        isActive: !business.isActive,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Business ${
        updatedBusiness.isActive ? "activated" : "deactivated"
      } successfully`,
      data: updatedBusiness,
    });
  } catch (error) {
    console.error("Toggle Business Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update business status",
    });
  }
};

/* =========================================================
   BUSINESS SUBSCRIPTION
========================================================= */

export const updateBusinessSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const { planId, status, startDate, endDate, autoRenew } = req.body;

    const business = await prisma.business.findUnique({
      where: {
        id,
      },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    if (planId) {
      const plan = await prisma.membershipPlan.findUnique({
        where: {
          id: planId,
        },
      });

      if (!plan || !plan.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid or inactive membership plan",
        });
      }
    }

    const validStatuses = ["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription status",
      });
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        businessId: id,
      },
    });

    let subscription;

    if (existingSubscription) {
      subscription = await prisma.subscription.update({
        where: {
          businessId: id,
        },
        data: {
          ...(planId && {
            planId,
          }),

          ...(status && {
            status,
          }),

          ...(startDate !== undefined && {
            startDate: new Date(startDate),
          }),

          ...(endDate !== undefined && {
            endDate: endDate ? new Date(endDate) : null,
          }),

          ...(autoRenew !== undefined && {
            autoRenew: Boolean(autoRenew),
          }),
        },

        include: {
          plan: true,
        },
      });
    } else {
      if (!planId) {
        return res.status(400).json({
          success: false,
          message: "planId is required to create a subscription",
        });
      }

      subscription = await prisma.subscription.create({
        data: {
          businessId: id,
          planId,

          status: status || "ACTIVE",

          startDate: startDate ? new Date(startDate) : new Date(),

          endDate: endDate ? new Date(endDate) : null,

          autoRenew: Boolean(autoRenew),
        },

        include: {
          plan: true,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Business subscription updated successfully",
      data: {
        ...subscription,
        plan: {
          ...subscription.plan,
          price: Number(subscription.plan.price),
        },
      },
    });
  } catch (error) {
    console.error("Update Business Subscription Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update business subscription",
    });
  }
};
