import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0d9488 0%, #115e59 100%)",
          color: "#fff",
          fontSize: 280,
          fontWeight: 700,
        }}
      >
        T
      </div>
    ),
    { width: 512, height: 512 },
  );
}
