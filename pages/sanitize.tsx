import Head from "next/head";
import Layout from "../components/layout";

import { LinkBox } from "../components/form";
import { H1 } from "../components/headings";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type State =
  | { status: "loading" }
  | { status: "success"; text: string; sanitizedURL: string }
  | { status: "error"; originalUrl: string };

export default function ResultWrapper() {
  const router = useRouter();
  const { url } = router.query;
  const validUrl = typeof url === "string" ? url : null;

  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!validUrl) return;

    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({ text: validUrl });
        const res = await fetch(`${API_URL}/api/sanitize?${params}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.sanitizedURLs?.[0]) {
          setState({
            status: "success",
            text: data.text,
            sanitizedURL: data.sanitizedURLs[0],
          });
        } else {
          setState({ status: "error", originalUrl: validUrl });
        }
      } catch {
        if (!cancelled) setState({ status: "error", originalUrl: validUrl });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [validUrl]);

  if (!validUrl || state.status === "loading") {
    return (
      <Layout>
        <header>
          <H1 className="animate-pulse font-normal! italic">Sanitizing...</H1>
        </header>
        <div className="mt-3.5">
          <div className="h-14 w-full animate-pulse rounded border-2 border-gray-700 bg-gray-800/50" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {state.status === "success" ? (
        <ResultSuccess text={state.text} sanitizedURL={state.sanitizedURL} />
      ) : (
        <ResultFailure originalUrl={state.originalUrl} />
      )}
    </Layout>
  );
}

function ResultSuccess({
  text,
  sanitizedURL,
}: {
  text: string;
  sanitizedURL: string;
}): React.ReactElement {
  const [copyState, setCopyState] = useState<boolean | null>(null);

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).select();
    try {
      navigator.clipboard.writeText(text);
      setCopyState(true);
    } catch {
      setCopyState(false);
    }
  };

  return (
    <>
      <Head>
        <title>Result · Tail.WTF</title>
      </Head>
      <header>
        <H1 className="font-normal! italic">
          🎉 Your link is now sanitized! Click to copy it.
        </H1>
      </header>

      <div className="relative mt-3.5">
        <LinkBox
          readOnly
          value={text}
          className="border-lime-200 pr-14 text-lime-200"
          onClick={copyState === null ? handleInputClick : undefined}
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
      {copyState !== null && (
        <p
          className={`mt-4 transition-opacity duration-200 ${copyState ? "text-lime-550" : "text-rose-450"}`}
        >
          {copyState ? "Copied!" : "Unable to copy link. Please try manually."}
        </p>
      )}
    </>
  );
}

interface SanitizeResult {
  sanitizedUrl: string;
  removedParams: string[];
  suggestedRule: { pattern: string; allowedParams: string[] } | null;
  confidence?: number;
  requiredParams?: string[];
}

function ResultFailure({
  originalUrl,
}: {
  originalUrl: string;
}): React.ReactElement {
  const [method, setMethod] = useState<"idle" | "ai" | "browser">("idle");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [result, setResult] = useState<SanitizeResult | null>(null);
  const [copyState, setCopyState] = useState<boolean | null>(null);

  const trySanitize = async (type: "ai" | "browser") => {
    setMethod(type);
    setState("loading");
    try {
      const endpoint =
        type === "ai" ? "/api/ai-sanitize" : "/api/browser-sanitize";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: originalUrl }),
      });
      const data = await res.json();
      if (data.sanitizedUrl) {
        setResult(data);
        setState("success");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  const handleCopy = () => {
    if (!result) return;
    try {
      navigator.clipboard.writeText(result.sanitizedUrl);
      setCopyState(true);
    } catch {
      setCopyState(false);
    }
  };

  return (
    <>
      <Head>
        <title>Rule Missing · Tail.WTF</title>
      </Head>
      <header>
        <H1 className="font-normal!">😢 Your link is not sanitized.</H1>
      </header>
      <p className="text-rose-450 mt-4">
        We were unable to sanitize your link with our rules.
      </p>

      {state === "idle" && (
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => trySanitize("ai")}
            className="border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
          >
            Try AI
          </button>
          <button
            onClick={() => trySanitize("browser")}
            className="border-2 border-gray-500 px-6 py-2 text-gray-300 transition-colors hover:border-gray-300"
          >
            Try Browser Render
          </button>
        </div>
      )}

      {state === "loading" && (
        <p className="mt-6 animate-pulse text-gray-400">
          {method === "ai"
            ? "AI is analyzing your URL..."
            : "Browser is testing parameters..."}
        </p>
      )}

      {state === "error" && (
        <p className="text-rose-450 mt-6">
          {method === "ai" ? "AI" : "Browser"} sanitization failed.
        </p>
      )}

      {state === "success" && result && (
        <div className="mt-6">
          <p className="text-lime-550">
            {method === "ai" && result.confidence !== undefined
              ? `AI suggestion (confidence: ${Math.round(result.confidence * 100)}%):`
              : "Browser-verified suggestion:"}
          </p>
          <div className="relative mt-2">
            <LinkBox
              readOnly
              value={result.sanitizedUrl}
              className="border-lime-200 pr-14 text-lime-200"
              onClick={handleCopy}
            />
          </div>
          {copyState && <p className="text-lime-550 mt-2">Copied!</p>}

          {result.removedParams.length > 0 && (
            <p className="mt-4 text-sm text-gray-400">
              Removed: {result.removedParams.join(", ")}
            </p>
          )}

          {result.suggestedRule && (
            <div className="mt-4 border border-gray-700 p-4">
              <p className="text-sm text-gray-300">Suggested rule:</p>
              <pre className="mt-2 overflow-auto text-xs text-gray-400">
                {JSON.stringify(result.suggestedRule, null, 2)}
              </pre>
              <a
                href={buildGitHubIssueUrl(originalUrl, result)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block border-2 border-gray-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-300"
              >
                Submit Rule to GitHub
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function buildGitHubIssueUrl(
  originalUrl: string,
  result: SanitizeResult,
): string {
  const domain = new URL(originalUrl).hostname;
  const title = `Rule request: ${domain}`;

  const body = `## URL
\`${originalUrl}\`

## Suggested Sanitized URL
\`${result.sanitizedUrl}\`

## Removed Parameters
${result.removedParams.length > 0 ? result.removedParams.map((p) => `- \`${p}\``).join("\n") : "None"}

## Suggested Rule
\`\`\`yaml
${domain}:
  sanitize:
    - pattern: "${result.suggestedRule?.pattern || "^/.*$"}"
      allowedParams: [${result.suggestedRule?.allowedParams.map((p) => `"${p}"`).join(", ") || ""}]
\`\`\`
`;

  const params = new URLSearchParams({
    title,
    body,
    labels: "rule-request",
  });

  return `https://github.com/Tail-WTF/Website/issues/new?${params}`;
}
