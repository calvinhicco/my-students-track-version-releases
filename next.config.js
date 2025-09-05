/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "out",
  trailingSlash: true,
  assetPrefix: "./",
  basePath: "",

  // Remove headers since they don't work with static export
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // Enable experimental features for better module handling
  experimental: {
    esmExternals: 'loose',
    serverComponentsExternalPackages: ['jspdf', 'jspdf-autotable'],
    externalDir: true,
  },

  // Webpack configuration
  webpack: (config, { isServer, webpack }) => {
    // Add client-side polyfills
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify/browser'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        zlib: require.resolve('browserify-zlib'),
        url: require.resolve('url/'),
        assert: require.resolve('assert/'),
        util: require.resolve('util/'),
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser'),
      };

      // Add polyfills
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    // Handle PDF files
    config.module.rules.push({
      test: /\.(pdf)$/i,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });

    // Exclude problematic modules from being processed
    config.externals = config.externals || [];
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'os': 'commonjs os',
      'electron': 'commonjs electron',
      'fs': 'commonjs fs',
      'path': 'commonjs path',
      'child_process': 'commonjs child_process',
    });

    // Add resolve aliases for browser-compatible modules
    config.resolve.alias = {
      ...config.resolve.alias,
      'jspdf': 'jspdf/dist/jspdf.es.min.js',
    };

    // Handle process.env
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      })
    );

    return config;
  },
}

module.exports = nextConfig
