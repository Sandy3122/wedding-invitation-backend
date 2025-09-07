# Wedding Backend API - Complete cURL Examples

This document provides comprehensive cURL examples for all API endpoints in the wedding backend.

## Base URL
```
http://localhost:3001
```

## 1. Health Check

### Check API Status
```bash
curl -X GET http://localhost:3001/health
```

**Response:**
```json
{
  "status": "OK",
  "message": "Wedding Backend API is running (Mock Mode)"
}
```

---

## 2. Wishes API

### Submit a New Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "relation": "Friend",
    "email": "john@example.com",
    "wish": "Congratulations on your wedding! May you both have a lifetime of happiness together.",
    "tone": "heartfelt",
    "artworkStyle": "cartoon",
    "artworkPrompt": "A romantic couple with hearts and flowers",
    "language": "en-IN"
  }'
```

### Submit Wish (Minimal Required Fields)
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "wish": "Best wishes for your special day!"
  }'
```

### Get All Wishes
```bash
curl -X GET http://localhost:3001/api/wishes
```

### Get Wishes with Pagination
```bash
curl -X GET "http://localhost:3001/api/wishes?limit=10&offset=0&approved=true"
```

### Get Single Wish by ID
```bash
curl -X GET http://localhost:3001/api/wishes/{wish-id}
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/wishes/c44f7c72-ddce-4c9f-bbb9-672ec588c36a
```

### Update a Wish
```bash
curl -X PUT http://localhost:3001/api/wishes/{wish-id} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "wish": "Updated wish message",
    "tone": "joyful",
    "isApproved": true
  }'
```

### Delete a Wish
```bash
curl -X DELETE http://localhost:3001/api/wishes/{wish-id}
```

### Like a Wish
```bash
curl -X POST http://localhost:3001/api/wishes/{wish-id}/like \
  -H "Content-Type: application/json" \
  -d '{"action": "like"}'
```

### Unlike a Wish
```bash
curl -X POST http://localhost:3001/api/wishes/{wish-id}/like \
  -H "Content-Type: application/json" \
  -d '{"action": "unlike"}'
```

### Get Wishes Statistics
```bash
curl -X GET http://localhost:3001/api/wishes/stats/overview
```

---

## 3. Media API

### Upload Media (Mock Mode)
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Wedding Ceremony Photo",
    "type": "photo",
    "date": "2024-12-15"
  }'
```

### Upload Media (Firebase Mode - with actual file)
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -F "media=@/path/to/your/photo.jpg" \
  -F "title=Wedding Ceremony Photo" \
  -F "date=2024-12-15"
```

### Upload Video (Firebase Mode)
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -F "media=@/path/to/your/video.mp4" \
  -F "title=Wedding Dance Video" \
  -F "date=2024-12-15"
```

### Get All Media
```bash
curl -X GET http://localhost:3001/api/media
```

### Get Single Media by ID
```bash
curl -X GET http://localhost:3001/api/media/{media-id}
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/media/907b08a1-b92d-48ea-8f4c-3f5644e63c4c
```

### Update Media Metadata
```bash
curl -X PUT http://localhost:3001/api/media/{media-id} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Photo Title",
    "date": "2024-12-20"
  }'
```

### Delete Media
```bash
curl -X DELETE http://localhost:3001/api/media/{media-id}
```

### Like Media
```bash
curl -X POST http://localhost:3001/api/media/{media-id}/like \
  -H "Content-Type: application/json" \
  -d '{"action": "like"}'
```

### Unlike Media
```bash
curl -X POST http://localhost:3001/api/media/{media-id}/like \
  -H "Content-Type: application/json" \
  -d '{"action": "unlike"}'
```

---

## 4. Complete Test Sequence

### Test All APIs in Sequence
```bash
#!/bin/bash

BASE_URL="http://localhost:3001"

echo "🧪 Testing Wedding Backend API..."

# 1. Health Check
echo "1. Testing health check..."
curl -X GET $BASE_URL/health
echo -e "\n"

# 2. Submit Wish
echo "2. Testing wish submission..."
WISH_RESPONSE=$(curl -s -X POST $BASE_URL/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "relation": "Friend",
    "email": "test@example.com",
    "wish": "Congratulations on your wedding!",
    "tone": "heartfelt",
    "artworkStyle": "cartoon",
    "language": "en-IN"
  }')
