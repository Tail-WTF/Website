import {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  InputHTMLAttributes,
} from "react";

/**
 * The main input component used in many pages to hold URL input/output.
 */
export function LinkBox(props: InputHTMLAttributes<HTMLInputElement>) {
  let className =
    "w-full overflow-hidden text-ellipsis rounded-none border-2 bg-transparent px-4 py-3 text-lg italic focus:overflow-x-auto focus:outline-none md:text-xl";
  if (props.className) className += ` ${props.className}`;

  const baseProps: InputHTMLAttributes<HTMLInputElement> = {
    name: "url",
    spellCheck: "false",
    autoCorrect: "off",
    autoComplete: "off",
    autoCapitalize: "off",
    ...props, // Pass through other props...
    className, // Except this need to be combined with base styles.
  };

  return <input {...baseProps} />;
}

/**
 * The main button component used for the primary action on a page.
 */
export function ActionBtn(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  let className = "border-2 italic border-gray-700 py-3 px-8 text-gray-700";
  if (props.className) className += ` ${props.className}`;

  const baseProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    ...props, // Pass through other props...
    className, // Except this need to be combined with base styles.
  };

  return <button {...baseProps} />;
}
