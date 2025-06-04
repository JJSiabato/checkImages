export const routes = [
  {
    method: 'get',
    path: '/saludo',
    handler: 'saludoHandler.handleSaludo',
    middlewares: ['logger'],
  },
  {
    method: 'post',
    path: '/check-images',
    handler: 'checkImages.checkImages',
    middlewares: ['logger'],
  },
];
