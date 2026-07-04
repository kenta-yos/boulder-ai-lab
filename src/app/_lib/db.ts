// データベース接続の共通クライアント（Prisma）。
// 開発中の再読み込みで接続が増えすぎないよう、1つを使い回す。
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// PostgreSQL(Neon)への接続アダプタ。接続先は環境変数 DATABASE_URL。
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
