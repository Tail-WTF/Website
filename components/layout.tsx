import Head from "next/head";

/**
 * General layout of the website. Controls headers/footers shared between pages.
 * As well as general site styling (background, font, etc).
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="referrer" content="same-origin"></meta>
        {/* @TODO: open graph tags */}
      </Head>
      <div className="bg-purple-1000 font-mono text-gray-300">
        <main className="mx-auto max-w-3xl">{children}</main>
      </div>
    </>
  );
}
