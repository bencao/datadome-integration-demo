import Document, { Html, Head, Main, NextScript } from "next/document";

const DATADOME_CLIENT_KEY = "C635DB61AA5694C440E70ECEFA127D";

function Datadome() {
  /* Datadome Integration */
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
              !function (a, b, c, d, e, f){
                a.ddjskey = e;
                a.ddoptions = f || null;
                var m = b.createElement(c), n = b.getElementsByTagName(c)[0];
                m.async = 1, m.src = d, n.parentNode.insertBefore(m, n);
              }(window,
                document,
                "script",
                "https://js.datadome.co/tags.js",
                "${DATADOME_CLIENT_KEY}",
                { ajaxListenerPath: true }
              );
            `
      }}
    />
  );
}

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <link rel="manifest" href="/site.webmanifest" />
        </Head>
        <body>
          <Main />
          <NextScript />
          <Datadome />
        </body>
      </Html>
    );
  }
}
