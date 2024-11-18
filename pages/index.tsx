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
      </Head>
      <Layout paddingTop={false}>
        <div className="flex h-screen flex-col">
          <header className="mt-[calc(10vh+4rem)]">
            <H1>Link Sanitizer</H1>
            <H2>Chop trackers from shared link</H2>
          </header>

          <div className="mt-10">
            <form action={submitTo} method="get" onSubmit={handleSubmit}>
              <LinkBox
                required
                value={url}
                placeholder="-> Paste your link here <-"
                className="peer border-gray-500 transition-colors placeholder:text-lime-550 valid:!border-gray-700 focus:border-gray-300"
                onChange={(e) => setURL(e.target.value)}
                onClick={url == "" ? handleInputClick : undefined} // Only trigger when input is empty
                autoFocus={true}
                enterKeyHint="go"
              />
              <ActionBtn
                type="submit"
                className="ml-auto mt-8 transition-colors hover:border-gray-300 hover:fill-gray-300 hover:text-gray-300 peer-valid:border-lime-550 peer-valid:fill-lime-200 peer-valid:text-lime-200 peer-valid:hover:border-lime-200"
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
          <div className="invisible flex-grow"></div>
          <div className="mb-7 animate-bounce text-base">↓ Why? ↓</div>
        </div>
        {/* First screen ends here */}
        <div className="mt-20">
          <H1 id="about" className="!font-bold">
            Why sanitize links?
          </H1>
          <div className="mt-7">
            <p className="break-all text-gray-500"> https://example.com/foo</p>
            <div className="flex w-full flex-row gap-10 overflow-auto whitespace-nowrap pr-5">
              <p className="text-gray-500">
                ?<span className="text-rose-450">share_source=copy_web</span>
                <br />
                &amp;
                <span className="text-rose-450">track=12345abcdef67890</span>
              </p>
              <p className="mt-auto text-lime-550">
                &quot;link generated on webpage&quot;
                <br />
                &quot;and shared by <i>user</i> at <i>date</i>... &quot;
              </p>
            </div>
          </div>
          <p className="mt-7 hyphens-auto text-justify md:w-4/6">
            Because online services want to monitor your digital life! When you
            tap share buttons, innocent-looking random strings are placed in the
            links you get - they are actually{" "}
            <span className="text-rose-450">&quot;trackers&quot;</span> tied to
            your account. Every time your friends open these links, service
            providers learn more about your social connections such as how often
            you talk to a particular friend, topics you discuss, etc. They can
            further exploit this information in conjunction with other data they
            have about you and your friends.
            <br />
            <br />
            Tail.WTF protects your privacy by chopping the annoying{" "}
            <span className="text-rose-450">&quot;tails&quot;</span> off these
            links, and also makes them look succinct and nicer.
          </p>
          <H1 id="privacy" className="mt-24 !font-bold">
            Privacy
          </H1>
          <p className="mt-7 hyphens-auto text-justify md:w-4/6">
            As a service that aims to protect your privacy, we do not collect
            any information from you without your explicitly consent. When we
            fail to sanitize specific link(s), we may ask if you would like to
            share info about them to improve this service.
          </p>
        </div>
      </Layout>
    </>
  );
}
