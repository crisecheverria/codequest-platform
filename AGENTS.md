# Codequest Platform - Agent Guidelines

## Build/Test Commands

- **All**: `npm run build` | `npm run test` | `npm run lint` | `npm run dev`
- **Backend**: `npm run build:backend` | `npm run test -w packages/backend` | `npm run dev:backend`
- **Frontend**: `npm run build:frontend` | `npm run test -w packages/frontend` | `npm run dev:frontend`
- **Single tests**: `npm run test:unit -w packages/backend` | `npm run test:integration -w packages/frontend`
- **Test with coverage**: `npm run test:coverage -w packages/backend` | `npm run test:coverage -w packages/frontend`

## Code Style & Standards

- **TypeScript**: Strict mode enabled, use proper types (avoid `any` except in tests)
- **Imports**: Use ES6 imports, group by: external libs → internal modules → types
- **Naming**: camelCase for variables/functions, PascalCase for classes/components/interfaces
- **Error Handling**: Use try-catch blocks, return structured errors with status codes
- **Validation**: Use Zod schemas for API validation, define interfaces before implementation
- **Models**: Use Mongoose with TypeScript interfaces, include proper indexes and pre-hooks
- **Components**: Functional components with TypeScript props, use const assertions for mappings
- **File Structure**: Group related files, use index.ts for exports, separate types from implementation
- **Testing**: Separate unit/integration tests, use descriptive test names, mock external dependencies
- **Comments**: Document complex business logic, avoid obvious comments, use JSDoc for public APIs
- **Async**: Use async/await over promises, handle errors at appropriate levels

## Quality Assurance

**IMPORTANT**: Before submitting any solution, agents MUST run the following commands to ensure code quality:

```bash
npm run build
npm run lint
```

If either command fails:

1. Fix all build errors and linting issues
2. Re-run the commands until they pass
3. Only then submit the solution as complete

This ensures all code meets project standards and prevents CI/CD failures.
