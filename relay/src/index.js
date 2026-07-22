// JuScript relay — passes messages between the prompter and its remote.
// Nothing is stored; a room only exists while devices are connected to it.

export class Room {
  constructor(state, env) {
    this.sessions = new Set();
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();
    this.sessions.add(server);

    server.addEventListener('message', (e) => {
      for (const s of this.sessions) {
        if (s !== server) { try { s.send(e.data); } catch (err) {} }
      }
    });

    const drop = () => { this.sessions.delete(server); this.announce(); };
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);

    this.announce();
    return new Response(null, { status: 101, webSocket: client });
  }

  announce() {
    const msg = JSON.stringify({ t: 'peers', n: this.sessions.size });
    for (const s of this.sessions) { try { s.send(msg); } catch (err) {} }
  }
}

export default {
  async fetch(request, env) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('JuScript relay is running.', {
        headers: { 'content-type': 'text/plain' }
      });
    }
    const code = (new URL(request.url).searchParams.get('room') || '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (code.length < 4) return new Response('bad room code', { status: 400 });
    return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
  }
};
