import { Router } from "express";
import jwt, { Secret } from "jsonwebtoken";
import axios from "axios";
import { UserModel } from "../models/User";
import { config } from "../config";

const router = Router();

// GitHub OAuth callback route (GET)
router.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }

  try {
    console.log("GitHub OAuth config:", {
      clientId: config.github.clientId,
      callbackUrl: config.github.callbackUrl,
    });

    // Exchange code for access token
    console.log("Exchanging code for access token...");
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
      }
    );

    console.log("Token response received:", {
      status: tokenRes.status,
      hasAccessToken: !!tokenRes.data.access_token,
    });

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

    console.log("GitHub user data received:", {
      id: userRes.data.id,
      login: userRes.data.login,
      hasEmail: !!userRes.data.email,
    });

    const githubUser = userRes.data;

    // Find or create user
    let user = await UserModel.findOne({ githubId: githubUser.id.toString() });
    console.log("Existing user found:", !!user);

    if (!user) {
      user = await UserModel.create({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
      });
      console.log("New user created:", user._id);
    }

    // Update last login and handle data migration if needed
    user.lastLogin = new Date();
    
    // Check if user has old submission data that needs migration
    if (user.submissions && user.submissions.length > 0) {
      const hasOldSubmissions = user.submissions.some(sub => !sub.challengeSlug && (sub as any).challengeId);
      
      if (hasOldSubmissions) {
        console.log("User has old submission data, clearing submissions for schema compatibility...");
        user.submissions = [];
        user.completedChallenges = [];
        console.log("Old submission data cleared");
      }
    }
    
    await user.save();
    console.log("User last login updated");

    // Generate JWT
    console.log("Generating JWT...");
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        githubId: user.githubId,
      },
      config.jwt.secret as Secret,
      {
        expiresIn: "7d",
      }
    );
    console.log("JWT generated successfully");

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
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent("Authentication failed")}`);
  }
});

router.post("/github", async (req, res) => {
  const { code } = req.body;

  try {
    console.log("GitHub OAuth config:", {
      clientId: config.github.clientId,
      callbackUrl: config.github.callbackUrl,
      // Don't log the secret!
    });

    // Exchange code for access token
    console.log("Exchanging code for access token...");
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
      }
    );

    console.log("Token response received:", {
      status: tokenRes.status,
      hasAccessToken: !!tokenRes.data.access_token,
    });

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

    console.log("GitHub user data received:", {
      id: userRes.data.id,
      login: userRes.data.login,
      hasEmail: !!userRes.data.email,
    });

    const githubUser = userRes.data;

    // Find or create user
    let user = await UserModel.findOne({ githubId: githubUser.id.toString() });
    console.log("Existing user found:", !!user);

    if (!user) {
      user = await UserModel.create({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
      });
      console.log("New user created:", user._id);
    }

    // Update last login and handle data migration if needed
    user.lastLogin = new Date();
    
    // Check if user has old submission data that needs migration
    if (user.submissions && user.submissions.length > 0) {
      const hasOldSubmissions = user.submissions.some(sub => !sub.challengeSlug && (sub as any).challengeId);
      
      if (hasOldSubmissions) {
        console.log("User has old submission data, clearing submissions for schema compatibility...");
        // For now, we'll clear old submissions to avoid validation errors
        // In production, you'd want to create a proper migration script
        user.submissions = [];
        user.completedChallenges = [];
        console.log("Old submission data cleared");
      }
    }
    
    await user.save();
    console.log("User last login updated");

    // Generate JWT
    console.log("Generating JWT...");
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        githubId: user.githubId,
      },
      config.jwt.secret as Secret,
      {
        expiresIn: "7d",
      }
    );
    console.log("JWT generated successfully");

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

export default router;
