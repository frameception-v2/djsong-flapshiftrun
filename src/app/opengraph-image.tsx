import { ImageResponse } from "next/og";
import { type ReactElement } from 'react';
import { PROJECT_TITLE, PROJECT_DESCRIPTION } from "~/lib/constants";

// Force dynamic rendering for OG images
export const dynamic = 'force-dynamic';

export const alt = PROJECT_TITLE;
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 800,
};

export default async function Image() {
  return new ImageResponse(
    (
      <div
        tw="h-full w-full flex flex-col justify-center items-center relative"
        style={{
          backgroundImage: `linear-gradient(to bottom, #c026d3, #ef4444)`,
          color: "white",
        }}
      >
        <h1 tw="text-9xl text-center font-semibold">{PROJECT_TITLE}</h1>
        <h3 tw="text-4xl font-normal">{PROJECT_DESCRIPTION}</h3>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
