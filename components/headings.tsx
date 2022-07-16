/**
 * Standard headings
 */

export function H1({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`text-lg font-extrabold md:text-xl ${className}`}>
      {children}
    </h1>
  );
}

export function H2({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`text-lg text-gray-500 md:text-xl ${className}`}>
      {children}
    </h2>
  );
}
