const { Room, Client } = require('colyseus');
const { Schema, MapSchema, type } = require('@colyseus/schema');

class Player extends Schema {
  @type('string') name = '';
  @type('number') x = Math.floor(Math.random() * 10) - 5;
  @type('number') y = 0.9;
  @type('number') z = Math.floor(Math.random() * 10) - 5;
  @type('number') rot = 0;
}

class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema();
}

class MyRoom extends Room {
  onCreate(options) {
    this.setState(new MyRoomState());

    this.onMessage('updatePosition', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
      player.rot = data.rot;
    });
  }

  onJoin(client, options) {
    console.log(client.sessionId, 'joined!');
    const player = new Player();
    player.name = options.name || 'Guest';
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client, consented) {
    console.log(client.sessionId, 'left!');
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log('room', this.roomId, 'disposing...');
  }
}

module.exports = { MyRoom };