import prisma from "../config/prisma.js";

/*
|--------------------------------------------------------------------------
| ADMIN DASHBOARD
|--------------------------------------------------------------------------
*/

export const getAdminDashboard = async (req, res, next) => {
  try {
    const businessId = req.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID is required",
      });
    }

    const [
      business,
      totalProducts,
      activeProducts,
      totalCategories,
      activeCategories,
      subscription,
    ] = await Promise.all([
      prisma.business.findUnique({
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
          isActive: true,
        },
      }),

      prisma.product.count({
        where: {
          businessId,
        },
      }),

      prisma.product.count({
        where: {
          businessId,
          isActive: true,
        },
      }),

      prisma.category.count({
        where: {
          businessId,
        },
      }),

      prisma.category.count({
        where: {
          businessId,
          isActive: true,
        },
      }),

      prisma.subscription.findUnique({
        where: {
          businessId,
        },

        include: {
          plan: true,
        },
      }),
    ]);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        business,

        statistics: {
          totalProducts,
          activeProducts,
          totalCategories,
          activeCategories,
        },

        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
              autoRenew: subscription.autoRenew,

              plan: {
                id: subscription.plan.id,
                name: subscription.plan.name,
                price: Number(subscription.plan.price),
                billingCycle:
                  subscription.plan.billingCycle,

                maxProducts:
                  subscription.plan.maxProducts,

                maxInvoices:
                  subscription.plan.maxInvoices,

                gstInvoice:
                  subscription.plan.gstInvoice,

                pdfInvoice:
                  subscription.plan.pdfInvoice,

                reports:
                  subscription.plan.reports,

                advancedReports:
                  subscription.plan.advancedReports,
              },
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| GET BUSINESS PROFILE
|--------------------------------------------------------------------------
*/

export const getBusinessProfile = async (
  req,
  res,
  next
) => {
  try {
    const businessId = req.businessId;

    const business =
      await prisma.business.findUnique({
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
          isActive: true,
          createdAt: true,
          updatedAt: true,
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
      data: business,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE BUSINESS PROFILE
|--------------------------------------------------------------------------
*/

export const updateBusinessProfile = async (
  req,
  res,
  next
) => {
  try {
    const businessId = req.businessId;

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

    const existingBusiness =
      await prisma.business.findUnique({
        where: {
          id: businessId,
        },
      });

    if (!existingBusiness) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */

    if (
      name !== undefined &&
      !String(name).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Business name cannot be empty",
      });
    }

    if (
      ownerName !== undefined &&
      !String(ownerName).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Owner name cannot be empty",
      });
    }

    if (
      email !== undefined &&
      !String(email).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be empty",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Build update object
    |--------------------------------------------------------------------------
    */

    const updateData = {};

    if (name !== undefined) {
      updateData.name = String(name).trim();
    }

    if (ownerName !== undefined) {
      updateData.ownerName =
        String(ownerName).trim();
    }

    if (email !== undefined) {
      updateData.email = String(email).trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    if (logo !== undefined) {
      updateData.logo = logo || null;
    }

    if (gstNumber !== undefined) {
      updateData.gstNumber =
        gstNumber || null;
    }

    if (panNumber !== undefined) {
      updateData.panNumber =
        panNumber || null;
    }

    if (address !== undefined) {
      updateData.address =
        address || null;
    }

    if (city !== undefined) {
      updateData.city = city || null;
    }

    if (state !== undefined) {
      updateData.state = state || null;
    }

    if (pincode !== undefined) {
      updateData.pincode =
        pincode || null;
    }

    if (country !== undefined) {
      updateData.country =
        country || null;
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    const updatedBusiness =
      await prisma.business.update({
        where: {
          id: businessId,
        },

        data: updateData,

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
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Business profile updated successfully",
      data: updatedBusiness,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| GET ADMIN SUBSCRIPTION
|--------------------------------------------------------------------------
*/

export const getAdminSubscription = async (
  req,
  res,
  next
) => {
  try {
    const businessId = req.businessId;

    const subscription =
      await prisma.subscription.findUnique({
        where: {
          businessId,
        },

        include: {
          plan: true,
        },
      });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,

        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          description:
            subscription.plan.description,

          price: Number(
            subscription.plan.price
          ),

          billingCycle:
            subscription.plan.billingCycle,

          maxProducts:
            subscription.plan.maxProducts,

          maxInvoices:
            subscription.plan.maxInvoices,

          gstInvoice:
            subscription.plan.gstInvoice,

          pdfInvoice:
            subscription.plan.pdfInvoice,

          reports:
            subscription.plan.reports,

          advancedReports:
            subscription.plan
              .advancedReports,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};