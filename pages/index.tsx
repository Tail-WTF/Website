import Head from "next/head";
import Layout from "../components/layout";
import { H1, H2 } from "../components/headings";
import { ActionBtn, LinkBox } from "../components/form";

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>Link Sanitizer · Tail.WTF</title>
        <meta name="description" content="Remove trackers from shared links" />
      </Head>
      <Layout>
        <div className="flex h-screen flex-col">
          <div className="mt-[calc(10vh+4rem)] flex flex-col">
            <header>
              <H1>Link Sanitizer</H1>
              <H2>Remove trackers from shared link.</H2>
            </header>

            <div className="mt-10">
              <form action="/sanitize" method="get">
                <LinkBox
                  required
                  placeholder="-> Paste your link here <-"
                  className="peer border-gray-500 transition-colors placeholder:text-lime-550 valid:border-gray-700"
                />
                <ActionBtn
                  type="submit"
                  className="ml-auto mt-8 block transition-colors peer-valid:border-lime-550 peer-valid:text-lime-200"
                >
                  Sanitize
                </ActionBtn>
              </form>
            </div>
          </div>
          <div className="invisible grow"></div>
          <div className="mb-7 animate-bounce text-base">↓ Why? ↓</div>
        </div>
        {/* First screen ends here */}
      </Layout>
    </>
  );
}
