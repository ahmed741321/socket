const WebSocket = require('ws');

// Define the valid key
const VALID_KEY = '800879';

// Create a WebSocket server with 4 worker processes
const wss = new WebSocket.Server({ port: 8080 });

let clients = new Map(); // Stores all connected clients
let authenticatedClients = new Map(); // Stores authenticated clients

wss.on('connection', (ws) => {
    // Assign a unique ID to each connection
    const id = Date.now() + Math.random();
    clients.set(id, ws);
    
    console.log(`New connection: ${id}`);

    // Handle incoming messages
    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            ws.send(JSON.stringify({ message: 'Invalid message format.', type: 'error' }));
            return;
        }

        const { type, key } = data;

        // Handle authentication
        if (type === 'authenticate') {
            if (key !== VALID_KEY) {
                ws.send(JSON.stringify({ message: 'Invalid key.', type: 'error' }));
                ws.close();
                return;
            }
            authenticatedClients.set(id, ws);
            ws.send(JSON.stringify({ message: 'Authentication successful.', type: 'notification' }));
            return;
        }

        // Ensure the client is authenticated
        if (!authenticatedClients.has(id)) {
            ws.send(JSON.stringify({ message: 'You are not authenticated.', type: 'error' }));
            return;
        }

        // Broadcast signaling messages to all authenticated clients except the sender
        authenticatedClients.forEach((client, clientId) => {
            if (clientId !== id) {
                client.send(JSON.stringify(data));
            }
        });
    });

    // Handle connection closure
    ws.on('close', () => {
        clients.delete(id);
        authenticatedClients.delete(id);
        console.log(`Connection closed: ${id}`);
    });
});

console.log('WebSocket server is running on ws://localhost:8080');
