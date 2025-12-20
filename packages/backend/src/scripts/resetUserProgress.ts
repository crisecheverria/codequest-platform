import { connectDB } from "../db";
import { UserModel } from "../models/User";
import readline from "readline";
import dotenv from "dotenv";

// Make sure we load environment variables
dotenv.config();

// Create interface for CLI interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to ask for confirmation
const confirm = async (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      resolve(answer.toLowerCase() === "y");
    });
  });
};

// Parse command line arguments
const parseArgs = () => {
  const args: { [key: string]: string | boolean } = {
    remove: process.argv.includes("--remove"),
    userId: "",
    skipConfirm: process.argv.includes("--yes") || process.argv.includes("-y"),
  };

  // Extract userId if present
  const userIdArg = process.argv.find((arg) => arg.startsWith("--userId="));
  if (userIdArg) {
    args.userId = userIdArg.split("=")[1];
  }

  return args;
};

const resetUserProgress = async () => {
  try {
    console.log("Environment variables loaded:", {
      MONGODB_URI: process.env.MONGODB_URI ? "Set (masked)" : "Not set",
      MONGODB_USER: process.env.MONGODB_USER ? "Set" : "Not set",
      MONGODB_PASSWORD: process.env.MONGODB_PASSWORD
        ? "Set (masked)"
        : "Not set",
    });

    // Use the database connection from config (which already handles auth)
    await connectDB();
    console.log("Connected to database successfully");

    const args = parseArgs();
    const filter = args.userId ? { _id: args.userId } : {};

    // Count targeted users
    const totalUsers = await UserModel.countDocuments(filter);

    if (totalUsers === 0) {
      console.log("No matching users found.");
      rl.close();
      process.exit(0);
    }

    console.log(
      `Found ${totalUsers} user${totalUsers > 1 ? "s" : ""} to reset`
    );

    // Ask for confirmation unless --yes flag is used
    if (!args.skipConfirm) {
      const message = args.userId
        ? `Are you sure you want to reset progress for user ${args.userId}?`
        : `WARNING: This will reset progress for ALL ${totalUsers} users. Are you sure?`;

      const confirmed = await confirm(message);
      if (!confirmed) {
        console.log("Operation cancelled.");
        rl.close();
        process.exit(0);
      }
    }

    let result;

    // Option 1: Complete removal
    if (args.remove) {
      console.log(`Removing all progress data...`);
      result = await UserModel.updateMany(filter, {
        $unset: {
          badges: "",
          submissions: "",
          progress: "",
          completedChallenges: "",
        },
      });
      console.log(
        `✓ Removed progress data from ${result.modifiedCount} user record(s)`
      );
    }
    // Option 2: Initialize empty structures
    else {
      console.log(`Resetting progress data to initial state...`);
      result = await UserModel.updateMany(filter, {
        $set: {
          badges: [],
          completedChallenges: [],
          submissions: [],
          progress: {
            conceptsProgress: {},
            languageProgress: {},
            streak: {
              current: 0,
              longest: 0,
              lastActive: new Date(),
            },
            totalPoints: 0,
          },
        },
      });
      console.log(
        `✓ Reset progress data for ${result.modifiedCount} user record(s)`
      );
    }

    // Optional: Print sample user to verify changes if only one was updated or if requested
    if (args.userId || totalUsers === 1) {
      const sampleUser = await UserModel.findOne(filter).lean();
      console.log("\nUser after reset:");

      // Print selected fields for verification
      const userSummary = {
        _id: sampleUser?._id,
        username: sampleUser?.username,
        badges: sampleUser?.badges || [],
        completedChallenges: sampleUser?.completedChallenges || [],
        submissions: (sampleUser?.submissions || []).length,
        progress: sampleUser?.progress || {},
      };

      console.log(JSON.stringify(userSummary, null, 2));
    }

    console.log("Progress reset completed successfully.");

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting user progress:", error);
    rl.close();
    process.exit(1);
  }
};

// Run the script
resetUserProgress();
