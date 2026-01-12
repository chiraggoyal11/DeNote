# DeNote

DeNote is a **full-stack notes sharing application** that allows users to upload, discover, and access academic notes securely using a **Node.js + Express backend**, **MongoDB**, and **IPFS via Pinata**.

**🌐 Live Demo:** [https://denote-nu.vercel.app](https://denote-nu.vercel.app)  
**📡 Backend API:** [https://denote-igao.onrender.com](https://denote-igao.onrender.com)

---

## 🚀 Features
- User authentication using **JWT**
- Upload and store notes via **IPFS (Pinata)**
- Metadata stored in **MongoDB**
- Secure backend with environment-based configuration
- **Decentralized Storage** - Notes are permanently pinned to IPFS through Pinata
- **Smart Discovery System** - Find notes based on community ratings and popularity
- **Rating System** - Users can rate notes to identify quality material
- **PDF Preview** - View notes directly using IPFS gateway links

---

## 🛠 Tech Stack
- **Backend:** Node.js, Express 4.18.2
- **Frontend:** React 18, Vite 5
- **Database:** MongoDB Atlas
- **Storage:** IPFS (Pinata)
- **Auth:** JSON Web Tokens (JWT)
- **Deployment:** Vercel (Frontend) + Render (Backend)

---

## ⚙️ Environment Variables

### Backend (`config.env`)
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
PINATA=your_pinata_jwt_token
NODE_ENV=production
PORT=5000
```

### Frontend (`.env`)
```env
VITE_API_BASE_URL=https://denote-igao.onrender.com
```

---

## ▶️ Run Locally

### Backend
```bash
npm install
npm start
```
Server runs on `http://localhost:5000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

---

## 🚀 Production Deployment

### Deploy Backend to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Add the variables from `config.env.example`
4. Deploy!

### Deploy Frontend to Vercel

1. Import project on [Vercel](https://vercel.com)
2. Set **Root Directory:** `frontend`
3. **Framework Preset:** Vite
4. Add environment variable:
   - `VITE_API_BASE_URL` = Your Render backend URL
5. Deploy!

### MongoDB Atlas Setup

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Go to **Network Access** → Add IP: `0.0.0.0/0` (allow from anywhere)
3. Get connection string and add to `MONGO_URI`

---

## 📁 Project Structure

```
DeNote/
├── app.js                 # Express server entry point
├── db.js                  # MongoDB connection
├── package.json           # Backend dependencies
├── config.env             # Backend environment variables (gitignored)
├── models/
│   ├── user.js           # User schema
│   └── note.js           # Note schema
├── routes/
│   └── noteRoute.js      # API routes
├── middleware/
│   └── jwt.js            # JWT authentication middleware
└── frontend/
    ├── src/
    │   ├── App.jsx       # Main React component
    │   ├── api.js        # Axios API configuration
    │   └── components/   # React components
    ├── package.json      # Frontend dependencies
    ├── vite.config.js    # Vite configuration
    └── vercel.json       # Vercel routing configuration
```

---

## �� Security Note
- Secrets and credentials are managed using environment variables
- The `config.env` file is included in `.gitignore`
- Never commit sensitive data to the repository
- Use MongoDB Atlas IP whitelist for production
- CORS is configured to accept requests only from allowed origins

---

## 🐛 Troubleshooting

### Frontend 404 on Refresh
- Ensure `vercel.json` exists in the frontend directory
- It rewrites all routes to `index.html` for client-side routing

### CORS Errors
- Check that `VITE_API_BASE_URL` is set correctly on Vercel
- Verify backend CORS allows your Vercel domain in `app.js`

### Backend Won't Start on Render
- Verify all environment variables are set in Render dashboard
- Check MongoDB Atlas allows connections from 0.0.0.0/0
- Review Render logs for specific error messages

---

## 📄 License
Open-source project for learning and educational purposes.

---

## 👥 Contributing
Contributions, issues, and feature requests are welcome!

---

## 🙏 Acknowledgments
- **IPFS/Pinata** for decentralized storage
- **MongoDB Atlas** for cloud database
- **Render** and **Vercel** for free hosting
