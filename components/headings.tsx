/**
 * Standard headings
 */

export function H1({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 id={id} className={`text-lg font-extrabold md:text-xl ${className}`}>
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
    <h2 className={`text-md text-gray-500 md:text-xl ${className}`}>
      {children}
    </h2>
  );
}
