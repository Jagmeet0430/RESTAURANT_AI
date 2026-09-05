import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  findPostgresTool,
  runBackup,
  runPostgresTool,
} from "./backupDatabase.js";

const { dbConfig } = await import("../src/config/index.js");
const { Pool } = pg;

const EXPECTED_TABLES = [
  "admins",
  "categories",
  "menu",
  "customers",
  "orders",
  "order_items",
  "counter_sales",
  "counter_sale_items",
  "inventory",
  "inventory_transactions",
  "products",
  "payments",
  "coupons",
  "schema_migrations",
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    backupPath: "",
    test: false,
    yes: false,
    target: dbConfig.database,
    keepTestDb: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--test") {
      options.test = true;
    } else if (arg === "--yes") {
      options.yes = true;
    } else if (arg === "--keep-test-db") {
      options.keepTestDb = true;
    } else if (arg === "--target") {
      options.target = args[index + 1];
      index += 1;
    } else if (!options.backupPath) {
      options.backupPath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
};

const usage = () => {
  console.log("Usage:");
  console.log('  node scripts/restoreDatabase.js "path\\file.dump" --test --yes');
  console.log('  node scripts/restoreDatabase.js "path\\file.dump" --target restaurant_db');
};

const assertBackupFile = async (backupPath) => {
  if (!backupPath) {
    usage();
    throw new Error("Backup path is required.");
  }

  const resolved = path.resolve(backupPath);
  const stats = await fs.stat(resolved).catch(() => null);

  if (!stats?.isFile()) {
    throw new Error(`Backup file does not exist: ${resolved}`);
  }

  if (stats.size <= 0) {
    throw new Error(`Backup file is empty: ${resolved}`);
  }

  return resolved;
};

const validateBackup = async (backupPath) => {
  const pgRestore = await findPostgresTool("pg_restore");
  await runPostgresTool(pgRestore, ["--list", backupPath]);
  return pgRestore;
};

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;

const adminDb = () => process.env.PGADMIN_DB || "postgres";

const psqlArgs = (databaseName, sql) => [
  "-h",
  dbConfig.host,
  "-p",
  String(dbConfig.port),
  "-U",
  dbConfig.user,
  "-d",
  databaseName,
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  sql,
];

const terminateConnections = async (databaseName) => {
  const psql = await findPostgresTool("psql");
  await runPostgresTool(
    psql,
    psqlArgs(
      adminDb(),
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${sqlString(databaseName)} AND pid <> pg_backend_pid();`
    )
  );
};

const dropDatabase = async (databaseName) => {
  if (databaseName === dbConfig.database) {
    throw new Error(`Refusing to drop active database ${databaseName}.`);
  }

  const dropdb = await findPostgresTool("dropdb");
  await terminateConnections(databaseName);
  await runPostgresTool(dropdb, [
    "-h",
    dbConfig.host,
    "-p",
    String(dbConfig.port),
    "-U",
    dbConfig.user,
    "--if-exists",
    databaseName,
  ]);
};

const createDatabase = async (databaseName) => {
  const createdb = await findPostgresTool("createdb");
  await runPostgresTool(createdb, [
    "-h",
    dbConfig.host,
    "-p",
    String(dbConfig.port),
    "-U",
    dbConfig.user,
    databaseName,
  ]);
};

const restoreIntoDatabase = async (pgRestore, backupPath, databaseName, clean = false) => {
  const args = [
    "-h",
    dbConfig.host,
    "-p",
    String(dbConfig.port),
    "-U",
    dbConfig.user,
    "-d",
    databaseName,
    "--no-owner",
    "--no-privileges",
  ];

  if (clean) {
    args.push("--clean", "--if-exists");
  }

  args.push(backupPath);
  await runPostgresTool(pgRestore, args);
};

const makePool = (databaseName) =>
  new Pool({
    host: dbConfig.host,
    port: Number(dbConfig.port),
    database: databaseName,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: false,
    max: 2,
  });

const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

const tableExists = async (pool, tableName) => {
  const result = await pool.query("SELECT to_regclass($1) AS table_name", [
    `public.${tableName}`,
  ]);
  return Boolean(result.rows[0]?.table_name);
};

const countRows = async (pool, tableName) => {
  if (!(await tableExists(pool, tableName))) {
    return null;
  }

  const result = await pool.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(tableName)}`);
  return Number(result.rows[0].count);
};

const scalar = async (pool, sql) => {
  try {
    const result = await pool.query(sql);
    return Number(result.rows[0]?.value || 0);
  } catch {
    return null;
  }
};

const collectSnapshot = async (databaseName) => {
  const pool = makePool(databaseName);
  try {
    const tables = {};
    for (const table of EXPECTED_TABLES) {
      tables[table] = await countRows(pool, table);
    }

    const aggregates = {
      orders_revenue: await scalar(
        pool,
        "SELECT COALESCE(SUM(total_amount), 0)::numeric AS value FROM orders"
      ),
      counter_sales_revenue: await scalar(
        pool,
        "SELECT COALESCE(SUM(total_amount), 0)::numeric AS value FROM counter_sales"
      ),
    };

    aggregates.combined_revenue =
      aggregates.orders_revenue === null || aggregates.counter_sales_revenue === null
        ? null
        : aggregates.orders_revenue + aggregates.counter_sales_revenue;

    return { tables, aggregates };
  } finally {
    await pool.end();
  }
};

const compareSnapshots = (original, restored) => {
  const tableResults = EXPECTED_TABLES.map((table) => ({
    table,
    original: original.tables[table],
    restored: restored.tables[table],
    match: original.tables[table] === restored.tables[table],
  }));

  const aggregateResults = Object.keys(original.aggregates).map((name) => ({
    name,
    original: original.aggregates[name],
    restored: restored.aggregates[name],
    match: original.aggregates[name] === restored.aggregates[name],
  }));

  return {
    tableResults,
    aggregateResults,
    ok:
      tableResults.every((result) => result.match) &&
      aggregateResults.every((result) => result.match),
  };
};

const confirmRestore = async (target) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      `Type RESTORE ${target} to overwrite database ${target}: `
    );
    return answer.trim() === `RESTORE ${target}`;
  } finally {
    rl.close();
  }
};

