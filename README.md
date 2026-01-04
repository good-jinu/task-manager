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
- `packages/web` - Web interface
- `packages/core` - Core business logic
- `packages/db` - Database layer
- `packages/notion` - Notion integration

## Environment

Copy `.env.example` to `.env` and configure your environment variables as needed.