const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

function extractText(imagePath) {
  return new Promise((resolve, reject) => {
    if (!imagePath) {
      return reject(new Error("Image path is required"));
    }

    if (!fs.existsSync(imagePath)) {
      return reject(
        new Error(`Image not found: ${imagePath}`)
      );
    }

    const outputDir = path.join(
      __dirname,
      "../../ocr_output"
    );

    fs.mkdirSync(outputDir, {
      recursive: true,
    });

    const args = [
      "--image_dir",
      imagePath,
      "--output",
      outputDir,
    ];

    execFile(
      "paddleocr",
      args,
      {
        timeout: 120000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("PaddleOCR error:", stderr || error.message);

          return reject(
            new Error(
              `PaddleOCR failed: ${stderr || error.message}`
            )
          );
        }

        resolve({
          stdout,
          stderr,
          outputDir,
        });
      }
    );
  });
}

module.exports = {
  extractText,
};