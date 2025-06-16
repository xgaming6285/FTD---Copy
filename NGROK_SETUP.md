# Ngrok Setup Guide

## The Problem

When using ngrok to expose your frontend, you encounter CORS errors when trying to login because:

1. **Frontend is accessed via ngrok URL** (e.g., `https://abc123.ngrok.io`)
2. **Backend is still on localhost:5000** (not accessible from outside)
3. **CORS blocks the request** because the origin (ngrok URL) is not allowed to access localhost:5000

## The Solution

You need to run **TWO separate ngrok tunnels** - one for frontend and one for backend.

### Step 1: Setup Backend Ngrok Tunnel

```bash
# Terminal 1: Start your backend server
cd backend
npm start  # This runs on localhost:5000

# Terminal 2: Start ngrok tunnel for backend
ngrok http 5000
```

This will give you a backend URL like: `https://def456.ngrok.io`

### Step 2: Setup Frontend Ngrok Tunnel

```bash
# Terminal 3: Update frontend .env file
cd frontend
# Edit .env file to point to your backend ngrok URL:
echo "VITE_API_URL=https://def456.ngrok.io/api" > .env

# Start your frontend
npm run dev  # This runs on localhost:3000

# Terminal 4: Start ngrok tunnel for frontend
ngrok http 3000
```

This will give you a frontend URL like: `https://abc123.ngrok.io`

### Step 3: Access Your App

Now you can access your app via the frontend ngrok URL (`https://abc123.ngrok.io`) and it will properly communicate with the backend ngrok URL.

## Alternative: Quick Development Setup

If you just want to test from external devices on the same network:

### Option A: Use Your Local Network IP

```bash
# Find your local IP
ipconfig  # On Windows
ifconfig  # On Mac/Linux

# Start frontend with network access
cd frontend
npm run dev -- --host 0.0.0.0

# Update .env to use your local IP
VITE_API_URL=http://YOUR_LOCAL_IP:5000/api
```

Then access via `http://YOUR_LOCAL_IP:3000` from other devices.

### Option B: Backend Only Ngrok

If you only want to expose the backend:

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Ngrok for backend only
ngrok http 5000

# Update frontend .env
cd frontend
echo "VITE_API_URL=https://your-backend-ngrok-url.ngrok.io/api" > .env
npm run dev
```

Access via `http://localhost:3000` but the backend calls will go through ngrok.

## What I Fixed

1. **CORS Configuration**: Updated `backend/server.js` to allow ngrok domains
2. **Dynamic API URL**: Updated `frontend/src/services/api.js` to warn when using ngrok without proper setup
3. **Instructions**: This guide to help you set up ngrok properly

## Current Status

✅ CORS now allows ngrok domains  
⚠️  You need to set up backend ngrok tunnel and update `frontend/.env`  
⚠️  You need to run two separate ngrok tunnels for full functionality  

## Quick Fix for Testing

If you just want to test quickly, you can:

1. Keep backend on localhost:5000
2. Access frontend via localhost:3000 (not ngrok)
3. Everything will work as expected

The ngrok setup is only needed if you want to access from external devices/internet. 