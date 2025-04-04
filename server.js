const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();

// Sample user data (in a real app, this would be in a database)
const users = [
    {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        // Plain password for testing only
        password: 'admin123'
    },
    {
        id: 2,
        username: 'test',
        email: 'test@example.com',
        // Plain password for testing only
        password: 'test123'
    }
];

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: true, 
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Enable session debugging
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
    console.log('Login request received:', req.body);
    const { username, password } = req.body;
    
    console.log('Login attempt:', username, 'Password:', password);
    
    // Find user
    const user = users.find(u => u.username === username);
    
    if (!user) {
        console.log('User not found:', username);
        return res.redirect('/login?error=invalid_credentials');
    }
    
    console.log('User found:', user.username, 'Stored password:', user.password);
    
    // Compare password directly (for testing only - in production use bcrypt)
    if (password === user.password) {
        console.log('Password match successful for:', username);
        
        // Force regenerate the session to ensure clean state
        req.session.regenerate(function(err) {
            if (err) {
                console.error('Error regenerating session:', err);
                return res.redirect('/login?error=server');
            }
            
            // Store user in session (without password)
            req.session.user = { id: user.id, username: user.username };
            
            // Save session explicitly before redirect
            req.session.save(function(err) {
                if (err) {
                    console.error('Error saving session:', err);
                    return res.redirect('/login?error=server');
                }
                console.log('Session saved successfully:', req.session);
                return res.redirect('/');
            });
        });
    } else {
        console.log('Password match failed for:', username);
        return res.redirect('/login?error=invalid_credentials');
    }
});

// Register new user
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !password) {
        return res.redirect('/login?error=empty_fields');
    }
    
    // Check if username already exists
    if (users.some(u => u.username === username)) {
        return res.redirect('/login?error=user_exists');
    }
    
    // Check if email already exists (if provided)
    if (email && users.some(u => u.email === email)) {
        return res.redirect('/login?error=user_exists');
    }
    
    try {
        // Create new user with plain password for testing
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: password // In production, use bcrypt to hash password
        };
        
        // Add user to array (in a real app, this would be saved to a database)
        users.push(newUser);
        
        // Regenerate session for clean state
        req.session.regenerate(function(err) {
            if (err) {
                console.error('Error regenerating session:', err);
                return res.redirect('/login?error=server');
            }
            
            // Store user data in new session
            req.session.user = { id: newUser.id, username: newUser.username };
            
            // Save session explicitly before redirect
            req.session.save(function(err) {
                if (err) {
                    console.error('Error saving session:', err);
                    return res.redirect('/login?error=server');
                }
                console.log('Session saved after registration:', req.session);
                return res.redirect('/');
            });
        });
    } catch (err) {
        console.error(err);
        return res.redirect('/login?error=server');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/login');
    });
});

// Unified root route
app.get('/', (req, res) => {
    console.log('User accessing root page:', req.session);
    if (req.session && req.session.user) {
        console.log('User is authenticated, serving index.html');
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        console.log('User is not authenticated, redirecting to login');
        res.redirect('/login');
    }
});

// API to check if user is logged in
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        return res.json({ authenticated: true, user: req.session.user });
    }
    res.json({ authenticated: false });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});