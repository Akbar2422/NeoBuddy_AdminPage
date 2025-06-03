# NeoBuddy Admin Panel - Real-time User Tracking Integration Guide

## Overview

This guide explains how to integrate the new `AdminPanel.tsx` TypeScript component into your existing NeoBuddy Admin Panel. The enhanced component provides:

- Real-time updates for `current_users` in the `rooms` table
- Session validation to only count active users with `rewards_left > 0`
- Automatic user count adjustments when users join or leave rooms
- Preservation of all existing room management functionality

## Integration Steps

### 1. Add TypeScript Support

If you haven't already, install TypeScript in your project:

```bash
npm install --save-dev typescript @types/react @types/react-dom
```

Create a `tsconfig.json` file in your project root if it doesn't exist:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 2. Update Your Main Entry Point

Update your `main.jsx` to import the new component instead of App.jsx:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminPanel from './AdminPanel.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminPanel />
  </React.StrictMode>,
)
```

### 3. Database Requirements

The component expects the following tables in your Supabase database:

1. `rooms` table with fields:
   - `id` (string)
   - `name` (string)
   - `description` (string)
   - `url` (string)
   - `max_users` (number)
   - `price_inr` (number)
   - `session_start_time` (string)
   - `session_end_time` (string)
   - `current_users` (number)
   - `created_at` (timestamp)

2. `sessions` table with fields:
   - `id` (string)
   - `room_id` (string, foreign key to rooms.id)
   - `user_id` (string)
   - `rewards_left` (number)
   - `created_at` (timestamp)

### 4. Enable Real-time Subscriptions

Ensure real-time subscriptions are enabled in your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to Database → Replication
3. Enable the "Realtime" option for both the `rooms` and `sessions` tables

## Key Features Explained

### Real-time User Count Updates

The component implements two Supabase channel subscriptions:

1. **Rooms subscription**: Handles general room updates and displays notifications
2. **Sessions subscription**: Specifically tracks user session changes to update the `current_users` count

When a user joins a room:
- A new session is created with `rewards_left > 0`
- The component detects this and increments the room's `current_users` count

When a user's session becomes inactive:
- The `rewards_left` value changes from > 0 to 0
- The component decrements the room's `current_users` count

### Session Validation Logic

The component includes validation to ensure only active sessions are counted:

```typescript
// Only count sessions where rewards_left > 0
if (payload.new && payload.new.room_id && payload.new.rewards_left > 0) {
  await updateRoomUserCount(payload.new.room_id, 1);
}
```

### UI Enhancements

- Added "Active Users" counter in the header showing total users across all rooms
- Maintained the existing cyberpunk theme and responsive design

## Troubleshooting

If you encounter issues:

1. Check browser console for errors
2. Verify Supabase connection and permissions
3. Ensure both `rooms` and `sessions` tables exist with the required fields
4. Confirm that real-time subscriptions are enabled in your Supabase project

## No Backend Changes Required

All functionality is implemented client-side using the Supabase JavaScript SDK. No additional backend services are needed.