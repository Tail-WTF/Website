import Head from "next/head";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="referrer" content="same-origin"></meta>
        {/* @TODO: open graph tags */}
      </Head>
      <div className="bg-purple-1000 font-mono">
        <main className="mx-auto max-w-3xl">{children}</main>
      </div>
    </>
  );
}
