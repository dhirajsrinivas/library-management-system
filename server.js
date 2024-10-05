// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const app = express();

// Set up the PostgreSQL pool
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'library2',
    password: 'Bda@2027',
    port: 5432,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public')); // for serving static files like CSS
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,  // Connect to your PostgreSQL pool
        tableName: 'session' // Ensure this table exists
    }),
    secret: 'your-secret-key', // Use a strong, unique secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }  // Set to true if using HTTPS
}));

// Route for home
app.get('/', (req, res) => {
    res.redirect('/home'); // Redirect to /home
});

// Route for home page
app.get("/home", (req, res) => {
    res.render("home");
});


// Route for home
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/books');
    } else {
        res.redirect('/login');
    }
});

app.get("/logout",(req,res)=>{
    res.render("home")
})

// Route for login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        return res.redirect('/books');
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

// Route for registration page
app.get('/register', (req, res) => {
    res.render('register');
});

// Handle user registration
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', 
            [username, hashedPassword, role]);
        res.redirect('/login'); // Redirect to login after registration
    } catch (err) {
        console.error(err);
        res.status(500).send('Error registering user.');
    }
});

// Route to display books (CRUD operations for librarians)
app.get('/books', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const result = await pool.query('SELECT * FROM books');
    res.render('books', { books: result.rows, user: req.session.user });
});


// Route to add a new book (for librarians only)
app.post('/books', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'librarian') {
        return res.status(403).send('Forbidden');
    }

    const { title, author, isbn, publishedDate, genre } = req.body;
    await pool.query('INSERT INTO books (title, author, isbn, published_date, genre) VALUES ($1, $2, $3, $4, $5)', 
        [title, author, isbn, publishedDate, genre]);
    res.redirect('/books');
});

// Route to delete a book (for librarians only)
app.post('/books/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'librarian') {
        return res.status(403).send('Forbidden');
    }

    const id = req.params.id;
    await pool.query('DELETE FROM books WHERE id = $1', [id]);
    res.redirect('/books');
});

// Route to log out
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/books');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
