(function (global) {
  'use strict';

  class WaterWorld extends GameWorld {

    /**
     * World object contains many agents and walls and food and stuff
     * @extends GameWorld
     * @constructor
     *
     * @return {WaterWorld}
     */
    constructor() {
      let worldOpts = {
          collision: {
            type: 'brute',
            cheats: {
              brute: false,
              quad: false,
              grid: false,
              walls: false
            },
          },
          grid: {
            width: 800,
            height: 800,
            buffer: 0,
            cellSize: 100,
            cellSpacing: 0,
            size: 4,
            pointy: false,
            fill: false
          },
          render: {
            background: 0xFFFFFF,
            antialiasing: true,
            autoResize: false,
            resizable: false,
            transparent: false,
            resolution: 1,
            noWebGL: false,
            width: 800,
            height: 800
          },
          cheats: {
            id: true,
            name: false,
            angle: false,
            bounds: false,
            direction: false,
            gridLocation: false,
            position: false,
            brute: false,
            quad: false,
            grid: false,
            walls: false
          },
          agent: {
            brainType: 'RL.DQNAgent',
            range: 85,
            proximity: 85,
            radius: 10,
            numEyes: 30,
            numTypes: 5,
            numActions: 4,
            numProprioception: 2,
            worker: false,
            interactive: true,
            useSprite: false,
            cheats: {
              id: true,
              name: false,
              angle: false,
              bounds: false,
              direction: false,
              gridLocation: false,
              position: false,
              brute: false,
              quad: false,
              grid: false,
              walls: false
            }
          },
          entity: {
            number: 30,
            radius: 10,
            interactive: true,
            useSprite: false,
            moving: true,
            cheats: {
              id: false,
              name: false,
              angle: false,
              bounds: false,
              direction: false,
              gridLocation: false,
              position: false,
              brute: false,
              quad: false,
              grid: false,
              walls: false
            }
          },
          entityAgent: {
            number: 0,
            radius: 0,
            interactive: true,
            useSprite: false,
            moving: true
          }
        },
        grid = new Grid(null, null, worldOpts.grid),
        maze = new Maze(grid.init());
      worldOpts.agent.cheats = worldOpts.cheats;
      let agents = [
          new Agent(new Vec(grid.cells[0].center.x, grid.cells[0].center.y), worldOpts.agent),
          new Agent(new Vec(grid.cells[0].center.x, grid.cells[0].center.y), worldOpts.agent)
        ];
      worldOpts.grid = grid;
      worldOpts.maze = maze;

      super(agents, [], worldOpts);
      this.agents[0].load('zoo/wateragent.json');
      //this.agents[1].load('zoo/wateragent.json');

      // var line = new Line([200, 150, 0, 0]);
      // this.stage.addChild(line);
      // window.addEventListener("mousemove", (e) => {
      //   line.updatePoints([null, null, e.clientX, e.clientY]);
      // }, false);

      if (document.getElementById('flotreward')) {
        this.rewards = new FlotGraph(this.agents);
      }
      this.init();

      return this;
    }

  }
  global.WaterWorld = WaterWorld;

}(this));
