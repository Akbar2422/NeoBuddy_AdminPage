# NeoBuddy Admin Panel

A modern, clean React admin panel for managing rooms with Supabase integration. Built with React, TailwindCSS, and Vite.

## Features

- ✅ **Add New Rooms** with validation
  - Room Name
  - Description
  - RunPod URL
  - Max Users (number input)
  - Price per hour (INR)

- ✅ **Room Management**
  - List all rooms in a clean table format
  - Real-time status indicators (Available/Full)
  - Current users vs Max users display
  - Inline editing capabilities
  - Delete rooms with confirmation

- ✅ **Smart Status Management**
  - Automatic status calculation based on current vs max users
  - Visual indicators for full rooms
  - Warning messages when rooms reach capacity

- ✅ **Modern UI/UX**
  - Clean, minimal design with TailwindCSS
  - Responsive layout for all screen sizes
  - Professional styling with hover effects
  - Loading states and error handling
  - Toast notifications for user feedback

## Tech Stack

- **Frontend**: React 18 with Vite
- **Styling**: TailwindCSS
- **Database**: Supabase
- **State Management**: React Hooks
- **Form Validation**: Custom validation

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Supabase Setup

#### Create Supabase Project
1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be fully set up

#### Create the Rooms Table
Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  runpod_url VARCHAR(500),
  max_users INTEGER NOT NULL DEFAULT 1,
  price_per_hour DECIMAL(10,2) NOT NULL,
  current_users INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (adjust based on your needs)
CREATE POLICY "Allow all operations on rooms" ON rooms
FOR ALL USING (true);
```

#### Configure Environment
1. Get your Supabase URL and anon key from Project Settings > API
2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update the `.env` file with your actual Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key
   ```
4. **Important**: Never commit your `.env` file to version control

### 3. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
src/
├── components/
│   ├── AddRoomForm.jsx    # Form for adding new rooms
│   └── RoomList.jsx       # Table displaying all rooms
├── lib/
│   └── supabase.js        # Supabase client and room operations
├── App.jsx                # Main application component
├── main.jsx              # React entry point
└── index.css             # TailwindCSS styles and custom components
```

## Database Schema

The `rooms` table structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR(255) | Room name |
| `description` | TEXT | Room description |
| `runpod_url` | VARCHAR(500) | RunPod URL |
| `max_users` | INTEGER | Maximum users allowed |
| `price_per_hour` | DECIMAL(10,2) | Price per hour in INR |
| `current_users` | INTEGER | Current number of users |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features in Detail

### Room Status Logic
- **Available**: `current_users < max_users`
- **Full**: `current_users >= max_users`
- Full rooms display a warning message

### Form Validation
- All fields are required
- URL validation for RunPod URL
- Numeric validation for max users and price
- Real-time error display

### Error Handling
- Connection status indicators
- User-friendly error messages
- Automatic retry mechanisms
- Loading states for better UX

## Customization

### Styling
The app uses TailwindCSS with custom component classes defined in `src/index.css`:
- `.btn-primary`, `.btn-secondary`, `.btn-danger` - Button styles
- `.input-field` - Input field styling
- `.card` - Card container styling
- `.status-available`, `.status-full` - Status badge styling

### Adding New Features
1. **Room Categories**: Add a `category` field to the database and form
2. **User Management**: Implement user tracking and management
3. **Analytics**: Add usage statistics and reporting
4. **Notifications**: Implement real-time notifications for room status changes

## Security Considerations

- Row Level Security (RLS) is recommended for production
- API keys should be stored in environment variables
- Implement proper authentication for production use
- Validate all inputs on both client and server side

## Troubleshooting

### Common Issues

1. **"Failed to load rooms"**
   - Check your Supabase URL and API key
   - Ensure the `rooms` table exists
   - Verify RLS policies if enabled

2. **"Failed to add room"**
   - Check form validation errors
   - Verify database permissions
   - Check browser console for detailed errors

3. **Styling Issues**
   - Ensure TailwindCSS is properly configured
   - Check that PostCSS is processing the CSS
   - Verify all dependencies are installed

### Getting Help

- Check the browser console for error messages
- Verify Supabase connection in the Network tab
- Ensure all environment variables are set correctly

## License

MIT License - feel free to use this project for your own purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with ❤️ for NeoBuddy**