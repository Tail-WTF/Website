import Link from "next/link";

export default function Footer() {
  return (
    <footer className="flex w-full py-4 text-gray-500">
      <nav className="flex gap-12">
        <a
          href="https://github.com/Tail-WTF/Website"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <Link href={"/#about"}>
          <a>About</a>
        </Link>
        <Link href={"/#privacy"}>
          <a>Privacy</a>
        </Link>
      </nav>
      <div className="flex-grow"></div>
      <div className="">
        {new Date().getFullYear() + " "}
        <Link href={"/"}>
          <a>Tail.WTF</a>
        </Link>
      </div>
    </footer>
  );
}
