require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const BING_URL = "https://www.bing.com/images/create";
const COOKIES = JSON.parse(fs.readFileSync("cookies.json")); // Load cookies from a file

async function generateImages(prompt) {
  try {
    if (!prompt) throw new Error("Prompt is required");

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set cookies for authentication
    await page.setCookie(...COOKIES);

    // Navigate to Bing Image Creator
    await page.goto(BING_URL, { waitUntil: "networkidle2" });

    // Input the prompt
    await page.type("input[aria-label^='Describe the image you want']", prompt);

    // Click the correct submit button
    await page.click("a#create_btn_c");

    // 🔁 Wait until at least one image appears, max 60 seconds
    await page.waitForFunction(
      () => {
        const links = Array.from(
          document.querySelectorAll("a[aria-label*='Image 1 of']")
        );
        return links.length > 0;
      },
      { timeout: 60000 }
    );

    // Escape single quotes in the prompt for querySelectorAll
    const escapedPrompt = prompt.replace(/'/g, "\\'");

    // Find total number of generated images
    const imageURLs = await page.evaluate((escapedPrompt) => {
      return Array.from(
        document.querySelectorAll(`a[aria-label^="${escapedPrompt}. Image "]`)
      )
        .map((el) => {
          try {
            const mediaData = JSON.parse(el.getAttribute("m"));
            return JSON.parse(mediaData.CustomData)?.MediaUrl || null;
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean); // Remove null values
    }, escapedPrompt);

    if (imageURLs.length === 0) {
      console.error("No images found.");
      await browser.close();
      return [];
    }
    const imageDir = path.join(__dirname, "images");
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir);
    let imagePaths = [];
    for (let i = 0; i < imageURLs.length; i++) {
      try {
        const { data } = await axios.get(imageURLs[i], {
          responseType: "arraybuffer",
        });
        const imagePath = path.join(
          imageDir,
          `output_${Date.now()}_${i + 1}.jpg`
        );
        fs.writeFileSync(imagePath, data);
        imagePaths.push(imagePath);
      } catch (error) {
        console.error(`Error downloading image ${i + 1}:`, error.message);
      }
    }

    await browser.close();
    return imagePaths;
  } catch (error) {
    console.error("Error generating images:", error.message);
    throw new Error("Failed to generate images");
  }
}

module.exports = { generateImages };
