import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { UserModel } from "../models/User";
import { ChallengeModel } from "../models/Challenge";

const router = Router();

// Wrapper to handle type compatibility
const protectedRoute = (
  handler: (req: AuthRequest, res: Response) => Promise<void>,
) => {
  return async (req: Request, res: Response) => {
    // Apply auth middleware first
    await new Promise<void>((resolve, reject) => {
      authMiddleware(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Then call the handler with the properly typed request
    return handler(req as AuthRequest, res);
  };
};

// Get dashboard stats
router.get(
  "/stats",
  protectedRoute(async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;

      // Get total challenges count
      const totalChallenges = await ChallengeModel.countDocuments();

      // Get user's submissions stats
      const submissions = user.submissions || [];
      const passedSubmissions = submissions.filter(
        (s) => s.status === "passed",
      );

      // Calculate statistics
      const stats = {
        totalChallenges,
        completedChallenges: user.completedChallenges?.length || 0,
        totalSubmissions: submissions.length,
        successRate:
          submissions.length > 0
            ? (passedSubmissions.length / submissions.length) * 100
            : 0,
        submissionsByLanguage: submissions.reduce(
          (acc: { [key: string]: number }, sub) => {
            acc[sub.language] = (acc[sub.language] || 0) + 1;
            return acc;
          },
          {},
        ),
        recentSubmissions: await UserModel.findById(user._id)
          .select("submissions")
          .then(async (user) => {
            if (!user) return [];
            const recentSubmissions = user.submissions
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .slice(0, 5);
            
            // Manually populate challenge data using slugs
            const populatedSubmissions = await Promise.all(
              recentSubmissions.map(async (submission) => {
                const challenge = await ChallengeModel.findOne({ slug: submission.challengeSlug })
                  .select("title difficulty slug");
                return {
                  challengeSlug: submission.challengeSlug,
                  timestamp: submission.timestamp,
                  status: submission.status,
                  language: submission.language,
                  code: submission.code,
                  results: submission.results,
                  challenge: challenge
                };
              })
            );
            
            return populatedSubmissions;
          }),
      };

      console.log("Stats calculated:", stats);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  }),
);

// Get detailed submission history
router.get(
  "/submissions",
  protectedRoute(async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      const userWithSubmissions = await UserModel.findById(user._id).select("submissions");
      
      if (!userWithSubmissions) {
        res.json([]);
        return;
      }
      
      const submissions = userWithSubmissions.submissions
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Manually populate challenge data using slugs
      const populatedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const challenge = await ChallengeModel.findOne({ slug: submission.challengeSlug })
            .select("title difficulty language");
          return {
            ...submission,
            challenge: challenge
          };
        })
      );

      res.json(populatedSubmissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  }),
);

export default router;
