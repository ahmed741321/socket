const express = require('express');
const path = require('path');
const sockjs = require('sockjs');

const app = express();
const port = 3000;

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// تقديم صفحة HTML عند زيارة '/'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// إعداد خادم SockJS
const echo = sockjs.createServer({
    prefix: '/sockjs',
    // لا حاجة لتحديد رقم المنفذ هنا لأننا سنقوم بإعداد السيرفر الرئيسي للسماح بـ SockJS على نفس المنفذ
});

let clients = [];

echo.on('connection', function (conn) {
    console.log('Client connected');
    clients.push(conn);

    // إرسال إشعار لجميع العملاء عند اتصال عميل جديد
    const joinMessage = JSON.stringify({
        username: 'Server',
        text: 'A new user has joined the chat.',
    });

    clients.forEach(client => {
        if (client !== conn) {
            client.write(joinMessage);
        }
    });

    conn.on('data', function (message) {
        //console.log('Received:', message);
        // إعادة إرسال الرسالة إلى جميع العملاء المتصلين
        clients.forEach(client => {
            if (client !== conn) {
                client.write(message);
            }
        });
    });

    conn.on('close', function () {
        console.log('Client disconnected');
        // إزالة العميل من قائمة العملاء
        clients = clients.filter(client => client !== conn);

        // إرسال إشعار لجميع العملاء عند مغادرة عميل
        const leaveMessage = JSON.stringify({
            username: 'Server',
            text: 'A user has left the chat.',
        });

        clients.forEach(client => {
            client.write(leaveMessage);
        });
    });
});

const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

echo.installHandlers(server);
