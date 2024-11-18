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
      className={`w-full text-ellipsis rounded-none border-2 bg-transparent p-4 text-lg italic focus:outline-none md:text-xl ${props.className}`}
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
      className={`flex items-center border-2 border-gray-700 fill-gray-700 px-8 py-3 text-lg font-bold italic text-gray-700 focus:border-gray-300 focus:outline-none md:text-xl ${props.className}`}
    />
  );
}
