const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const app = express();

// --- CONFIGURATION ---
const CANVAS_URL = process.env.CANVAS_URL || "https://stridek12learning.org";
const CLIENT_ID = process.env.CLIENT_ID || "10000000000004";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "UXF6XMuf8mEPRwyUC6kfBHxPxKtc4yH96wrtvcfG6CMFUDLVtAMR893yGxKK62m2";

// Ensures the path is ALWAYS included correctly
const BASE_URL = process.env.REDIRECT_URI || "https://tigr-dashboard.onrender.com";
const REDIRECT_URI = BASE_URL.includes('/api/auth/callback') ? BASE_URL : `${BASE_URL.replace(/\/$/, "")}/api/auth/callback`;

const PORT = process.env.PORT || 3000;

app.use(session({
    secret: 'tigr-secret-key-12345',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: true, // Required for Render/HTTPS
        sameSite: 'none' // Required for Canvas redirects
    } 
}));

app.use(express.static('public')); 

// 1. Start Login
app.get('/api/auth/canvas', (req, res) => {
    const authUrl = `${CANVAS_URL}/login/oauth2/auth?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.redirect(authUrl);
});

// 2. Auth Callback
app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
        const response = await axios.post(`${CANVAS_URL}/login/oauth2/token`, {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            code: code
        });
        
        req.session.token = response.data.access_token;
        // This log helps us see success in Render
        console.log("Token successfully created for user!"); 
        res.redirect('/'); 
    } catch (error) {
        // This log is critical for debugging the loop
        console.error("CANVAS TOKEN ERROR:", error.response?.data || error.message);
        res.status(500).send("Login failed. Check Render logs for details.");
    }
});

// 3. Get Data
app.get('/api/assignments', async (req, res) => {
    if (!req.session.token) return res.status(401).json({ error: "Not logged in" });

    try {
        const headers = { Authorization: `Bearer ${req.session.token}` };
        const [courses, planner] = await Promise.all([
            axios.get(`${CANVAS_URL}/api/v1/courses?include[]=enrollments&per_page=12`, { headers }),
            axios.get(`${CANVAS_URL}/api/v1/planner/items`, { headers })
        ]);

        res.json({
            courses: courses.data.filter(c => c.name), 
            planner: planner.data
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch Canvas data" });
    }
});

app.listen(PORT, () => console.log(`Dashboard live at ${REDIRECT_URI}`));
