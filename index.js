const express = require('express');
const path = require('path');
const sockjs = require('sockjs');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SockJS server setup
const websocket = sockjs.createServer({
    prefix: '/sockjs',
});

let clients = {}; // clientId -> connection
let contacts = []; // List of contact names (in a real scenario, this might be more dynamic)

// Handle WebSocket connections
// Handle WebSocket connections
websocket.on('connection', function (conn) {
    console.log('Client connected');
    let clientId = null;

    conn.on('data', function (message) {
        const data = JSON.parse(message);

        if (data.type === 'identify') {
            clientId = data.clientId;
            clients[clientId] = conn;
            console.log(`Client identified as ${clientId}`);

            // Update the contact list with the new client
            contacts.push(clientId);
            broadcastContacts(); // Notify all clients of the updated contact list
        } else if (data.type === 'get_contacts') {
            // Send the contact list to the connected client
            conn.write(JSON.stringify({
                type: 'contacts',
                contacts: contacts
            }));
        } else if (data.type === 'message') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: 'message',
                    from: clientId,
                    text: data.text
                }));
            }
        } else if (data.type === 'call_request' || data.type === 'video_call_request') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: data.type,
                    from: clientId
                }));
            }
        } else if (data.type === 'call_accept' || data.type === 'video_call_accept' || data.type === 'call_reject') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: data.type,
                    from: clientId
                }));
            }
        } else if (data.type === 'ice_candidate') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: 'ice_candidate',
                    candidate: data.candidate
                }));
            }
        } else if (data.type === 'offer') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: 'offer',
                    from: clientId,
                    offer: data.offer,
                    isVideo: data.isVideo
                }));
            }
        } else if (data.type === 'answer') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: 'answer',
                    from: clientId,
                    answer: data.answer
                }));
            }
        } else if (data.type === 'call_ended') {
            const targetClient = clients[data.targetClientId];
            if (targetClient) {
                targetClient.write(JSON.stringify({
                    type: 'call_ended',
                    from: clientId
                }));
            }
        }
    });

    conn.on('close', function () {
        console.log(`Client ${clientId} disconnected`);
        delete clients[clientId];
        contacts = contacts.filter(contact => contact !== clientId); // Remove from contacts
        broadcastContacts(); // Notify all clients of the updated contact list
    });
});


// Function to broadcast the contact list to all connected clients
function broadcastContacts() {
    const contactMessage = JSON.stringify({
        type: 'contacts',
        contacts: contacts
    });

    Object.values(clients).forEach(conn => {
        conn.write(contactMessage);
    });
}
const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

websocket.installHandlers(server);
