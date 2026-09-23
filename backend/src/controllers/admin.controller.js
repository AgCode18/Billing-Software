import prisma from "../config/prisma.js";

export const getDashboard = async (req, res) => {
  try {
    const businessId = req.businessId;

    const business = await prisma.business.findUnique({
      where: {
        id: businessId,
      },
      include: {
        subscription: {
          include: {
            plan: true,
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

    const admin = await prisma.user.findFirst({
      where: {
        businessId,
        role: "ADMIN",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return res.status(200).json({
      success: true,

      business: {
        id: business.id,
        name: business.name,
        ownerName: business.ownerName,
        email: business.email,
        phone: business.phone,
        logo: business.logo,
        gstNumber: business.gstNumber,
        panNumber: business.panNumber,
        address: business.address,
        city: business.city,
        state: business.state,
        pincode: business.pincode,
        country: business.country,
      },

      admin,

      subscription: business.subscription,
    });
  } catch (error) {
    console.error(
      "Admin Dashboard Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};