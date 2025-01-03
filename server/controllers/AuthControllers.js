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
  const prisma = new PrismaClient();

  try {
    // Log the incoming request for debugging
    console.log("Request userId:", req.userId);

    // Validate userId
    if (!req.userId) {
      console.error("User ID not provided in the request.");
      return res.status(400).json({ error: "User ID not provided." });
    }

    // Fetch user data with associated address
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    // Handle case where user is not found
    if (!user) {
      console.error("User not found for ID:", req.userId);
      return res.status(404).json({ error: "User not found." });
    }

    // Respond with user data
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        image: user.profileImage,
        username: user.username,
        fullname: user.fullname,
        description: user.description,
        isProfileSet: user.isProfileInfoSet,
        isFreelancer: user.isFreelancer,
        phone: user.phone,
        isVerified: user.isVerified,
        verificationDocs: user.verificationDocs,
        portfolio: user.portfolio,
        verificationDate: user.verificationDate,
        isAdminApproved: user.isAdminApproved,
        language: user.language,
        qualifications: user.qualifications,
        hobbies: user.hobbies,
        skills: user.skills,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        experience: user.experience,
        interests: user.interests,
        houseNo: user.houseNo,
        street: user.street,
        city: user.city,
        state: user.state,
        postalCode: user.postalCode,
        country: user.country,
        apartment: user.apartment,
        landmark: user.landmark,
        addressType: user.addressType,
      },
    });
  } catch (err) {
    console.error("Error fetching user info:", err.message, err.stack);
    return res.status(500).json({ error: "Internal Server Error." });
  } finally {
    // Ensure Prisma disconnect
    await prisma.$disconnect();
  }
};




export const setUserInfo = async (req, res, next) => {
  const prisma = new PrismaClient();

  // Validate user inputs
  const validateInputs = (inputData) => {
    const {
      username,
      fullname,
      phone,
      description,
      language,
      qualifications,
      hobbies,
      skills,
      dateOfBirth,
      gender,
      experience,
      interests,
      street,
      city,
      state,
      postalCode,
      country,
      apartment,
      landmark,
      addressType,
    } = inputData;

    // Validate string fields
    const stringFields = [
      username, fullname, phone, description, gender,
      street, city, state, postalCode, country,
      apartment, landmark, addressType,
    ];
    if (stringFields.some((field) => field && typeof field !== 'string')) {
      return 'Invalid string field detected.';
    }

    // Validate arrays
    const arrayFields = [language, qualifications, hobbies, skills, interests];
    if (arrayFields.some((field) => field && !Array.isArray(field))) {
      return 'Invalid array field detected.';
    }

    // Validate date
    if (dateOfBirth && isNaN(new Date(dateOfBirth).getTime())) {
      return 'Invalid date format.';
    }

    // Validate experience (integer, positive)
    if (experience && (!Number.isInteger(experience) || experience < 0)) {
      return 'Experience must be a positive integer.';
    }

    return null;
  };

  try {
    // Ensure user is authenticated
    if (!req?.userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user ID.' });
    }

    const {
      username,
      fullname,
      phone,
      description,
      language,
      qualifications,
      hobbies,
      skills,
      dateOfBirth,
      gender,
      experience,
      interests,
      verificationDocs,
      portfolio,
      houseNo,
      street,
      city,
      state,
      postalCode,
      country,
      apartment,
      landmark,
      addressType,
    } = req.body;

    // Validate inputs
    const validationError = validateInputs(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Prepare update data
    const updateData = {
      username: username || null,
      fullname: fullname || null,
      phone: phone || null,
      description: description || null,
      language: language || [],
      qualifications: qualifications || [],
      hobbies: hobbies || [],
      skills: skills || [],
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || null,
      experience: experience || null,
      interests: interests || [],
      verificationDocs: verificationDocs || null,
      portfolio: portfolio || null,
      houseNo: houseNo || null,
      street: street || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      country: country || 'India',
      apartment: apartment || null,
      landmark: landmark || null,
      addressType: addressType || null,
      isProfileInfoSet: true,
    };

    // Update the user record
    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    });

    return res.status(200).json({
      message: 'Profile updated successfully.',
      data: updatedUser,
    });
  } catch (err) {
    // Handle unique constraint violations
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        const target = err.meta?.target?.[0];
        const conflictField = target === 'username' ? 'username' : 'phone';
        return res.status(409).json({
          error: `${conflictField} already exists.`,
        });
      }
    }

    // Handle unexpected errors
    console.error('Error updating user profile:', err);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
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

