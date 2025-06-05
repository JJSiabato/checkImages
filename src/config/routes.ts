export const routes = [
  {
    method: 'post',
    path: '/check-images',
    handler: 'checkImages.checkImages',
    middlewares: ['logger'],
  },
];
