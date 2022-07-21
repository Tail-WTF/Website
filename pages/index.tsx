import Head from "next/head";
import Layout from "../components/layout";
import { H1, H2 } from "../components/headings";
import { ActionBtn, LinkBox } from "../components/form";
import { useState } from "react";
import { useRouter } from "next/router";

export default function IndexPage() {
  const router = useRouter();
  const [url, setURL] = useState("");

  const submitTo = "/sanitize";
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push({
      pathname: submitTo,
      query: { url },
    });
  };

  const handleInputClick = async () => {
    try {
      setURL(await navigator.clipboard.readText());
    } catch {}
  };

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
              <form action={submitTo} method="get" onSubmit={handleSubmit}>
                <LinkBox
                  required
                  value={url}
                  placeholder="-> Paste your link here <-"
                  className="peer border-gray-500 transition-colors placeholder:text-lime-550 valid:border-gray-700"
                  onChange={(e) => setURL(e.target.value)}
                  onClick={handleInputClick}
                  autoFocus={true}
                  enterKeyHint="go"
                />
                <ActionBtn
                  type="submit"
                  className="ml-auto mt-8 transition-colors peer-valid:border-lime-550 peer-valid:fill-lime-200 peer-valid:text-lime-200"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    aria-hidden={true}
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-3 h-6 w-6"
                  >
                    <path d="M15.273 2.182h6.545v6.545H24V24H13.09V8.727h2.183V6.545h2.182v2.182h2.181V4.364h-4.363zm6.545 8.727h-6.545v6.546h2.182V13.09h4.363zm-4.363 8.727h-2.182v2.182h2.182zM6.545 9.818H4.364V12H2.182v2.182h2.182v2.182h2.181v-2.182h2.182V12H6.545ZM4.364 0H2.182v2.182H0v2.182h2.182v2.181h2.182V4.364h2.181V2.182H4.364Zm6.545 4.364H8.727v2.181H6.545v2.182h2.182v2.182h2.182V8.727h2.182V6.545h-2.182z" />
                  </svg>
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
