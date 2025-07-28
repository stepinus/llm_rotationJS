### Build / Test / Lint Commands

*   There is no explicit build step for this project. The `llm_rotation.js` file is a standalone JavaScript module.
*   **Lint**: Use ESLint with a recommended configuration for JavaScript.
    *   To lint all files: `npx eslint .`
*   **Test**: Use Jest for running tests.
    *   To run all tests: `npx jest`
    *   To run a single test file: `npx jest <path/to/your/test-file.js>`

### Code Style Guidelines

*   **Imports**: Use `await import()` for dynamic module loading. Group import statements at the top of the file.
*   **Formatting**:
    *   Indent with 4 spaces.
    *   Place opening curly braces on the same line as the statement (`if (condition) {`).
    *   Use semicolons at the end of statements.
    *   Maintain consistent spacing around operators and function arguments.
*   **Types**: Use JSDoc for type annotations and documentation of functions, parameters, and return values.
*   **Naming Conventions**:
    *   Classes: `PascalCase` (e.g., `LlmManager`).
    *   Functions/Methods: `camelCase` (e.g., `generateResponse`).
    *   Private Methods: Prefix with an underscore (e.g., `_callGemini`).
    *   Variables: `camelCase`.
    *   Constants: `camelCase` when defined within a scope; `UPPER_SNAKE_CASE` for global, immutable constants if introduced.
*   **Error Handling**: Implement robust error handling using `try...catch` blocks for asynchronous operations and external API calls. Throw `Error` objects with clear, concise messages.
*   **Comments**: Use JSDoc for comprehensive documentation of classes, methods, and important logic. Add inline comments when necessary to explain complex or non-obvious code sections.
