import { Router } from "express";
import {
  signup,
  getUserInfo,
  setUserInfo,
  setUserImage,
  setUserName,
  login,

} from "../controllers/AuthControllers.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "public/uploads/profiles";
    console.log("Resolved upload path:", uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const fileName = Date.now() + req.userId + file.originalname;
    console.log("Generated filename:", fileName);
    cb(null, fileName);
  },
});


const upload = multer({ storage: storage });

const authRoutes = Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/get-user-info", verifyToken, getUserInfo);
authRoutes.post("/set-username" , verifyToken, setUserName);
authRoutes.post("/set-user-info", verifyToken, setUserInfo);

authRoutes.post(
  "/set-user-image",
  verifyToken,
  upload.single("image"),
  setUserImage
);

export default authRoutes;
