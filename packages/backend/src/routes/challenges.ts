// backend/src/routes/challenges.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { ChallengeModel } from "../models";
import { ConceptModel } from "../models/Concept";
import { UserModel } from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { config } from "../config";

const router = Router();

// Validation schema for creating a challenge
const CreateChallengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  language: z.enum(["javascript", "typescript", "php", "go"]),
  functionName: z.string().min(1),
  parameterTypes: z.array(z.string()),
  returnType: z.string(),
  template: z.string(),
  testCases: z.array(
    z.object({
      input: z.array(z.any()),
      expected: z.any(),
      description: z.string().optional(),
    })
  ),
  timeLimit: z.number().positive(),
  memoryLimit: z.number().positive(),
});

// Get all challenges
router.get("/", async (req, res) => {
  try {
    
    // Build filter object from query parameters
    const filter: any = {};
    
    if (req.query.language) {
      filter.language = req.query.language;
    }
    
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }
    
    if (req.query.concept) {
      filter.conceptTags = { $in: [req.query.concept] };
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    let query = ChallengeModel.find(filter);
    
    if (limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }
    
    const challenges = await query.lean();
    
    // Get total count and pagination metadata only if pagination is requested
    if (limit) {
      const totalChallenges = await ChallengeModel.countDocuments(filter);
      const totalPages = Math.ceil(totalChallenges / limit);
      
      console.log(`Found ${challenges.length} challenges (page ${page}/${totalPages})`);
      
      res.json({ 
        challenges,
        pagination: {
          page,
          limit,
          totalChallenges,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } else {
      console.log(`Found ${challenges.length} challenges`);
      res.json({ challenges });
    }
  } catch (error) {
    console.error("Error fetching challenges:", error);
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

// Get the next challenge to solve
router.get("/next", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conceptTag, currentSlug, language } = req.query;
    const authReq = req as AuthRequest;
    const userId = authReq.user._id;

    console.log("Request params:", { conceptTag, currentSlug, language });

    if (!conceptTag || typeof conceptTag !== "string") {
      return res.status(400).json({ error: "Concept tag is required" });
    }

    if (!currentSlug || typeof currentSlug !== "string") {
      return res
        .status(400)
        .json({ error: "Current challenge slug is required" });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({ error: "Language is required" });
    }

    // Get user's completed challenges
    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const completedChallenges = user.completedChallenges || [];
    const completedSlugs = new Set(completedChallenges);

    // Get all concepts to determine order
    const concepts = await ConceptModel.find({
      $or: [{ language: "all" }, { language }],
    })
      .sort({ order: 1 })
      .lean();

    const conceptSlugs = concepts.map((concept) => concept.slug);

    // Find index of current concept
    const currentConceptIndex = conceptSlugs.indexOf(conceptTag);
    if (currentConceptIndex === -1) {
      return res.status(404).json({ error: "Concept not found" });
    }

    // Strategy:
    // 1. First try to find an uncompleted challenge in the current concept
    // 2. If all challenges in current concept are completed, move to the next concept
    // 3. If all concepts are completed, return a message indicating completion

    // Step 1: Get challenges for current concept and find uncompleted ones
    const currentConceptChallenges = await ChallengeModel.find({
      conceptTags: conceptTag,
      language,
    }).lean();

    // Find current challenge index
    const currentIndex = currentConceptChallenges.findIndex(
      (c) => c.slug === currentSlug
    );

    if (currentIndex === -1) {
      return res.status(404).json({ error: "Current challenge not found" });
    }

    // Look for uncompleted challenges in the current concept, starting after the current one
    for (let i = currentIndex + 1; i < currentConceptChallenges.length; i++) {
      const challenge = currentConceptChallenges[i];
      if (!completedSlugs.has(challenge.slug)) {
        return res.json({
          challenge,
          status: "next_in_concept",
          conceptTag,
        });
      }
    }

    // If we reached here, we need to look for the next concept with challenges
    for (let i = currentConceptIndex + 1; i < conceptSlugs.length; i++) {
      const nextConceptTag = conceptSlugs[i];
      const nextConcept = concepts[i];

      // Check if this concept should be unlocked based on dependencies
      if (nextConcept.dependencies && nextConcept.dependencies.length > 0) {
        const depsMet = nextConcept.dependencies.every((dep) => {
          // Check if user has completed challenges for this dependency concept
          return completedChallenges.some((slug) => {
            const challenge = currentConceptChallenges.find(
              (c) =>
                c.slug === slug &&
                c.conceptTags?.includes(dep)
            );
            return !!challenge;
          });
        });

        if (!depsMet) {
          continue; // Skip this concept as dependencies are not met
        }
      }

      // Get challenges for this next concept
      const nextConceptChallenges = await ChallengeModel.find({
        conceptTags: nextConceptTag,
        language,
      }).lean();

      if (nextConceptChallenges.length === 0) {
        continue; // No challenges in this concept, try the next one
      }

      // Find first uncompleted challenge in this concept
      const nextChallenge = nextConceptChallenges.find(
        (challenge) => !completedSlugs.has(challenge.slug)
      );

      if (nextChallenge) {
        return res.json({
          challenge: nextChallenge,
          status: "next_concept",
          conceptTag: nextConceptTag,
          previousConcept: conceptTag,
        });
      }
    }

    // If we get here, all challenges in all concepts are completed
    return res.json({
      status: "all_completed",
      message: "Congratulations! You've completed all challenges.",
      language,
    });
  } catch (error) {
    console.error("Error getting next challenge:", error);
    res.status(500).json({
      error: "Failed to get next challenge",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get single challenge by slug or ID (for backwards compatibility)
router.get("/:identifier", async (req, res) => {
  try {
    
    // Try to find by slug first, then by ID for backwards compatibility
    let challenge = await ChallengeModel.findOne({ slug: req.params.identifier });
    
    if (!challenge) {
      // If not found by slug, try by ObjectId for backwards compatibility
      try {
        challenge = await ChallengeModel.findById(req.params.identifier);
      } catch (error) {
        // If it's not a valid ObjectId, ignore the error
      }
    }

    if (!challenge) {
      console.log("Challenge not found"); // Debug log
      return res.status(404).json({ error: "Challenge not found" });
    }

    // If the challenge has conceptTags, fetch related resources
    let conceptResources: {
      title: string;
      url: string;
      type: string;
    }[] = [];
    if (challenge.conceptTags && challenge.conceptTags.length > 0) {
      // Get primary concept tag (usually the first one)
      const primaryConceptTag = challenge.conceptTags[0];

      // Fetch concept details for this tag
      const concept = await ConceptModel.findOne({ slug: primaryConceptTag });

      if (concept && concept.resources) {
        conceptResources = concept.resources;
      }
    }

    // Check for user progress if authenticated
    let userProgress: { completed: boolean } | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        const user = await UserModel.findById(decoded.userId);
        if (user) {
          userProgress = {
            completed: user.completedChallenges.includes(challenge.slug)
          };
        }
      } catch (error) {
        // If token is invalid, just don't include user progress
      }
    }

    // Convert to plain object and remove internal fields
    const challengeObj = challenge.toObject();
    delete challengeObj.__v;
    
    // Add computed functionSignature field
    const parameterTypesStr = challengeObj.parameterTypes?.join(', ') || '';
    const functionSignature = `${challengeObj.functionName}(${parameterTypesStr}): ${challengeObj.returnType}`;
    
    const responseData: any = {
      ...challengeObj,
      functionSignature,
      conceptResources,
    };
    
    if (userProgress) {
      responseData.userProgress = userProgress;
    }

    res.json({
      challenge: responseData
    });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    res.status(500).json({ error: "Failed to fetch challenge" });
  }
});

// Get related challenges for a specific challenge
router.get("/:slug/related", async (req, res) => {
  try {
    const { slug } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    
    console.log(`Fetching related challenges for: ${slug}, limit: ${limit}`);
    
    // First, find the current challenge to get its concept tags and language
    const currentChallenge = await ChallengeModel.findOne({ slug });
    
    if (!currentChallenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    
    // Build query to find related challenges
    const query: any = {
      slug: { $ne: slug }, // Exclude the current challenge
      $or: []
    };
    
    // Add language match (highest priority)
    if (currentChallenge.language) {
      query.$or.push({ language: currentChallenge.language });
    }
    
    // Add concept tags match
    if (currentChallenge.conceptTags && currentChallenge.conceptTags.length > 0) {
      query.$or.push({ 
        conceptTags: { $in: currentChallenge.conceptTags }
      });
    }
    
    // If no OR conditions, fall back to same difficulty
    if (query.$or.length === 0) {
      query.difficulty = currentChallenge.difficulty;
      delete query.$or;
    }
    
    const relatedChallenges = await ChallengeModel.find(query)
      .limit(limit)
      .select('-testCases -template') // Remove sensitive information
      .lean();
    
    console.log(`Found ${relatedChallenges.length} related challenges`);
    res.json({ challenges: relatedChallenges });
  } catch (error) {
    console.error("Error fetching related challenges:", error);
    res.status(500).json({ error: "Failed to fetch related challenges" });
  }
});

// Create new challenge
router.post("/", async (req, res) => {
  try {
    console.log(
      "Received challenge creation request with body:",
      JSON.stringify(req.body, null, 2)
    );

    // Validate request body
    const challengeData = CreateChallengeSchema.parse(req.body);
    console.log("Validation passed, creating challenge...");

    // Create new challenge document
    const challenge = new ChallengeModel(challengeData);
    console.log("Challenge model created:", challenge);

    // Save to database
    const savedChallenge = await challenge.save();
    console.log("Challenge saved successfully:", savedChallenge._id);

    res.status(201).json({
      message: "Challenge created",
      challengeId: savedChallenge._id,
      challenge: savedChallenge,
    });
  } catch (error) {
    console.error("Error creating challenge:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: "Failed to create challenge",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

export default router;
