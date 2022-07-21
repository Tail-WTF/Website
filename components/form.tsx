import { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

/**
 * The main input component used in many pages to hold URL input/output.
 */
export function LinkBox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      name="url"
      spellCheck="false"
      autoCorrect="off"
      autoComplete="off"
      autoCapitalize="off"
      {...props} // Pass through other props...
      className={`w-full overflow-hidden text-ellipsis rounded-none border-2 bg-transparent px-4 py-3 text-lg italic focus:overflow-x-auto focus:outline-none md:text-xl ${props.className}`}
    />
  );
}

/**
 * The main button component used for the primary action on a page.
 */
export function ActionBtn(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex items-center border-2 border-gray-700 fill-gray-700 py-3 px-8 text-lg font-bold italic text-gray-700 md:text-xl ${props.className}`}
    />
  );
}
