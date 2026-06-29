import { toPng } from "html-to-image";

export async function captureElementToPng(element: HTMLElement): Promise<Blob> {
  await waitForImages(element);

  const dataUrl = await toPng(element, {
    cacheBust: false,
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

async function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return;
      if (typeof image.decode === "function") {
        await image.decode().catch(() => {});
        return;
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}
