export function validateImageFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('这张图片的格式暂不支持，请换一张 JPG、PNG 或 WebP 照片。HEIC 可先导出为 JPG。');
  }
  if (!file.size) throw new Error('这张照片似乎是空文件，请重新选择。');
  if (file.size > 10 * 1024 * 1024) throw new Error('照片超过 10MB，请先缩小后再试。');
}

export function fitWithin(width, height, max = 1280) {
  if (!(width > 0 && height > 0 && max > 0)) throw new Error('无法读取照片尺寸，请换一张图片。');
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function containRect(width, height, targetWidth, targetHeight) {
  if (!(width > 0 && height > 0 && targetWidth > 0 && targetHeight > 0)) throw new Error('图片尺寸无效');
  const scale = Math.min(targetWidth / width, targetHeight / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;
  return { x: (targetWidth - fittedWidth) / 2, y: (targetHeight - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
}

export function createRequestGate() {
  let generation = 0;
  return { begin: () => ++generation, cancel: () => ++generation, isCurrent: token => token === generation };
}

export function validatePreparedSize(size) {
  if (size > 3 * 1024 * 1024) throw new Error('处理后的照片仍超过 3MB，请换一张较小的照片。');
}

export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('这张照片无法读取。请换一张完整的 JPG、PNG 或 WebP 图片。'));
    image.src = source;
  });
}

export async function preparePhoto(file) {
  validateImageFile(file);
  const temporaryURL = URL.createObjectURL(file);
  try {
    const image = await loadImage(temporaryURL);
    const size = fitWithin(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器暂时无法处理照片，请更新浏览器后重试。');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('照片处理失败，请换一张照片重试。');
    validatePreparedSize(blob.size);
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('照片处理失败，请重新选择。'));
      reader.readAsDataURL(blob);
    });
    return { url: URL.createObjectURL(blob), dataURL, width: size.width, height: size.height, name: file.name };
  } finally {
    URL.revokeObjectURL(temporaryURL);
  }
}
