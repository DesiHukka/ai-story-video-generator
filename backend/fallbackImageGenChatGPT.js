// fallbackImageGenChatGPT.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// load your exported ChatGPT cookies if you still need them
const COOKIES = fs.existsSync("cookies_chatgpt.json")
  ? JSON.parse(fs.readFileSync("cookies_chatgpt.json"))
  : [];

puppeteer.use(StealthPlugin());

async function fallbackGenerateImagesChatGPT(prompt, n = 2) {
  if (!prompt) throw new Error("Prompt is required");

  // const browser = await puppeteer.launch({
  //   headless: true,
  //   executablePath:
  //     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // adjust for your platform
  //   userDataDir: "A:\\AI Projects\\chrome copy1\\User Data",
  //   args: ["--no-sandbox", "--disable-setuid-sandbox"],
  // });

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setCookie(...COOKIES);

  // Optional: set a real Chrome UA
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  );

  // // 1️⃣ First, navigate to chat.openai.com and wait for you to be fully logged in
  await page.goto("https://chat.openai.com/chat", {
    waitUntil: "networkidle2",
  });
  // this will hang until you’ve solved the CF check & seen the “New chat” button
  // await page.waitForSelector('button[aria-label="New chat"]', { timeout: 0 });

  // 2️⃣ Now navigate to your shared DALL·E thread
  await page.goto("https://chat.openai.com/g/g-2fkFE8rbu-dall-e", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // 3️⃣ Wait for the ProseMirror prompt to appear
  await page.waitForSelector("#prompt-textarea", { timeout: 60000 });

  // 4️⃣ Type & send
  await page.focus("#prompt-textarea");
  await page.keyboard.type(`Generate ${n} images for: ${prompt}`, {
    delay: 20,
  });
  await page.click("#composer-submit-button");

  // 5️⃣ Wait for images
  await page.waitForFunction(
    (count) => {
      const grid = document.querySelector("div.grid-cols-2");
      return grid && grid.querySelectorAll("img").length >= count;
    },
    { timeout: 120000 },
    n
  );

  // 6️⃣ Scrape URLs
  const imageUrls = await page.evaluate((count) => {
    const imgs = Array.from(document.querySelectorAll("div.grid-cols-2 img"));
    return imgs.slice(-count).map((img) => img.src);
  }, n);

  // 7️⃣ Download them
  const outDir = path.join(__dirname, "fallback_images");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const downloaded = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const { data } = await axios.get(url, { responseType: "arraybuffer" });
    const ext = path.extname(new URL(url).pathname) || ".png";
    const filename = `fallback_${Date.now()}_${i + 1}${ext}`;
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, data);
    downloaded.push(filepath);
  }

  await browser.close();
  return downloaded;
}

// Example
fallbackGenerateImagesChatGPT(
  "Chhutki, in her red frock with white polka dots, stands at the edge of the forest, her expression filled with worry as she watches two men cutting down trees with axes. The men wear brown shirts and hats, surrounded by fallen logs and sawdust. The forest in the background looks vibrant but threatened. Chhutki turns and runs toward the deeper forest to find the fairy queen.",
  2
)
  .then((files) => console.log("Downloaded:", files))
  .catch(console.error);

module.exports = { fallbackGenerateImagesChatGPT };
