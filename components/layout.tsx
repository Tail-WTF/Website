import Head from "next/head";
import Footer from "./footer";

/**
 * General layout of the website. Controls headers/footers shared between pages.
 * As well as general site styling (background, font, etc).
 */
export default function Layout({
  children,
  paddingTop = true,
}: {
  children: React.ReactNode;
  paddingTop?: boolean;
}) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="referrer" content="same-origin"></meta>
        <meta name="description" content="Chop trackers from shared link" />
        {/* @TODO: open graph tags */}
      </Head>
      <main className="mx-auto max-w-screen-md px-8 md:px-0">
        <div
          className={`flex min-h-screen flex-col ${paddingTop ? "pt-[calc(10vh+4rem)]" : ""}`}
        >
          {children}
          <div className="invisible grow"></div>
          <Footer />
        </div>
      </main>
    </>
  );
}
