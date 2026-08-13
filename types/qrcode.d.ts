declare module "qrcode" {
  export type QRCodeToCanvasOptions = {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: { dark?: string; light?: string };
  };

  export function toCanvas(canvas: HTMLCanvasElement | null, text: string, options?: QRCodeToCanvasOptions): Promise<void>;
}
