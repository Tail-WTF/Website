import Head from "next/head";
import Layout from "../components/layout";

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

  const sanitized = await sanitizeLinkInText(url);
  return {
    props: {
      text: sanitized.text,
      sanitizedURL: sanitized.links?.[0] || null,
    },
  };
};

export default function ResultWrapper({
  text,
  sanitizedURL,
}: {
  text: string;
  sanitizedURL: string | undefined;
}) {
  return (
    <Layout>
      {sanitizedURL ? (
        <ResultSuccess text={text} sanitizedURL={sanitizedURL} />
      ) : (
        <ResultFailure />
      )}
    </Layout>
  );
}

function ResultSuccess({
  text,
  sanitizedURL,
}: {
  text: string;
  sanitizedURL: string | undefined;
}): React.ReactElement {
  const [copyState, setCopyState] = useState<boolean | null>(null);

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
    try {
      navigator.clipboard.writeText(text);
      setCopyState(true);
    } catch (error) {
      setCopyState(false);
    }
  };

  return (
    <>
      <Head>
        <title>Result · Tail.WTF</title>
      </Head>
      <header>
        <H1 className="!font-normal italic">
          🎉 Your link is now sanitized! Click to copy it.
        </H1>
      </header>

      <div className="relative mt-3.5">
        <LinkBox
          readOnly
          value={text}
          className="border-lime-200 pr-14 text-lime-200"
          onClick={copyState === null ? handleInputClick : undefined} // Only trigger on first click
        />
        <a
          href={sanitizedURL}
          target="_self"
          rel="noopener noreferrer"
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
    </>
  );
}

function ResultFailure(): React.ReactElement {
  return (
    <>
      <Head>
        <title>Rule Missing · Tail.WTF</title>
      </Head>
      <header>
        <H1 className="!font-normal">😢 Your link is not sanitized.</H1>
      </header>
      <p className="mt-4 text-rose-450">
        We were unable to sanitize your link. <br />
        Please submit a rule request on GitHub to help us improve.
      </p>
    </>
  );
}
