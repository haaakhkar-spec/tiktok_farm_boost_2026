const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const proxies = fs.existsSync('./proxies.txt') 
    ? fs.readFileSync('./proxies.txt', 'utf-8').split('\n').filter(p => p.trim())
    : [];

app.post('/boost', async (req, res) => {
    const { url, count } = req.body;
    if (!url || !count) return res.json({ success: false, error: 'بيانات ناقصة' });

    try {
        const browser = await chromium.launch({
            headless: true,
            args: ['--disable-blink-features=AutomationControlled']
        });

        let successCount = 0;
        const maxConcurrent = 5;

        const enterLive = async (proxy) => {
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                proxy: proxy ? { server: proxy } : undefined,
                viewport: { width: 1280, height: 720 }
            });
            const page = await context.newPage();
            try {
                await page.goto(url, { waitUntil: 'networkidle' });
                await page.waitForSelector('[data-e2e="live-join-btn"], button[class*="Join"]', { timeout: 10000 });
                await page.click('[data-e2e="live-join-btn"], button[class*="Join"]');
                successCount++;
                await page.waitForTimeout(5000);
            } catch (e) {
            } finally {
                await context.close();
            }
        };

        const chunks = [];
        for (let i = 0; i < count; i += maxConcurrent) {
            chunks.push(Array.from({ length: Math.min(maxConcurrent, count - i) }, (_, idx) => {
                const proxy = proxies.length > 0 ? proxies[(i + idx) % proxies.length] : null;
                return enterLive(proxy);
            }));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk);
        }

        await browser.close();
        res.json({ success: true, message: تم دخول ${successCount} حساب });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.listen(3000, () => console.log('الخادم يعمل على المنفذ 3000'));
