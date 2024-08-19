const WebSocket = require('ws');

// Define the valid key
const VALID_KEY = '800879';

// Create a WebSocket server
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

        const { type, key, message: msg } = data;

        // Handle authentication
        if (type === 'authenticate') {
            if (key !== VALID_KEY) {
                ws.send(JSON.stringify({ message: 'Invalid key.', type: 'error' }));
                ws.close();
                return;
            }
            authenticatedClients.set(id, ws);
            ws.send(JSON.stringify({ message: 'Authentication successful.', type: 'notification' }));

            // Notify other authenticated clients
            authenticatedClients.forEach((client) => {
                if (client !== ws) {
                    client.send(JSON.stringify({ message: 'A new user has joined the chat.', type: 'newUser' }));
                }
            });
            return;
        }

        // Ensure the client is authenticated
        if (!authenticatedClients.has(id)) {
            ws.send(JSON.stringify({ message: 'You are not authenticated.', type: 'error' }));
            return;
        }

        // Broadcast the message to all authenticated clients except the sender
        authenticatedClients.forEach((client) => {
            if (client !== ws) {
                client.send(JSON.stringify({ message: msg, type: 'regular' }));
            }
        });

        // Acknowledge the message back to the sender only if it's not a regular message
        if (type !== 'regular') {
            const response = `You said: ${msg}`;
            ws.send(JSON.stringify({ message: response, type: 'regular' }));
        }
    });

    // Handle connection closure
    ws.on('close', () => {
        clients.delete(id);
        authenticatedClients.delete(id);

        console.log(`Connection closed: ${id}`);

        if (authenticatedClients.size > 0) {
            // Notify remaining users that someone has left
            const notificationMessage = JSON.stringify({ message: 'A user has left the chat. All messages have been cleared.', type: 'notification' });
            authenticatedClients.forEach((client) => {
                client.send(notificationMessage);
                client.send(JSON.stringify({ message: 'clear', type: 'system' }));
            });

            // Check if only one user is left
            if (authenticatedClients.size === 1) {
                const [remainingClient] = authenticatedClients.values();
                remainingClient.send(JSON.stringify({ message: 'You are now alone. The chat history has been cleared.', type: 'notification' }));
            }
        }
    });
});

console.log('WebSocket server is running on ws://localhost:8080');
