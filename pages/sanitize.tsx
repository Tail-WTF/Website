import Head from "next/head";
import Layout from "../components/layout";
import { H1, H2 } from "../components/headings";
import { LinkBox } from "../components/form";
import Footer from "../components/footer";
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
                autoFocus
                value={sanitizedURL}
                className="border-lime-200 text-lime-200"
                onFocus={(e) => {
                  e.target.setSelectionRange(0, e.target.value.length);
                  navigator.clipboard.writeText(sanitizedURL);
                }}
              />
            </div>
          </div>
          <div className="invisible grow"></div>
          <Footer />
        </div>
      </Layout>
    </>
  );
}
