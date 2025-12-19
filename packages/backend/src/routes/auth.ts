import { Router, Response } from "express";
import jwt, { Secret } from "jsonwebtoken";
import axios from "axios";
import { UserModel } from "../models/User";
import { config } from "../config";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GitHub OAuth callback route (GET)
router.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );


    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new Error("No access token received from GitHub");
    }

    // Get user data from GitHub
    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "Code-Challenge-Platform",
      },
    });

    const githubUser = userRes.data;

    // Find or create user
    let user = await UserModel.findOne({ githubId: githubUser.id.toString() });

    if (!user) {
      user = await UserModel.create({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
      });
    }

    // Update last login and handle data migration if needed
    user.lastLogin = new Date();

    // Check if user has old submission data that needs migration
    if (user.submissions && user.submissions.length > 0) {
      const hasOldSubmissions = user.submissions.some(
        (sub) => !sub.challengeSlug && (sub as any).challengeId,
      );

      if (hasOldSubmissions) {
        user.submissions = [];
        user.completedChallenges = [];
      }
    }

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        githubId: user.githubId,
      },
      config.jwt.secret as Secret,
      {
        expiresIn: "7d",
      },
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/success?token=${token}`);
  } catch (error) {
    console.error("Detailed authentication error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      response:
        error instanceof axios.AxiosError
          ? {
              status: error.response?.status,
              data: error.response?.data,
            }
          : undefined,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(
      `${frontendUrl}/login?error=authentication_failed&message=${encodeURIComponent("Authentication failed")}`,
    );
  }
});

router.post("/github", async (req, res) => {
  const { code } = req.body;

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );


    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new Error("No access token received from GitHub");
    }

    // Get user data from GitHub
    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "Code-Challenge-Platform",
      },
    });


    const githubUser = userRes.data;

    // Find or create user
    let user = await UserModel.findOne({ githubId: githubUser.id.toString() });

    if (!user) {
      user = await UserModel.create({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
      });
    }

    // Update last login and handle data migration if needed
    user.lastLogin = new Date();

    // Check if user has old submission data that needs migration
    if (user.submissions && user.submissions.length > 0) {
      const hasOldSubmissions = user.submissions.some(
        (sub) => !sub.challengeSlug && (sub as any).challengeId,
      );

      if (hasOldSubmissions) {
        user.submissions = [];
        user.completedChallenges = [];
      }
    }

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        githubId: user.githubId,
      },
      config.jwt.secret as Secret,
      {
        expiresIn: "7d",
      },
    );

    res.json({ token, user });
  } catch (error) {
    console.error("Detailed authentication error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      response:
        error instanceof axios.AxiosError
          ? {
              status: error.response?.status,
              data: error.response?.data,
            }
          : undefined,
    });

    res.status(500).json({
      error: "Authentication failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    // Return user data without sensitive information
    res.json({
      id: user._id,
      githubId: user.githubId,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

export default router;
