import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Download,
  Film,
  Image,
  Repeat2,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_DURATION_SECONDS, MAX_FILE_MB, validateFile } from "@/lib/gif-converter";

const title = "MP4 a GIF — Gifloop";
const description =
  "Convierte un video MP4 en un GIF animado y descárgalo sin enviar tu archivo a ningún servidor.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  [Upload, "Subir"],
  [Zap, "Convertir"],
  [Download, "Descargar"],
] as const;

function Index() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{
    url: string;
    name: string;
    width: number;
    height: number;
  } | null>(null);
  const busy = progress !== null;
  const stage = result ? 2 : file ? 1 : 0;

  useEffect(() => {
    if (!result) return undefined;
    return () => URL.revokeObjectURL(result.url);
  }, [result]);

  function select(file?: File) {
    if (!file || busy) return;
    const issue = validateFile(file);
    setError(issue ?? "");
    if (issue) return;
    setFile(file);
    setResult(null);
  }

  async function convert() {
    if (!file || busy) return;
    setError("");
    setProgress(0);
    try {
      const { convertToGif } = await import("@/lib/gif-converter");
      const { blob, width, height } = await convertToGif(file, setProgress);
      setResult({
        url: URL.createObjectURL(blob),
        name: `${file.name.replace(/\.mp4$/i, "") || "video"}.gif`,
        width,
        height,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo convertir el archivo.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="converter-shell">
      <header className="converter-header">
        <div className="converter-bar">
          <div className="converter-brand">
            <span>
              <Repeat2 size={22} aria-hidden="true" />
            </span>
            <span>
              gif<span>loop</span>
            </span>
          </div>
          <div className="converter-local">
            <span aria-hidden="true" /> Conversión local
          </div>
        </div>
      </header>
      <main className="converter-main">
        <div className="converter-wrap">
          <span className="converter-kicker">
            <Film size={13} aria-hidden="true" /> CONVERTIDOR DE VIDEO
          </span>
          <h1 className="converter-title" aria-label="MP4 a GIF">
            MP4 <ArrowRight size={52} strokeWidth={1.65} aria-hidden="true" /> <span>GIF</span>
          </h1>
          <p className="converter-subtitle">Convierte tus videos en GIF animados.</p>
          <section className="converter-tool" aria-label="Convertidor de MP4 a GIF">
            <div className="converter-tool-head">
              <span>
                <ArrowRightLeft size={14} aria-hidden="true" /> CONVERSIÓN
              </span>
              <span>MP4 → GIF</span>
            </div>
            <input
              ref={input}
              type="file"
              accept=".mp4,video/mp4"
              aria-label="Archivo MP4"
              hidden
              onChange={(event) => {
                select(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <div
              className={`converter-drop${dragging ? " is-dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                select(event.dataTransfer.files[0]);
              }}
            >
              {result ? (
                <>
                  <img
                    className="converter-preview"
                    src={result.url}
                    alt="Vista previa del GIF convertido"
                    width={result.width}
                    height={result.height}
                  />
                  <h2>Tu GIF está listo</h2>
                  <Button className="converter-action" size="lg" asChild>
                    <a href={result.url} download={result.name}>
                      <Download aria-hidden="true" /> Descargar GIF
                    </a>
                  </Button>
                  <Button
                    className="converter-change"
                    variant="ghost"
                    size="sm"
                    onClick={() => input.current?.click()}
                  >
                    Elegir otro MP4
                  </Button>
                </>
              ) : (
                <>
                  <div className="converter-art" aria-hidden="true">
                    <span className="converter-art-tile input">
                      <Film size={25} strokeWidth={1.6} />
                      MP4
                    </span>
                    <ArrowRight size={21} strokeWidth={1.5} />
                    <span className="converter-art-tile output">
                      <Image size={25} strokeWidth={1.6} />
                      GIF
                    </span>
                  </div>
                  <h2>
                    {busy ? "Convirtiendo tu video…" : file ? file.name : "Suelta tu MP4 aquí"}
                  </h2>
                  {busy ? (
                    <>
                      <progress
                        className="converter-progress"
                        value={progress}
                        max={100}
                        aria-label="Progreso de conversión"
                      />
                      <span className="converter-meta">{progress} %</span>
                    </>
                  ) : file ? (
                    <>
                      <p>
                        {new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(
                          file.size / 1_000_000,
                        )}{" "}
                        MB
                      </p>
                      <Button className="converter-action" size="lg" onClick={convert}>
                        <Zap aria-hidden="true" /> Convertir a GIF
                      </Button>
                      <Button
                        className="converter-change"
                        variant="ghost"
                        size="sm"
                        onClick={() => input.current?.click()}
                      >
                        Cambiar archivo
                      </Button>
                    </>
                  ) : (
                    <>
                      <p>o elige un video de tu dispositivo</p>
                      <Button
                        className="converter-action"
                        size="lg"
                        onClick={() => input.current?.click()}
                      >
                        <Upload aria-hidden="true" /> Seleccionar MP4
                      </Button>
                      <span className="converter-meta">
                        MP4 · Hasta {MAX_FILE_MB} MB · {MAX_DURATION_SECONDS} s máx.
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {error && (
              <p className="converter-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <ol className="converter-steps" aria-label="Etapas de la conversión">
            {steps.map(([Icon, label], i) => (
              <li key={label} aria-current={stage === i ? "step" : undefined}>
                {stage > i ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Icon size={14} aria-hidden="true" />
                )}
                {label}
              </li>
            ))}
          </ol>
        </div>
      </main>
      <footer className="converter-footer">
        <div className="converter-footer-inner">
          <span>GIFLOOP</span>
          <span>
            <ShieldCheck size={15} aria-hidden="true" /> Tus archivos no se envían
          </span>
        </div>
      </footer>
    </div>
  );
}
