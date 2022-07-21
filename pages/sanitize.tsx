import Head from "next/head";
import Layout from "../components/layout";
import Footer from "../components/footer";

import { LinkBox } from "../components/form";
import { H1 } from "../components/headings";

import { useState } from "react";
import { GetServerSideProps } from "next";

import { sanitizeLinkInText } from "../utils/sanitizer";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { url = null } = ctx.query;
  if (!url || Array.isArray(url)) {
    return {
      notFound: true,
    };
  }

  const sanitizedURL = await sanitizeLinkInText(url);
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
                className="border-lime-200 pr-14 text-lime-200"
                onClick={copyState === null ? handleInputClick : undefined} // Only trigger on first click
              />
              <a
                href="#"
                className="absolute inset-y-0 right-4 my-auto flex h-6 w-6"
              >
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 fill-lime-200"
                >
                  <title>Open Sanitized Link</title>
                  <path d="M24 0H13.09v2.182h6.546v2.182h-2.181v2.181h-2.182v2.182H13.09v2.182h-2.182v2.182h2.182v-2.182h2.182V8.727h2.182V6.545h2.181V4.364h2.182v6.545H24ZM0 2.182h8.727v2.182H2.182v17.454h17.454v-6.545h2.182V24H0Z" />
                </svg>
              </a>
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
