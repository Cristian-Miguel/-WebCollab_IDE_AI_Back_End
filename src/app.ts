// import { Server } from './server';

// function main() {
//     const server = new Server();
//     server.listen();
// }

// main();
import { Server } from './server';

const server = new Server();

export const app = server.getApp(); 

if (process.env.NODE_ENV !== 'test') {
    server.listen();
}