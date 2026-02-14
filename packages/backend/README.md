### Backend Test Suite and Coverage

This backend includes an expanded automated test suite with improved coverage compared to the previous baseline on `main`.

#### Current branch (chore/test-verification)
- Test suites: 11 passed / 11 total
- Tests: 131 total (129 passed, 2 skipped)
- Coverage (all files):
  - Statements: 40.66%
  - Branches: 30.40%
  - Functions: 36.96%
  - Lines: 40.85%

#### Baseline (main)
- Test suites: 5 passed / 5 total
- Tests: 85 total (83 passed, 2 skipped)
- Coverage (all files):
  - Statements: 23.73%
  - Branches: 20.64%
  - Functions: 18.95%
  - Lines: 23.89%

#### Net improvement
- +6 test suites
- +46 tests
- +16.93 pts statements
- +9.76 pts branches
- +18.01 pts functions
- +16.96 pts lines

Notes
- New tests exercise additional routes (`auth`, `dashboard`, `learning`, `health`) and unit layers (`db`, `middleware`, `services`).
- Coverage reports are generated via Jest (`npm test -- --coverage`).
