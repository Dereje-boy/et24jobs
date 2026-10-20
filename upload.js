const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");

// 1. Initialize the S3 Client configured for Cloudflare R2
const s3Client = new S3Client({
  region: "auto", // R2 requires 'auto' as the region
  endpoint:
    "https://c07d7b079fbdf488693d21a1bb631090.eu.r2.cloudflarestorage.com/et24jobs", // Replace with your R2 endpoint
  credentials: {
    accessKeyId: "3fd4bb767653b29e5e8aad4c7533fa92", // Replace with your R2 Access Key ID
    secretAccessKey:
      "78609aad6f1ef54bdf0f9de67330fa99d51c12ac6dd372b8f019030046dff597", // Replace with your R2 Secret Access Key
  },
});

async function uploadFile() {
  const bucketName = "et24jobs"; // Replace with your private bucket name
  const filePath = "./app.js"; // Local file you want to upload
  const objectKey = "app.js"; // The destination path/name inside your R2 bucket

  try {
    // Read the file content from your local system
    const fileStream = fs.createReadStream(filePath);

    const uploadParams = {
      Bucket: bucketName,
      Key: objectKey,
      Body: fileStream,
      ContentType: "text/plain", // Update this to match your file's MIME type (e.g., 'image/png', 'application/pdf')
    };

    console.log("Uploading file to R2 private bucket...");
    const data = await s3Client.send(new PutObjectCommand(uploadParams));

    console.log("Success! File uploaded successfully.");
    console.log("ETag:", data.ETag);
  } catch (err) {
    console.error("Error uploading file:", err);
  }
}

uploadFile();