const restoreTest = async (pgRestore, backupPath, testDbName, keepTestDb = false) => {
  if (testDbName === dbConfig.database) {
    throw new Error("Temporary restore database cannot match the active database.");
  }

  await dropDatabase(testDbName);
  await createDatabase(testDbName);

  try {
    await restoreIntoDatabase(pgRestore, backupPath, testDbName);
    const original = await collectSnapshot(dbConfig.database);
    const restored = await collectSnapshot(testDbName);
    const reconciliation = compareSnapshots(original, restored);

    console.log("Temporary restore completed.");
    console.log(`Temporary database: ${testDbName}`);
    console.log("Table reconciliation:");
    for (const result of reconciliation.tableResults) {
      console.log(
        `- ${result.table}: original=${result.original} restored=${result.restored} match=${result.match}`
      );
    }
    console.log("Revenue reconciliation:");
    for (const result of reconciliation.aggregateResults) {
      console.log(
        `- ${result.name}: original=${result.original} restored=${result.restored} match=${result.match}`
      );
    }

    if (!reconciliation.ok) {
      throw new Error("Restore reconciliation failed.");
    }

    return reconciliation;
  } finally {
    if (!keepTestDb) {
      await dropDatabase(testDbName);
      console.log(`Temporary database dropped: ${testDbName}`);
    }
  }
};

const main = async () => {
  const options = parseArgs();
  const backupPath = await assertBackupFile(options.backupPath);
  const pgRestore = await validateBackup(backupPath);
  const testDbName = `${dbConfig.database}_restore_test`;

  console.log("RestaurantAI restore validation");
  console.log(`Backup: ${backupPath}`);
  console.log(`Target database: ${options.test ? testDbName : options.target}`);
  console.log("Backup list: readable");

  if (options.test) {
    await restoreTest(pgRestore, backupPath, testDbName, options.keepTestDb);
    console.log("Restore test passed.");
    return;
  }

  if (options.target !== dbConfig.database) {
    throw new Error(`Target must be the configured local database: ${dbConfig.database}`);
  }

  if (!options.yes && !(await confirmRestore(options.target))) {
    throw new Error("Restore cancelled.");
  }

  console.log("Creating safety backup before target restore...");
  const safetyBackup = await runBackup();
  console.log(`Safety backup created: ${safetyBackup.backupPath}`);

  console.log("Validating source backup in temporary database before target restore...");
  await restoreTest(pgRestore, backupPath, testDbName);

  console.log(`Restoring into target database: ${options.target}`);
  await terminateConnections(options.target);
  await restoreIntoDatabase(pgRestore, backupPath, options.target, true);
  console.log("Target restore completed.");
};

try {
  if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
  }
} catch (error) {
  console.error(`Restore failed: ${error.message}`);
  process.exitCode = 1;
}