export const submitFreelancerForm = async (req, res) => {
  const prisma = new PrismaClient();

  try {
    const {
      fullname,
      phone,
      dob,
      email,
      gender,
      houseNo,
      apartment,
      street,
      landmark,
      language,
      city,
      state,
      pinCode,
      qualifications,
      experience,
      languages,
      portfolio,
      agree,
      emailUpdates,
    } = req.body;

    // Validate required fields
    if (
      !fullname ||
      !phone ||
      !dob ||
      !email ||
      !gender ||
      !houseNo ||
      !street ||
      !city ||
      !state ||
      !pinCode ||
      !qualifications ||
      !experience ||
      !languages ||
      !portfolio ||
      !agree
    ) {
      return res.status(400).json({ message: "Please fill in all required fields." });
    }

    // Ensure user is authenticated
    if (!req?.userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user ID." });
    }

    // Handle file upload
    const verificationDocsPath = req.file ? req.file.path : null;
    if (!verificationDocsPath) {
      return res.status(400).json({ message: "Verification document is required." });
    }

    // Prepare application data
    const freelancerApplication = {
      userId: req.userId, // Assumes `verifyToken` middleware sets req.userId
      fullname,
      phone,
      dob: new Date(dob), // Convert date of birth to a Date object
      email,
      gender,
      houseNo,
      apartment,
      street,
      landmark,
      language,
      city,
      state,
      pinCode,
      qualifications,
      verificationDocs: verificationDocsPath,
      experience,
      languages,
      portfolio,
      agree: agree === "true", // Convert agree to boolean
      emailUpdates: emailUpdates === "true", // Convert emailUpdates to boolean
      status: "pending", // Application status as "pending" initially
    };

    // Save application to the applications table (for admin approval)
    const application = await prisma.application.create({
      data: freelancerApplication,
    });

    res.status(200).json({
      message: "Freelancer application submitted successfully. Awaiting admin approval.",
      data: application,
    });
  } catch (err) {
    console.error("Error submitting freelancer form:", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  } finally {
    await prisma.$disconnect();
  }
};


export const approveFreelancerApplication = async (req, res) => {
  const prisma = new PrismaClient();

  try {
    const { applicationId } = req.params;

    // Find the application by ID
    const application = await prisma.application.findUnique({
      where: { id: Number(applicationId) },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }

    // Update user's status to Freelancer (after approval)
    const updatedUser = await prisma.user.update({
      where: { id: application.userId },
      data: {
        isFreelancer: true, // Set user as a freelancer
      },
    });

    // Move the data from the application table to the user table (optional if needed)
    await prisma.user.update({
      where: { id: application.userId },
      data: {
        fullname: application.fullname,
        phone: application.phone,
        dob: application.dob,
        email: application.email,
        gender: application.gender,
        houseNo: application.houseNo,
        apartment: application.apartment,
        street: application.street,
        landmark: application.landmark,
        language: application.language,
        city: application.city,
        state: application.state,
        pinCode: application.pinCode,
        qualifications: application.qualifications,
        experience: application.experience,
        languages: application.languages,
        portfolio: application.portfolio,
        emailUpdates: application.emailUpdates,
      },
    });

    // Delete the application after approval (optional)
    await prisma.application.delete({
      where: { id: Number(applicationId) },
    });

    res.status(200).json({
      message: "Freelancer application approved successfully.",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Error approving freelancer application:", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  } finally {
    await prisma.$disconnect();
  }
};
