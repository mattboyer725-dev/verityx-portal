import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCloudSqlUrlToEnv,
  durableDatabaseRequired,
  resolvePostgresUrl,
} from "./postgres-url.ts";

describe("postgres url", () => {
  it("passes Neon URLs through and rewrites Cloud SQL to a unix socket", () => {
    assert.equal(resolvePostgresUrl({}), undefined);
    assert.equal(
      resolvePostgresUrl({ DATABASE_URL: "postgresql://vx:s3cret@ep-neon.aws.neon.tech/verityx?sslmode=require" }),
      "postgresql://vx:s3cret@ep-neon.aws.neon.tech/verityx?sslmode=require",
    );
    assert.equal(
      resolvePostgresUrl({
        DATABASE_URL: "postgresql://vx:s3cret@127.0.0.1:5432/verityx",
        CLOUD_SQL_CONNECTION_NAME: "acme-prod:us-central1:verityx-pg",
      }),
      "postgresql://vx:s3cret@/verityx?host=%2Fcloudsql%2Facme-prod%3Aus-central1%3Averityx-pg",
    );
    const already =
      "postgresql://vx:s3cret@/verityx?host=/cloudsql/acme-prod:us-central1:verityx-pg";
    assert.equal(
      resolvePostgresUrl({
        DATABASE_URL: already,
        CLOUD_SQL_CONNECTION_NAME: "acme-prod:us-central1:verityx-pg",
      }),
      already,
    );
    const encoded =
      "postgresql://vx:s3cret@/verityx?host=%2Fcloudsql%2Facme-prod%3Aus-central1%3Averityx-pg";
    assert.equal(
      resolvePostgresUrl({
        DATABASE_URL: encoded,
        CLOUD_SQL_CONNECTION_NAME: "acme-prod:us-central1:verityx-pg",
      }),
      encoded,
    );
    assert.equal(
      resolvePostgresUrl({
        DATABASE_URL: "postgresql://vx:s3cret@/verityx",
        CLOUD_SQL_CONNECTION_NAME: "acme-prod:us-central1:verityx-pg",
      }),
      "postgresql://vx:s3cret@/verityx?host=%2Fcloudsql%2Facme-prod%3Aus-central1%3Averityx-pg",
    );
  });

  it("writes the socket URL back onto DATABASE_URL for Better Auth's pool", () => {
    const env: NodeJS.Dict<string> = {
      DATABASE_URL: "postgresql://vx:s3cret@/verityx",
      CLOUD_SQL_CONNECTION_NAME: "acme-prod:us-central1:verityx-pg",
    };
    const resolved = applyCloudSqlUrlToEnv(env);
    assert.equal(env.DATABASE_URL, resolved);
    assert.match(env.DATABASE_URL ?? "", /cloudsql/);
    assert.equal(applyCloudSqlUrlToEnv(env), resolved);
  });

  it("does not rewrite when Cloud SQL is not configured", () => {
    const env: NodeJS.Dict<string> = {
      DATABASE_URL: "postgresql://vx:s3cret@ep-neon.aws.neon.tech/verityx?sslmode=require",
    };
    assert.equal(applyCloudSqlUrlToEnv(env), env.DATABASE_URL);
  });

  it("requires a durable database on Google Cloud", () => {
    assert.equal(durableDatabaseRequired({}), false);
    assert.equal(durableDatabaseRequired({ GCP_RUNTIME: "1" }), true);
    assert.equal(durableDatabaseRequired({ REQUIRE_DATABASE: "1" }), true);
  });
});
