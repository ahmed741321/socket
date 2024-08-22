const express = require('express');
const path = require('path');
const sockjs = require('sockjs');

// إعداد التطبيق
const app = express();
const port = 3000;

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// تقديم صفحة HTML عند زيارة '/'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// إعداد خادم SockJS
const sockjsOptions = {
    prefix: '/sockjs',
};

const echo = sockjs.createServer(sockjsOptions);

echo.on('connection', function (conn) {
    console.log('Client connected');

    conn.on('data', function (message) {
        console.log('Received:', message);

        // إعادة إرسال الرسالة إلى جميع العملاء المتصلين
        echo.clients.forEach(function (client) {
            if (client !== conn) {
                client.write(message);
            }
        });
    });

    conn.on('close', function () {
        console.log('Client disconnected');
    });
});

const server = app.listen(port, () => {
    console.log(`Server running on http://your-domain.com:${port}`);
});

echo.installHandlers(server);
