# GetLost Portal - Local Development Setup Guide

## Prerequisites

- **Node.js**: v18+ (you have v24.5.0 ✅)
- **npm**: v11+ (you have v11.5.1 ✅)
- **Git**: For version control

## Quick Setup

### 1. Environment Variables

Your `.env` file has been updated with:
```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="[generated-secret]"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
NODE_ENV="development"
```

**⚠️ Important**: You need to set up Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID → `AUTH_GOOGLE_ID`
7. Copy Client Secret → `AUTH_GOOGLE_SECRET`

**For local development without Google OAuth**, you can use email/password authentication (credentials provider is configured).

### 2. Database Setup

The database has been initialized. If you need to reset it:

```bash
npm run db:push        # Push schema changes
npm run db:setup      # Safe database initialization
npm run db:studio     # Open Drizzle Studio (database GUI)
```

### 3. Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

## Available Scripts

- `npm run dev` - Start development server (kills port 3000 first)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push schema changes to database
- `npm run db:setup` - Safe database initialization
- `npm run db:studio` - Open Drizzle Studio (database GUI)
- `npm run db:generate` - Generate migrations
- `npm run typecheck` - Type check TypeScript
- `npm run make-admin` - Make a user an admin (requires email)
- `npm run check` - Lint code with Biome

## Application Features

### Authentication
- **Google OAuth** - Sign in with Google account
- **Email/Password** - Traditional credentials authentication
- **Magic Link** - Passwordless email authentication
- **Password Reset** - Forgot password flow

### User Roles
- **user** - Regular user (default)
- **admin** - Admin access
- **super_admin** - Super admin access

### Main Features
- **Landing Page** - Marketing site with pricing
- **Dashboard** - User dashboard for book management
- **Book Upload** - Upload manuscripts for analysis
- **Reports** - Generate book analysis reports
- **Admin Panel** - Admin interface at `/admin`

## First Steps

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Visit the app**: http://localhost:3000

3. **Sign up/Sign in**:
   - Go to `/signup` or `/login`
   - Use Google OAuth or create an account with email/password

4. **Access Dashboard**:
   - After signing in, go to `/dashboard`
   - Upload your first book!

## Troubleshooting

### Port Already in Use
The dev script automatically kills port 3000, but if issues persist:
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Database Issues
```bash
# Reset database
rm dev.db
npm run db:push
```

### Google OAuth Not Working
- Make sure redirect URI matches exactly: `http://localhost:3000/api/auth/callback/google`
- Check that Google+ API is enabled in Google Cloud Console
- Verify credentials are correct in `.env`

### TypeScript Errors
Some script files may show TypeScript errors - these are normal for JS files in the scripts folder.

### Missing Dependencies
```bash
npm install
```

## Project Structure

```
getlostportal/
├── src/
│   ├── app/              # Next.js pages & routes
│   │   ├── dashboard/    # User dashboard
│   │   ├── admin/        # Admin panel
│   │   ├── auth/         # Auth pages
│   │   └── api/          # API routes
│   ├── server/           # Server-side code
│   │   ├── api/          # tRPC API
│   │   ├── auth/         # Auth configuration
│   │   ├── db/           # Database schema
│   │   └── services/     # Business logic
│   └── components/       # Shared UI components
├── scripts/              # Setup & utility scripts
├── dev.db               # SQLite database
└── .env                 # Environment variables
```

## Need Help?

- Check the [T3 Stack docs](https://create.t3.gg/)
- Review error messages in the console
- Check database with: `npm run db:studio`

## Notes

- The application uses **better-sqlite3** for the database
- Authentication uses **NextAuth v5** (beta)
- The app supports both OAuth and credentials authentication
- Admin users can be created with: `npm run make-admin`
