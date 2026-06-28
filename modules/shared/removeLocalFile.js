const fs = require("fs");
const path = require("path");

const removeLocalFile = (filePath = "") => {
  try {
    if (!filePath) return;

    const normalizedFilePath = String(filePath).trim();

    if (
      normalizedFilePath.startsWith("http://") ||
      normalizedFilePath.startsWith("https://")
    ) {
      return;
    }

    const uploadsRoot = path.join(process.cwd(), "uploads");
    const safePath = normalizedFilePath.replace(/^\/+/, "");
    const absolutePath = path.resolve(process.cwd(), safePath);

    // Only allow deleting files inside uploads folder
    if (!absolutePath.startsWith(uploadsRoot)) {
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    // Do not break API request if file deleting fails
  }
};

module.exports = {
  removeLocalFile
};