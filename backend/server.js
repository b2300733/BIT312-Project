require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./config');

const app = express();

// Allow dynamic origin or same-origin requests in cloud deployment
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/activities', require('./routes/activities.route'));
app.use('/api/registrations', require('./routes/registrations.route'));
app.use('/api/users', require('./routes/users.route'));
app.use('/api/reminders', require('./routes/reminders.route'));

// Health check endpoint (useful later for AWS ALB Target Groups)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Serve Angular compiled static files (Angular 21 outputs to dist/<project>/browser)
const angularDistPath = path.join(__dirname, '../dist/BIT210-Service-Day-Dashboard/browser');
app.use(express.static(angularDistPath));

// Fallback all non-API routes to Angular index.csr.html (in /dist) for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(angularDistPath, 'index.csr.html'));
});

// Verify RDS MySQL connection on startup
db.getConnection()
  .then((conn) => {
    console.log('Connected to RDS MySQL database successfully');
    conn.release();
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
  });

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Monolithic Server is running on port ${PORT}`);
});
