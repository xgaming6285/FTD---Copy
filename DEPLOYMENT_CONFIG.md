# Deployment Configuration

## Backend API Configuration

Your frontend is now configured to use the deployed backend at `https://ftd-backend.onrender.com` by default.

### Current Setup
- **Default API URL**: `https://ftd-backend.onrender.com`
- **Environment Variable**: `VITE_API_URL` (optional override)

### To Use Deployed Backend (Default)
No additional configuration needed. The app will automatically use `https://ftd-backend.onrender.com`.

### To Use Local Backend (For Development)
If you want to run the backend locally for development:

1. Create a `.env` file in the `frontend/` directory:
```bash
cd frontend
echo "VITE_API_URL=http://localhost:5000" > .env
```

2. Make sure your local backend is running on port 5000

### To Switch Back to Deployed Backend
Simply delete the `.env` file or comment out the `VITE_API_URL` line:
```bash
# VITE_API_URL=http://localhost:5000
```

## Testing
After making changes, restart your development server:
```bash
cd frontend
npm run dev
```

The console will show which API URL is being used when you open the browser developer tools. 