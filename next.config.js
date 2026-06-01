/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mantém a sua configuração do webpack se precisar dela no futuro...
  webpack: (config) => config,
  
  // ...e adicionamos isso aqui para silenciar o erro do Turbopack
  turbopack: {}, 

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;