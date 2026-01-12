const express=require('express');
const morgan=require('morgan');
const dotenv=require('dotenv');
const connectDB=require('./db');
const cors=require('cors');
const app=express();
const colors=require('colors');

// Load environment variables first
dotenv.config({
    path:'./config.env'
});

// CORS configuration - allows requests from frontend
const allowedOrigins = [
    'https://denote-nu.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
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
app.use(morgan('dev'))

app.use(express.json({}));
app.use(express.urlencoded({extended:false}));

// Handle OPTIONS preflight requests
app.options('*', cors(corsOptions));

connectDB(); 


app.use('/api/denote' , require('./routes/noteRoute'));
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`.green.underline.bold);
});