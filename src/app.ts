import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

import { routes } from './config/routes';
import * as middlewares from './middleware';

const app = new Koa();
const router = new Router();

// Middleware global
app.use(bodyParser());

// Rutas desde la config
routes.forEach(route => {
  const handlerFn = getHandlerFunction(route.handler);
  const middlewareFns = (route.middlewares || []).map(name => (middlewares as any)[name]);

  (router as any)[route.method](route.path, ...middlewareFns, handlerFn);
});

app.use(router.routes());
app.use(router.allowedMethods());

export default app;

// Utilidad para obtener el handler desde string "modulo.función"
function getHandlerFunction(path: string) {
  const [mod, fn] = path.split('.');
  const modRef = require(`./handlers/${mod}`);
  return modRef[fn];
}
