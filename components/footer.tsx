import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-24 flex w-full py-4 text-gray-500">
      <nav>
        <ul className="flex gap-12">
          <li>
            <a
              href="https://github.com/Tail-WTF/Website"
              target="_blank"
              rel="noreferrer"
            >
              <span>GitHub</span>
            </a>
          </li>
          <DesktopNavItem href={"/#about"}>About</DesktopNavItem>
          <DesktopNavItem href={"/#privacy"}>Privacy</DesktopNavItem>
        </ul>
      </nav>
      <div className="grow"></div>
      <div>
        <Link href={"/"}>Tail.WTF</Link>
      </div>
    </footer>
  );
}

function DesktopNavItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li className="hidden md:inline">
      <Link href={href}>{children}</Link>
    </li>
  );
}
