import bcrypt from "bcrypt";
import { PrismaClient, Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
const prisma = new PrismaClient();
import { renameSync } from "fs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";


// Utility function to hash passwords
const generatePassword = async (password) => {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
};

// Utility function to compare passwords
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Signup controller
// Signup controller
export const signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const hashedPassword = await generatePassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ message: "User created successfully", user, token });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return res
        .status(400)
        .json({ error: "Database error", details: err.message });
    }

    console.error("Unexpected error during signup:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
};


// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email }, // Payload
      process.env.JWT_SECRET, // Secret key
      { expiresIn: "7d" } // Token expiration
    );

    const { password: _, ...userData } = user;

    // Send response with user data and token
    res.status(200).json({ message: "Login successful", user: userData, token });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return res
        .status(400)
        .json({ error: "Database error", details: err.message });
    }

    console.error("Unexpected error during login:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
};


export const getUserInfo = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(400).send("User ID not provided"); // Clear message for missing userId
    }
    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        image: user.profileImage,
        username: user.username,
        name: user.fullname,
        description: user.description,
        isProfileSet: user.isProfileInfoSet,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal Server Error");
  }
};


export const setUserInfo = async (req, res, next) => {
  const prisma = new PrismaClient();
  try {
    if (!req?.userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user ID." });
    }

    const { username, fullname, description } = req.body;

    // Validate inputs
    if (
      typeof username !== "string" ||
      typeof fullname !== "string" ||
      typeof description !== "string"
    ) {
      return res.status(400).json({ error: "Invalid input types." });
    }

    // Update user profile
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        username,
        fullname,
        description,
        isProfileInfoSet: true,
      },
    });

    return res.status(200).json({ message: "Profile data updated successfully." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002" && err.meta?.target?.includes("username")) {
        return res.status(409).json({ userNameError: "Username already exists." });
      }
    }

    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await prisma.$disconnect();
  }
};

export const setUserName = async (req, res, next) => {
  try {
    // Ensure userId is present in the request
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user ID." });
    }

    const { username } = req.body;

    // Validate the username
    if (typeof username !== "string" || username.trim().length === 0) {
      return res.status(400).json({ error: "Invalid input type or empty username." });
    }

    const prisma = new PrismaClient();

    // Attempt to update the username
    await prisma.user.update({
      where: { id: req.userId },
      data: { username },
    });

    return res.status(200).json({ message: "Username updated successfully." });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle unique constraint violation for username
      if (err.code === "P2002" && err.meta?.target?.includes("username")) {
        return res.status(409).json({ error: "Username already exists." });
      }
    }
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    // Always disconnect Prisma client
    const prisma = new PrismaClient();
    await prisma.$disconnect();
  }
};

export const setUserImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Image not included.");
    if (!req.userId) return res.status(400).send("Cookie Error.");

    const date = Date.now();

    // Simulate __dirname
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const uploadDir = path.join(__dirname, "../public/uploads/profiles");

    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Construct file paths for the new image
    const fileName = path.join(uploadDir, `${date}${req.userId}${req.file.originalname}`);
    const relativePath = `/uploads/profiles/${date}${req.userId}${req.file.originalname}`;

    console.log("Source Path:", req.file.path);
    console.log("Destination Path:", fileName);

    // Get the old profile image path from the database
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { profileImage: true },
    });

    // If the user has an old profile image, delete it from storage
    if (user && user.profileImage) {
      const oldImagePath = path.join(__dirname, `../public${user.profileImage}`);
      
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath); // Delete the old profile image file
        console.log(`Old image deleted: ${oldImagePath}`);
      }
    }

    // Rename and save the new image
    renameSync(req.file.path, fileName);

    // Update the database with the new profile image path
    await prisma.user.update({
      where: { id: req.userId },
      data: { profileImage: relativePath },
    });

    res.status(200).json({ img: relativePath });
  } catch (err) {
    console.error("Error during image upload:", err);
    res.status(500).send("Internal Server Error: " + err.message);
  }
};

