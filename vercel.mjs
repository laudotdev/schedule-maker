const backendUrl = process.env.BACKEND_URL?.replace(/\/+$/, "");

if (!backendUrl) {
  throw new Error("Set BACKEND_URL in the Vercel project environment variables.");
}

export const config = {
  rewrites: [
    {
      source: "/api/schedule",
      destination: `${backendUrl}/api/schedule`,
    },
  ],
};
