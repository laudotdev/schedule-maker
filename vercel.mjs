import { deploymentEnv, routes } from "@vercel/config/v1";

export const config = {
  rewrites: [
    routes.rewrite(
      "/api/schedule",
      `${deploymentEnv("BACKEND_URL")}/api/schedule`,
    ),
  ],
};
