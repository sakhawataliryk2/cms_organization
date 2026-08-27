declare module "undici" {
  export class Agent {
    constructor(options?: {
      connections?: number;
      pipelining?: number;
      keepAliveTimeout?: number;
      keepAliveMaxTimeout?: number;
    });
  }
}
