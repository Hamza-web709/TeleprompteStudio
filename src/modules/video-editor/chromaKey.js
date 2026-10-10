/**
 * Chroma Key Green Screen Processor
 */

export class ChromaKeyProcessor {
  constructor(keyColor = { r: 0, g: 177, b: 64 }, tolerance = 90, smoothness = 20) {
    this.keyColor = keyColor;
    this.tolerance = tolerance;
    this.smoothness = smoothness;
  }

  processImageData(imageData) {
    const data = imageData.data;
    const len = data.length;
    const { r: kr, g: kg, b: kb } = this.keyColor;
    const tolSq = this.tolerance * this.tolerance;
    const smoothSq = (this.tolerance + this.smoothness) * (this.tolerance + this.smoothness);

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const diffSq = (r - kr) * (r - kr) + (g - kg) * (g - kg) + (b - kb) * (b - kb);

      if (diffSq < tolSq) {
        data[i + 3] = 0; // Fully transparent
      } else if (diffSq < smoothSq) {
        // Linear fade alpha
        const alphaFraction = (diffSq - tolSq) / (smoothSq - tolSq);
        data[i + 3] = Math.round(data[i + 3] * alphaFraction);
      }
    }

    return imageData;
  }
}

export const chromaKeyProcessor = new ChromaKeyProcessor();
