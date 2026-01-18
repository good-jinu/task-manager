# Task Manager

A task manager AI agent that integrates with platforms like Notion to help you manage your tasks efficiently.

## Setup

This project uses [mise](https://mise.jdx.dev/) for tool management. Getting started is simple:

```bash
mise install
```

This will automatically:
- Install Node.js 24 and pnpm 10
- Install all project dependencies
- Set up git pre-commit hooks

## Development

Start the development server:

```bash
mise run dev
# or
pnpm dev-dev
```

This runs the SST development environment where you can test your changes locally.

## Deployment

Deploy to production:

```bash
mise run deploy
# or
pnpm prod-deploy
```

Remove production deployment:

```bash
mise run remove
# or
pnpm prod-remove
```

## Code Quality

Check code formatting and linting:

```bash
pnpm check
```

Auto-fix issues:

```bash
pnpm check:fix
```

## Project Structure

This is a monorepo with packages in the `packages/` directory:

### Core Packages

- **`packages/core`** - AI agent and business logic
  - AI SDK integration (OpenAI, DeepInfra)
  - Task manager agent with tool execution
  - Task operations (create, update, search)
  - No external dependencies on other packages

- **`packages/db`** - Database layer and services
  - DynamoDB operations (tasks, users, workspaces)
  - Service layer (TaskService, UserService, WorkspaceService)
  - Integration services (TaskIntegrationService, WorkspaceIntegrationService)
  - Notion adapter for task sync
  - Depends on: `@task-manager/notion`

- **`packages/notion`** - Notion API integration
  - Notion client wrapper with OAuth support
  - Task manager for Notion operations
  - Markdown to Notion blocks converter
  - Database and page management
  - Depends on: `@notionhq/client`

- **`packages/queue`** - SQS queue management
  - Message queue operations for async tasks
  - Agent execution queue handling
  - Depends on: `@task-manager/db`

### Application Packages

- **`packages/web`** - SvelteKit web application
  - User interface and API routes
  - Authentication (Auth.js)
  - Task management UI
  - Notion integration UI
  - Depends on: `@task-manager/core`, `@task-manager/db`, `@task-manager/notion`, `@task-manager/queue`

- **`packages/workers`** - Lambda workers
  - Background task processor
  - Agent execution handler
  - Notion sync on agent actions
  - Depends on: `@task-manager/core`, `@task-manager/db`, `@task-manager/queue`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         packages/web                         │
│                    (SvelteKit Frontend + API)                │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────┬──────────────┬──────────────┐
             │             │              │              │
             ▼             ▼              ▼              ▼
    ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐
    │   core     │  │     db     │  │  notion  │  │  queue   │
    │ (AI Agent) │  │ (Services) │  │(Notion API)│ │  (SQS)   │
    └────────────┘  └──────┬─────┘  └──────────┘  └────┬─────┘
                           │                            │
                           └────────────┬───────────────┘
                                        │
                                        ▼
                              ┌────────────────┐
                              │    workers     │
                              │   (Lambda)     │
                              └────────────────┘
                                        │
                                        │ uses
                                        ▼
                              ┌─────────────────────┐
                              │ core + db + queue   │
                              └─────────────────────┘
```

**Data Flow:**
1. **User Action** → Web UI sends request to API route
2. **API Route** → Calls services in `db` package
3. **Service Layer** → Performs database operations
4. **Agent Execution** → Queues message via `queue` package
5. **Worker** → Processes queue message, executes agent from `core`
6. **Notion Sync** → Worker syncs results to Notion via `notion` package

**Key Features:**
- **Async Agent Execution**: Long-running AI operations run in Lambda workers
- **Notion Integration**: Bidirectional sync between tasks and Notion pages
- **Markdown Support**: Rich markdown parsing with nested lists and inline formatting
- **OAuth Authentication**: Secure Notion integration per workspace

## Environment

Copy `.env.example` to `.env` and configure your environment variables as needed.