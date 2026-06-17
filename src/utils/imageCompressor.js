/**
 * Compresses an image file in the browser using the HTML5 Canvas API.
 * Resizes the image to fit within maximum dimensions while preserving aspect ratio,
 * and outputs a compressed JPEG file.
 * 
 * @param {File} file - The original file selected by the user.
 * @param {Object} options - Compression options.
 * @param {number} options.maxWidth - Maximum width of the compressed image (default: 1200).
 * @param {number} options.maxHeight - Maximum height of the compressed image (default: 1200).
 * @param {number} options.quality - Quality rating from 0.0 to 1.0 (default: 0.8).
 * @returns {Promise<File>} - A promise that resolves to the compressed File object.
 */
export async function compressImage(file, options = {}) {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

  // If the file is not an image, return it unmodified
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate target dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get 2D canvas context'));
        }

        // Draw image onto canvas (automatically downscaling it)
        ctx.drawImage(img, 0, 0, width, height);

        // Convert the canvas drawing back to a file
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas compression failed - null blob generated'));
            }

            // Create a new File from the blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            // Log size saving details for verification
            console.log(
              `[ImageCompressor] Original: ${(file.size / 1024).toFixed(1)} KB | ` +
              `Compressed: ${(compressedFile.size / 1024).toFixed(1)} KB | ` +
              `Saved: ${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (err) => reject(new Error('Failed to load image element: ' + err.message));
    };

    reader.onerror = (err) => reject(new Error('Failed to read file: ' + err.message));
  });
}
