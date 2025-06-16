# Vercel Frontend Deployment Guide

## Prerequisites

1. **Backend Deployed**: Ensure your backend is deployed on Render first
2. **Backend URL**: Note your Render backend URL (e.g., `https://your-backend.onrender.com`)

## Vercel Configuration

### Project Settings
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Node.js Version**: 18.x (recommended)

### Build Settings
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables

Add these in the Vercel Dashboard → Settings → Environment Variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `VITE_API_URL` | `https://your-backend.onrender.com/api` | Production, Preview, Development |

**Important**: Replace `your-backend.onrender.com` with your actual Render backend URL.

## Deployment Steps

### Method 1: GitHub Integration (Recommended)

1. **Connect Repository**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/in with GitHub
   - Import your repository
   - Select the repository with your project

2. **Configure Project**:
   - Set **Root Directory** to `frontend`
   - Framework preset should auto-detect as "Vite"
   - Click "Deploy"

3. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add `VITE_API_URL` with your backend URL
   - Redeploy if needed

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Navigate to frontend directory
cd frontend

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy: Y
# - Which scope: [your account]
# - Link to existing project: N
# - What's your project's name: your-app-name
# - In which directory is your code located: ./
```

## Post-Deployment Configuration

### Update Backend CORS

After getting your Vercel URLs, update your Render backend environment variables:

1. **Production URL**: `https://your-app.vercel.app`
2. **Preview URLs**: `https://your-app-git-*.vercel.app`
3. **Development URLs**: `https://your-app-*.vercel.app`

Update the `CORS_ORIGIN` variable in Render:
```
CORS_ORIGIN=https://your-app.vercel.app,https://your-app-git-main-username.vercel.app
```

### Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update backend CORS_ORIGIN with the custom domain

## Environment-Specific URLs

Vercel creates multiple deployment URLs:

- **Production**: `https://your-app.vercel.app` (from main branch)
- **Preview**: `https://your-app-git-[branch].vercel.app` (from feature branches)
- **Development**: Various preview URLs for each commit

Make sure your backend accepts all these URL patterns (already configured in the updated CORS settings).

## Troubleshooting

### Common Issues:

1. **API Connection Failed**:
   - Check `VITE_API_URL` environment variable
   - Ensure backend URL includes `/api` path
   - Verify backend is running and accessible

2. **CORS Errors**:
   - Ensure frontend URL is in backend's CORS_ORIGIN
   - Check browser developer tools for exact error
   - Verify Render backend is running

3. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

4. **Routing Issues**:
   - Ensure `vercel.json` is properly configured
   - Check that all routes redirect to index.html

### Testing Deployment

1. **Health Check**: Visit `https://your-backend.onrender.com/api/health`
2. **Frontend**: Visit `https://your-app.vercel.app`
3. **API Connection**: Check browser network tab for API calls
4. **Authentication**: Test login functionality

## Performance Optimization

- **Build Optimization**: Already configured in vite.config.js
- **Code Splitting**: Configured for vendor, MUI, and Redux chunks
- **Caching**: Vercel automatically handles static asset caching
- **CDN**: Vercel's global CDN automatically serves your app

## Monitoring

- **Vercel Analytics**: Available in the dashboard
- **Function Logs**: View in Vercel dashboard
- **Performance**: Monitor Core Web Vitals
- **Errors**: Check browser console and Vercel logs 