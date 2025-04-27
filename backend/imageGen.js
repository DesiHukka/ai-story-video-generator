// imageGen.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const BING_URL = "https://www.bing.com/images/create";
puppeteer.use(StealthPlugin());

async function generateImages(prompt) {
  if (!prompt) throw new Error("Prompt is required");

  // pick a random cookie file (1–4)
  const idx = Math.floor(Math.random() * 4) + 1;
  const cookieFile = path.resolve(__dirname, `cookies${idx}.json`);
  console.log(`🔑 Using cookies from ${path.basename(cookieFile)}`);

  const raw = JSON.parse(fs.readFileSync(cookieFile, "utf8"));
  // inject url into each cookie
  const cookies = raw.map((c) => ({ ...c, url: "https://www.bing.com" }));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // apply cookies before navigation
    await page.setCookie(...cookies);

    // set a realistic UA
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/121.0.0.0 Safari/537.36"
    );

    // go to Bing Image Creator
    await page.goto(BING_URL, { waitUntil: "networkidle2" });

    // find either input or textarea
    let handle = await page.$("input#sb_form_q");
    if (!handle) {
      handle = await page.$("textarea#sb_form_q");
      if (!handle) {
        throw new Error("❌ Could not find prompt input or textarea");
      }
    }
    await handle.type(`${prompt}, hyper-realistic`, { delay: 50 });

    // click “Create”
    await page.click("a#create_btn_c");

    // wait for at least one result
    await page.waitForFunction(
      () => !!document.querySelector(".imgri-inner-container > a"),
      { timeout: 60_000 }
    );

    // scrape the generated image URLs
    const imageURLs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".imgri-inner-container > a"))
        .map((el) => {
          const m = el.getAttribute("m");
          if (!m) return null;
          try {
            const outer = JSON.parse(m);
            const inner = JSON.parse(outer.CustomData);
            return inner.MediaUrl;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    });

    if (imageURLs.length === 0) {
      console.error("⚠️ No images found for prompt:", prompt);
      return [];
    }

    // download each image
    const imageDir = path.join(__dirname, "images");
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir);
    const paths = [];
    for (let i = 0; i < imageURLs.length; i++) {
      try {
        const { data } = await axios.get(imageURLs[i], {
          responseType: "arraybuffer",
        });
        const filename = `output_${Date.now()}_${i + 1}.jpg`;
        const filepath = path.join(imageDir, filename);
        fs.writeFileSync(filepath, data);
        paths.push(filepath);
      } catch (err) {
        console.error(`❌ Failed to download image ${i + 1}:`, err.message);
      }
    }

    return paths;
  } finally {
    await browser.close();
  }
}

module.exports = { generateImages };
