// Module augmentation to register file routes with TanStack Router's type system.
// This allows createFileRoute('/path') calls to type-check correctly.
// Run `npm run dev` to regenerate routeTree.gen.ts with complete type information.
declare module '@tanstack/router-core' {
  interface FileRoutesByPath {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: any; parentRoute: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    '/flows': {
      id: '/flows';
      path: '/flows';
      fullPath: '/flows';
      preLoaderRoute: any;
      parentRoute: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    '/prompts': {
      id: '/prompts';
      path: '/prompts';
      fullPath: '/prompts';
      preLoaderRoute: any;
      parentRoute: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    '/sessions': {
      id: '/sessions';
      path: '/sessions';
      fullPath: '/sessions';
      preLoaderRoute: any;
      parentRoute: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    '/settings': {
      id: '/settings';
      path: '/settings';
      fullPath: '/settings';
      preLoaderRoute: any;
      parentRoute: any;
    };
  }
}
