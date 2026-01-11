# Fix for Guest User Registration Error

## Problem
The error "Failed to create guest user: Requested resource not found" occurs because the SST stack is missing some required DynamoDB tables.

## Root Cause
The `packages/db/src/client.ts` file references `SyncStatisticsTable` and `SyncHistoryTable` resources that were not defined in the `sst.config.ts` file.

## Solution Applied
I've made the following changes:

### 1. Added Missing Tables to SST Configuration
Updated `sst.config.ts` to include:
- `SyncStatisticsTable` - for tracking sync performance metrics
- `SyncHistoryTable` - for detailed sync operation logs

### 2. Improved Error Handling
Updated `packages/db/src/client.ts` to:
- Use optional chaining when accessing SST resources
- Provide more descriptive error messages when tables are missing
- Support environment variable fallbacks

## Required Action
To fix the guest user registration error, you need to deploy the updated SST configuration:

```bash
# Deploy the updated stack with new tables
sst deploy

# Or if running in development mode
sst dev
```

## Verification
After deployment, the guest user registration should work correctly. You can test it by:

1. Starting the development server: `npm run dev` (in packages/web)
2. Visiting the application in your browser
3. Attempting to register as a guest user

## Alternative Temporary Fix
If you can't deploy immediately, you can set environment variables as a temporary workaround:

```bash
export SYNCSTATISTICS_TABLE_NAME="your-sync-stats-table-name"
export SYNCHISTORY_TABLE_NAME="your-sync-history-table-name"
```

However, the proper solution is to deploy the updated SST configuration.