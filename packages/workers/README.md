# @task-manager/workers

Lambda worker functions for asynchronous task processing.

## Overview

This package contains AWS Lambda handlers that process background jobs, primarily for task execution via SQS queues.

## Workers

### Task Processor (`task-processor.ts`)

Processes task execution messages from the SQS queue. This worker:
- Receives task execution requests from the queue
- Executes the TaskManagerAgent with the provided context
- Records execution steps and results to DynamoDB
- Handles errors and triggers SQS retries on failure

**Handler:** `packages/workers/src/task-processor.handler`

**Configuration:**
- Timeout: 15 minutes
- Memory: 1024 MB
- Trigger: SQS Queue messages

## Dependencies

- `@task-manager/core` - Task management agent logic
- `@task-manager/db` - Database services
- `@task-manager/queue` - Queue message types
- `@types/aws-lambda` - Lambda type definitions
