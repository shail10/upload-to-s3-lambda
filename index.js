const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp"); // Add this for image processing

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

exports.handler = async (event) => {
  const s3Client = new S3Client();
  const bucketName = process.env.INPUT_BUCKET_NAME;
  const fileName = `${generateUUID()}.jpg`;

  try {
    // Check if event.body exists and is a string
    if (!event.body || typeof event.body !== 'string') {
      throw new Error('Invalid request body');
    }

    // Parse the base64 image data (assuming it's sent as base64)
    let imageData;
    try {
      // If the body is a JSON string, parse it
      const body = JSON.parse(event.body);
      imageData = body.image;
    } catch (e) {
      // If not JSON, assume it's raw base64
      imageData = event.body;
    }

    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Process image with sharp (resize, optimize, etc.)
    const processedImage = await sharp(imageBuffer)
      .resize({
        width: 800, // Adjust as needed
        height: 800,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 }) // Optimize JPEG quality
      .toBuffer();

    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: processedImage,
      ContentType: 'image/jpeg',
      // Optional: Add metadata
      Metadata: {
        'original-size': imageBuffer.length.toString(),
        'processed-size': processedImage.length.toString()
      }
    };

    // Upload to S3
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const fileUrl = `https://s3.amazonaws.com/${bucketName}/${fileName}`;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // If needed for CORS
      },
      body: JSON.stringify({
        message: 'Image uploaded successfully!',
        fileUrl: fileUrl,
        fileName: fileName
      })
    };

  } catch (err) {
    console.error('Error processing image:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Error processing image',
        details: err.message
      })
    };
  }
};