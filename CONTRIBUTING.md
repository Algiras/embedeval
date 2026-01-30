# Contributing to EmbedEval

Thank you for your interest in contributing to EmbedEval! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Algiras/embedeval.git
   cd embedeval
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start Redis (required for testing)**
   ```bash
   ./docker/redis.sh start
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

### Making Changes

1. Create a new branch for your feature or fix
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and ensure they follow the coding standards

3. Run linting and type checking
   ```bash
   npm run lint
   npm run typecheck
   ```

4. Build and test
   ```bash
   npm run build
   npm test
   ```

5. Test CLI locally (if applicable)
   ```bash
   npm run dev -- <command> [options]
   ```

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Write unit tests for new features

### Commit Messages

Use conventional commit format:
- `feat: add new chunking strategy`
- `fix: resolve BM25 scoring issue`
- `docs: update README with examples`
- `test: add integration tests`

## Testing

### Unit Tests

Place tests in `tests/` directory with `.test.ts` extension:

```typescript
// tests/my-feature.test.ts
describe('My Feature', () => {
  test('should do something', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### Integration Tests

For CLI integration tests, use the local test script:

```bash
npm run test:local
```

This requires:
- Ollama running locally
- Redis running locally

## Adding New Features

### Adding a New Provider

1. Create provider in `src/providers/my-provider.ts`
2. Implement `EmbeddingProvider` interface
3. Add to `src/providers/index.ts`
4. Update CLI commands
5. Add tests

### Adding a New Strategy

1. Create strategy stage in `src/strategies/<category>/my-strategy.ts`
2. Implement `StrategyStage` interface
3. Register in `src/strategies/registry.ts`
4. Add to `PREDEFINED_STRATEGIES` if applicable
5. Add tests

### Adding a New CLI Command

1. Create command in `src/cli/commands/my-command.ts`
2. Register in `src/cli/index.ts`
3. Add documentation
4. Add tests

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add entry to CHANGELOG.md
4. Submit PR with clear description
5. Wait for CI checks to pass
6. Address review comments

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing documentation first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
