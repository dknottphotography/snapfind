import { Html, Head, Main, NextScript } from "next/document";

// SnapFind is light-theme only (dark mode removed 2026-11-07 at the
// owner's request). Pin <html data-theme="light"> before first paint so
// no visitor ever sees a dark flash, whatever they had saved before.
const themeInit = `document.documentElement.dataset.theme="light";`;

export default function Document() {
  return (
    <Html lang="en" data-theme="light">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
