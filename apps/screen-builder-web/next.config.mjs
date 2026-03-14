/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@pebble/sdui-contract'],
  async headers() {
    return [
      {
        // Enable SharedArrayBuffer for the WASM emulator (needed by Emscripten pthreads).
        // Applied to all routes because the parent page must also be cross-origin isolated
        // for SharedArrayBuffer to work in the emulator iframe.
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

export default nextConfig
