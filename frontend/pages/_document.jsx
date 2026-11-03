import { Html, Head, Main, NextScript } from "next/document";

// Sets the theme (dark by default, or the visitor's saved choice) on
// <html data-theme> before first paint, so there's no flash of the
// wrong theme. The standalone couple's gallery never reads this —
// it is always its own light design.
const themeInit = `(function(){try{var t=localStorage.getItem("snapfind-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function Document() {
  return (
    <Html lang="en" data-theme="dark">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
