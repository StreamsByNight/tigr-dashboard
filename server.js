const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const app = express();

// --- CONFIGURATION ---
const CANVAS_URL = process.env.CANVAS_URL || "https://stridek12learning.org";
const CLIENT_ID = process.env.CLIENT_ID || "10000000000004";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "UXF6XMuf8mEPRwyUC6kfBHxPxKtc4yH96wrtvcfG6CMFUDLVtAMR893yGxKK62m2";

// This logic ensures localhost is used unless Render tells it otherwise
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3000/api/auth/callback";
const PORT = process.env.PORT || 3000;

app.use(session({
    secret: 'tigr-secret-key-12345',
    resave: false,
    saveUninitialized: true,
    // Change to 'true' only when you are live on Render (HTTPS)
    cookie: { secure: false } 
}));

app.use(express.static('public')); 

// 1. Start Login
app.get('/api/auth/canvas', (req, res) => {
    // We encode this to ensure the special characters in the URL don't break the link
    const encodedRedirect = encodeURIComponent(REDIRECT_URI);
    const authUrl = `${CANVAS_URL}/login/oauth2/auth?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodedRedirect}`;
    
    console.log("Sending user to Canvas. Expected return to:", REDIRECT_URI);
    res.redirect(authUrl);
});

// 2. Auth Callback
app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided by Canvas");

    try {
        const response = await axios.post(`${CANVAS_URL}/login/oauth2/token`, {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI, // Must match the one sent in step 1 exactly
            code: code
        });
        
        req.session.token = response.data.access_token;
        console.log("Login successful! Token received.");
        res.redirect('/'); 
    } catch (error) {
        console.error("Auth Error details:", error.response?.data || error.message);
        res.status(500).send("Authentication Failed. Check your terminal for the error details.");
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

// 4. Logout
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`--- TIGR DASHBOARD STARTING ---`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`Redirecting Canvas back to: ${REDIRECT_URI}`);
});