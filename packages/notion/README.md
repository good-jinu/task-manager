# @notion-task-manager/notion

A TypeScript package for managing tasks using the Notion API. This package provides a clean interface for creating, reading, updating, and deleting tasks in a Notion database.

## Features

- ✅ Full CRUD operations for tasks
- ✅ Type-safe TypeScript interfaces
- ✅ Flexible database configuration
- ✅ Built-in error handling
- ✅ Support for task filtering
- ✅ Utility functions for common operations

## Installation

```bash
pnpm install @notion-task-manager/notion
```

## Setup

### 1. Create a Notion Integration

1. Go to [Notion Developers](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Give it a name and select your workspace
4. Copy the "Internal Integration Token"

### 2. Create a Task Database

Create a new database in Notion with the following properties:

- **Name** (Title) - Required
- **Status** (Select) - Options: "To Do", "In Progress", "Done", "Cancelled"
- **Priority** (Select) - Options: "Low", "Medium", "High", "Urgent"
- **Due Date** (Date)
- **Assignee** (Text)
- **Tags** (Multi-select)

### 3. Share Database with Integration

1. Open your database in Notion
2. Click "Share" in the top right
3. Click "Invite" and select your integration

## Usage

### Basic Setup

```typescript
import { createTaskManager, createDatabaseConfig } from '@notion-task-manager/notion';

const taskManager = createTaskManager(
  process.env.NOTION_TOKEN!,
  createDatabaseConfig('your-database-id')
);
```

### Creating Tasks

```typescript
import { TaskStatus, TaskPriority } from '@notion-task-manager/notion';

const task = await taskManager.createTask({
  title: 'Complete project documentation',
  description: 'Write comprehensive docs for the new feature',
  status: TaskStatus.TODO,
  priority: TaskPriority.HIGH,
  dueDate: new Date('2024-01-15'),
  assignee: 'John Doe',
  tags: ['documentation', 'urgent']
});
```

### Getting Tasks

```typescript
// Get all tasks
const allTasks = await taskManager.getTasks();

// Get tasks with filters
const filteredTasks = await taskManager.getTasks({
  status: [TaskStatus.IN_PROGRESS],
  priority: [TaskPriority.HIGH, TaskPriority.URGENT]
});

// Get a specific task
const task = await taskManager.getTask('task-id');
```

### Updating Tasks

```typescript
const updatedTask = await taskManager.updateTask('task-id', {
  status: TaskStatus.DONE,
  priority: TaskPriority.LOW
});
```

### Deleting Tasks

```typescript
await taskManager.deleteTask('task-id');
```

### Custom Database Configuration

If your database uses different property names:

```typescript
import { createDatabaseConfig } from '@notion-task-manager/notion';

const customConfig = createDatabaseConfig('your-database-id', {
  titleProperty: 'Task Name',
  statusProperty: 'Current Status',
  priorityProperty: 'Task Priority',
  dueDateProperty: 'Deadline',
  assigneeProperty: 'Assigned To',
  tagsProperty: 'Labels'
});

const taskManager = createTaskManager(process.env.NOTION_TOKEN!, customConfig);
```

## API Reference

### Types

#### Task
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  assignee?: string;
  tags?: string[];
}
```

#### TaskStatus
```typescript
enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
  CANCELLED = 'Cancelled'
}
```

#### TaskPriority
```typescript
enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent'
}
```

### Methods

#### createTask(input: CreateTaskInput): Promise<Task>
Creates a new task in the database.

#### getTasks(filter?: TaskFilter): Promise<Task[]>
Retrieves tasks from the database with optional filtering.

#### getTask(taskId: string): Promise<Task | null>
Retrieves a specific task by ID.

#### updateTask(taskId: string, input: UpdateTaskInput): Promise<Task>
Updates an existing task.

#### deleteTask(taskId: string): Promise<void>
Archives (deletes) a task.

## Error Handling

The package includes built-in error handling for common Notion API errors:

```typescript
try {
  const task = await taskManager.getTask('invalid-id');
} catch (error) {
  console.error('Failed to get task:', error.message);
}
```

## Environment Variables

Add your Notion token to your environment:

```bash
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_database_id
```