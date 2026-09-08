const dotenv = require('dotenv');
const colors = require('colors');
const connectDB = require('./db');
const { createApp } = require('./createApp');

// Load environment variables first
// In production (Render), env vars are set in dashboard, not config.env
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    dotenv.config({
        path: './config.env'
    });
}

const app = createApp();

if (require.main === module) {
    connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`server is running on port ${PORT}`.green.underline.bold);
    });
}

module.exports = app;
