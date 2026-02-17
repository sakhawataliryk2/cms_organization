import { Html, Head, Main, NextScript } from "next/document";

/**
 * Minimal _document for Next.js when using App Router.
 * Kept so that any internal or legacy code paths that request /_document can resolve.
 * The actual document structure is controlled by app/layout.tsx.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
