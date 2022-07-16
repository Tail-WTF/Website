import Head from "next/head";
import Layout from "../components/layout";
import Footer from "../components/footer";

import { LinkBox } from "../components/form";
import { H1 } from "../components/headings";

import { useState } from "react";
import { GetServerSideProps } from "next";

import { sanitizeURL } from "../utils/sanitizer";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { url = null } = ctx.query;
  if (!url || Array.isArray(url)) {
    return {
      notFound: true,
    };
  }

  const sanitizedURL = await sanitizeURL(url);
  return {
    props: {
      sanitizedURL,
    },
  };
};

export default function ResultPage({ sanitizedURL }: { sanitizedURL: string }) {
  const [copyState, setCopyState] = useState<boolean | null>(null);

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
    try {
      navigator.clipboard.writeText(sanitizedURL);
      setCopyState(true);
    } catch (error) {
      setCopyState(false);
    }
  };

  return (
    <>
      <Head>
        <title>Link Sanitization Result · Tail.WTF</title>
        <meta name="description" content="Remove trackers from shared links" />
      </Head>
      <Layout>
        <div className="flex h-screen flex-col">
          <div className="mt-[calc(10vh+4rem)] flex flex-col">
            <header>
              <H1 className="!font-normal italic">
                🎉 Your link is now sanitized! Click to copy it.
              </H1>
            </header>

            <div className="relative mt-3.5">
              <LinkBox
                readOnly
                value={sanitizedURL}
                className="border-lime-200 text-lime-200"
                onClick={handleInputClick}
              />
            </div>
            {copyState !== null &&
              (copyState ? (
                <p className="mt-4 text-lime-550">Copied!</p>
              ) : (
                <p className="mt-4 text-rose-450">
                  Unable to copy link. Please try manually.
                </p>
              ))}
          </div>
          <div className="invisible grow"></div>
          <Footer />
        </div>
      </Layout>
    </>
  );
}
