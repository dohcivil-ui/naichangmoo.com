import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";
import { getDb } from "@/db";
import * as dbSchema from "@/db/schema";

const lineEnabled = Boolean(process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      ...dbSchema.schema,
      user: dbSchema.users,
      session: dbSchema.sessions,
      account: dbSchema.accounts,
      verification: dbSchema.verifications
    }
  }),
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, prompt: "select_account" }
    } : {}),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? {
      facebook: { clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET }
    } : {})
  },
  plugins: [
    ...(lineEnabled ? [genericOAuth({
      config: [{
        providerId: "line",
        clientId: process.env.LINE_CLIENT_ID as string,
        clientSecret: process.env.LINE_CLIENT_SECRET as string,
        authorizationUrl: "https://access.line.me/oauth2/v2.1/authorize",
        tokenUrl: "https://api.line.me/oauth2/v2.1/token",
        userInfoUrl: "https://api.line.me/v2/profile",
        scopes: ["openid", "profile", "email"]
      }]
    })] : []),
    nextCookies()
  ]
});
