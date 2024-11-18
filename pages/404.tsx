import Head from "next/head";
import Link from "next/link";
import Layout from "../components/layout";
import { H1, H2 } from "../components/headings";

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page Not Found · Tail.WTF</title>
      </Head>
      <Layout>
        <H1>404 · Page Not Found</H1>
        <H2 className="mt-2">
          We cannot find the page you are looking for :-{"("}
        </H2>
        <Link href="/" className="mt-10 block text-lg text-cyan-600 md:text-xl">
          {"<-"} Back to home page
        </Link>
      </Layout>
    </>
  );
}
