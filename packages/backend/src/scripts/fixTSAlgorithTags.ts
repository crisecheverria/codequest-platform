// fixTSAlgorithmTags.ts
import { connectDB } from "../db";
import mongoose from "mongoose";

const fixTSAlgorithmTags = async () => {
  try {
    await connectDB();
    console.log("Connected to database");

    const db = mongoose.connection.db;
    const challengeCollection = db.collection("challenges");

    // Define the correct tags for each algorithm challenge
    const algorithmTags = {
      linearSearch: ["arrays", "list-algorithms", "iteration"],
      binarySearch: [
        "arrays",
        "list-algorithms",
        "recursion",
        "divide and conquer",
      ],
      firstDuplicate: ["arrays", "list-algorithms", "hashing"],
      countOccurrences: ["arrays", "list-algorithms", "iteration", "counting"],
      isSorted: ["arrays", "list-algorithms", "comparisons"],
    };

    // First, check the current state
    const challenges = await challengeCollection
      .find({
        language: "typescript",
        functionName: { $in: Object.keys(algorithmTags) },
      })
      .toArray();

    console.log("Current state of TypeScript algorithm challenges:");
    challenges.forEach((c) => {
      console.log(
        `${c.title} (${c.functionName}): ${JSON.stringify(c.conceptTags)}`
      );
    });

    // Fix each challenge
    for (const [functionName, tags] of Object.entries(algorithmTags)) {
      const result = await challengeCollection.updateOne(
        { language: "typescript", functionName },
        { $set: { conceptTags: tags } }
      );

      if (result.matchedCount > 0) {
        console.log(`✓ Fixed tags for ${functionName}: ${tags.join(", ")}`);
      } else {
        console.log(`⚠ Challenge not found: ${functionName}`);
      }
    }

    // Verify the fixes
    const updatedChallenges = await challengeCollection
      .find({
        language: "typescript",
        functionName: { $in: Object.keys(algorithmTags) },
      })
      .toArray();

    updatedChallenges.forEach((c) => {
      console.log(
        `${c.title} (${c.functionName}): ${JSON.stringify(c.conceptTags)}`
      );
    });

    console.log("Done fixing TypeScript algorithm tags");
    process.exit(0);
  } catch (error) {
    console.error("Error fixing TypeScript algorithm tags:", error);
    process.exit(1);
  }
};

fixTSAlgorithmTags();
