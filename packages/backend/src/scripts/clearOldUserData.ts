import { connectDB } from "../db";
import { UserModel } from "../models/User";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const confirm = async (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      resolve(answer.toLowerCase() === "y");
    });
  });
};

const clearOldUserData = async () => {
  try {
    
    // Connect to database
    await connectDB();
    console.log("Connected to database");

    // Get count of users with old data
    const usersWithOldData = await UserModel.countDocuments({
      $or: [
        { "submissions.challengeId": { $exists: true } },
        { completedChallenges: { $type: "objectId" } }
      ]
    });

    if (usersWithOldData === 0) {
      console.log("No users found with old data format. All good!");
      rl.close();
      process.exit(0);
    }

    console.log(`Found ${usersWithOldData} users with old data format.`);
    console.log("This will clear their submissions and completed challenges to fix schema compatibility.");
    console.log("Users can rebuild their progress by completing challenges again.");

    // Auto-confirm for automation
    const autoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');
    
    if (!autoConfirm) {
      const confirmed = await confirm(
        `Are you sure you want to clear old data for ${usersWithOldData} users?`
      );

      if (!confirmed) {
        console.log("Operation cancelled.");
        rl.close();
        process.exit(0);
      }
    } else {
      console.log("Auto-confirming data clear...");
    }

    // Clear old data
    const result = await UserModel.updateMany(
      {
        $or: [
          { "submissions.challengeId": { $exists: true } },
          { completedChallenges: { $type: "objectId" } }
        ]
      },
      {
        $set: {
          submissions: [],
          completedChallenges: [],
          badges: [],
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
      }
    );

    console.log(`✓ Cleared old data for ${result.modifiedCount} users`);
    console.log("Migration completed successfully!");

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("Error clearing old user data:", error);
    rl.close();
    process.exit(1);
  }
};

clearOldUserData();