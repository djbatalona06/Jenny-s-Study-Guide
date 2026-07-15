```markdown
# Jenny-s-Study-Guide Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the Jenny-s-Study-Guide JavaScript repository. It covers file and code organization, import/export styles, commit message habits, and testing patterns. By following these guidelines, contributors can maintain consistency and clarity throughout the codebase.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `studyHelper.js`, `quizManager.js`

### Imports
- Use **relative imports** for modules within the project.
  - Example:
    ```javascript
    import { getFlashcards } from './flashcardUtils';
    ```

### Exports
- Use **named exports** for functions, constants, and objects.
  - Example:
    ```javascript
    // In flashcardUtils.js
    export function getFlashcards() { ... }
    export const FLASHCARD_LIMIT = 20;
    ```

### Commit Messages
- Commit messages are **freeform** (no enforced prefix).
- Average message length: ~57 characters.
- Example:
  ```
  Add new function for generating quiz questions
  ```

## Workflows

### General Development
**Trigger:** When adding or modifying features or bug fixes  
**Command:** `/dev`

1. Create or update files using camelCase naming.
2. Use relative imports and named exports.
3. Write clear, concise commit messages describing your changes.
4. If applicable, add or update corresponding test files (`*.test.js`).
5. Push your changes and open a pull request.

### Testing
**Trigger:** When verifying code correctness  
**Command:** `/test`

1. Identify or create test files matching the pattern `*.test.js`.
2. Write tests for new or changed functionality.
3. Run tests using your preferred JavaScript test runner (framework not specified).
4. Ensure all tests pass before merging changes.

## Testing Patterns

- Test files follow the pattern: `*.test.js`
- The specific testing framework is **unknown**; use standard JavaScript testing practices.
- Example test file:
  ```javascript
  // flashcardUtils.test.js
  import { getFlashcards } from './flashcardUtils';

  test('getFlashcards returns correct number of cards', () => {
    const cards = getFlashcards();
    expect(cards.length).toBe(20);
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /dev    | Start general development workflow (feature/bugfix) |
| /test   | Run or write tests for the codebase                |
```
