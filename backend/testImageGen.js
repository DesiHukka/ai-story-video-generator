const { generateImages } = require("./imageGen");

async function test() {
  try {
    const prompt = `Guddu, the 9-year-old boy in a white kurta and blue pajama pants, is sitting on the floor of the same rural hut. Beside him is a small squirrel named Tony. Tony is wearing a tiny blue cap and stands on her hind legs, looking at Guddu as if speaking. The room has the same mud walls, wooden table, and oil lamp. The cloudy evening sky is visible through the window.`;
    console.log("Generating images for prompt:", prompt);

    const images = await generateImages(prompt);
    console.log("Images saved:", images);
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

test();
