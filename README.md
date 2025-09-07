# Wedding Backend API

Backend API for the AI-powered wedding invitation application with Firebase Storage and Firestore integration.

## Features

- **Media Upload CRUD APIs** - Upload, retrieve, update, and delete photos/videos with Firebase Storage
- **Photo Likes API** - Like/unlike functionality for media items
- **Wishes Form Submission API** - Submit and manage wedding wishes with full CRUD operations
- **Image Processing** - Automatic image resizing and thumbnail generation
- **Firebase Integration** - Secure file storage and database operations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
NODE_ENV=development
PORT=3001
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
```

3. Ensure `serviceAccountKey.json` is in the root directory

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Check API status

### Media APIs
- `POST /api/media/upload` - Upload media file
- `GET /api/media` - Get all media
- `GET /api/media/:id` - Get single media item
- `PUT /api/media/:id` - Update media metadata
- `DELETE /api/media/:id` - Delete media
- `POST /api/media/:id/like` - Like/unlike media

### Wishes APIs
- `POST /api/wishes` - Submit new wish
- `GET /api/wishes` - Get all wishes
- `GET /api/wishes/:id` - Get single wish
- `PUT /api/wishes/:id` - Update wish
- `DELETE /api/wishes/:id` - Delete wish
- `POST /api/wishes/:id/like` - Like/unlike wish
- `GET /api/wishes/stats/overview` - Get wishes statistics

## Media Upload

Upload media with the following fields:
- `media` (file) - The image/video file
- `title` (string) - Media title
- `date` (string) - Media date
- `type` (string) - Media type (optional, auto-detected)

## Wish Submission

Submit wishes with the following fields:
- `name` (string, required) - Submitter's name
- `relation` (string) - Relation to couple
- `email` (string) - Email address
- `wish` (string, required) - The wish message
- `tone` (string) - Wish tone (heartfelt, joyful, romantic, funny, blessing)
- `artworkStyle` (string) - Artwork style (cartoon, ghibli, royal)
- `artworkPrompt` (string) - Custom artwork prompt
- `language` (string) - Language code

## Response Format

All API responses follow this format:
```json
{
  "success": boolean,
  "message": string,
  "data": object | array,
  "error": string (only on error)
}
```

## Error Handling

The API includes comprehensive error handling with appropriate HTTP status codes:
- 200 - Success
- 201 - Created
- 400 - Bad Request
- 404 - Not Found
- 500 - Internal Server Error

## Firebase Collections

- `media` - Stores media metadata
- `wishes` - Stores wish submissions

## File Storage

- Media files are stored in Firebase Storage under `media/` folder
- Thumbnails are stored under `thumbnails/` folder
- Automatic image optimization and resizing
- Support for images and videos up to 50MB

## Admin Credentials Seeding

Seed or update the admin login (stored at Firestore `login/admin`). The password is stored as a SHA-256 hash.

1) Ensure `serviceAccountKey.json` exists in `wedding-backend/`.
2) Run interactively (prompts for username and hidden password):
```bash
npm run seed:admin
```
Or provide flags:
```bash
npm run seed:admin -- --username safipraneeth --password 'YourSecretPassword'
```
This writes:
- `username`: provided value
- `password`: SHA-256 hex hash of the provided password

Use the same username/password on the Admin UI; the client hashes the password before sending.

## Auth & Sessions

The backend exposes minimal admin auth endpoints with HMAC-signed tokens and a verify route.

Environment variables:
```
AUTH_TOKEN_SECRET=change-this-to-a-long-random-string
ADMIN_SEED_SECRET=optional-secret-for-/api/auth/seed
# TOKEN TTL is set in code (routes/auth.js) as 12h; adjust if needed
```

Endpoints:
- `POST /api/auth/login` – Body `{ username, passwordHash }` (SHA-256 hex). Returns `{ success, token, expiresInMs }`.
- `GET /api/auth/verify` – Header `Authorization: Bearer <token>`. Returns `{ success, payload }` if valid.
- `POST /api/auth/seed` – Header `X-Admin-Seed: $ADMIN_SEED_SECRET`, Body `{ username, passwordHash }`.

Examples:
```bash
# Hash your password to hex (Linux/macOS)
HASH=$(printf '%s' 'MySecret' | sha256sum | awk '{print $1}')

# Login
curl -s http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"passwordHash\":\"$HASH\"}"

# Verify a token
curl -s http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer <PASTE_TOKEN>"
```

Session behaviour:
- The frontend persists the token in `localStorage` and calls `/api/auth/verify` on page load.
- While verifying, the UI shows a small loading state to avoid login flicker.
- Logout clears the token client-side.
