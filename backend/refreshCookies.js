const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "cookies.json");
const LOGIN_URL = "https://www.bing.com/images/create";

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // So you can log in manually
    slowMo: 50,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Step 1: Go to Bing Image Creator
  console.log("🔑 Opening Bing Image Creator...");
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

  // Step 2: Wait for user to log in and generate session cookies
  console.log("⏳ Please log in manually if needed.");
  console.log(
    "✅ After you're logged in and can see the image prompt box, press ENTER in the terminal to save cookies."
  );

  // Pause until user confirms they're logged in
  process.stdin.resume();
  process.stdin.on("data", async () => {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log(`🍪 Cookies saved to ${COOKIES_PATH}`);
    await browser.close();
    process.exit(0);
  });
})();
