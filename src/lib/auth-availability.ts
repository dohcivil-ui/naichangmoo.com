type AuthEnvironment = {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
};

export function isAuthRuntimeConfigured(environment?: AuthEnvironment) {
  const source = environment ?? {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL
  };
  return Boolean(source.DATABASE_URL && source.BETTER_AUTH_SECRET && source.BETTER_AUTH_URL);
}