echo $WISH_RESPONSE
WISH_ID=$(echo $WISH_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo -e "\n"

# 3. Get Wishes
echo "3. Testing get wishes..."
curl -X GET $BASE_URL/api/wishes
echo -e "\n"

# 4. Like Wish
echo "4. Testing like wish..."
curl -X POST $BASE_URL/api/wishes/$WISH_ID/like \
  -H "Content-Type: application/json" \
  -d '{"action": "like"}'
echo -e "\n"

# 5. Upload Media (Mock)
echo "5. Testing media upload..."
MEDIA_RESPONSE=$(curl -s -X POST $BASE_URL/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Wedding Photo",
    "type": "photo",
    "date": "2024-12-15"
  }')
echo $MEDIA_RESPONSE
MEDIA_ID=$(echo $MEDIA_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo -e "\n"

# 6. Get Media
echo "6. Testing get media..."
curl -X GET $BASE_URL/api/media
echo -e "\n"

# 7. Like Media
echo "7. Testing like media..."
curl -X POST $BASE_URL/api/media/$MEDIA_ID/like \
  -H "Content-Type: application/json" \
  -d '{"action": "like"}'
echo -e "\n"

# 8. Get Statistics
echo "8. Testing statistics..."
curl -X GET $BASE_URL/api/wishes/stats/overview
echo -e "\n"

echo "🎉 All tests completed!"
```

---

## 5. Error Handling Examples

### Test Invalid Wish Submission
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "wish": ""
  }'
```

### Test Non-existent Resource
```bash
curl -X GET http://localhost:3001/api/wishes/non-existent-id
```

### Test Invalid Media Upload
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 6. Different Wish Tones

### Heartfelt Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah",
    "wish": "May your love story continue to grow more beautiful with each passing day.",
    "tone": "heartfelt"
  }'
```

### Joyful Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mike",
    "wish": "Here is to a lifetime of laughter, adventures, and endless joy together!",
    "tone": "joyful"
  }'
```

### Romantic Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emma",
    "wish": "Like stars that shine brighter together, may your love illuminate every moment.",
    "tone": "romantic"
  }'
```

### Funny Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex",
    "wish": "May your marriage be filled with as much laughter as your dating stories!",
    "tone": "funny"
  }'
```

### Blessing Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Reverend Smith",
    "wish": "May divine grace bless your union with wisdom, patience, and eternal love.",
    "tone": "blessing"
  }'
```

---

## 7. Different Languages

### Hindi Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "राम",
    "wish": "आप दोनों की शादी पर बहुत-बहुत बधाई!",
    "language": "hi"
  }'
```

### Telugu Wish
```bash
curl -X POST http://localhost:3001/api/wishes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "రాజు",
    "wish": "మీ వివాహానికి హార్దిక శుభాకాంక్షలు!",
    "language": "te"
  }'
```

---

## 8. Media Types

### Photo Upload
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Engagement Photo",
    "type": "photo",
    "date": "2024-11-15"
  }'
```

### Video Upload
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Wedding Ceremony Video",
    "type": "video",
    "date": "2024-12-15"
  }'
```

---

## 9. Response Examples

### Successful Wish Submission
```json
{
  "success": true,
  "message": "Wish submitted successfully",
  "data": {
    "id": "c44f7c72-ddce-4c9f-bbb9-672ec588c36a",
    "name": "John Doe",
    "relation": "Friend",
    "email": "john@example.com",
    "originalWish": "Congratulations on your wedding!",
    "enhancedWish": "Congratulations on your wedding!",
    "tone": "heartfelt",
    "artworkStyle": "cartoon",
    "artworkPrompt": "",
    "language": "en-IN",
    "likes": 0,
    "createdAt": "2024-12-15T10:30:00.000Z",
    "updatedAt": "2024-12-15T10:30:00.000Z",
    "isApproved": true
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Name and wish are required"
}
```

---

## 10. Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/wishes` | Submit wish |
| GET | `/api/wishes` | Get all wishes |
| GET | `/api/wishes/:id` | Get single wish |
| PUT | `/api/wishes/:id` | Update wish |
| DELETE | `/api/wishes/:id` | Delete wish |
| POST | `/api/wishes/:id/like` | Like/unlike wish |
| GET | `/api/wishes/stats/overview` | Get statistics |
| POST | `/api/media/upload` | Upload media |
| GET | `/api/media` | Get all media |
| GET | `/api/media/:id` | Get single media |
| PUT | `/api/media/:id` | Update media |
| DELETE | `/api/media/:id` | Delete media |
| POST | `/api/media/:id/like` | Like/unlike media |

---

## Notes

- Replace `{wish-id}` and `{media-id}` with actual IDs from your responses
- For Firebase mode, use multipart/form-data for media uploads
- All timestamps are in ISO 8601 format
- Mock mode generates placeholder images for media
- All responses follow the same format: `{success, message, data}`
