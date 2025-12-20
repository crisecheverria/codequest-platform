import express from "express";
import { TutorialModel } from "../models/Tutorial";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();

// Get all tutorials
router.get("/", async (req, res) => {
  try {
    // First, let's check what's in the database
    const allTutorials = await TutorialModel.find({}).lean();
    // eslint-disable-next-line no-console
    console.log("All tutorials in DB:", allTutorials.length, allTutorials.map(t => ({ id: t._id, title: t.title, language: t.language })));
    // Debug request information
    // eslint-disable-next-line no-console
    console.log("Request URL:", req.originalUrl);
    // eslint-disable-next-line no-console
    console.log("Request query raw:", req.query);
    
    // Cast query parameters to strings to ensure consistent behavior
    const category = req.query.category ? String(req.query.category) : undefined;
    const language = req.query.language ? String(req.query.language) : undefined;
    
    // eslint-disable-next-line no-console
    console.log("Query params:", { category, language });
    
    // Build a query that will work with our MongoDB schema
    const query: Record<string, string | { $in: string[] }> = {};
    
    // Handle category filter
    if (category) query.category = category;
    
    // Handle language filter with proper MongoDB operators
    if (language) {
      if (language === "all") {
        // Don't filter by language if "all" is selected
      } else {
        // Match either exact language or "all"
        query.language = { $in: [language, "all"] };
      }
    }
    
    // eslint-disable-next-line no-console
    console.log("MongoDB query:", query);
    
    const tutorials = await TutorialModel.find(query)
      .select("title slug description category language order timeToComplete mainImage author")
      .sort({ order: 1 });
    
    // eslint-disable-next-line no-console
    
    res.json(tutorials);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching tutorials:", error);
    res.status(500).json({ message: "Failed to fetch tutorials" });
  }
});

// Get tutorial by slug
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    
    const tutorial = await TutorialModel.findOne({ slug })
      .populate("relatedConcepts", "name slug description")
      .populate({
        path: "steps.challengeId",
        select: "title slug difficulty",
      });
      
    if (!tutorial) {
      return res.status(404).json({ message: "Tutorial not found" });
    }
    
    res.json(tutorial);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching tutorial:", error);
    res.status(500).json({ message: "Failed to fetch tutorial" });
  }
});

// Track tutorial progress
router.post("/:tutorialId/progress", authMiddleware, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const authReq = req as AuthRequest;
  try {
    // Future implementation: extract tutorialId, stepIndex, completed, and userId
    // const { tutorialId } = req.params;
    // const { stepIndex, completed } = req.body;
    // const userId = authReq.user._id;

    // Add logic to track user progress through tutorials
    // This would be connected to your existing user progress tracking system
    
    res.json({ message: "Progress updated successfully" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error updating progress:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

export default router;