import { Context } from 'koa';

export async function handleSaludo(ctx: Context) {
  ctx.body = { mensaje: '¡Hola desde un handler modular!' };
}
