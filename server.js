const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const passport = require('passport');
const { get } = require('http');
// const { profile } = require('console');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const emojiAccessToken = process.env.EMOJI_API_KEY;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;
const dbFileName = 'bookstore.db';  
let db;

async function initializeDB() {
    db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });
    console.log('Connected to the database.');
}

// Function to close the database connection
async function closeDatabase() {
    if (db) {
        await db.close();
        console.log('Database connection closed.');
    }
}

// Configure passport
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, (token, tokenSecret, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
            limit: function (arr, limit) {
                if (!Array.isArray(arr)) { return []; }
                return arr.slice(0, limit);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'A&S Bookstore';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.get('/auth/google', passport.authenticate('google', { scope: ['profile']}));

app.get('/auth/google/callback', passport.authenticate('google', {
    scope: ['profile'],
    failureRedirect: '/login'
  }), async (req, res) => {
        const hashedGoogleId = crypto.createHash('sha256').update(req.user.id).digest('hex');
        req.session.hashedGoogleId = hashedGoogleId;
        let user = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', hashedGoogleId);
        if(user){
            req.session.loggedIn = true;
            req.session.userId = user.id;
            res.redirect('/');
        }
        else{
            res.redirect('/registerUsername');
        }
    }
);

app.get('/registerUsername', 
    (req, res) => {
        res.render('registerUsername', { regError: req.query.error });
    }
);

app.post('/registerUsername', 
    async (req, res) => {
        const username = req.body.username;
        //hash(username);  // Example hash function
        const avatar_url = `http://localhost:${PORT}/avatar/${username}`;
        const memberSince = new Date().toISOString();
    
        if (await findUserByUsername(username)) {
            res.redirect('/registerUsername?error=Username+already+exists');
        } else if (username == undefined || username.length < 6) {
            res.redirect('/registerUsername?error=6+Character+Minimum+Name+Length');
        } else {
            await addUser(username, req.session.hashedGoogleId, avatar_url, memberSince);
            let user = await findUserByUsername(username);
            req.session.loggedIn = true;
            req.session.userId = user.id;
            res.redirect('/');
        }
    }
);

app.get('/logout', (req, res) =>{
    req.session.destroy();
    res.redirect('/googleLogout');
});

app.get('/googleLogout', (req, res) => {
    res.render('googleLogout');
});

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//

app.get('/', async (req, res) => {
    const posts = await getPosts();
    const user = await getCurrentUser(req) || {};

    for (let post of posts) {
        try {
            const cachedImage = await getCachedImage(post.title);
            if (cachedImage) {
                post.coverImageUrl = cachedImage.coverImageUrl;
            } else {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(post.title)}`);
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    post.coverImageUrl = data.items[0].volumeInfo.imageLinks.thumbnail;
                    await cacheImage(post.title, post.coverImageUrl);
                } else {
                    post.coverImageUrl = ''; // No cover image found
                }
            }
        } catch (error) {
            post.coverImageUrl = ''; // Error fetching cover image
        }
    }
    res.render('home', { posts, user });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

//async function addPost(title, content, username, timestamp, likes)
app.post('/posts', isAuthenticated, async (req, res) => {
    // TODO: Add a new post and redirect to home
    const currentUser = await getCurrentUser(req);
    const timestamp = new Date().toISOString();
    await addPost(req.body.title, req.body.content, currentUser.username, timestamp, 0);
    res.redirect('/');
});
app.post('/like/:id', isAuthenticated, async (req, res) => {
    // TODO: Update post likes
    console.log("like post");
    await updatePostLikes(req, res);
});
app.get('/profile', isAuthenticated, async (req, res) => {
    // TODO: Render profile page
    await renderProfile(req, res);
});

app.get('/books', async (req, res) => {
    try {
        const response = await fetch(`http://localhost:${PORT}/api/book-covers/harry-potter`);
        const data = await response.json();
        res.render('books', { coverImages: data.coverImages });
    } catch (error) {
        res.render('books', { error: 'Failed to load cover images' });
    }
});

app.get('/posts/books/:bookname', async (req, res) => {
    let title = req.params.bookname;
    title = title.replace(/\s/g, "%20");
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${title}`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const coverImages = data.items.map(item => item.volumeInfo.imageLinks.thumbnail);
            console.log(coverImages[0]);
            res.status(200).json(coverImages[0]);
        } else {
            res.status(404).json({ error: 'No cover images found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cover images' });
    }
});

app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    handleAvatar(req, res);
});

app.post('/register', async (req, res) => {
    const username = req.body.username;
    const hashedGoogleId = crypto.createHash('sha256').update(username).digest('hex');
    //hash(username);  // Example hash function
    const avatar_url = `http://localhost:${PORT}/avatar/${username}`;
    const memberSince = new Date().toISOString();

    if (await findUserByUsername(username)) {
        res.redirect('/register?error=Username+already+exists');
    } else if (username == undefined || username.length < 6) {
        res.redirect('/register?error=6+Character+Minimum+Name+Length');
    } else {
        await addUser(username, hashedGoogleId, avatar_url, memberSince);
        res.redirect('/login');
    }
});

app.post('/login', async (req, res) => {
    const username = req.user.displayName;
    const user = await findUserByUsername(username);
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=Invalid+username');
    }
});


app.post('/delete/:id', isAuthenticated, async (req, res) => {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', req.params.id);
    const user = await getCurrentUser(req);
    if (post.username === user.username) {
        await db.run('DELETE FROM posts WHERE id = ?', req.params.id);
    }
    res.redirect('/');
});

app.get('/api/book-covers/harry-potter', async (req, res) => {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:Harry%20Potter`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const coverImages = data.items.map(item => item.volumeInfo.imageLinks.thumbnail);
            res.json({ coverImages });
        } else {
            res.status(404).json({ error: 'No cover images found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cover images' });
    }
});

app.get('/api/emojis', async (req, res) => {
    try {
        const response = await fetch(`https://emoji-api.com/emojis?access_key=${emojiAccessToken}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch emojis' });
    }
});


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });
// Ensure the database is initialized before starting the server.
initializeDB().then(() => {
    console.log('Database initialized. Server starting...');
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}).catch(err => {
    console.error('Failed to initialize the database:', err);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received.');
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received.');
    await closeDatabase();
    process.exit(0);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


// Function to find a user by username (using sqlite)
async function findUserByUsername(username) {
    const user = await db.get('SELECT * FROM users WHERE username = ?', username);
    return user;
}

// Function to find a user by user ID (using sqlite)
async function findUserById(userId) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    return user;
}


// Function to add a new user (using sqlite)
async function addUser(username, hashedGoogleId, avatar_url, memberSince) {
    await db.run('INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)', 
                 username, hashedGoogleId, avatar_url, memberSince);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}


// Function to render the profile page (using sqlite)
async function renderProfile(req, res) {
    const user = await getCurrentUser(req);
    if(user){
        const userPosts = await db.all('SELECT * FROM posts WHERE username = ?', user.username);
        for (let post of userPosts) {
            try {
                const cachedImage = await getCachedImage(post.title);
                if (cachedImage) {
                    post.coverImageUrl = cachedImage.coverImageUrl;
                } else {
                    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(post.title)}`);
                    const data = await response.json();
                    if (data.items && data.items.length > 0) {
                        post.coverImageUrl = data.items[0].volumeInfo.imageLinks.thumbnail;
                        await cacheImage(post.title, post.coverImageUrl);
                    } else {
                        post.coverImageUrl = ''; // No cover image found
                    }
                }
            } catch (error) {
                post.coverImageUrl = ''; // Error fetching cover image
            }
        }
        user.posts = userPosts;
        res.render('profile', { user });
    } else{
        res.redirect('/auth/google')
    }
}

// Function to update post likes (using sqlite)
async function updatePostLikes(req, res) {
    const userId = req.session.userId;
    const postId = req.params.id;
    const usernameFromUsers = await db.get('SELECT username FROM users WHERE id = ?', userId);
    const usernameFromPosts = await db.get('SELECT username FROM posts WHERE id = ?', postId);
    console.log(usernameFromUsers, " ", usernameFromPosts);
    
    const existingLike = await db.get('SELECT * FROM likes WHERE userId = ? AND postId = ?', userId, postId);
    console.log(existingLike, " ", userId, " ", postId);
    if ((usernameFromUsers.username != usernameFromPosts.username) && (!existingLike)) {
        await db.run('INSERT INTO likes (userId, postId) VALUES (?, ?)', userId, postId);
        await db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', postId);
    }
    res.status(200).redirect('/');
}
    

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    let username = req.params.username;
    let buffer = generateAvatar(username[0]);
    let user = findUserByUsername(username);

    res.status(200).send(buffer);
}

// Function to get the current user from session (using sqlite)
async function getCurrentUser(req) {
    return await findUserById(req.session.userId);
}


// Function to get all posts, sorted by latest first (using sqlite)
async function getPosts() {
    const allPosts = await db.all('SELECT * FROM posts ORDER BY timestamp DESC');
    return allPosts;
}

// Function to get cached image from the database
async function getCachedImage(title) {
    return await db.get('SELECT coverImageUrl FROM post_cover_images WHERE title = ?', [title]);
}

// Function to cache the image in the database
async function cacheImage(title, coverImageUrl) {
    await db.run('INSERT OR REPLACE INTO post_cover_images (title, coverImageUrl) VALUES (?, ?)', [title, coverImageUrl]);
}

// Function to add a new post (using sqlite)
async function addPost(title, content, username, timestamp, likes) {
    await db.run('INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)', 
                 title, content, username, timestamp, likes);
}


// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#33FFF2', '#FF8C33', '#8C33FF', '#F2FF33'];
    if(!letter){
        letter = '!';
    }
    const index = letter.toUpperCase().charCodeAt(0) % colors.length;
    // 2. Create a canvas with the specified width and height
    const c = canvas.createCanvas(width, height);
    const ctx = c.getContext('2d');
    // 3. Draw the background color
    ctx.fillStyle = colors[index];
    ctx.fillRect(0, 0, width, height);
    // 4. Draw the letter in the center
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${Math.floor(width / 2)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);
    // 5. Return the avatar as a PNG buffer
    return c.toBuffer('image/png');
}