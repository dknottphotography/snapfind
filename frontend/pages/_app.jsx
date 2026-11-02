import Head from "next/head";
import { useRouter } from "next/router";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  // The couple's gallery is a standalone page with its own design.
  // It does not share SnapFind's chrome (film grain, dark theme shell).
  const standalone = router.pathname === "/couple-gallery";

  return (
    <>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Unbounded:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </Head>
      {standalone ? (
        <Component {...pageProps} />
      ) : (
        <div className="grain">
          <Component {...pageProps} />
        </div>
      )}
    </>
  );
}
