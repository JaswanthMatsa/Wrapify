const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const querystring = require('querystring');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    spotifyId: String,
    displayName: String,
    email: String,
    accessToken: String,
    refreshToken: String,
    wrappedHistory: [
        {
            month: Number,
            year: Number,
            term: String,
            createdAt: { type: Date, default: Date.now },
            stats: Object
        }
    ]
});

const User = mongoose.model('User', userSchema);

// Spotify Config
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5000/auth/callback';
console.log('Using Redirect URI:', REDIRECT_URI);

// Auth Routes
app.get('/auth/login', (req, res) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).send('<h1>Configuration Error</h1><p>Spotify Client ID or Secret is missing in <code>server/.env</code>. Please follow the setup instructions in the walkthrough.</p>');
    }
    const scope = 'user-read-private user-read-email user-top-read user-read-recently-played';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            show_dialog: true
        }));
});

app.get('/auth/callback', async (req, res) => {
    const code = req.query.code || null;

    try {
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        // Get User Info from Spotify
        const userResponse = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': 'Bearer ' + access_token }
        });

        const { id, display_name, email } = userResponse.data;

        // Save or update user in DB
        let user = await User.findOne({ spotifyId: id });
        if (!user) {
            user = new User({
                spotifyId: id,
                displayName: display_name,
                email: email,
                accessToken: access_token,
                refreshToken: refresh_token
            });
        } else {
            user.accessToken = access_token;
            user.refreshToken = refresh_token;
        }
        await user.save();

        // Generate JWT
        const token = jwt.sign({ id: user._id, spotifyId: id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Redirect to frontend with token
        res.redirect(`http://127.0.0.1:5173/login-success?token=${token}`);

    } catch (error) {
        console.error('Error in Spotify callback:', error.response?.data || error.message);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Stats Route (The Analytics Engine)
app.get('/stats', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const term = req.query.term || 'medium_term'; // short_term, medium_term, long_term

        // 1. Fetch Top Artists & Tracks
        const [topArtistsRes, topTracksRes, recentlyPlayedRes] = await Promise.all([
            axios.get(`https://api.spotify.com/v1/me/top/artists?time_range=${term}&limit=20`, {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            }),
            axios.get(`https://api.spotify.com/v1/me/top/tracks?time_range=${term}&limit=20`, {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            }),
            axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            })
        ]);

        const topArtists = topArtistsRes.data.items;
        const topTracks = topTracksRes.data.items;
        const recentlyPlayed = recentlyPlayedRes.data.items;

        // 2. Calculate Analytics

        // Genre Breakdown
        const genreMap = {};
        topArtists.forEach(artist => {
            if (artist.genres) {
                artist.genres.forEach(genre => {
                    genreMap[genre] = (genreMap[genre] || 0) + 1;
                });
            }
        });
        const sortedGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]);

        // Listening Minutes Estimation
        // We'll estimate based on average track length * recent activity
        const averageTrackLengthMs = 180000; // 3 mins
        const estimatedMinutes = 15000 + Math.floor(Math.random() * 20000); // Mock for MVP, real would need history

        // Personality Logic
        let personality = "Balanced Listener";
        const uniqueGenres = Object.keys(genreMap).length;

        if (uniqueGenres > 15) personality = "Explorer";
        else if (sortedGenres[0] && sortedGenres[0][1] > topArtists.length * 0.4) personality = "Loyal Fan";
        else if (estimatedMinutes > 25000) personality = "Deep Diver";
        else personality = "Vibe Curator";

        const stats = {
            minutes: estimatedMinutes,
            topArtists: topArtists.slice(0, 5).map(a => ({ name: a.name, image: a.images[0]?.url })),
            topTracks: topTracks.slice(0, 5).map(t => ({ name: t.name, artist: t.artists[0].name })),
            topGenres: sortedGenres.slice(0, 3).map(g => g[0]),
            personality
        };

        // Save history (Avoid duplicates for same month/year/term)
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const existingEntryIndex = user.wrappedHistory.findIndex(
            h => h.month === month && h.year === year && h.term === term
        );

        if (existingEntryIndex > -1) {
            user.wrappedHistory[existingEntryIndex].stats = stats;
            user.wrappedHistory[existingEntryIndex].createdAt = now;
        } else {
            user.wrappedHistory.push({
                month,
                year,
                term,
                stats,
                createdAt: now
            });
        }

        await user.save();

        res.json(stats);

    } catch (error) {
        console.error('Error fetching stats:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Spotify stats' });
    }
});

// History Route
app.get('/history', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Sort by date descending
        const history = user.wrappedHistory.sort((a, b) => b.createdAt - a.createdAt);
        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error.message);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
