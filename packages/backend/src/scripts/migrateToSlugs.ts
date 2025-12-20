import { connectDB } from "../db";
import { UserModel } from "../models/User";
import { ChallengeModel } from "../models/Challenge";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const migrateUserDataToSlugs = async () => {
  try {
    
    // Connect to database
    await connectDB();
    console.log("Connected to database");

    // Get all users with submissions
    const users = await UserModel.find({
      $or: [
        { "submissions.challengeId": { $exists: true } },
        { completedChallenges: { $type: "objectId" } }
      ]
    });

    console.log(`Found ${users.length} users that need migration`);

    let migratedUsers = 0;
    let errorUsers = 0;

    for (const user of users) {
      try {
        console.log(`Migrating user: ${user.username} (${user._id})`);
        
        let hasChanges = false;

        // Migrate submissions
        if (user.submissions && user.submissions.length > 0) {
          const migratedSubmissions = [];
          
          for (const submission of user.submissions) {
            const oldSubmission = submission as any;
            
            if (oldSubmission.challengeId && !oldSubmission.challengeSlug) {
              // Find the challenge by ObjectId to get its slug
              const challenge = await ChallengeModel.findById(oldSubmission.challengeId);
              
              if (challenge && challenge.slug) {
                migratedSubmissions.push({
                  challengeSlug: challenge.slug,
                  timestamp: submission.timestamp,
                  status: submission.status,
                  language: submission.language,
                  code: submission.code,
                  results: submission.results
                });
                hasChanges = true;
                console.log(`  - Migrated submission: ${challenge.title} -> ${challenge.slug}`);
              } else {
                console.log(`  - Warning: Could not find challenge for ID ${oldSubmission.challengeId}, skipping submission`);
              }
            } else if (oldSubmission.challengeSlug) {
              // Already migrated, keep as is
              migratedSubmissions.push({
                challengeSlug: oldSubmission.challengeSlug,
                timestamp: submission.timestamp,
                status: submission.status,
                language: submission.language,
                code: submission.code,
                results: submission.results
              });
            }
          }
          
          if (hasChanges) {
            user.submissions = migratedSubmissions;
          }
        }

        // Migrate completedChallenges
        if (user.completedChallenges && user.completedChallenges.length > 0) {
          const migratedCompleted = [];
          
          for (const challengeId of user.completedChallenges) {
            if (typeof challengeId === 'string') {
              // Already a slug, keep as is
              migratedCompleted.push(challengeId);
            } else {
              // ObjectId, need to convert to slug
              const challenge = await ChallengeModel.findById(challengeId);
              if (challenge && challenge.slug) {
                migratedCompleted.push(challenge.slug);
                hasChanges = true;
                console.log(`  - Migrated completed challenge: ${challenge.title} -> ${challenge.slug}`);
              } else {
                console.log(`  - Warning: Could not find challenge for ID ${challengeId}, skipping`);
              }
            }
          }
          
          if (hasChanges) {
            user.completedChallenges = migratedCompleted;
          }
        }

        // Save the user if there were changes
        if (hasChanges) {
          await user.save();
          migratedUsers++;
          console.log(`  ✓ User ${user.username} migrated successfully`);
        } else {
          console.log(`  - User ${user.username} already up to date`);
        }

      } catch (error) {
        console.error(`Error migrating user ${user.username}:`, error);
        errorUsers++;
      }
    }

    console.log(`
Migration completed:
- Users migrated: ${migratedUsers}
- Users with errors: ${errorUsers}
- Total users processed: ${users.length}
    `);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  migrateUserDataToSlugs();
}

export { migrateUserDataToSlugs };