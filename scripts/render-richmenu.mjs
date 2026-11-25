// assets/richmenu.html → assets/richmenu.png（Playwright が必要: npm i -D playwright）
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const html = fileURLToPath(new URL("../assets/richmenu.html", import.meta.url));
const out = fileURLToPath(new URL("../assets/richmenu.png", import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2500, height: 843 } });
await page.goto(`file://${html}`);
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
