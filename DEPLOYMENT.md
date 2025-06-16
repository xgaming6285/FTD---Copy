# Deployment Guide

## Prerequisites
- Node.js 16+ installed
- MongoDB Atlas account (for production database)
- Render.com account (or similar hosting service)
- Git repository

## Backend Deployment (on Render.com)

1. **Environment Variables Setup**
   Create the following environment variables in your Render.com dashboard:
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_atlas_uri
   JWT_SECRET=your_jwt_secret
   PORT=5000
   CORS_ORIGIN=your_frontend_url
   ```

2. **Deployment Steps**
   - Connect your GitHub repository to Render.com
   - Create a new Web Service
   - Select the repository and branch
   - Configure build settings:
     - Build Command: `cd backend && npm install`
     - Start Command: `cd backend && npm start`
   - Add environment variables
   - Deploy

## Frontend Deployment (on Render.com or Vercel)

1. **Environment Variables Setup**
   Create a `.env` file in the frontend directory:
   ```
   VITE_API_URL=your_backend_api_url
   ```

2. **Build Configuration**
   The frontend is configured with Vite. Build command is already set up in `package.json`.

3. **Deployment Steps**
   - Connect your GitHub repository
   - Create a new Static Site (Render.com) or Project (Vercel)
   - Configure build settings:
     - Build Command: `cd frontend && npm install && npm run build`
     - Output Directory: `frontend/dist`
   - Add environment variables
   - Deploy

## Manual Deployment Steps

### Backend
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create production build
npm run build

# Start the server
npm start
```

### Frontend
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create production build
npm run build

# The build folder (dist) is ready to be deployed
```

## CI/CD Setup

1. **GitHub Actions Workflow**
   Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy

   on:
     push:
       branches: [ main ]

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - name: Use Node.js
           uses: actions/setup-node@v2
           with:
             node-version: '16.x'
         - name: Install dependencies
           run: |
             npm run install-all
         - name: Run tests
           run: |
             npm test
         - name: Build
           run: |
             npm run build
   ```

## Health Checks

1. **Backend Health Check**
   - Endpoint: `GET /api/health`
   - Expected response: `{ status: 'ok' }`

2. **Frontend Health Check**
   - Verify API connection on load
   - Check authentication status
   - Monitor API response times

## Monitoring

1. **Backend Monitoring**
   - Set up Morgan for HTTP request logging
   - Implement error tracking (e.g., Sentry)
   - Monitor server resources

2. **Frontend Monitoring**
   - Implement error boundary components
   - Set up performance monitoring
   - Track user interactions and errors

## Backup and Recovery

1. **Database Backups**
   - Configure automated MongoDB Atlas backups
   - Set up periodic data exports
   - Document restore procedures

2. **Application Backups**
   - Maintain version control
   - Document deployment rollback procedures
   - Keep configuration backups

## Security Considerations

1. **Backend Security**
   - Enable CORS with specific origins
   - Use Helmet.js for security headers
   - Implement rate limiting
   - Use secure session management

2. **Frontend Security**
   - Implement CSP headers
   - Sanitize user inputs
   - Use secure cookie attributes
   - Enable HTTPS only

## Troubleshooting

Common issues and solutions:
1. **CORS Issues**
   - Verify CORS_ORIGIN environment variable
   - Check frontend API URL configuration

2. **Database Connection**
   - Verify MongoDB URI
   - Check network access settings

3. **Build Failures**
   - Clear node_modules and package-lock.json
   - Rebuild with clean installation

4. **Performance Issues**
   - Check server resources
   - Monitor database queries
   - Analyze frontend bundle size 