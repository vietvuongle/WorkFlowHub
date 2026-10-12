# Project instructions

- Keep changes focused. Follow existing NestJS module, naming, import-alias, Prettier, and ESLint patterns.
- Put API domains under `src/api/<domain>` with entity, DTO, service, controller, module, and focused Jest tests as needed. Register new modules in `src/api/api.module.ts`.
- Domain entities must follow existing entities: extend `AbstractEntity`, accept `Partial<Entity>` in the constructor, use branded `Uuid`, explicit TypeORM decorators/index names, and `Relation<T>` for relations. Keep migrations consistent with inherited audit columns; static lookup entities may omit audit only when their schema does too.
- Use the shared field decorators for DTO validation and Swagger metadata. Keep request DTOs separate from response DTOs; do not expose secrets or password hashes.
- Protect private routes with the existing `AuthGuard`, `@ApiAuth`, and `@CurrentUser`. Scope every workspace/project/task query to the authenticated user's authorized membership; never trust owner or actor IDs from request bodies.
- For workspace-scoped routes, declare required codes with `@WorkspacePermissions(...)` and apply `WorkspacePermissionGuard`; keep role assignment from granting owner-only permissions to non-owners.
- NestJS dependency injection is module-scoped: every controller guard/provider must be resolvable in its owning module, and that module must import the module exporting each dependency or register the provider together with its required repositories. Do not assume a sibling or parent module makes providers available; verify every `@UseGuards(...)` dependency when adding or moving controllers.
- Avoid circular imports between modules and services. Put shared injection tokens/constants in a dependency-neutral file, never in a module that imports the service consuming that token.
- After changing module wiring, guards, providers, bootstrap, or infrastructure clients, validate runtime startup as well as compilation: start the app with its required local services, inspect startup logs for Nest DI/import errors, and request the public home and health routes (plus Swagger in development). Type-check/build success alone does not prove the app can bootstrap or accept HTTP requests.
- Use TypeORM repositories and transactions for persistence. Add a forward and rollback migration for every schema change; never rely on `synchronize` in production. The existing user table is `"user"` (singular), and legacy migrations use `uuid_generate_v4()`.
- Surface expected failures with NestJS HTTP exceptions; rethrow unexpected errors. Do not swallow errors or return fake success values.
- Whenever adding or changing an API, add/update Jest tests for every affected endpoint, including success, validation, authentication/authorization, and expected failure cases; add service tests for domain rules. Run the focused tests, `pnpm exec tsc --noEmit --pretty false`, and `pnpm build`.
- Use `pnpm`. When running TypeORM commands in Docker Compose, execute them inside the API container so Compose database settings are used.
- Reuse the configured PostgreSQL, Redis, and BullMQ services. Add Kafka, MinIO, or other infrastructure only when implementing a scoped requirement; do not introduce placeholder integrations.
- Do not edit generated files by hand. Keep documentation concise and update it when commands, APIs, or setup change.
