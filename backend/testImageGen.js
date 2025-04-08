const { generateImages } = require("./imageGen");

async function test() {
  try {
    const prompt = "lord vishnu fighting lord shiva, hyperrealism";
    console.log("Generating images for prompt:", prompt);

    const images = await generateImages(prompt);
    console.log("Images saved:", images);
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

test();
