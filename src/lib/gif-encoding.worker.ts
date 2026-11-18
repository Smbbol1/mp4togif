import { applyPalette, GIFEncoder, quantize } from "gifenc";

const gif = GIFEncoder();

self.onmessage = ({
  data,
}: MessageEvent<
  | { type: "finish" }
  | {
      type: "frame";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
      delay: number;
    }
>) => {
  if (data.type === "finish") {
    gif.finish();
    const bytes = gif.bytes();
    self.postMessage(bytes, { transfer: [bytes.buffer] });
    return;
  }

  const { pixels, width, height, delay } = data;
  const palette = quantize(pixels, 256);
  gif.writeFrame(applyPalette(pixels, palette), width, height, { palette, delay, repeat: 0 });
  self.postMessage(null);
};
