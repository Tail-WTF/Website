import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";

export default function IndexPage() {
  return (
    <div className="flex h-screen flex-col dark:bg-slate-800">
      <Head>
        <title>URL Sanitizer · Tail.WTF</title>
      </Head>
      <header className="flex h-16 max-w-full py-5 px-12 text-xl dark:border-slate-700 dark:text-white sm:px-32">
        <div>
          <Link href="/">
            <a className="font-mono font-bold">Tail.WTF</a>
          </Link>
        </div>
        <div className="ml-auto space-x-4">
          <a href="https://github.com/tail-wtf">
            <svg
              role="img"
              className="h-7 w-7 fill-slate-900 dark:fill-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
        </div>
      </header>

      <div className="relative -top-24 m-auto w-10/12 items-center justify-center dark:text-white sm:w-[40rem]">
        <h1 className="text-center text-4xl sm:text-7xl">URL Sanitizer</h1>
        <h2 className="text-md mt-3 text-center sm:text-2xl">
          Remove{" "}
          <span className="relative">
            Trackers
            <span className="animate-progress absolute -left-px top-2.5 h-0.5 w-16 -rotate-6 bg-rose-400 sm:-left-1 sm:top-4 sm:h-1 sm:w-24"></span>
          </span>{" "}
          from Shared Link
        </h2>
        <form className="relative mt-10">
          <input
            name="url"
            className="peer h-12 w-full rounded-md border-2 border-yellow-400/60 p-4 pr-10 focus:border-yellow-400 focus:outline-none dark:border-yellow-400 dark:bg-slate-500/10 dark:focus:border-yellow-200"
            placeholder="Paste URL here"
            required
            autoFocus
            autoComplete="off"
            autoCorrect="off"
          />
          <button
            type="submit"
            className="absolute inset-y-0 right-4 flex items-center fill-slate-400 peer-focus:fill-slate-500 dark:fill-slate-200 dark:peer-focus:fill-white"
          >
            <svg
              className="h-5 w-5 -rotate-12 -scale-x-100 transition hover:-rotate-[30deg]"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <path d="M96 32C96 14.33 110.3 0 128 0H192C209.7 0 224 14.33 224 32V128H96V32zM224 160C277 160 320 202.1 320 256V464C320 490.5 298.5 512 272 512H48C21.49 512 0 490.5 0 464V256C0 202.1 42.98 160 96 160H224zM160 416C204.2 416 240 380.2 240 336C240 291.8 204.2 256 160 256C115.8 256 80 291.8 80 336C80 380.2 115.8 416 160 416zM384 48C384 49.36 383 50.97 381.8 51.58L352 64L339.6 93.78C338.1 95 337.4 96 336 96C334.6 96 333 95 332.4 93.78L320 64L290.2 51.58C288.1 50.97 288 49.36 288 48C288 46.62 288.1 45.03 290.2 44.42L320 32L332.4 2.219C333 1 334.6 0 336 0C337.4 0 338.1 1 339.6 2.219L352 32L381.8 44.42C383 45.03 384 46.62 384 48zM460.4 93.78L448 64L418.2 51.58C416.1 50.97 416 49.36 416 48C416 46.62 416.1 45.03 418.2 44.42L448 32L460.4 2.219C461 1 462.6 0 464 0C465.4 0 466.1 1 467.6 2.219L480 32L509.8 44.42C511 45.03 512 46.62 512 48C512 49.36 511 50.97 509.8 51.58L480 64L467.6 93.78C466.1 95 465.4 96 464 96C462.6 96 461 95 460.4 93.78zM467.6 194.2L480 224L509.8 236.4C511 237 512 238.6 512 240C512 241.4 511 242.1 509.8 243.6L480 256L467.6 285.8C466.1 287 465.4 288 464 288C462.6 288 461 287 460.4 285.8L448 256L418.2 243.6C416.1 242.1 416 241.4 416 240C416 238.6 416.1 237 418.2 236.4L448 224L460.4 194.2C461 193 462.6 192 464 192C465.4 192 466.1 193 467.6 194.2zM448 144C448 145.4 447 146.1 445.8 147.6L416 160L403.6 189.8C402.1 191 401.4 192 400 192C398.6 192 397 191 396.4 189.8L384 160L354.2 147.6C352.1 146.1 352 145.4 352 144C352 142.6 352.1 141 354.2 140.4L384 128L396.4 98.22C397 97 398.6 96 400 96C401.4 96 402.1 97 403.6 98.22L416 128L445.8 140.4C447 141 448 142.6 448 144z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
