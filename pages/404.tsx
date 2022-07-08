import Head from "next/head";
import Link from "next/link";
import Layout from "../components/layout";
import { H1, H2 } from "../components/headings";

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page Not Found · Tail.WTF</title>
        <meta name="description" content="Remove trackers from shared links" />
      </Head>
      <Layout>
        <div className="flex h-screen flex-col">
          <div className="ml-[5vw] mt-[36vh]">
            <H1>404 · Page Not Found</H1>
            <H2 className="mt-2">
              We cannot find the page you are looking for :-{"("}
            </H2>
            <Link href="/">
              <a className="mt-10 block text-lg text-cyan-600 sm:text-xl">
                {"<-"} Back to home page
              </a>
            </Link>
          </div>
        </div>
      </Layout>
    </>
  );
}
