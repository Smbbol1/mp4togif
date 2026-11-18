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
  "Convierte uno o varios videos MP4 en GIF animados y descárgalos sin enviar tus archivos a ningún servidor.";

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

const numberFormat = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });
const formatMb = (size: number) => numberFormat.format(size / 1_000_000);

type GifResult = {
  url: string;
  name: string;
  width: number;
  height: number;
};

type QueueItem = {
  id: string;
  file: File;
  status: "waiting" | "converting" | "done" | "error";
  progress: number;
  result: GifResult | null;
  error: string;
};

function Index() {
  const input = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<QueueItem[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const completedCount = items.filter((item) => item.status === "done").length;
  const remainingCount = items.length - completedCount;
  const allDone = items.length > 0 && completedCount === items.length;
  const activeIndex = items.findIndex((item) => item.status === "converting");
  const stage = allDone ? 2 : items.length ? 1 : 0;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => {
        if (item.result) URL.revokeObjectURL(item.result.url);
      });
    },
    [],
  );

  function updateItem(id: string, update: Partial<QueueItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  function select(fileList?: FileList | null) {
    if (!fileList || busy) return;
    const files = Array.from(fileList);
    if (!files.length) return;

    items.forEach((item) => {
      if (item.result) URL.revokeObjectURL(item.result.url);
    });

    const nextItems: QueueItem[] = [];
    const issues: string[] = [];
    files.forEach((file, index) => {
      const issue = validateFile(file);
      if (issue) {
        issues.push(`${file.name}: ${issue}`);
      } else {
        nextItems.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          file,
          status: "waiting",
          progress: 0,
          result: null,
          error: "",
        });
      }
    });
    setItems(nextItems);
    setError(issues.join(" "));
  }

  async function convertAll() {
    if (!items.length || busy) return;
    const queue = items.filter((item) => item.status !== "done");
    if (!queue.length) return;

    setError("");
    setBusy(true);
    try {
      const { convertToGif } = await import("@/lib/gif-converter");
      for (const item of queue) {
        updateItem(item.id, { status: "converting", progress: 0, error: "" });
        try {
          const { blob, width, height } = await convertToGif(item.file, (progress) => {
            updateItem(item.id, { progress });
          });
          updateItem(item.id, {
            status: "done",
            progress: 100,
            result: {
              url: URL.createObjectURL(blob),
              name: `${item.file.name.replace(/\.mp4$/i, "") || "video"}.gif`,
              width,
              height,
            },
          });
        } catch (e) {
          updateItem(item.id, {
            status: "error",
            error: e instanceof Error ? e.message : "No se pudo convertir el archivo.",
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron convertir los archivos.");
    } finally {
      setBusy(false);
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
          <p className="converter-subtitle">Convierte uno o varios videos en GIF animados.</p>
          <section className="converter-tool" aria-label="Convertidor de MP4 a GIF">
            <div className="converter-tool-head">
              <span>
                <ArrowRightLeft size={14} aria-hidden="true" /> CONVERSIÓN
              </span>
              <span>{items.length > 1 ? `${items.length} MP4` : "MP4 → GIF"}</span>
            </div>
            <input
              ref={input}
              type="file"
              accept=".mp4,video/mp4"
              aria-label="Archivos MP4"
              style={{ display: "none" }}
              multiple
              onChange={(event) => {
                select(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <div
              className={`converter-drop${dragging ? " is-dragging" : ""}${items.length ? " has-files" : ""}`}
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
                select(event.dataTransfer.files);
              }}
            >
              {!items.length ? (
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
                  <h2>Suelta tus MP4 aquí</h2>
                  <p>o elige uno o varios videos de tu dispositivo</p>
                  <Button
                    className="converter-action"
                    size="lg"
                    onClick={() => input.current?.click()}
                  >
                    <Upload aria-hidden="true" /> Seleccionar MP4
                  </Button>
                  <span className="converter-meta">
                    MP4 · Selección múltiple · Hasta {MAX_FILE_MB} MB · {MAX_DURATION_SECONDS} s
                    máx.
                  </span>
                </>
              ) : (
                <>
                  <div className="converter-batch-summary">
                    <h2>
                      {allDone
                        ? items.length === 1
                          ? "Tu GIF está listo"
                          : "Tus GIF están listos"
                        : busy
                          ? `Convirtiendo ${activeIndex + 1} de ${items.length}…`
                          : items.length === 1
                            ? (items[0]?.file.name ?? "1 video seleccionado")
                            : `${items.length} videos seleccionados`}
                    </h2>
                    <p>
                      {allDone
                        ? "Descarga cada GIF cuando quieras."
                        : busy
                          ? "Los videos se procesan uno por uno."
                          : `${formatMb(items.reduce((total, item) => total + item.file.size, 0))} MB en total`}
                    </p>
                  </div>
                  <ul className="converter-files" aria-label="Videos seleccionados">
                    {items.map((item) => (
                      <li className={`converter-file is-${item.status}`} key={item.id}>
                        {item.result ? (
                          <img
                            className="converter-file-preview"
                            src={item.result.url}
                            alt={`GIF de ${item.file.name}`}
                            width={item.result.width}
                            height={item.result.height}
                          />
                        ) : (
                          <span className="converter-file-icon" aria-hidden="true">
                            <Film size={21} strokeWidth={1.6} />
                          </span>
                        )}
                        <div className="converter-file-info">
                          <strong title={item.file.name}>{item.file.name}</strong>
                          <span>{formatMb(item.file.size)} MB</span>
                          {item.status === "converting" && (
                            <progress
                              className="converter-file-progress"
                              value={item.progress}
                              max={100}
                              aria-label={`Progreso de ${item.file.name}`}
                            />
                          )}
                          {item.error && (
                            <span className="converter-file-error" role="alert">
                              {item.error}
                            </span>
                          )}
                        </div>
                        <div className="converter-file-action">
                          {item.result ? (
                            <Button className="converter-download" size="sm" asChild>
                              <a
                                href={item.result.url}
                                download={item.result.name}
                                aria-label={`Descargar GIF de ${item.file.name}`}
                              >
                                <Download aria-hidden="true" /> Descargar
                              </a>
                            </Button>
                          ) : (
                            <span className="converter-file-status">
                              {item.status === "converting"
                                ? `${item.progress} %`
                                : item.status === "error"
                                  ? "Con error"
                                  : "En espera"}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!busy && remainingCount > 0 && (
                    <Button className="converter-action" size="lg" onClick={convertAll}>
                      <Zap aria-hidden="true" />
                      {completedCount > 0
                        ? `Reintentar ${remainingCount === 1 ? "conversión" : "conversiones"}`
                        : items.length === 1
                          ? "Convertir a GIF"
                          : `Convertir ${items.length} MP4`}
                    </Button>
                  )}
                  {!busy && (
                    <Button
                      className="converter-change"
                      variant="ghost"
                      size="sm"
                      onClick={() => input.current?.click()}
                    >
                      Elegir otros MP4
                    </Button>
                  )}
                  {busy && (
                    <span className="converter-meta">
                      Convirtiendo por turnos para cuidar la memoria
                    </span>
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
