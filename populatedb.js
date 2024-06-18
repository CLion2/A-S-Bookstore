// populatedb.js

const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

// Placeholder for the database file name
const dbFileName = 'bookstore.db';

async function initializeDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT NOT NULL UNIQUE,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS likes (
            userId INTEGER NOT NULL,
            postId INTEGER NOT NULL,
            PRIMARY KEY (userId, postId),
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (postId) REFERENCES posts(id)
        );

        CREATE TABLE IF NOT EXISTS post_cover_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT UNIQUE,
            coverImageUrl TEXT
        );
    `);

    // Sample data - Replace these arrays with your own data
    const users = [
        { username: 'Soma', hashedGoogleId: 'hashedGoogleId1', avatar_url: '', memberSince: '2024-01-01 12:00:00' },
        { username: 'Alex', hashedGoogleId: 'hashedGoogleId2', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Emily', hashedGoogleId: 'hashedGoogleId3', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'John', hashedGoogleId: 'hashedGoogleId4', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Sophia', hashedGoogleId: 'hashedGoogleId5', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Michael', hashedGoogleId: 'hashedGoogleId6', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Oliver', hashedGoogleId: 'hashedGoogleId7', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Lily', hashedGoogleId: 'hashedGoogleId8', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'James', hashedGoogleId: 'hashedGoogleId9', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Amelia', hashedGoogleId: 'hashedGoogleId10', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Ethan', hashedGoogleId: 'hashedGoogleId11', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Isabella', hashedGoogleId: 'hashedGoogleId12', avatar_url: '', memberSince: '2024-01-02 12:00:00' },
        { username: 'Liam', hashedGoogleId: 'hashedGoogleId13', avatar_url: '', memberSince: '2024-01-02 12:00:00' }
    ];

    const posts = [
        { title: 'Frankenstein: the 1818 Text', content: 'I read this book in English class with my friends, and I always got excited when I picked it up. An interesting tale that resonnates through the ages.', username: 'Alex', timestamp: '2024-01-01 12:30:00', likes: 0 },
        { title: 'And The Mountains Echoed', content: 'This is my favorite book. One of the the first books I read in English. I highly recommend, and it will maky you very emotional!', username: 'Soma', timestamp: '2024-01-02 12:30:00', likes: 0 },
        {
            title: 'Pride and Prejudice',
            content: 'A classic novel with wit and romance. The characters are timeless, and the social commentary is still relevant today.',
            username: 'Emily',
            timestamp: '2024-02-14 15:45:00',
            likes: 5
        },
        {
            title: '1984',
            content: 'A thought-provoking and chilling dystopian novel. It’s a warning of what could happen when power is left unchecked.',
            username: 'John',
            timestamp: '2024-03-22 09:20:00',
            likes: 12
        },
        {
            title: 'To Kill a Mockingbird',
            content: 'An impactful story about justice and morality. It explores deep themes and evokes a strong sense of empathy.',
            username: 'Sophia',
            timestamp: '2024-04-10 18:30:00',
            likes: 7
        },
        {
            title: 'The Great Gatsby',
            content: 'A beautifully written tragedy about the American Dream. The imagery and symbolism make it a powerful read.',
            username: 'Michael',
            timestamp: '2024-05-05 11:00:00',
            likes: 3
        },
        {
            title: 'Moby-Dick',
            content: 'An epic tale of obsession and revenge. The narrative is complex and rich with symbolism.',
            username: 'Oliver',
            timestamp: '2024-06-15 08:50:00',
            likes: 8
        },
        {
            title: 'Jane Eyre',
            content: 'A gripping novel with strong characters and a deeply emotional story. The journey of the protagonist is inspiring.',
            username: 'Lily',
            timestamp: '2024-07-21 14:35:00',
            likes: 4
        },
        {
            title: 'The Catcher in the Rye',
            content: 'A raw and honest portrayal of teenage angst and rebellion. It captures the complexities of adolescence perfectly.',
            username: 'James',
            timestamp: '2024-08-10 17:20:00',
            likes: 6
        },
        {
            title: 'Brave New World',
            content: 'A haunting vision of a controlled, conformist society. The themes of freedom and individuality are thought-provoking.',
            username: 'Amelia',
            timestamp: '2024-09-03 10:45:00',
            likes: 10
        },
        {
            title: 'The Hobbit',
            content: 'A delightful adventure with rich world-building and memorable characters. It’s a timeless tale of courage and friendship.',
            username: 'Ethan',
            timestamp: '2024-10-27 19:15:00',
            likes: 11
        },
        {
            title: 'Crime and Punishment',
            content: 'A profound exploration of morality and redemption. The psychological depth of the characters is remarkable.',
            username: 'Isabella',
            timestamp: '2024-11-12 13:25:00',
            likes: 9
        },
        {
            title: 'Wuthering Heights',
            content: 'A dark and passionate story of love and revenge. The atmosphere and characters are intensely compelling.',
            username: 'Liam',
            timestamp: '2024-12-05 07:30:00',
            likes: 5
        }
    ];

    // Insert sample data into the database
    await Promise.all(users.map(user => {
        return db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
        );
    }));

    await Promise.all(posts.map(post => {
        return db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
            [post.title, post.content, post.username, post.timestamp, post.likes]
        );
    }));

    console.log('Database populated with initial data.');
    await db.close();
}

initializeDB().catch(err => {
    console.error('Error initializing database:', err);
});