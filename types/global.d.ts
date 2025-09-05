// Extend the Window interface to include electron and other globals
interface Window {
  electron?: {
    // Add any electron-specific methods you expose via contextBridge
  };
}

declare module 'jspdf' {
  class jsPDF {
    constructor(options?: any);
    text(text: string, x: number, y: number, options?: any): jsPDF;
    save(filename?: string): void;
    autoTable: (options: any) => void;
    setFontSize(size: number): jsPDF;
    setTextColor(color: number | number[]): jsPDF;
    setPage(n: number): jsPDF;
    internal: {
      pageSize: {
        width: number;
        height: number;
        getWidth(): number;
        getHeight(): number;
      };
      getNumberOfPages(): number;
      getCurrentPageInfo(): { pageNumber: number };
    };
  }
  export = jsPDF;
}

declare module 'jspdf-autotable' {
  interface AutoTableOptions {
    head?: any[][];
    body?: any[][];
    startY?: number;
    styles?: any;
    headStyles?: any;
    alternateRowStyles?: any;
    margin?: any;
    didDrawPage?: (data: any) => void;
  }

  export default function autoTable(doc: any, options: AutoTableOptions): void;
}

// Declare Node.js built-in modules for browser polyfills
declare module 'path-browserify' {
  import path from 'path';
  export = path;
}

declare module 'os-browserify/browser' {
  const os: {
    platform: () => string;
    release: () => string;
  };
  export = os;
}

declare module 'crypto-browserify' {
  const crypto: any;
  export = crypto;
}

declare module 'stream-browserify' {
  import { Readable, Writable, Duplex, Transform } from 'stream';
  export { Readable, Writable, Duplex, Transform };
}

declare module 'stream-http' {
  const http: any;
  export = http;
}

declare module 'https-browserify' {
  import https from 'https';
  export = https;
}

declare module 'browserify-zlib' {
  const zlib: any;
  export = zlib;
}

declare module 'url' {
  import { URL, URLSearchParams } from 'url';
  export { URL, URLSearchParams };
}

declare module 'assert' {
  const assert: any;
  export = assert;
}

declare module 'util' {
  const util: any;
  export = util;
}

declare module 'buffer' {
  const Buffer: any;
  export { Buffer };
}

declare module 'process/browser' {
  const process: any;
  export = process;
}
