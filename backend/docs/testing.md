# Testing

We use **Jest** for unit tests and **Supertest** for HTTP API tests.

---

[[toc]]

## Unit Testing

Unit tests check service logic in isolation, usually with mocked repositories.
Run all unit tests or a focused file:

```bash
pnpm test
pnpm test src/api/task/task.service.spec.ts
```

## HTTP API Testing

Tests in `test/` send HTTP requests through every current NestJS API route and
the global request-validation pipe. They check successful routing/status,
service dispatch, invalid DTOs and UUIDs, and missing authentication. Services
and workspace permission checks are mocked so these tests do not need
PostgreSQL or Redis; service-level tests cover business rules and permissions.

```bash
pnpm test:e2e
```

The example in `test/app.e2e-spec.ts` covers the public home route, login DTO
validation, and dispatching valid login input to the service. Add tests for
important API flows and expected failures, such as invalid input, missing
authentication, or insufficient permission.

Tests using real repositories or the full `AppModule` are database integration
tests. Point them at a dedicated test database, apply migrations before running,
and clean up test data. Do not run destructive test setup against the database
configured in `.env`.

## Watch Mode and Coverage

```bash
pnpm test:watch -- src/api/task/task.service.spec.ts
pnpm test:cov
```

## Testing in Visual Studio Code

Install the [Jest Runner](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner)
extension to run tests directly from a test file.
