import { Router } from "express";
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserDetails,
  updateUserCoverImage,
  updateUserAvatar,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  //while taking fields take files also >>
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// secured routes -- verify user before going to the route

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/refresh-token").post(refreshAccessToken);

router.post("/change-password", verifyJWT, changeCurrentPassword);

router.route("/get-user").get(verifyJWT, getCurrentUser);

router.route("/update-user").post(verifyJWT, updateUserDetails);

router
  .route("/update-user-avatar")
  .post(upload.single("avatar"), verifyJWT, updateUserAvatar);

router
  .route("/update-user-coverImage")
  .post(upload.single("coverImage"), verifyJWT, updateUserCoverImage);

export default router;
