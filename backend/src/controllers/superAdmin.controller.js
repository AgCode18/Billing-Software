import crypto from "crypto";
import prisma from "../config/prisma.js";

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

    // -----------------------------
    // Required field validation
    // -----------------------------

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
        message: "Required fields are missing",
      });
    }

    // -----------------------------
    // Check existing admin email
    // -----------------------------

    const existingUser = await prisma.user.findUnique({
      where: {
        email: adminEmail.toLowerCase().trim(),
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Admin email already exists",
      });
    }

    // -----------------------------
    // Check membership plan
    // -----------------------------

    const plan = await prisma.membershipPlan.findFirst({
      where: {
        id: planId,
        isActive: true,
      },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found or inactive",
      });
    }

    // -----------------------------
    // Hash Admin password
    // -----------------------------

    const hashedPassword = await crypto.hash(
      adminPassword,
      12
    );

    // -----------------------------
    // Create everything
    // -----------------------------

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          ownerName,
          email: businessEmail.toLowerCase().trim(),
          phone,
          logo,
          gstNumber,
          panNumber,
          address,
          city,
          state,
          pincode,
          country: country || "India",
        },
      });

      const admin = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail.toLowerCase().trim(),
          password: hashedPassword,
          role: "ADMIN",
          businessId: business.id,
          isActive: true,
          mustChangePassword: true,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          status: "ACTIVE",
          startDate: startDate
            ? new Date(startDate)
            : new Date(),
          endDate: endDate
            ? new Date(endDate)
            : null,
          autoRenew: autoRenew ?? false,
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

    return res.status(201).json({
      success: true,
      message: "Business and Admin created successfully",

      business: {
        id: result.business.id,
        name: result.business.name,
        ownerName: result.business.ownerName,
        email: result.business.email,
        phone: result.business.phone,
      },

      admin: {
        id: result.admin.id,
        name: result.admin.name,
        email: result.admin.email,
        role: result.admin.role,
      },

      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        startDate: result.subscription.startDate,
        endDate: result.subscription.endDate,
        autoRenew: result.subscription.autoRenew,
        plan: result.subscription.plan,
      },

      credentials: {
        email: adminEmail,
        password: adminPassword,
      },
    });
  } catch (error) {
    console.error(
      "Create Business Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create business",
    });
  }
};


export const getMembershipPlans = async (req, res) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        price: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error(
      "Get Membership Plans Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch membership plans",
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
          },
        },

        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      businesses,
    });
  } catch (error) {
    console.error(
      "Get Businesses Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch businesses",
    });
  }
};