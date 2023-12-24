import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while getting access token");
  }
};

const cookeiOptions = { httpOnly: true, secure: true };

const registerUser = asyncHandler(async (req, res) => {
  // get user detail from fe
  // validation - check non empty
  // check if user exist : username/email
  // check for images - (avatar required)
  // upload image to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token from response
  // check for user creation
  // return response

  const { username, email, fullname, password } = req.body;
  //   if (!fullname) throw new ApiError(400, "fullname is required");

  if (
    [fullname, username, email, password].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError(400, "all fields are required");
  }

  const existedUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existedUser) throw new ApiError(409, "User with email or username exist");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required 1st");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : "";

  if (!avatar) throw new ApiError(400, "Avatar file is required");

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
    password,
    email,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while regestring user");

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered successfully"));
  //   console.log(username, email, fullname, password);
  //   res.status(200);
});

const loginUser = asyncHandler(async (req, res) => {
  //get data from fe
  //validate all user feilds
  //check if username/email exist in database
  //validate user password
  //access and refresh token
  //send cookie

  const { email, username, password } = req.body;
  if (!(username || email))
    throw new ApiError(400, "username or email is required");

  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) throw new ApiError(404, "User does not exist");
  const isAuthenticated = await user.isValidPassword(password);

  if (!isAuthenticated) throw new ApiError(401, "Invalid user credentials");
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const singedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookeiOptions)
    .cookie("refreshToken", refreshToken, cookeiOptions)
    .json(
      new ApiResponse(
        200,
        { user: singedUser, accessToken, refreshToken },
        "user logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookeiOptions)
    .clearCookie("refreshToken", cookeiOptions)
    .json(new ApiResponse(200, {}, "User logout successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "unauthorized request");
  try {
    const decodedToken = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "Invalid Refresh Token");

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", newRefreshToken)
      .json(
        new ApiResponse(
          200,
          { accessToken, newRefreshToken },
          "accessToken refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
