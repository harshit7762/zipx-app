# Render Deployment Checklist

## ✅ PHASE 1: COMPLETED

### Changes Made:
1. ✅ Updated `Backend/server.js`:
   - Added `path` module import
   - Configured CORS for production (includes Render URL)
   - Added static file serving for Frontend
   - Added catch-all route to serve index.html

2. ✅ Created `.gitignore`:
   - Excludes node_modules
   - Excludes .env files
   - Excludes logs and OS files

3. ✅ Created `render.yaml`:
   - Configured for Singapore region
   - Set to free tier
   - Defined build and start commands

---

## 📋 NEXT STEPS (PHASE 2-6)

### PHASE 2: Push to GitHub
```bash
# Initialize git (if not done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Prepare for Render deployment"

# Create GitHub repo at https://github.com/new
# Then run:
git remote add origin https://github.com/YOUR-USERNAME/zipx-app.git
git branch -M main
git push -u origin main
```

### PHASE 3: Deploy on Render

1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your `zipx-app` repository
5. Configure:
   - **Name:** zipx-backend
   - **Region:** Singapore
   - **Root Directory:** Backend
   - **Build Command:** npm install
   - **Start Command:** npm start
   - **Instance Type:** Free

6. Add Environment Variables:
   - `MONGO_URI`: mongodb+srv://zipx6204_db_user:zipX%400840@cluster0.yfiufvw.mongodb.net/zipxdb?retryWrites=true&w=majority&appName=Cluster0
   - `JWT_SECRET`: zipx_super_secret_2026
   - `PORT`: 5000

7. Click "Create Web Service"

### PHASE 4: Update Frontend API URL

After deployment, update `Frontend/app.js` line 5:
```javascript
const API_URL = "https://YOUR-APP-NAME.onrender.com/api";
```

Then update CORS in `Backend/server.js` with your actual Render URL.

Push changes:
```bash
git add .
git commit -m "Update API URL for production"
git push
```

### PHASE 5: Test Deployment

Visit: `https://YOUR-APP-NAME.onrender.com`

Test:
- Login functionality
- Create orders
- Check tracking
- Verify all features work

### PHASE 6: Build APK/EXE

With production URL in place, build your APK and EXE files.

---

## 🔧 Important Notes

### MongoDB Atlas Setup
Make sure MongoDB Atlas allows connections from anywhere:
1. Go to MongoDB Atlas Dashboard
2. Network Access → Add IP Address
3. Add: 0.0.0.0/0 (Allow from anywhere)

### Keep App Awake (Free Tier)
Use UptimeRobot to prevent sleep:
1. Sign up at https://uptimerobot.com
2. Add monitor: https://YOUR-APP-NAME.onrender.com/api/auth/me
3. Check every 5 minutes

### Your Render URL
After deployment, your app will be at:
- **Web App:** https://YOUR-APP-NAME.onrender.com
- **API:** https://YOUR-APP-NAME.onrender.com/api

---

## 📞 Support

If you face issues:
1. Check Render logs in dashboard
2. Verify environment variables are set
3. Ensure MongoDB Atlas allows all IPs
4. Check browser console for errors

---

## 🎉 Ready for Phase 2!

Your code is now ready for GitHub and Render deployment.
Follow the steps above to complete the deployment.
