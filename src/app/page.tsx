import { Metadata } from "next";
import App from "./app";
import { PROJECT_TITLE, PROJECT_DESCRIPTION } from "~/lib/constants";

const appUrl =
  process.env.NEXT_PUBLIC_URL ||
  process.env.VERCEL_URL ||
  "http://localhost:3000";

const frame = {
  version: "vNext",
  image: `${appUrl}/opengraph-image`,
  buttons: [
    {
      label: "Play Game",
    }
  ],
};

export const metadata: Metadata = {
  title: PROJECT_TITLE,
  description: PROJECT_DESCRIPTION,
  openGraph: {
    title: PROJECT_TITLE,
    description: PROJECT_DESCRIPTION,
    images: [
      {
        url: `${appUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: PROJECT_TITLE,
      },
    ],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${appUrl}/opengraph-image`,
    "fc:frame:button:1": "Play Game",
  },
};

export default function Home() {
  return <App />;
}
