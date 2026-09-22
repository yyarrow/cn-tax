"use client";

/**
 * 把 DOM 节点导出成 PNG dataUrl。
 * html-to-image 的 toPng 在部分浏览器里 img.decode() 不返回，这里只用它的 toSvg，后面自己画 canvas。
 */
export async function exportNodeAsPng(
  node: HTMLElement,
  opts: { fileName: string; background?: string },
): Promise<string> {
  const background = opts.background ?? "#f6f5f2";
  const { toSvg } = await import("html-to-image");
  const svgUrl = await toSvg(node, { skipFonts: true });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    el.onload = () => {
      clearTimeout(timer);
      resolve(el);
    };
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load"));
    };
    el.src = svgUrl;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/** 桌面端：把 dataUrl 触发成下载 */
export function savePng(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}
