import "dotenv/config";

import bcrypt from "bcryptjs";

import prisma from "../src/config/prisma.js";

const seed = async () => {
  try {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: "superadmin@billing.com",
      },
    });

    if (existingUser) {
      console.log("Super Admin already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      "Admin@123",
      12
    );

    const superAdmin = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: "superadmin@billing.com",
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log("Super Admin created successfully.");
    console.log(`ID: ${superAdmin.id}`);
    console.log("Email: superadmin@billing.com");
    console.log("Password: Admin@123");
  } catch (error) {
    console.error("Seed Error:", error);
  } finally {
    await prisma.$disconnect();
  }
};

seed(); 