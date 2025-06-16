# Render Backend Deployment Guide

## Prerequisites

1. **MongoDB Atlas Database**
   - Create a MongoDB Atlas account at https://www.mongodb.com/atlas
   - Create a new cluster
   - Create a database user with read/write permissions
   - Get your connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/lead-management?retryWrites=true&w=majority`)

2. **JWT Secret Key**
   - Generate a secure JWT secret (minimum 32 characters)
   - You can use: `openssl rand -base64 32` or an online generator

## Render Configuration

### Service Settings
- **Service Type**: Web Service
- **Environment**: Node
- **Region**: Choose the closest to your users (e.g., Oregon for US West)
- **Instance Type**: Starter (can upgrade later)

### Build & Deploy Settings
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Auto-Deploy**: Yes (deploy on git push)

### Environment Variables

Add these in the Render Dashboard → Environment tab:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://username:password@cluster.mongodb.net/lead-management?retryWrites=true&w=majority` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | `your-32-character-secret-key` | JWT signing secret |
| `JWT_EXPIRE` | `30d` | JWT token expiration |
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `5000` | Server port (Render will override this) |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Your Vercel frontend URL (update after Vercel deployment) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

### Health Check
Render will automatically use the `/api/health` endpoint for health checks.

## Post-Deployment Steps

1. **Get your Render URL**: After deployment, note your backend URL (e.g., `https://your-app.onrender.com`)
2. **Update CORS**: Update the `CORS_ORIGIN` environment variable with your actual Vercel URL
3. **Seed Database**: Use the provided seeding endpoint or script to create initial admin user
4. **Test API**: Test your API endpoints using the health check: `https://your-app.onrender.com/api/health`

## Important Notes

- **Cold Starts**: Free tier services sleep after 15 minutes of inactivity
- **Database Seeding**: You may need to run database seeding after first deployment
- **Logs**: Check the Render logs for any deployment or runtime issues
- **Custom Domain**: You can add a custom domain in the Render dashboard

## Troubleshooting

### Common Issues:
1. **MongoDB Connection**: Ensure your MongoDB Atlas allows connections from anywhere (0.0.0.0/0) or add Render's IP ranges
2. **Environment Variables**: Double-check all environment variables are set correctly
3. **CORS Errors**: Ensure the frontend URL is in the CORS_ORIGIN variable
4. **Build Failures**: Check that all dependencies are in package.json and not devDependencies 