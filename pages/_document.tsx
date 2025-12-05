import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html className="bg-purple-1000 font-mono text-gray-300" lang="en">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?display=swap&family=JetBrains+Mono:ital,wght@0,400;0,700;0,800;1,400;1,700"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
