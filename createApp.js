const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const { generalLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * Build the Express app (no DB connect / listen). Used by server start and tests.
 */
function createApp() {
    const app = express();

    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    }));

    const allowedOrigins = [
        'https://denote-nu.vercel.app',
        'https://de-note-theta.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174'
    ];

    const extraOrigins = String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    for (const o of extraOrigins) {
        if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
    }

    const corsOptions = {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                console.log('Blocked by CORS:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 200
    };

    app.use(cors(corsOptions));
    if (process.env.NODE_ENV !== 'test') {
        app.use(morgan('dev'));
    }

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.options('*', cors(corsOptions));

    app.get('/health', (req, res) => {
        res.status(200).json({
            success: true,
            status: 'ok',
            service: 'denote',
            timestamp: new Date().toISOString()
        });
    });

    app.use('/api/denote', generalLimiter);
    app.use('/api/denote/collections', require('./routes/collectionRoute'));
    app.use('/api/denote', require('./routes/communityRoute'));
    app.use('/api/denote', require('./routes/adminRoute'));
    app.use('/api/denote', require('./routes/aiRoute'));
    app.use('/api/denote', require('./routes/noteRoute'));

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
