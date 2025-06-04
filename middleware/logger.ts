import { Context, Next } from 'koa';

export async function logger(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const time = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${time}ms`);
}
