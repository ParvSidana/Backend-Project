import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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

  // console.log("user id", typeof req.user._id);

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

const changeCurrentPassword = asyncHandler(async (req, res) => {
  //
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(404, "User not found");

  const isPassValid = await user.isPasswordCorrect(oldPassword);

  if (!isPassValid) throw new ApiError(402, "Password is Incorrect");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(201)
    .json(new ApiResponse(200, "Password changed Successfully", {}));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(201, "User returned Successfully", req.user));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email)
    throw new ApiError(400, "fullname and email is required");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  // await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "User Details updated Successfully", user));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // since we require a single file - use 'req.file' not 'req.files'
  const localFilePath = req.file?.path; // from multer

  if (!localFilePath) throw new ApiError(400, "Avatar file is required");

  const avatar = await uploadOnCloudinary(localFilePath);

  if (!avatar) throw new ApiError(401, "avatar not uploaded on cloudinary");

  const user = await findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  return res.status(200).json(201, "Avatar updated successfully", user);
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const localFilePath = req.file?.path; // from multer

  if (!localFilePath) throw new ApiError(400, "Cover Image file is required");

  const coverImage = await uploadOnCloudinary(localFilePath);

  if (!coverImage)
    throw new ApiError(401, "coverImage not uploaded on cloudinary");

  const user = await findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  return res.status(200).json(201, "Cover Image updated successfully", user);
});

const getChannelProfile = asyncHandler(async (req, res) => {
  // here the user will be received from parameter
  const { username } = req.params; // username -> channel name

  if (!username?.trim()) {
    throw new ApiError(400, "Username not found");
  }

  // aggregate returns an ARRAY of documents
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      // for subscribers - we have to look for same channel docs
      $lookup: {
        from: "subscriptions", // from which model to lookup/join
        localField: "_id", // User model '_id' field (present model field)
        foreignField: "channel", // Subscription model 'channel' field (other model field)
        as: "subscribers", // what to call the field
      },
    },
    {
      // for subscribedTo channels
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo", // channels user has subscribed to
      },
    },
    {
      // add fields in the present document
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        // field for whether user has subscribed or not
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        email: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);

  if (!channel?.length) throw new ApiError(401, "Channel does not exist");

  return res
    .status(200)
    .json(
      new ApiResponse(201, "Channel profile fetched successfully", channel[0])
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: req.user._id,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          // here we are at videos and joining users
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                // here we are at users again
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    email: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        201,
        "user History fetched successfully",
        user[0].watchHistory
      )
    );
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getChannelProfile,
  getWatchHistory,
};
