// Shrink a photo before it is uploaded: phone cameras make 3-8 MB pictures, which would be slow on
// mobile data. The longest side is limited and the picture is re-saved as JPEG (about 200-600 KB).
// Resolves to a JPEG Blob, or rejects if the browser cannot read the file as a picture.
export const MAX_PHOTOS = 3;

export const shrinkImage = async (file, maxSide = 1600, quality = 0.82) => {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('Please choose a photo.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // older browsers: decode through an <img> element instead
    bitmap = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
      img.src = url;
    });
  }

  const w = bitmap.width || bitmap.naturalWidth;
  const h = bitmap.height || bitmap.naturalHeight;
  if (!w || !h) throw new Error('Could not read that photo.');
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // PNGs with transparency would turn black as JPEG otherwise
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not process that photo.');
  return blob;
};
