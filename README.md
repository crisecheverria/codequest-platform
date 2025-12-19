# Code Challenge Platform

A platform for creating and solving coding challenges, built with TypeScript, React, and Node.js. Feel free to contribute and help us grow the collection of challenges and concepts!

## Features

- 🚀 Interactive coding environment
- ✅ Automated test execution
- 🔒 Secure code execution in Docker containers
- 📊 Progress tracking
- 🏆 Achievement system
- 🤖 In-Editor AI Assistant with progressive help
- 🔐 GitHub OAuth authentication

## Supported Programming Languages

Currently supported:

- **TypeScript/JavaScript**
- **PHP**
- **Go**

Coming soon:

- **Python** - Challenges in development

## Screenshots

### Challenge Interface

![CodeQuest Challenge Interface](assets/codequest-challenge.png)
_Interactive coding environment with real-time testing and AI assistance_

### User Dashboard

![CodeQuest Dashboard](assets/codequest-dashboard.png)
_Progress tracking dashboard with achievements and statistics_

## Coquest CLI

If you want to solve challenges from the command line, you can use the [Coquest CLI](https://github.com/crisecheverria/codequest). It allows you to interact with almost the same list of challenges directly from your terminal. And you can use your own code editor to solve them.

## Getting Started

### Quick Start Summary

1. **Clone** → `git clone https://github.com/crisecheverria/codequest-platform.git`
2. **Install** → `npm install`
3. **Start MongoDB** → `docker run --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password -d mongo`
4. **Copy env files** → `cp packages/backend/.env.example packages/backend/.env` & `cp packages/frontend/.env.example packages/frontend/.env`
5. **Setup GitHub OAuth** → Create OAuth app, update env files with real credentials
6. **Seed database** → `cd packages/backend && npx ts-node src/scripts/seedChallenges.ts && npx ts-node src/scripts/seedConcepts.ts`
7. **Start** → `npm run dev`
8. **Visit** → `http://localhost:5173`

### Prerequisites

- Node.js 18+
- Docker
- Go (optional - only required if using native Go execution mode)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/crisecheverria/codequest-platform.git
cd codequest-platform
```

2. Install dependencies:

```bash
npm install
```

3. Set up MongoDB with Docker:

```bash
# Pull the MongoDB image
docker pull mongo

# Run MongoDB container with authentication enabled
docker run --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -d mongo
```

The MongoDB container is now ready to use with the admin user. The .env.example files are already configured to work with this setup using `admin:password` credentials.

4. Update Your Environment Variables

```bash
# Copy examples to .env files
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# Update the environment variables as needed
```

5. Configure GitHub OAuth

To enable user authentication, you'll need to set up GitHub OAuth:

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:
   - **Application name**: `CodeQuest Platform` (or your preferred name)
   - **Homepage URL**: `http://localhost:5173`
   - **Application description**: `Local development for CodeQuest Platform` (optional)
   - **Authorization callback URL**: `http://localhost:3001/api/auth/github/callback`
4. Click **"Register application"**
5. Copy the **Client ID** from the app page
6. Click **"Generate a new client secret"** and copy the **Client Secret**
7. Update your environment files with the real values:

**Backend (`packages/backend/.env`)**:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=Ov23liXXXXXXXXXXXXX  # Replace with your actual Client ID
GITHUB_CLIENT_SECRET=your-actual-client-secret  # Replace with your actual Client Secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# MongoDB Configuration (should already be set)
MONGODB_URI=mongodb://admin:password@localhost:27017/code-challenges?authSource=admin
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

**Frontend (`packages/frontend/.env`)**:

```bash
# GitHub OAuth Configuration
VITE_GITHUB_CLIENT_ID=Ov23liXXXXXXXXXXXXX  # Same as backend Client ID
VITE_GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback

# API Configuration
VITE_API_URL=http://localhost:3001
```

> ⚠️ **Important**: Replace the example values with your actual GitHub OAuth credentials!

6. Seed the Database

Before starting the application, you'll need to populate the database with challenges and concepts:

```bash
# Navigate to the backend package
cd packages/backend

# Seed challenges
npx ts-node src/scripts/seedChallenges.ts

# Seed concepts
npx ts-node src/scripts/seedConcepts.ts
```

7. Start the Development Environment

```bash
# From the project root
npm run dev
```

This will start both the frontend and backend services:

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`

You should now be able to:

1. Visit `http://localhost:5173`
2. Click "Continue with GitHub" to log in
3. Start solving coding challenges!

## Database Management

### Re-seeding Data

If you need to update or re-seed the database:

```bash
cd packages/backend

# Re-seed challenges (updates existing, adds new)
npx ts-node src/scripts/seedChallenges.ts

# Re-seed concepts
npx ts-node src/scripts/seedConcepts.ts
```

### Reset User Progress

You can reset user progress if needed:

```bash
cd packages/backend
# Reset all users (with confirmation)
npx ts-node src/scripts/resetUserProgress.ts

# Reset specific user
npx ts-node src/scripts/resetUserProgress.ts --userId=user_id_here

# Skip confirmation
npx ts-node src/scripts/resetUserProgress.ts --yes

# Completely remove progress data instead of resetting
npx ts-node src/scripts/resetUserProgress.ts --remove
```

## Viewing the Database with MongoDB Compass

You can use MongoDB Compass (a GUI for MongoDB) to visualize and interact with your database:

1. Download and install [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Open MongoDB Compass
3. Connect to your local MongoDB instance with the connection string:

```
mongodb://admin:password@localhost:27017/code-challenges?authSource=admin
```

## AI Assistant

The platform includes an AI assistant that provides progressive help to users while they work on coding challenges. The assistant offers five levels of assistance:

1. **Hint**: A gentle nudge in the right direction
2. **Concept**: Explanation of relevant programming concepts
3. **Approach**: Step-by-step approach to solve the problem
4. **Pseudocode**: Solution outline in pseudocode
5. **Code Snippet**: Partial code implementation

### Setting up the AI Assistant

The AI assistant has two modes:

- Local mode: Uses rule-based suggestions (no API key required)
- External API mode: Uses an external AI service for more tailored assistance

To enable the external API:

1. Add the following variables to your `packages/backend/.env`:

```
AI_API_KEY=your_api_key
AI_API_ENDPOINT=https://api.openai.com/v1/chat/completions
USE_EXTERNAL_AI_API=true
```

2. Restart the backend server

## Code Execution Modes

The platform supports multiple code execution modes:

### Docker Execution (Default)

All languages (TypeScript, Go, PHP) are executed in secure Docker containers. This is the recommended mode for production.

### Native Go Execution (Optional)

For development environments, you can enable native Go execution for faster compile times:

1. Ensure Go is installed locally (`go version` should work)
2. Add to your `packages/backend/.env`:

```
USE_NATIVE_GO_EXECUTOR=true
NATIVE_GO_TIMEOUT=45000
```

3. Restart the backend server

**Note**: Native execution is only available for Go challenges and requires Go to be installed on the host system.

4. Once connected, you can browse collections like `challenges`, `concepts`, `users`, and more

## Project Structure

- `packages/frontend`: React application
- `packages/backend`: Node.js API and code execution service
- `data/`: JSON files for challenges and concepts

## Features in Detail

### Interactive Coding Environment

- Real-time code editing with syntax highlighting
- Test execution against predefined test cases
- In-editor AI assistance with progressive levels of help

### Achievement System

- Earn badges by completing all challenges in a concept category
- Track progress with visual indicators
- Unlock new skill trees as you progress

### AI Assistant

The AI Assistant helps users solve challenges without giving away the full solution:

- **Context-aware**: Analyzes the current code and challenge
- **Progressive help**: Provides increasingly detailed assistance
- **Code integration**: Can insert code snippets directly into the editor
- **Educational**: Explains concepts and approaches, not just solutions

## Troubleshooting

### Common Setup Issues

#### MongoDB Authentication Error

If you see `Command find requires authentication`:

1. **Check your backend `.env` file** has the correct MongoDB URI:

   ```bash
   MONGODB_URI=mongodb://admin:password@localhost:27017/code-challenges?authSource=admin
   ```

2. **Restart your development server** after updating environment variables:
   ```bash
   npm run dev
   ```

#### GitHub OAuth "404 Not Found" Error

If GitHub OAuth fails with a 404 error:

1. **Verify your GitHub OAuth App settings**:

   - Homepage URL: `http://localhost:5173`
   - Callback URL: `http://localhost:3001/api/auth/github/callback`

2. **Check your environment variables** have real values (not placeholders):

   ```bash
   # Backend .env should have real values like:
   GITHUB_CLIENT_ID=Ov23li...  # Not "your-client-id"
   GITHUB_CLIENT_SECRET=ghp_...  # Not "your-client-secret"
   ```

3. **Restart the development server** after updating OAuth credentials

#### Frontend "No routes matched" Error

If you see routing errors during OAuth:

- This was a known issue that has been fixed in the current version
- Make sure you're using the latest code

#### Can't See User Profile Image

The avatar should appear after logging in. If not:

- The backend now automatically fetches user profile data including avatar
- Check browser localStorage for user data: `localStorage.getItem('user')`

### Docker Issues

If you encounter issues with MongoDB:

```bash
# Check if the MongoDB container is running
docker ps

# See container logs for errors
docker logs mongodb

# Restart the container if needed
docker restart mongodb

# If container doesn't exist, recreate it:
docker run --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -d mongo
```

### AI Assistant Issues

If the AI assistant is not working correctly:

1. Check if you're using the right environment variables for external API mode
2. Ensure your API key is valid
3. Check the backend logs for any error messages
4. If using local mode, the assistance will be rule-based and less tailored

## Data-Driven Seeding for Code Challenge Platform

This repository uses a data-driven approach for seeding challenges and concepts. This makes it easier for contributors to add or modify content without touching the seed scripts.

### Directory Structure

```
code-challenge-platform/
├── data/
│   ├── challenges.json
│   └── concepts.json
├── packages/
│   ├── backend/
│   │   └── src/
│   │       └── scripts/
│   │           ├── seedChallenges.ts
│   │           └── seedConcepts.ts
│   └── frontend/
└── package.json
```

### How It Works

1. Challenge and concept data is stored in separate JSON files in the `data/` directory.
2. The seed scripts read from these JSON files instead of having hardcoded data.

### Contributing New Challenges or Concepts

To add new challenges or concepts:

1. Edit the appropriate JSON file in the `data/` directory.
2. Run the seed script to update the database.

#### Adding a New Challenge

Add a new entry to `data/challenges.json` following the existing format:

```json
{
  "title": "Your Challenge Title",
  "description": "Challenge description...",
  "difficulty": "easy|medium|hard",
  "language": "typescript",
  "functionName": "yourFunctionName",
  "parameterTypes": ["param1Type", "param2Type"],
  "returnType": "returnType",
  "template": "function yourFunctionName(...) {\n  // Write your code here\n}",
  "testCases": [
    {
      "input": [input1, input2],
      "expected": expectedOutput,
      "description": "test case description"
    }
  ],
  "conceptTags": ["tag1", "tag2"],
  "timeLimit": 5000,
  "memoryLimit": 128
}
```

#### Adding a New Concept

Add a new entry to `data/concepts.json` following the existing format:

```json
{
  "name": "Concept Name",
  "slug": "concept-slug",
  "description": "Concept description...",
  "category": "fundamentals|intermediate|advanced",
  "language": "all|typescript|javascript",
  "order": 21,
  "dependencies": ["dependency1", "dependency2"],
  "resources": [
    {
      "title": "Resource Title",
      "url": "https://resource-url.com",
      "type": "documentation|tutorial|video"
    }
  ]
}
```

### Benefits of the Data-Driven Approach

- **Separation of Concerns**: Data is separate from logic
- **Easy Collaboration**: Contributors can focus on content without touching code
- **Versioning**: JSON files can be version-controlled separately
- **Flexibility**: Easy to extend or modify data structure without changing scripts
- **Maintainability**: Centralized data management makes updates simpler

## Contributing

We welcome contributions to the Code Challenge Platform! Here's how you can help:

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/code-challenge-platform.git`
3. Install dependencies: `npm install`
4. Set up your development environment following the [Getting Started](#getting-started) section

### Development Workflow

1. Create a new branch for your feature: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test your changes: `npm run test`
4. Lint your code: `npm run lint`
5. Commit your changes: `git commit -m "Add your feature"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Create a Pull Request

### Types of Contributions

#### Adding New Challenges

- Edit `data/challenges.json` to add new coding challenges
- Follow the existing format and include comprehensive test cases
- Run `npx ts-node src/scripts/seedChallenges.ts` to test your changes

#### Adding New Concepts

- Edit `data/concepts.json` to add new learning concepts
- Ensure proper categorization and dependencies
- Run `npx ts-node src/scripts/seedConcepts.ts` to test your changes

#### Code Improvements

- Bug fixes and performance improvements
- New features and enhancements
- UI/UX improvements
- Documentation updates

#### Testing

- Write tests for new features
- Improve existing test coverage
- Report bugs and issues

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Write clear, descriptive commit messages
- Include tests for new functionality
- Update documentation as needed

### Pull Request Guidelines

- Provide a clear description of your changes
- Reference any related issues
- Ensure all tests pass
- Keep changes focused and atomic
- Be responsive to feedback and requests for changes

### Reporting Issues

If you find a bug or have a feature request:

1. Check existing issues first
2. Create a detailed issue with:
   - Clear description of the problem
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Questions?

Feel free to open an issue for questions about contributing or reach out through GitHub discussions.
