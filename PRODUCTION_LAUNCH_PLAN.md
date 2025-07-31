# 🚀 The Stack - Production Launch Plan

> **Deployment Architecture**: Netlify (Frontend) + Render (Backend) + Supabase (Database)  
> **Total Monthly Cost**: $5/month  
> **Launch Target**: Farcaster Mini App

---

## 📋 **DEPLOYMENT CHECKLIST**

### **PHASE 1: Database Setup** 🗄️
- [ ] **1.1** Create new Supabase project
- [ ] **1.2** Run database schema migration (tables: players, player_stats, daily_activity, achievements, player_achievements)
- [ ] **1.3** Set up database indexes and constraints
- [ ] **1.4** Get Supabase connection string and API keys
- [ ] **1.5** Test database connection locally

### **PHASE 2: Backend Deployment** ⚙️
- [ ] **2.1** Create Render account and connect GitHub repository
- [ ] **2.2** Configure Render web service from `multiplayer-server/` directory
- [ ] **2.3** Set environment variables:
  - `DATABASE_URL` (Supabase connection string)
  - `NODE_ENV=production`
  - `PORT=3002`
- [ ] **2.4** Update CORS origins for production domains
- [ ] **2.5** Deploy and test Socket.IO WebSocket connections
- [ ] **2.6** Verify API endpoints (`/api/leaderboard/global`, `/api/player/stats`)

### **PHASE 3: Frontend Deployment** 🎨
- [ ] **3.1** Create Netlify account and connect GitHub repository
- [ ] **3.2** Configure build settings:
  - Build command: `npm run build`
  - Publish directory: `babs/dist`
  - Node version: 18+
- [ ] **3.3** Update environment variables:
  - `VITE_MULTIPLAYER_SERVER_URL` (Render backend URL)
- [ ] **3.4** Update API endpoints in code to use production URLs
- [ ] **3.5** Test React + Three.js performance on Netlify
- [ ] **3.6** Verify responsive design and mobile controls

### **PHASE 4: Farcaster Integration** 🎯
- [ ] **4.1** Create required assets:
  - App icon: 1024x1024px PNG
  - Splash screen: 200x200px PNG  
  - Preview image: 3:2 aspect ratio PNG/JPG
- [ ] **4.2** Set up custom domain (recommended for manifest)
- [ ] **4.3** Create Farcaster manifest (`/.well-known/farcaster.json`)
- [ ] **4.4** Sign manifest with Farcaster account
- [ ] **4.5** Add social sharing meta tags to HTML
- [ ] **4.6** Test with Farcaster preview tool

### **PHASE 5: Launch & Testing** 🎉
- [ ] **5.1** Complete end-to-end testing:
  - User authentication
  - Multiplayer connections
  - Brick placement and persistence
  - Leaderboard updates
  - Mobile responsiveness
- [ ] **5.2** Performance testing and optimization
- [ ] **5.3** Launch on Farcaster by sharing app URL
- [ ] **5.4** Monitor analytics and user feedback

---

## 🔧 **TECHNICAL CONFIGURATION**

### **File Structure**
```
/
├── babs/                     # Frontend (Deploy to Netlify)
│   ├── src/
│   ├── package.json
│   └── dist/                 # Build output
├── multiplayer-server/       # Backend (Deploy to Render)
│   ├── index.js             # Main server
│   ├── database.js          # DB connection
│   ├── BrickPersistenceManager.js
│   └── package.json
└── PRODUCTION_LAUNCH_PLAN.md # This file
```

### **Environment Variables**

#### **Render (Backend)**
```bash
DATABASE_URL=postgresql://[supabase-connection-string]
NODE_ENV=production
PORT=3002
```

#### **Netlify (Frontend)**
```bash
VITE_MULTIPLAYER_SERVER_URL=https://your-app.onrender.com
```

### **Domain Configuration**
- **Frontend**: `your-app.netlify.app` or custom domain
- **Backend**: `your-app.onrender.com` 
- **Database**: Supabase managed endpoint

---

## 📊 **COST BREAKDOWN**

| Service | Plan | Cost | Features |
|---------|------|------|----------|
| **Netlify** | Free | $0/month | 100GB bandwidth, custom domains, SSL |
| **Render** | Starter | $5/month | 512MB RAM, 0.1 CPU, custom domains |
| **Supabase** | Free | $0/month | 500MB database, 50K MAUs, real-time |
| **Total** | | **$5/month** | Production-ready multiplayer game |

---

## 🎯 **LAUNCH SUCCESS CRITERIA**

- [ ] ✅ Players can authenticate with Farcaster
- [ ] ✅ Real-time multiplayer brick placement works
- [ ] ✅ Leaderboard updates automatically 
- [ ] ✅ Mobile controls are responsive
- [ ] ✅ Game state persists between sessions
- [ ] ✅ App appears correctly in Farcaster feeds
- [ ] ✅ Performance is smooth on mobile devices

---

## 🚨 **ROLLBACK PLAN**

If issues occur during deployment:

1. **Database Issues**: Keep local PostgreSQL as backup
2. **Backend Issues**: Deploy to backup service (Railway/Fly.io)
3. **Frontend Issues**: Use Vercel as backup deployment
4. **Domain Issues**: Use platform default URLs temporarily

---

## 📞 **SUPPORT RESOURCES**

- **Render Docs**: https://render.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs
- **Farcaster Mini Apps**: https://miniapps.farcaster.xyz
- **Three.js Performance**: https://threejs.org/docs/#manual/introduction/FAQ

---

> **Next Step**: Begin with Phase 1 - Database Setup 🗄️