import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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

  const { username, email, password, fullname } = req.body; //avatar and coverImage will be available using multer through 'req.files'
  // console.log(email);

  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(401, `${field} is required`);
  }

  const existedUser = User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  console.log(req.files);

  const avatarLocalFilePath = req.files?.avatar[0]?.path;
  const coverImageLocalFilePath = req.files?.coverImage[0]?.path;

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

export { registerUser };
