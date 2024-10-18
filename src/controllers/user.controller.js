import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(400, "No user exists");

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // save a document without triggering any validation or middleware
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.log("Error while generating tokens", error);
    throw new ApiError(
      402,
      "Error while generating tokens in generateAccessAndRefreshToken"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //REGISTER THE USER STEPS -
  //get user details from frontend
  //validation on fields - not empty
  //check if user already exists - username,email
  //check for images, check for avatar
  //upload to cloudinary ,avatar check
  //create user object - create user entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return response

  // console.log("body-", req.body);
  const { username, email, password, fullname } = req.body; //avatar and coverImage will be available using multer through 'req.files'
  // console.log(email);

  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(401, `${field} is required`);
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  // console.log("req.files", req.files);
  // cnakns

  const avatarLocalFilePath = req.files?.avatar[0]?.path;
  let coverImageLocalFilePath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  )
    coverImageLocalFilePath = req.files.coverImage.path;

  if (!avatarLocalFilePath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalFilePath);
  const coverImage = await uploadOnCloudinary(coverImageLocalFilePath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const newUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!newUser) {
    throw new ApiError(500, "User not created properly");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, "User registered Successfully", newUser));
});

const loginUser = asyncHandler(async (req, res) => {
  // STEPS TO LOGIN USER -
  // req login data from frontend
  // validate fields
  // find user from db
  // check password
  // access and refresh token
  // send resp with coookie

  const { username, email, password } = req.body;
  // console.log(username);
  // console.log(email);

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) throw new ApiError(404, "User is not registered");

  //can call 'isPasswordCorrect' and other methods from 'user.model.js' by using the 'user' created
  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) throw new ApiError(401, "Password is incorrect");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(201, "User Logged in Successfully", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // STEPS FOR LOGOUT USER -
  // from middleware get the user
  // refresh token - undefined
  // cookie remove

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(201)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logout Successfully", {}));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    // from cookies we get encoded token
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken)
      throw new ApiError(401, "incomingRefreshToken not found");

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) throw new ApiError(404, "User not found with decodedToken id");

    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh Token is Expired");
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(201)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(200, "Access Token refreshed", {
          accessToken,
          refreshToken: newRefreshToken,
        })
      );
  } catch (error) {
    throw new ApiError(
      400,
      error?.message || "Error while refreshing access token"
    );
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
