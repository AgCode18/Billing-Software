import "dotenv/config";

import prisma from "../src/config/prisma.js";

const plans = [
  {
    name: "Basic",
    description: "Basic billing features",
    price: 499,
    billingCycle: "MONTHLY",
    maxProducts: 100,
    maxInvoices: 500,
    gstInvoice: true,
    pdfInvoice: true,
    reports: true,
    advancedReports: false,
  },

  {
    name: "Professional",
    description: "Advanced billing features",
    price: 999,
    billingCycle: "MONTHLY",
    maxProducts: 500,
    maxInvoices: 2000,
    gstInvoice: true,
    pdfInvoice: true,
    reports: true,
    advancedReports: true,
  },

  {
    name: "Enterprise",
    description: "Complete business billing solution",
    price: 1999,
    billingCycle: "MONTHLY",
    maxProducts: null,
    maxInvoices: null,
    gstInvoice: true,
    pdfInvoice: true,
    reports: true,
    advancedReports: true,
  },
];

const seedPlans = async () => {
  try {
    for (const planData of plans) {
      const existingPlan =
        await prisma.membershipPlan.findFirst({
          where: {
            name: planData.name,
          },
        });

      if (existingPlan) {
        console.log(
          `${planData.name} plan already exists`
        );

        continue;
      }

      await prisma.membershipPlan.create({
        data: planData,
      });

      console.log(
        `${planData.name} plan created`
      );
    }
  } catch (error) {
    console.error("Plan Seed Error:", error);
  } finally {
    await prisma.$disconnect();
  }
};

seedPlans();