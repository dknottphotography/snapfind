import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Unbounded:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="grain">
        <Component {...pageProps} />
      </div>
    </>
  );
}
