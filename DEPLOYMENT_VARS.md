# Deployment Environment Variables Guide

## Backend Environment Variables (Render)

Set these environment variables in your Render dashboard:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lead-management?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here-minimum-32-characters
JWT_EXPIRE=30d

# Server Configuration
NODE_ENV=production
PORT=5000

# CORS Configuration (Replace with your actual Vercel URLs)
CORS_ORIGIN=https://your-app-name.vercel.app,https://your-app-name-git-main-username.vercel.app,https://your-app-name-username.vercel.app

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Frontend Environment Variables (Vercel)

Set these environment variables in your Vercel dashboard:

```env
# API Configuration (Replace with your actual Render backend URL)
VITE_API_URL=https://your-backend-app.onrender.com/api
```

## Deployment Instructions

### 1. Backend Deployment (Render)

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the following configurations:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node
   - **Region**: Choose closest to your users
4. Add all the backend environment variables listed above
5. Deploy

### 2. Frontend Deployment (Vercel)

1. Connect your GitHub repository to Vercel
2. Set the following configurations:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the frontend environment variable listed above
4. Deploy

### 3. MongoDB Setup

You'll need a MongoDB Atlas database:
1. Create a MongoDB Atlas account
2. Create a cluster
3. Create a database user
4. Get the connection string
5. Replace the MONGODB_URI in your backend environment variables

### 4. Update CORS Origins

After deploying to Vercel, update the CORS_ORIGIN environment variable in Render with your actual Vercel URLs. 