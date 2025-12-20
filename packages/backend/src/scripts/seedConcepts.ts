// Improved implementation for packages/backend/src/scripts/seedConcepts.ts
// This will properly map PHP challenges to PHP resources

import { ConceptModel } from "../models/Concept";
import { connectDB } from "../db";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Make sure we load environment variables
dotenv.config();

// Updated function to update challenges with concept tags
const updateChallengesWithConcepts = async () => {
  // Expanded map of challenge functionName to concept tags
  // This now properly handles language-specific mappings
  const conceptMappings: Record<string, Record<string, string[]>> = {
    // TypeScript/JavaScript concept mappings
    typescript: {
      sum: ["variables", "operators"],
      multiply: ["variables", "operators"],
      isEven: ["conditionals", "operators"],
      getAbsoluteValue: ["conditionals", "operators"],
      reverseString: ["strings", "arrays"],
      countVowels: ["strings", "loops"],
      findMax: ["arrays", "loops"],
      filterEvenNumbers: ["arrays", "functions", "loops", "filter"],
      createGreeting: ["functions", "strings"],
      factorial: ["recursion", "functions"],
      fibonacci: ["recursion", "functions"],
      calculate: ["type-annotations", "conditionals", "operators"],
      createPerson: ["type-annotations", "objects", "conditionals"],
      doubleNumbers: ["functional-programming", "map", "arrays"],
      toUpperCase: ["functional-programming", "map", "strings"],
      sumArray: ["functional-programming", "reduce", "arrays"],
      averageOfEvenNumbers: [
        "functional-programming",
        "filter",
        "reduce",
        "arrays",
      ],
      wordLengthMap: ["functional-programming", "reduce", "objects"],
      groupByLength: ["functional-programming", "reduce", "objects", "arrays"],
      filterLongWords: ["functional-programming", "filter", "strings"],
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
      deepEqual: ["objects", "recursion", "deep-comparison"],
    },
    // PHP concept mappings - properly using php-specific concept tags
    php: {
      helloWorld: ["php-basics"],
      sum: ["php-basics", "php-functions", "php-math"],
      reverseString: ["php-strings", "php-functions"],
      doubleValues: ["php-arrays", "php-loops"],
      countVowels: ["php-strings", "php-loops"],
      calculateDiscount: ["php-functions", "php-math"],
      createRectangleClass: ["php-oop", "php-classes"],
      filterEvenNumbers: ["php-arrays", "php-functions"],
      safeDivide: ["php-error-handling", "php-functions"],
      linearSearch: ["php-search-algorithms", "php-linear-search"],
      binarySearch: ["php-search-algorithms", "php-binary-search"],
      firstDuplicate: ["php-array-analysis", "php-duplicate-handling"],
      countOccurrences: ["php-array-analysis", "php-frequency-counting"],
      isSorted: ["php-array-analysis", "php-array-validation"],
    },
    // Go concept mappings - using go-specific concept tags
    go: {
      demonstrateTypes: ["variables-go"],
      getDayName: ["constants-go"],
      divmod: ["functions-go"],
      getGrade: ["conditionals-go"],
      sumToN: ["loops-go"],
      findMax: ["arrays-go"],
      getEvenNumbers: ["slices-go"],
      countWords: ["maps-go"],
      createPerson: ["structs-go"],
      newCounter: ["pointers-methods-go"],
    },
  };

  // Access collection directly for better flexibility
  const db = mongoose.connection.db;
  const challengeCollection = db.collection("challenges");

  console.log("Getting challenges to update concept tags...");

  // Get all challenges
  const challenges = await challengeCollection.find({}).toArray();
  console.log(`Found ${challenges.length} challenges to process`);

  // First, log all TypeScript algorithm challenges to see if they exist
  const tsAlgorithmChallenges = [
    {
      title: "Linear Search",
      description:
        "Implement a function that performs linear search to find the index of a target value in an array.",
      difficulty: "easy",
      language: "typescript",
      functionName: "linearSearch",
      parameterTypes: ["number[]", "number"],
      returnType: "number",
      template:
        "function linearSearch(arr: number[], target: number): number {\n  // Write your code here\n}",
      testCases: [
        {
          input: [[1, 2, 3, 4, 5], 3],
          expected: 2,
          description: "target in middle",
        },
        {
          input: [[1, 2, 3], 4],
          expected: -1,
          description: "target not found",
        },
        { input: [[], 1], expected: -1, description: "empty array" },
      ],
      conceptTags: ["arrays", "list-algorithms", "iteration"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Binary Search",
      description:
        "Implement binary search on a sorted array. Return the index of the target or -1 if not found.",
      difficulty: "medium",
      language: "typescript",
      functionName: "binarySearch",
      parameterTypes: ["number[]", "number"],
      returnType: "number",
      template:
        "function binarySearch(arr: number[], target: number): number {\n  // Write your code here\n}",
      testCases: [
        {
          input: [[1, 3, 5, 7, 9], 5],
          expected: 2,
          description: "target found",
        },
        {
          input: [[2, 4, 6, 8], 3],
          expected: -1,
          description: "target not found",
        },
        { input: [[], 1], expected: -1, description: "empty array" },
      ],
      conceptTags: [
        "arrays",
        "list-algorithms",
        "recursion",
        "divide and conquer",
      ],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Find First Duplicate",
      description:
        "Return the first duplicate number found in the array or -1 if none exist.",
      difficulty: "medium",
      language: "typescript",
      functionName: "firstDuplicate",
      parameterTypes: ["number[]"],
      returnType: "number",
      template:
        "function firstDuplicate(arr: number[]): number {\n  // Write your code here\n}",
      testCases: [
        {
          input: [[2, 1, 3, 5, 3, 2]],
          expected: 3,
          description: "3 is the first duplicate",
        },
        {
          input: [[1, 2, 3, 4]],
          expected: -1,
          description: "no duplicates",
        },
        {
          input: [[1, 1, 2]],
          expected: 1,
          description: "immediate duplicate",
        },
      ],
      conceptTags: ["arrays", "list-algorithms", "hashing"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Count Occurrences",
      description: "Count how many times a target number appears in the array.",
      difficulty: "easy",
      language: "typescript",
      functionName: "countOccurrences",
      parameterTypes: ["number[]", "number"],
      returnType: "number",
      template:
        "function countOccurrences(arr: number[], target: number): number {\n  // Write your code here\n}",
      testCases: [
        {
          input: [[1, 2, 2, 3, 2], 2],
          expected: 3,
          description: "multiple occurrences",
        },
        { input: [[4, 5, 6], 1], expected: 0, description: "none found" },
        { input: [[], 0], expected: 0, description: "empty array" },
      ],
      conceptTags: ["arrays", "list-algorithms", "iteration", "counting"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Check if Sorted",
      description: "Determine if an array is sorted in ascending order.",
      difficulty: "easy",
      language: "typescript",
      functionName: "isSorted",
      parameterTypes: ["number[]"],
      returnType: "boolean",
      template:
        "function isSorted(arr: number[]): boolean {\n  // Write your code here\n}",
      testCases: [
        {
          input: [[1, 2, 3, 4]],
          expected: true,
          description: "sorted array",
        },
        {
          input: [[4, 3, 2, 1]],
          expected: false,
          description: "descending",
        },
        { input: [[1]], expected: true, description: "single element" },
      ],
      conceptTags: ["arrays", "list-algorithms", "comparisons"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
  ];

  // Insert the challenges directly
  for (const challenge of tsAlgorithmChallenges) {
    try {
      // Check if the challenge already exists
      const existingChallenge = await challengeCollection.findOne({
        title: challenge.title,
        language: "typescript",
      });

      if (existingChallenge) {
        // Update the existing challenge
        await challengeCollection.updateOne(
          { _id: existingChallenge._id },
          { $set: challenge }
        );
        console.log(
          `✓ Updated TypeScript algorithm challenge: ${challenge.title}`
        );
      } else {
        // Create a new challenge
        await challengeCollection.insertOne(challenge);
        console.log(
          `✓ Created TypeScript algorithm challenge: ${challenge.title}`
        );
      }
    } catch (error) {
      console.error(
        `Error processing TypeScript algorithm challenge "${challenge.title}":`,
        error
      );
    }
  }

  const phpAlgorithms = [
    {
      title: "Linear Search",
      description:
        "Implement linear search to find the index of a target value in an array.",
      difficulty: "easy",
      language: "php",
      functionName: "linearSearch",
      parameterTypes: ["array", "int"],
      returnType: "int",
      template:
        "<?php\n\nfunction linearSearch(array $arr, int $target): int {\n  // Write your code here\n  return -1;\n}\n\n?>",
      testCases: [
        {
          input: [[1, 2, 3, 4, 5], 3],
          expected: 2,
          description: "target in middle",
        },
        {
          input: [[1, 2, 3], 4],
          expected: -1,
          description: "target not found",
        },
        { input: [[], 1], expected: -1, description: "empty array" },
      ],
      conceptTags: ["php-list-algorithms", "php-arrays"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Binary Search",
      description:
        "Implement binary search on a sorted array. Return the index or -1.",
      difficulty: "medium",
      language: "php",
      functionName: "binarySearch",
      parameterTypes: ["array", "int"],
      returnType: "int",
      template:
        "<?php\n\nfunction binarySearch(array $arr, int $target): int {\n  // Write your code here\n  return -1;\n}\n\n?>",
      testCases: [
        {
          input: [[1, 3, 5, 7, 9], 5],
          expected: 2,
          description: "target found",
        },
        {
          input: [[2, 4, 6, 8], 3],
          expected: -1,
          description: "target not found",
        },
      ],
      conceptTags: ["php-arrays", "php-list-algorithms", "php-recursion"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Find First Duplicate",
      description:
        "Return the first duplicate number found in the array or -1 if none exist.",
      difficulty: "medium",
      language: "php",
      functionName: "firstDuplicate",
      parameterTypes: ["array"],
      returnType: "int",
      template:
        "<?php\n\nfunction firstDuplicate(array $arr): int {\n  // Write your code here\n  return -1;\n}\n\n?>",
      testCases: [
        {
          input: [[2, 1, 3, 5, 3, 2]],
          expected: 3,
          description: "3 is first duplicate",
        },
        {
          input: [[1, 2, 3, 4]],
          expected: -1,
          description: "no duplicates",
        },
      ],
      conceptTags: ["php-arrays", "php-list-algorithms", "php-duplicates"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Count Occurrences",
      description: "Count how many times a target number appears in the array.",
      difficulty: "easy",
      language: "php",
      functionName: "countOccurrences",
      parameterTypes: ["array", "int"],
      returnType: "int",
      template:
        "<?php\n\nfunction countOccurrences(array $arr, int $target): int {\n  // Write your code here\n  return 0;\n}\n\n?>",
      testCases: [
        {
          input: [[1, 2, 2, 3, 2], 2],
          expected: 3,
          description: "multiple occurrences",
        },
        { input: [[4, 5, 6], 1], expected: 0, description: "none found" },
      ],
      conceptTags: ["php-arrays", "php-list-algorithms", "php-counting"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
    {
      title: "Check if Sorted",
      description: "Determine if an array is sorted in ascending order.",
      difficulty: "easy",
      language: "php",
      functionName: "isSorted",
      parameterTypes: ["array"],
      returnType: "bool",
      template:
        "<?php\n\nfunction isSorted(array $arr): bool {\n  // Write your code here\n  return true;\n}\n\n?>",
      testCases: [
        {
          input: [[1, 2, 3, 4]],
          expected: true,
          description: "sorted array",
        },
        {
          input: [[4, 3, 2, 1]],
          expected: false,
          description: "descending",
        },
        { input: [[1]], expected: true, description: "single element" },
      ],
      conceptTags: ["php-arrays", "php-list-algorithms", "php-loops"],
      timeLimit: 5000,
      memoryLimit: 128,
    },
  ];

  // Insert the challenges directly
  for (const challenge of phpAlgorithms) {
    try {
      // Check if the challenge already exists
      const existingChallenge = await challengeCollection.findOne({
        title: challenge.title,
        language: "php",
      });

      if (existingChallenge) {
        // Update the existing challenge
        await challengeCollection.updateOne(
          { _id: existingChallenge._id },
          { $set: challenge }
        );
      } else {
        // Create a new challenge
        await challengeCollection.insertOne(challenge);
      }
    } catch (error) {
      console.error(
        `Error processing PHP algorithm challenge "${challenge.title}":`,
        error
      );
    }
  }

  // Verify the challenges were added/updated
  const finalCheck = await challengeCollection
    .find({
      language: "typescript",
      title: {
        $in: [
          "Linear Search",
          "Binary Search",
          "Find First Duplicate",
          "Count Occurrences",
          "Check if Sorted",
        ],
      },
    })
    .toArray();

  console.log(
    `Final check: Found ${finalCheck.length} TypeScript algorithm challenges`
  );
  finalCheck.forEach((c) => {
    console.log(`- ${c.title}: ${JSON.stringify(c.conceptTags)}`);
  });

  const phpFinalCheck = await challengeCollection
    .find({
      language: "php",
      title: {
        $in: [
          "Linear Search",
          "Binary Search",
          "Find First Duplicate",
          "Count Occurrences",
          "Check if Sorted",
        ],
      },
    })
    .toArray();

  console.log(
    `Final check: Found ${phpFinalCheck.length} TypeScript algorithm challenges`
  );
  phpFinalCheck.forEach((c) => {
    console.log(`- ${c.title}: ${JSON.stringify(c.conceptTags)}`);
  });

  console.log(
    `Found ${tsAlgorithmChallenges.length} TypeScript algorithm challenges:`
  );
  tsAlgorithmChallenges.forEach((c) => {
    console.log(`- ${c.title} (${c.functionName})`);
  });

  let updatedCount = 0;
  let skippedCount = 0;

  // Update each challenge with conceptTags based on functionName and language
  for (const challenge of challenges) {
    try {
      const language = challenge.language.toLowerCase();
      const functionName = challenge.functionName;

      // Get language-specific mappings
      const languageMappings = conceptMappings[language];

      if (languageMappings && languageMappings[functionName]) {
        // For algorithm challenges, ensure we're not removing the list-algorithms tag
        let updatedConceptTags = languageMappings[functionName];

        // Update challenge with the correct language-specific concept tags
        // CRITICAL: Include both _id AND language in the query to ensure we only update the right challenge
        const result = await challengeCollection.updateOne(
          { _id: challenge._id, language: language },
          { $set: { conceptTags: updatedConceptTags } }
        );

        if (result.matchedCount > 0) {
          console.log(
            `✓ Updated ${language} challenge: ${
              challenge.title
            } with concepts: ${updatedConceptTags.join(", ")}`
          );
          updatedCount++;
        }
      } else {
        console.log(
          `⤫ Skipped challenge: ${challenge.title} (no concept mapping found for ${language}/${functionName})`
        );
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error updating challenge "${challenge.title}":`, error);
    }
  }

  // IMPORTANT: Special handling for algorithm challenges by title
  // This ensures TypeScript algorithm challenges are properly tagged even if the function names don't match
  const algorithmChallenges = [
    {
      title: "Linear Search",
      tags: ["arrays", "list-algorithms", "iteration"],
    },
    {
      title: "Binary Search",
      tags: ["arrays", "list-algorithms", "recursion", "divide and conquer"],
    },
    {
      title: "Find First Duplicate",
      tags: ["arrays", "list-algorithms", "hashing"],
    },
    {
      title: "Count Occurrences",
      tags: ["arrays", "list-algorithms", "iteration", "counting"],
    },
    {
      title: "Check if Sorted",
      tags: ["arrays", "list-algorithms", "comparisons"],
    },
  ];

  console.log("\nEnsuring TypeScript algorithm challenges have correct tags:");
  for (const challenge of algorithmChallenges) {
    const result = await challengeCollection.updateOne(
      { title: challenge.title, language: "typescript" },
      { $set: { conceptTags: challenge.tags } }
    );

    if (result.matchedCount > 0) {
      console.log(
        `✓ Fixed TypeScript challenge: ${
          challenge.title
        } with tags: ${challenge.tags.join(", ")}`
      );
      updatedCount++;
    } else {
      console.log(`⚠ TypeScript challenge not found: ${challenge.title}`);
    }
  }

  // Verification after updates
  console.log("\nVerifying TypeScript algorithm challenges after updates:");
  for (const challenge of algorithmChallenges) {
    const tsChallenge = await challengeCollection.findOne({
      title: challenge.title,
      language: "typescript",
    });

    if (tsChallenge) {
      console.log(
        `- ${challenge.title}: ${JSON.stringify(tsChallenge.conceptTags)}`
      );
    } else {
      console.log(`- ${challenge.title}: NOT FOUND`);
    }
  }

  console.log(`
  Challenge concept mapping completed:
  - Updated: ${updatedCount}
  - Skipped: ${skippedCount}
  - Total: ${challenges.length}
  `);
};

// Main function to seed concepts
const seedConcepts = async () => {
  try {

    // Connect to the database
    await connectDB();
    console.log("Successfully connected to database");

    // Check if "true" is passed as a command line argument (force update)
    const forceUpdate = process.argv.includes("true");

    // Read concepts from JSON files
    const conceptsPath = path.resolve(__dirname, "../../data/concepts.json");
    const phpConceptsPath = path.resolve(
      __dirname,
      "../../data/php-concepts.json"
    );

    console.log("Loading concepts from:", conceptsPath);
    console.log("Loading PHP concepts from:", phpConceptsPath);

    // Load and merge the concepts
    const concepts = [];

    if (fs.existsSync(conceptsPath)) {
      const conceptsData = fs.readFileSync(conceptsPath, "utf8");
      concepts.push(...JSON.parse(conceptsData));
      console.log(`Loaded ${concepts.length} JavaScript/TypeScript concepts`);
    } else {
      console.warn(`Concepts file not found at ${conceptsPath}`);
    }

    if (fs.existsSync(phpConceptsPath)) {
      const phpConceptsData = fs.readFileSync(phpConceptsPath, "utf8");
      const phpConcepts = JSON.parse(phpConceptsData);
      concepts.push(...phpConcepts);
      console.log(`Loaded ${phpConcepts.length} PHP concepts`);
    } else {
      console.warn(`PHP concepts file not found at ${phpConceptsPath}`);
    }

    console.log(`Total concepts to process: ${concepts.length}`);

    if (forceUpdate) {
      // Clear existing concepts
      await ConceptModel.deleteMany({});
      console.log("✓ Cleared existing concepts");

      // Insert new concepts
      await ConceptModel.insertMany(concepts);
      console.log(`✓ Successfully seeded ${concepts.length} concepts!`);
    } else {
      // Update or insert concepts without clearing
      let created = 0;
      let updated = 0;

      for (const concept of concepts) {
        try {
          const exists = await ConceptModel.findOne({ slug: concept.slug });

          if (!exists) {
            await ConceptModel.create(concept);
            created++;
          } else {
            await ConceptModel.findOneAndUpdate(
              { slug: concept.slug },
              concept
            );
            updated++;
          }
        } catch (error) {
          console.error(`Error processing concept "${concept.name}":`, error);
        }
      }

      console.log(`
      Concept seeding completed:
      - Created: ${created}
      - Updated: ${updated}
      - Total: ${concepts.length}
      `);
    }

    // Update challenges with concept tags
    await updateChallengesWithConcepts();

    console.log("Completed seeding concepts and updating challenge mappings");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding concepts:", error);
    process.exit(1);
  }
};

// Run the seed function
seedConcepts();
