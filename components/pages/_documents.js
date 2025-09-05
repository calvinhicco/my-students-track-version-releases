
// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        {/* jsPDF CDN fallback */}
        <script src="https://cdn.jsdelivr.net/npm/jspdf@3.0.1/dist/jspdf.umd.min.js"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}