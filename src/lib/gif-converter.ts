export const MAX_FILE_MB = 500;
export const MAX_DURATION_SECONDS = 55;
const FRAME_SECONDS = 0.1;
const MAX_EDGE = 480;

export function validateFile(file: Pick<File, "name" | "type" | "size">) {
  if (!/\.mp4$/i.test(file.name) && file.type !== "video/mp4") return "Selecciona un archivo MP4.";
  if (!file.size) return "El archivo está vacío. Selecciona otro MP4.";
  if (file.size > MAX_FILE_MB * 1_000_000) return `El MP4 supera los ${MAX_FILE_MB} MB.`;
  return undefined;
}

export function validateDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "No se pudo leer la duración del video.";
  if (seconds > MAX_DURATION_SECONDS)
    return `El video debe durar ${MAX_DURATION_SECONDS} segundos o menos.`;
  return undefined;
}

function waitForVideo(video: HTMLVideoElement, event: string, start: () => void) {
  return new Promise<void>((resolve, reject) => {
    const clean = () => {
      clearTimeout(timeout);
      video.removeEventListener(event, success);
      video.removeEventListener("error", fail);
    };
    const success = () => {
      clean();
      resolve();
    };
    const fail = () => {
      clean();
      reject(new Error("No se pudo leer el video. Prueba con otro MP4."));
    };
    const timeout = setTimeout(fail, 12_000);
    video.addEventListener(event, success, { once: true });
    video.addEventListener("error", fail, { once: true });
    start();
  });
}

export async function convertToGif(file: File, onProgress: (value: number) => void) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const url = URL.createObjectURL(file);
  let worker: Worker | undefined;

  try {
    await waitForVideo(video, "loadeddata", () => {
      video.src = url;
    });
    const durationError = validateDuration(video.duration);
    if (durationError) throw new Error(durationError);
    if (!video.videoWidth || !video.videoHeight)
      throw new Error("El MP4 no contiene una pista de video.");

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Tu navegador no pudo preparar la conversión.");

    const encoder = new Worker(new URL("./gif-encoding.worker.ts", import.meta.url), {
      type: "module",
    });
    worker = encoder;
    const send = (payload: object, transfer: Transferable[] = []) =>
      new Promise<unknown>((resolve, reject) => {
        const fail = () => {
          clearTimeout(timeout);
          reject(new Error("No se pudo generar el GIF. Inténtalo de nuevo."));
        };
        const timeout = setTimeout(fail, 15_000);
        encoder.onmessage = (event) => {
          clearTimeout(timeout);
          resolve(event.data);
        };
        encoder.onerror = fail;
        encoder.onmessageerror = fail;
        encoder.postMessage(payload, transfer);
      });

    const count = Math.ceil(video.duration / FRAME_SECONDS);
    for (let i = 0; i < count; i++) {
      const time = i * FRAME_SECONDS;
      if (i > 0)
        await waitForVideo(video, "seeked", () => {
          video.currentTime = time;
        });
      ctx.drawImage(video, 0, 0, width, height);
      const { data: pixels } = ctx.getImageData(0, 0, width, height);
      const delay = Math.max(
        20,
        Math.round(Math.min(FRAME_SECONDS, video.duration - time) * 100) * 10,
      );
      await send({ type: "frame", pixels, width, height, delay }, [pixels.buffer]);
      onProgress(Math.round(((i + 1) / count) * 98));
    }

    const bytes = await send({ type: "finish" });
    if (!(bytes instanceof Uint8Array)) throw new Error("No se pudo generar el GIF.");
    return { blob: new Blob([new Uint8Array(bytes)], { type: "image/gif" }), width, height };
  } finally {
    worker?.terminate();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
