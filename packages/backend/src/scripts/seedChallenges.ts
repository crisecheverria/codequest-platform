import { connectDB } from "../db";
import { ChallengeModel } from "../models/Challenge";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Make sure we load environment variables
dotenv.config();

const seedChallenges = async () => {
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
    console.log("Successfully connected to database");

    // Check if "true" is passed as a command line argument
    const forceUpdate = process.argv.includes("true");

    // If forceUpdate is true, clear all existing challenges
    if (forceUpdate) {
      await ChallengeModel.deleteMany({});
      console.log("Cleared existing challenges");
    }

    // Read TypeScript/JavaScript challenges from JSON file
    const challengesPath = path.resolve(
      __dirname,
      "../../data/challenges.json"
    );
    console.log(
      "Loading TypeScript/JavaScript challenges from:",
      challengesPath
    );

    if (!fs.existsSync(challengesPath)) {
      throw new Error(`Challenges file not found at ${challengesPath}`);
    }

    const challengesData = fs.readFileSync(challengesPath, "utf8");
    const challenges = JSON.parse(challengesData);
    console.log(
      `Loaded ${challenges.length} TypeScript/JavaScript challenges from file`
    );

    // Read PHP challenges from JSON file
    const phpChallengesPath = path.resolve(
      __dirname,
      "../../data/php-challenges.json"
    );
    console.log("Loading PHP challenges from:", phpChallengesPath);

    if (!fs.existsSync(phpChallengesPath)) {
      console.warn(`PHP challenges file not found at ${phpChallengesPath}`);
      console.log("Continuing without PHP challenges");
    } else {
      const phpChallengesData = fs.readFileSync(phpChallengesPath, "utf8");
      const phpChallenges = JSON.parse(phpChallengesData);
      console.log(`Loaded ${phpChallenges.length} PHP challenges from file`);

      // Combine all challenges
      challenges.push(...phpChallenges);
      console.log(`Total challenges to process: ${challenges.length}`);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Check for existing challenges to avoid duplicates
    for (const challenge of challenges) {
      try {
        const exists = await ChallengeModel.findOne({ title: challenge.title });

        if (!exists) {
          // Create new challenge
          await ChallengeModel.create(challenge);
          created++;
        } else if (forceUpdate) {
          // Update if forceUpdate is true
          await ChallengeModel.findOneAndUpdate(
            { title: challenge.title },
            challenge
          );
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(
          `Error processing challenge "${challenge.title}":`,
          error
        );
      }
    }

    console.log(`
      Challenge seeding completed:
      - Created: ${created}
      - Updated: ${updated}
      - Skipped: ${skipped}
      - Total processed: ${challenges.length}
    `);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding challenges:", error);
    process.exit(1);
  }
};

seedChallenges();
