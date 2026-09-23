import "dotenv/config";
import crypto from "crypto";
import prisma from "../src/config/prisma.js";

/**
 * Hash a password using scrypt with a random salt.
 * Returns "salt:hash" so it can be verified later.
 */
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

/**
 * Verify a plain password against a stored "salt:hash" string.
 */
export const verifyPassword = (password, storedHash) => {
  const [salt, originalHash] = storedHash.split(":");
  const hashToVerify = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(originalHash, "hex"),
    Buffer.from(hashToVerify, "hex")
  );
};

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

    const hashedPassword = hashPassword("Admin@123");

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