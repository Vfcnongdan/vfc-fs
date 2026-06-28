import { toPng } from "html-to-image";

export async function captureElementToPng(element: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });

  const response = await fetch(dataUrl);
  const blob = response.headers.get("content-type")?.includes("image/png")
    ? (await response.blob())
    : await blobFromDataUrl(dataUrl);
  return blob;
}

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
