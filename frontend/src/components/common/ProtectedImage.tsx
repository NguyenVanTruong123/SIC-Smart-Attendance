import { Image } from "antd";
import { useEffect, useState, type CSSProperties } from "react";
import api from "@/utils/api";

interface ProtectedImageProps {
  src?: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  preview?: boolean;
  style?: CSSProperties;
}

export function ProtectedImage({ src, alt, width, height, preview, style }: ProtectedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (!src) {
      setObjectUrl(undefined);
      return;
    }
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      setObjectUrl(src);
      return;
    }
    let active = true;
    let nextUrl: string | undefined;
    const requestUrl = src.startsWith("/api/v1/") ? src.slice("/api/v1".length) : src;
    setObjectUrl(undefined);
    void (api.get(requestUrl, { responseType: "blob" }) as Promise<Blob>)
      .then((image) => {
        const imageUrl = URL.createObjectURL(image);
        if (!active) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        nextUrl = imageUrl;
        setObjectUrl(imageUrl);
      })
      .catch(() => active && setObjectUrl(undefined));
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [src]);

  return objectUrl ? <Image width={width} height={height} preview={preview} src={objectUrl} alt={alt} style={style} /> : <>—</>;
}
