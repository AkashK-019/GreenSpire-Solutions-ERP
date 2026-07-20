/**
 * 
 * @param {File} file 
 * @param {Object} options 
 * @param {number} options.maxWidth 
 * @param {number} options.maxHeight 
 * @param {number} options.quality 
 * @returns {Promise<File>} 
 */
export async function compressImage(file, options = {}) {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

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

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas compression failed - null blob generated'));
            }

            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

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
