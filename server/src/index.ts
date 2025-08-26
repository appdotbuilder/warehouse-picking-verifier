import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  createUserInputSchema,
  createMofInputSchema,
  createItemInputSchema,
  scanItemInputSchema,
  verifyItemInputSchema,
  updateMofStatusInputSchema,
  getMofBySerialInputSchema,
  getMofProgressInputSchema
} from './schema';
import { z } from 'zod';

// Import handlers
import { createUser } from './handlers/create_user';
import { createMof } from './handlers/create_mof';
import { createItem } from './handlers/create_item';
import { getMofBySerial } from './handlers/get_mof_by_serial';
import { getMofProgress } from './handlers/get_mof_progress';
import { scanItem } from './handlers/scan_item';
import { verifyItem } from './handlers/verify_item';
import { updateMofStatus } from './handlers/update_mof_status';
import { getAllMofs } from './handlers/get_all_mofs';
import { getUserMofs } from './handlers/get_user_mofs';
import { getAllItems } from './handlers/get_all_items';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  // MOF management
  createMof: publicProcedure
    .input(createMofInputSchema)
    .mutation(({ input }) => createMof(input)),

  getMofBySerial: publicProcedure
    .input(getMofBySerialInputSchema)
    .query(({ input }) => getMofBySerial(input)),

  getMofProgress: publicProcedure
    .input(getMofProgressInputSchema)
    .query(({ input }) => getMofProgress(input)),

  getAllMofs: publicProcedure
    .query(() => getAllMofs()),

  getUserMofs: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserMofs(input.userId)),

  updateMofStatus: publicProcedure
    .input(updateMofStatusInputSchema)
    .mutation(({ input }) => updateMofStatus(input)),

  // Item management
  createItem: publicProcedure
    .input(createItemInputSchema)
    .mutation(({ input }) => createItem(input)),

  getAllItems: publicProcedure
    .query(() => getAllItems()),

  // Picker flow
  scanItem: publicProcedure
    .input(scanItemInputSchema)
    .mutation(({ input }) => scanItem(input)),

  // Requester verification flow
  verifyItem: publicProcedure
    .input(verifyItemInputSchema)
    .mutation(({ input }) => verifyItem(input))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();